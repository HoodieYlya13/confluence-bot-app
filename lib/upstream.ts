import "server-only";
import { tryCatch } from "./utils";

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
  const [err, res] = await tryCatch(
    fetch(new URL("/health", MCP_SERVER_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (err || !res.ok) return null;

  const [jsonErr, data] = await tryCatch(res.json());
  if (jsonErr) return null;

  return data as UpstreamHealth;
}

export async function fetchMetricsText(): Promise<string | null> {
  const [err, res] = await tryCatch(
    fetch(new URL("/metrics", MCP_SERVER_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (err || !res.ok) return null;

  const [textErr, text] = await tryCatch(res.text());
  if (textErr) return null;

  return text;
}
