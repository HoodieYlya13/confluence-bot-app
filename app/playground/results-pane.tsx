import Link from "next/link";
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
import { MAX_QUERY_LENGTH } from "./search-form";

const TOP_K = 5;

export async function Results({
  query,
  mode,
}: {
  query: string;
  mode: DemoMode;
}) {
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

export function PanesGrid({ skeleton = false }: { skeleton?: boolean }) {
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
