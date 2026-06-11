import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { PendingButton } from "@/components/pending-button";
import { DEMO_ROLES, semanticSearch } from "@/lib/mcp";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import type { DemoRole, PaneResult } from "@/lib/roles";
import { PaneBody, PaneSkeleton, RolePaneShell } from "./role-pane";

export const maxDuration = 60;

export const metadata = {
  title: "RBAC playground",
};

const TOP_K = 5;
const MAX_QUERY_LENGTH = 300;

const SUGGESTED_QUERIES = [
  "What are the LHC cryogenic interlock thresholds?",
  "How do I shut down the Sector 4 injection magnets?",
  "What are the collimator alignment offsets for betatron cleaning?",
  "Which VME registers configure the SPS beam instrumentation?",
];

type PlaygroundSearchParams = Promise<{ q?: string | string[] }>;

export default function PlaygroundPage({
  searchParams,
}: {
  searchParams: PlaygroundSearchParams;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          RBAC playground
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          One question, two authorization levels. Each pane is a real MCP tool
          call against the live server, authenticated with a different bearer
          token. The document ACL filter runs <em>inside</em> the vector query —
          restricted content never reaches the lower-privileged session.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Suspense fallback={<SearchForm query="" />}>
          <PrefilledSearchForm searchParams={searchParams} />
        </Suspense>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((suggestion) => (
            <Link
              key={suggestion}
              href={`/playground?q=${encodeURIComponent(suggestion)}`}
              className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400"
            >
              {suggestion}
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={<PanesGrid skeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function getQuery(searchParams: PlaygroundSearchParams): Promise<string> {
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  return raw?.trim() ?? "";
}

async function PrefilledSearchForm({
  searchParams,
}: {
  searchParams: PlaygroundSearchParams;
}) {
  return <SearchForm query={await getQuery(searchParams)} />;
}

function SearchForm({ query }: { query: string }) {
  return (
    <Form action="/playground" className="flex gap-2">
      <input
        key={query}
        name="q"
        defaultValue={query}
        required
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Ask about accelerator operations…"
        className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
      />
      <PendingButton
        pendingLabel="Searching…"
        className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        Ask both roles
      </PendingButton>
    </Form>
  );
}

async function SearchResults({
  searchParams,
}: {
  searchParams: PlaygroundSearchParams;
}) {
  const query = await getQuery(searchParams);

  if (!query) return <PanesGrid />;

  if (query.length > MAX_QUERY_LENGTH)
    return (
      <>
        <Notice>
          Queries are limited to {MAX_QUERY_LENGTH} characters — try a shorter
          one.
        </Notice>
        <PanesGrid />
      </>
    );

  try {
    await checkRateLimit("search");
  } catch (error) {
    if (error instanceof RateLimitError)
      return (
        <>
          <Notice>
            Rate limit reached — the playground allows a handful of searches per
            minute. Try again shortly.
          </Notice>
          <PanesGrid />
        </>
      );
    throw error;
  }

  const settled = await Promise.allSettled(
    DEMO_ROLES.map((role) => semanticSearch(role, query, TOP_K)),
  );
  const results = Object.fromEntries(
    DEMO_ROLES.map((role, index) => {
      const outcome = settled[index];
      return [
        role,
        outcome.status === "fulfilled"
          ? { ok: true, chunks: outcome.value }
          : {
              ok: false,
              error:
                "The live server did not answer for this role — it may be waking up. Try again shortly.",
            },
      ];
    }),
  ) as Record<DemoRole, PaneResult>;

  const juniorResult = results.JUNIOR_OP;
  const juniorDocIds = new Set(
    juniorResult.ok ? juniorResult.chunks.map((chunk) => chunk.doc_id) : [],
  );

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-2">
        {DEMO_ROLES.map((role) => (
          <RolePaneShell key={role} role={role}>
            <PaneBody
              role={role}
              result={results[role]}
              juniorDocIds={juniorDocIds}
            />
          </RolePaneShell>
        ))}
      </section>
      <p className="text-center text-xs text-zinc-500">
        Results retrieved live via{" "}
        <code className="font-mono">semantic_search_accelerator</code> over MCP
        streamable HTTP — highlighted chunks were withheld from the junior
        operator by the ACL filter.
      </p>
    </>
  );
}

function PanesGrid({ skeleton = false }: { skeleton?: boolean }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {DEMO_ROLES.map((role) => (
        <RolePaneShell key={role} role={role}>
          {skeleton ? (
            <PaneSkeleton />
          ) : (
            <p className="text-sm text-zinc-500">
              Ask a question to see what this role is allowed to retrieve.
            </p>
          )}
        </RolePaneShell>
      ))}
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
      {children}
    </div>
  );
}
