"use client";

import { useState } from "react";
import {
  DEMO_ROLES,
  type DemoRole,
  type PaneResult,
  type SearchResponse,
} from "@/lib/roles";

const SUGGESTED_QUERIES = [
  "What are the LHC cryogenic interlock thresholds?",
  "How do I shut down the Sector 4 injection magnets?",
  "What are the collimator alignment offsets for betatron cleaning?",
  "Which VME registers configure the SPS beam instrumentation?",
];

const ROLE_META: Record<
  DemoRole,
  { blurb: string; badge: string; ring: string }
> = {
  JUNIOR_OP: {
    blurb: "Junior operator — cleared for routine operational procedures only.",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800",
    ring: "border-amber-200 dark:border-amber-900",
  },
  ATS_CORE_LEAD: {
    blurb:
      "Core team lead — additionally cleared for restricted machine-protection data.",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
    ring: "border-emerald-200 dark:border-emerald-900",
  },
};

export default function PlaygroundPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResponse(null);
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setResponse(data as SearchResponse);
    } catch {
      setResponse(null);
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const juniorDocIds = new Set(
    response?.results.JUNIOR_OP.ok
      ? response.results.JUNIOR_OP.chunks.map((chunk) => chunk.doc_id)
      : [],
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          RBAC playground
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          One question, two authorization levels. Each pane is a real MCP tool
          call against the live server, authenticated with a different bearer
          token. The document ACL filter runs <em>inside</em> the vector query
          — restricted content never reaches the lower-privileged session.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={300}
            placeholder="Ask about accelerator operations…"
            className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Ask both roles"}
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => runSearch(suggestion)}
              disabled={loading}
              className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {DEMO_ROLES.map((role) => (
          <RolePane
            key={role}
            role={role}
            result={response?.results[role] ?? null}
            loading={loading}
            juniorDocIds={juniorDocIds}
          />
        ))}
      </section>

      {response && (
        <p className="text-center text-xs text-zinc-500">
          Results retrieved live via{" "}
          <code className="font-mono">semantic_search_accelerator</code> over
          MCP streamable HTTP — highlighted chunks were withheld from the
          junior operator by the ACL filter.
        </p>
      )}
    </div>
  );
}

function RolePane({
  role,
  result,
  loading,
  juniorDocIds,
}: {
  role: DemoRole;
  result: PaneResult | null;
  loading: boolean;
  juniorDocIds: Set<string>;
}) {
  const meta = ROLE_META[role];

  return (
    <div
      className={`rounded-lg border bg-white dark:bg-zinc-900 ${meta.ring}`}
    >
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-medium ${meta.badge}`}
        >
          {role}
        </span>
        <p className="mt-2 text-xs text-zinc-500">{meta.blurb}</p>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {loading && <PaneSkeleton />}
        {!loading && !result && (
          <p className="text-sm text-zinc-500">
            Ask a question to see what this role is allowed to retrieve.
          </p>
        )}
        {!loading && result && !result.ok && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {result.error}
          </p>
        )}
        {!loading && result?.ok && result.chunks.length === 0 && (
          <p className="text-sm text-zinc-500">
            No documents visible to this role matched the query.
          </p>
        )}
        {!loading &&
          result?.ok &&
          result.chunks.map((chunk) => {
            const restricted =
              role === "ATS_CORE_LEAD" && !juniorDocIds.has(chunk.doc_id);
            return (
              <div
                key={`${chunk.doc_id}-${chunk.chunk_index}`}
                className={`rounded-md border p-3 ${
                  restricted
                    ? "border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {chunk.doc_id}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    chunk {chunk.chunk_index}
                  </span>
                  <span className="ml-auto font-mono text-xs text-sky-600 dark:text-sky-400">
                    {(chunk.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
                {restricted && (
                  <span className="mt-2 inline-block rounded-full bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
                    Hidden from JUNIOR_OP
                  </span>
                )}
                <p className="mt-2 line-clamp-5 whitespace-pre-line text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  {chunk.text}
                </p>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function PaneSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}
