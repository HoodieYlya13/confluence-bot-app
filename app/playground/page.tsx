import { Suspense, use } from "react";
import type { DemoMode } from "@/lib/roles";
import { SearchForm, SearchFormSkeleton } from "./search-form";
import { Results, PanesGrid } from "./results-pane";

export const maxDuration = 60;

export const metadata = {
  title: "RBAC playground",
};

type PlaygroundSearchParams = Promise<{
  q?: string | string[];
  suggested_q?: string | string[];
  mode?: string | string[];
}>;

export default function PlaygroundPage({
  searchParams,
}: {
  searchParams: PlaygroundSearchParams;
}) {
  const resolvedParams = use(searchParams);
  const query = getQueryFromParams(
    resolvedParams.q,
    resolvedParams.suggested_q,
  );
  const mode = getModeFromParams(resolvedParams.mode);

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
        <Suspense fallback={<SearchFormSkeleton query={query} mode={mode} />}>
          <PrefilledSearchForm query={query} mode={mode} />
        </Suspense>
      </section>

      <Suspense fallback={<PanesGrid skeleton />}>
        <Results query={query} mode={mode} />
      </Suspense>
    </div>
  );
}

function getQueryFromParams(
  q: string | string[] | undefined,
  suggestedQ: string | string[] | undefined,
): string {
  const rawSuggested = Array.isArray(suggestedQ) ? suggestedQ[0] : suggestedQ;
  if (rawSuggested?.trim()) return rawSuggested.trim();
  const rawQ = Array.isArray(q) ? q[0] : q;
  return rawQ?.trim() ?? "";
}

function getModeFromParams(mode: string | string[] | undefined): DemoMode {
  const raw = Array.isArray(mode) ? mode[0] : mode;
  return raw === "answer" ? "answer" : "search";
}

function PrefilledSearchForm({
  query,
  mode,
}: {
  query: string;
  mode: DemoMode;
}) {
  return <SearchForm query={query} mode={mode} />;
}
