import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { PendingButton } from "@/components/pending-button";
import { askQuestion, DEMO_ROLES, semanticSearch } from "@/lib/mcp";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import type { AnswerResult, DemoMode, DemoRole, PaneResult } from "@/lib/roles";
import { tryCatch } from "@/lib/utils";
import {
  AnswerBody,
  extractHexTokens,
  PaneBody,
  PaneSkeleton,
  RolePaneShell,
} from "./role-pane";

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

type PlaygroundSearchParams = Promise<{
  q?: string | string[];
  mode?: string | string[];
}>;

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
          One question, two authorization levels.{" "}
          <strong>Compare retrieval</strong> calls{" "}
          <code className="font-mono">semantic_search_accelerator</code> and
          shows the raw chunks each role may see — the ACL filter runs{" "}
          <em>inside</em> the vector query. <strong>Compare answers</strong>{" "}
          calls <code className="font-mono">ask_accelerator_operations</code>,
          which runs the full LangGraph agent server-side (retrieve → verify →
          generate → leak scan) and returns one grounded answer per role.
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
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function getQuery(searchParams: PlaygroundSearchParams): Promise<string> {
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  return raw?.trim() ?? "";
}

async function getMode(
  searchParams: PlaygroundSearchParams,
): Promise<DemoMode> {
  const { mode } = await searchParams;
  const raw = Array.isArray(mode) ? mode[0] : mode;
  return raw === "answer" ? "answer" : "search";
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
    <Form action="/playground" className="flex flex-col gap-2 sm:flex-row">
      <input
        key={query}
        name="q"
        defaultValue={query}
        required
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Ask about accelerator operations…"
        className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
      />
      <div className="flex gap-2">
        <PendingButton
          name="mode"
          value="search"
          pendingLabel="Searching…"
          className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Compare retrieval
        </PendingButton>
        <PendingButton
          name="mode"
          value="answer"
          pendingLabel="Generating…"
          className="rounded-md bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Compare answers
        </PendingButton>
      </div>
    </Form>
  );
}

async function Results({
  searchParams,
}: {
  searchParams: PlaygroundSearchParams;
}) {
  const query = await getQuery(searchParams);
  const mode = await getMode(searchParams);

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

  const [error] = await tryCatch(checkRateLimit(mode));
  if (error) {
    if (error instanceof RateLimitError)
      return (
        <>
          <Notice>
            Rate limit reached — the playground allows only a handful of{" "}
            {mode === "answer" ? "answers" : "searches"} per minute. Try again
            shortly.
          </Notice>
          <PanesGrid />
        </>
      );
    throw error;
  }

  return mode === "answer" ? (
    <AnswerPanes query={query} />
  ) : (
    <SearchPanes query={query} />
  );
}

async function SearchPanes({ query }: { query: string }) {
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
        Retrieved live via{" "}
        <code className="font-mono">semantic_search_accelerator</code> over MCP
        — highlighted chunks were withheld from the junior operator by the ACL
        filter.{" "}
        <Link
          href={`/playground?q=${encodeURIComponent(query)}&mode=answer`}
          className="text-violet-600 hover:underline dark:text-violet-400"
        >
          Generate answers for this question →
        </Link>
      </p>
    </>
  );
}

async function AnswerPanes({ query }: { query: string }) {
  const settled = await Promise.allSettled(
    DEMO_ROLES.map((role) => askQuestion(role, query)),
  );
  const results = Object.fromEntries(
    DEMO_ROLES.map((role, index) => {
      const outcome = settled[index];
      return [
        role,
        outcome.status === "fulfilled"
          ? { ok: true, answer: outcome.value }
          : {
              ok: false,
              error:
                "The live server did not answer for this role — it may be waking up. Try again shortly.",
            },
      ];
    }),
  ) as Record<DemoRole, AnswerResult>;

  const juniorResult = results.JUNIOR_OP;
  const juniorTokens = new Set(
    juniorResult.ok ? extractHexTokens(juniorResult.answer) : [],
  );

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-2">
        {DEMO_ROLES.map((role) => (
          <RolePaneShell key={role} role={role}>
            <AnswerBody
              role={role}
              result={results[role]}
              juniorTokens={juniorTokens}
            />
          </RolePaneShell>
        ))}
      </section>
      <p className="text-center text-xs text-zinc-500">
        Generated live via{" "}
        <code className="font-mono">ask_accelerator_operations</code> — the
        agent runs server-side with the verify gate and leak scan enforced.
        Highlighted register addresses appear only in the lead&apos;s grounded
        answer.{" "}
        <Link
          href={`/playground?q=${encodeURIComponent(query)}&mode=search`}
          className="text-sky-600 hover:underline dark:text-sky-400"
        >
          See the raw retrieved chunks →
        </Link>
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
