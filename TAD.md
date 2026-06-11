# Technical Architecture Decisions — confluence-bot-app

House convention: no code comments or docstrings. Every design decision and its rationale lives here.

## Purpose

A thin public console over the [mcp-confluence-documentation-rag](https://github.com/HoodieYlya13/mcp-confluence-documentation-rag) server. Two jobs:

1. **Overview** — live `/health` and Prometheus `/metrics` from the deployed Space, rendered as a dashboard.
2. **RBAC playground** — the same question asked through two MCP sessions holding different bearer tokens, results side by side, restricted chunks highlighted.

The app is deliberately thin. The engineering story (4-layer RBAC, ACL pushdown, eval gates) lives server-side; this is the window that lets a reviewer experience it without installing an MCP client.

## Decisions

### All upstream calls are server-side; tokens never reach the browser

Route handlers and server components are the only places that talk to the MCP server. The two demo bearer tokens live in environment variables (`MCP_TOKEN_JUNIOR_OP`, `MCP_TOKEN_ATS_CORE_LEAD`) read inside `lib/mcp.ts`, which is guarded by `server-only` so any accidental client import fails the build. The browser only ever sees this app's own `/api/*` surface.

### Real MCP client, not a REST shim

`lib/mcp.ts` uses the official `@modelcontextprotocol/sdk` `Client` over `StreamableHTTPClientTransport`, performing the full initialize → tool-call → close handshake per request. A raw `fetch` to a bespoke endpoint would have been less code, but exercising the actual protocol means the project demonstrates both an MCP server (Python) and an MCP client (TypeScript). Connections are per-request rather than pooled: the playground is low-traffic by design and a stateless handler survives serverless cold starts.

### One `/api/search` call fans out to both roles

The comparison is the product, so the server runs both role sessions in parallel (`Promise.allSettled`) and returns a per-role result envelope. This charges the rate limiter once per comparison, keeps the two panes atomic (no skew between halves of the demo), and halves client round-trips. Per-pane upstream failures degrade independently instead of failing the whole comparison.

### Rate limiting: platform headers, not cookies

Adapted from a prior project that stored the client IP in an `httpOnly` cookie set by middleware. The cookie round-trips through the client, so a caller can replace it per request and rotate identities at will — fine for a contact form, not for the public face of a security-themed project. Here the identity key is read at request time from `x-real-ip` / `x-forwarded-for`, which the hosting platform sets and the client cannot override. This also removes the need for a `proxy.ts` entirely: fewer moving parts, same guarantee, and the limiter logic stays in one file (`lib/ratelimit.ts`).

Two tiers via Upstash sliding windows:

- **Per-IP:** `search` 10/min (drives MCP traffic), everything else 60/min.
- **Global daily budget:** 500 searches/day across all callers, protecting the free-tier Space and any downstream LLM quota from a single hot link or a scripted loop. The global key is checked after the per-IP key so an abuser exhausts their own window first.

In development without Upstash credentials the limiter no-ops with a warning; in production missing credentials throw at first use — fail closed, matching the upstream server's philosophy.

### Input constraints at the boundary

`/api/search` enforces non-empty queries ≤ 300 characters and clamps `top_k` to [1, 5] before anything reaches the MCP server (which clamps to [1, 10] itself — defense in depth, smaller public surface than the protocol allows).

### Sleeping-Space handling is a feature, not an error

The free Hugging Face Space sleeps when idle. Health fetches use 10 s timeouts and degrade to an explicit "waking up" state in the UI rather than an error page, because the first reviewer click after a quiet week will hit exactly this path.

### Prometheus parsed, not proxied

`/metrics` exposition text is parsed into structured samples server-side (`lib/prometheus.ts`, dependency-free regex parser) so the overview page renders semantic cards (denials by layer, latency from `_sum`/`_count` pairs) instead of embedding raw text. The raw endpoint stays linked for anyone who wants the source of truth.

### Package manager: bun

`bun.lock` is the single lockfile (the npm lockfile from scaffolding was removed). Vercel detects and respects it.

### Metrics are point-in-time by design

The upstream counters live in process memory and reset on Space restart; the container is disposable by design (state of record is Confluence). Building a time-series store for them would contradict that architecture — historical trends belong to the eval reports published by CI, not to this console.
