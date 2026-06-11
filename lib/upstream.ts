import "server-only";

export const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL ??
  "https://hoodieylya13-mcp-confluence-documentation-rag.hf.space";

export type UpstreamHealth = {
  status: string;
  indexed_documents: number;
  total_chunks: number;
  retriever_backend: string;
};

export async function fetchHealth(): Promise<UpstreamHealth | null> {
  try {
    const res = await fetch(new URL("/health", MCP_SERVER_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as UpstreamHealth;
  } catch {
    return null;
  }
}

export async function fetchMetricsText(): Promise<string | null> {
  try {
    const res = await fetch(new URL("/metrics", MCP_SERVER_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
