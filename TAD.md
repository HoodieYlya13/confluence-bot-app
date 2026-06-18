# Technical Architecture Decisions — confluence-bot-app

House convention: no code comments or docstrings. Every design decision and its rationale lives here.

## Purpose

A thin public console over the [mcp-confluence-documentation-rag](https://github.com/HoodieYlya13/mcp-confluence-documentation-rag) server. Two jobs:

1. **Overview** — live `/health` and Prometheus `/metrics` from the deployed Space, rendered as a dashboard.
2. **RBAC playground** — the same question asked through two MCP sessions holding different bearer tokens, results side by side, restricted chunks highlighted.

The app is deliberately thin. The engineering story (4-layer RBAC, ACL pushdown, eval gates) lives server-side; this is the window that lets a reviewer experience it without installing an MCP client.

## Decisions

### All upstream calls are server-side; tokens never reach the browser

Server components and server actions are the only places that talk to the MCP server. The two demo bearer tokens live in environment variables (`MCP_TOKEN_JUNIOR_OP`, `MCP_TOKEN_ATS_CORE_LEAD`) read inside `lib/mcp.ts`, which is guarded by `server-only` so any accidental client import fails the build. The browser only ever receives rendered HTML and RSC payloads — there is no JSON API surface at all.

### Server-first UI: the URL is the state, client JS is one button

The playground is a server component driven entirely by `?q=` search params. The search box is a `next/form` `<Form>` with a string action — a plain GET form under the hood, so the entire demo works with JavaScript disabled (with JS, Next upgrades submission to a client-side navigation with prefetched shell). Suggested queries are `<Link>`s, not click handlers. Results render inside a `<Suspense>` boundary fed the `searchParams` promise, which keeps the page shell static (both routes build as Partial Prerender: static HTML shell, dynamic content streamed).

The only client component in the app is `components/pending-button.tsx`, a `useFormStatus` submit button shared by the search form and the overview's refresh form — the documented pattern for instant feedback on `<Form>` submissions. The overview refresh is a server action calling `refresh()` from `next/cache`, replacing the previous `router.refresh()` client component.

This replaced an earlier version with a fully client-side playground page posting to `/api/search` plus `/api/health` and `/api/metrics` proxy routes. The rewrite deleted all three route handlers: less client JS, shareable/linkable search results, progressive enhancement for free, and a smaller public attack surface — the rate limiter now guards the only path that can reach the MCP server, the server render of the results.

The React Compiler is enabled (`reactCompiler: true`), so there is no manual `useMemo`/`useCallback`/`memo` anywhere; the compiler owns memoization.

### Real MCP client, not a REST shim

`lib/mcp.ts` uses the official `@modelcontextprotocol/sdk` `Client` over `StreamableHTTPClientTransport`, performing the full initialize → tool-call → close handshake per request. A raw `fetch` to a bespoke endpoint would have been less code, but exercising the actual protocol means the project demonstrates both an MCP server (Python) and an MCP client (TypeScript). Connections are per-request rather than pooled: the playground is low-traffic by design and a stateless handler survives serverless cold starts.

### One search render fans out to both roles

The comparison is the product, so one server render runs both role sessions in parallel (`Promise.allSettled`) and produces a per-role result envelope. This charges the rate limiter once per comparison and keeps the two panes atomic (no skew between halves of the demo). Per-pane upstream failures degrade independently instead of failing the whole comparison.

### Two modes: compare retrieval vs compare answers

The playground exposes both server deployment patterns from one form. **Compare retrieval** calls `semantic_search_accelerator` and shows the raw chunks each role may see — proving the ACL pushdown (layers 1–2). **Compare answers** calls `ask_accelerator_operations`, the tool that runs the full LangGraph agent server-side (retrieve → verify → generate → leak scan), and shows one grounded answer per role — proving the generation-side guardrails (layers 3–4) and that RBAC shapes the _answer_, not just the retrieval. Both modes were kept because the chunk diff is the clearest proof of retrieval RBAC, while the answer diff is the more legible proof for non-technical viewers (the junior simply gets a different answer).

Mode is a second search param (`?mode=search|answer`, default `search`), selected by two submit buttons sharing `name="mode"` — so the choice rides the same GET/`next/form` flow and works with JavaScript disabled (the activated button's value is encoded into the URL; pressing Enter selects the first, retrieval). Each result footer links to the same query in the other mode. Answer mode is rate-limited tighter than search (4/min, 150/day vs 10/min, 500/day) because it spends an LLM call server-side, not just a vector query.

In answer mode the restricted accent moves from whole chunks to **hex register tokens** (`0x…`): tokens present in the lead's answer but absent from the junior's are badged violet — the same "clearance accent" idea applied to generated text, and a direct visual echo of the server's post-generation leak scanner. A refusal (`Security Exception`) renders as a distinct rose "blocked by guardrail" card.

### Restricted-chunk highlight: a clearance accent, not an error

Chunks the lead retrieved but the junior did not are badged "Restricted — requires ATS_CORE_LEAD" in violet. An earlier version used rose ("Hidden from JUNIOR_OP"), but rose is the app's danger color (error notices, blocked-attempt counts), so the lead pane read as if something was wrong — when the highlight is the success story: elevated access doing its job. Violet was chosen because the other accents are taken: amber marks the junior role, emerald the lead, rose errors.

The badge condition — the chunk's `doc_id` is absent from the junior's result set — is a heuristic, not ground truth. A document the junior _can_ see could rank below their top-5 and be falsely badged. The demo corpus keeps restricted and routine documents distinct enough that this doesn't occur in practice, and the alternative (asking the server for per-document ACLs) would add an API surface solely for presentation.

### Rate limiting: platform headers, not cookies

Adapted from a prior project that stored the client IP in an `httpOnly` cookie set by middleware. The cookie round-trips through the client, so a caller can replace it per request and rotate identities at will — fine for a contact form, not for the public face of a security-themed project. Here the identity key is read at request time from `x-real-ip` / `x-forwarded-for`, which the hosting platform sets and the client cannot override. This also removes the need for a `proxy.ts` entirely: fewer moving parts, same guarantee, and the limiter logic stays in one file (`lib/ratelimit.ts`).

Two tiers via Upstash sliding windows:

- **Per-IP:** `search` 10/min (drives MCP traffic), everything else 60/min.
- **Global daily budget:** 500 searches/day across all callers, protecting the free-tier Space and any downstream LLM quota from a single hot link or a scripted loop. The global key is checked after the per-IP key so an abuser exhausts their own window first.

In development without Upstash credentials the limiter no-ops with a warning; in production missing credentials throw at first use — fail closed, matching the upstream server's philosophy.

### Input constraints at the boundary

The search render rejects empty or > 300-character queries and pins `top_k` to 5 before anything reaches the MCP server (which clamps to [1, 10] itself — defense in depth, smaller public surface than the protocol allows). The form mirrors the same limits client-side via native `required` and `maxLength` attributes, no validation JS.

### Sleeping-Space handling is a feature, not an error

The free Hugging Face Space sleeps when idle. Health fetches use 10 s timeouts and degrade to an explicit "waking up" state in the UI rather than an error page, because the first reviewer click after a quiet week will hit exactly this path.

### Prometheus parsed, not proxied

`/metrics` exposition text is parsed into structured samples server-side (`lib/prometheus.ts`, dependency-free regex parser) so the overview page renders semantic cards (denials by layer, latency from `_sum`/`_count` pairs) instead of embedding raw text. The raw endpoint stays linked for anyone who wants the source of truth.

### Package manager: bun

`bun.lock` is the single lockfile (the npm lockfile from scaffolding was removed). Vercel detects and respects it.

### Metrics are point-in-time by design

The upstream counters live in process memory and reset on Space restart; the container is disposable by design (state of record is Confluence). Building a time-series store for them would contradict that architecture — historical trends belong to the eval reports published by CI, not to this console.
