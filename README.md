# confluence-bot-app

Public console for the [mcp-confluence-documentation-rag](https://github.com/HoodieYlya13/mcp-confluence-documentation-rag) server — an RBAC-enforced MCP documentation RAG deployed on Hugging Face Spaces.

Two pages:

- **Overview** (`/`) — live health and Prometheus metrics from the deployed server: indexed corpus size, tool-call counts, RBAC denials by security layer, tool latency, Confluence sync status.
- **RBAC playground** (`/playground`) — ask one question through two real MCP sessions holding different bearer tokens (`JUNIOR_OP` vs `ATS_CORE_LEAD`) and see, side by side, which document chunks each authorization level is allowed to retrieve. Chunks withheld from the junior operator are highlighted.

Built with Next.js 16 (App Router), Tailwind 4, the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) as a streamable-HTTP client, and Upstash for rate limiting. Design rationale lives in [TAD.md](TAD.md) — house convention: no code comments.

## Setup

```bash
bun install
cp .env.example .env.local
bun dev
```

| Variable | Purpose |
|---|---|
| `MCP_SERVER_URL` | Base URL of the deployed MCP server |
| `MCP_TOKEN_JUNIOR_OP` | Demo bearer token mapped server-side to the `JUNIOR_OP` role |
| `MCP_TOKEN_ATS_CORE_LEAD` | Demo bearer token mapped server-side to the `ATS_CORE_LEAD` role |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (optional in development, required in production) |

Tokens are only ever read server-side (`server-only` guarded); the browser talks exclusively to this app's `/api/*` routes, which are rate limited per IP plus a global daily budget.

## Deploy

Push to Vercel; set the environment variables above. The upstream Space sleeps when idle — the console surfaces this as a "waking up" state rather than an error.
