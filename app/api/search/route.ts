import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_ROLES,
  semanticSearch,
  type DemoRole,
  type SearchChunk,
} from "@/lib/mcp";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";

export const maxDuration = 60;

type PaneResult =
  | { ok: true; chunks: SearchChunk[] }
  | { ok: false; error: string };

export async function POST(req: NextRequest) {
  try {
    await checkRateLimit("search");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again in a minute." },
        { status: 429 },
      );
    }
    throw error;
  }

  let body: { query?: unknown; topK?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length > 300) {
    return NextResponse.json(
      { error: "Query must be a non-empty string of at most 300 characters." },
      { status: 400 },
    );
  }

  const topK =
    typeof body.topK === "number" && Number.isFinite(body.topK)
      ? Math.max(1, Math.min(Math.trunc(body.topK), 5))
      : 3;

  const settled = await Promise.allSettled(
    DEMO_ROLES.map((role) => semanticSearch(role, query, topK)),
  );

  const results = {} as Record<DemoRole, PaneResult>;
  DEMO_ROLES.forEach((role, index) => {
    const outcome = settled[index];
    results[role] =
      outcome.status === "fulfilled"
        ? { ok: true, chunks: outcome.value }
        : { ok: false, error: "The MCP server could not be reached. It may be waking from sleep — retry in ~30 seconds." };
  });

  return NextResponse.json({ query, topK, results });
}
