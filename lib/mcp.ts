import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { DemoRole, SearchChunk } from "./roles";
import { MCP_SERVER_URL } from "./upstream";
import { tryCatch, tryCatchSync } from "./utils";

export { DEMO_ROLES, type DemoRole, type SearchChunk } from "./roles";

const ROLE_TOKEN_ENV: Record<DemoRole, string> = {
  JUNIOR_OP: "MCP_TOKEN_JUNIOR_OP",
  ATS_CORE_LEAD: "MCP_TOKEN_ATS_CORE_LEAD",
};

async function runMcpTool<T>(
  role: DemoRole,
  toolName: string,
  args: Record<string, unknown>,
  normalize: (res: Record<string, unknown>) => T,
): Promise<T> {
  const token = process.env[ROLE_TOKEN_ENV[role]];
  if (!token) throw new Error(`${ROLE_TOKEN_ENV[role]} is not configured.`);

  const transport = new StreamableHTTPClientTransport(
    new URL("/mcp", MCP_SERVER_URL),
    { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const client = new Client({ name: "confluence-bot-app", version: "0.1.0" });

  const [err, result] = await tryCatch(async () => {
    await client.connect(transport);
    const res = await client.callTool({
      name: toolName,
      arguments: args,
    });
    if (res.isError)
      throw new Error(extractText(res.content) || "MCP tool call failed.");
    return normalize(res as Record<string, unknown>);
  });

  await tryCatch(client.close());

  if (err) throw err;
  return result;
}

export async function semanticSearch(
  role: DemoRole,
  query: string,
  topK: number,
): Promise<SearchChunk[]> {
  return runMcpTool(
    role,
    "semantic_search_accelerator",
    { query, top_k: topK },
    normalizeResult,
  );
}

export async function askQuestion(
  role: DemoRole,
  question: string,
): Promise<string> {
  return runMcpTool(
    role,
    "ask_accelerator_operations",
    { question },
    normalizeAnswer,
  );
}

function normalizeAnswer(result: Record<string, unknown>): string {
  const structured = (
    result.structuredContent as { result?: unknown } | undefined
  )?.result;
  if (typeof structured === "string") return structured;
  return extractText(result.content);
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (item): item is { type: "text"; text: string } =>
        typeof item === "object" &&
        item !== null &&
        (item as { type?: string }).type === "text",
    )
    .map((item) => item.text)
    .join(" ");
}

function normalizeResult(result: Record<string, unknown>): SearchChunk[] {
  const structured = (
    result.structuredContent as { result?: SearchChunk[] } | undefined
  )?.result;
  if (Array.isArray(structured)) return structured;

  const chunks: SearchChunk[] = [];
  const content = result.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      const entry = item as { type?: string; text?: string };
      if (entry?.type !== "text" || typeof entry.text !== "string") continue;
      const [parseErr, parsed] = tryCatchSync(() => JSON.parse(entry.text!));
      if (!parseErr && parsed) {
        if (Array.isArray(parsed)) chunks.push(...parsed);
        else chunks.push(parsed);
      }
    }
  }
  return chunks;
}
