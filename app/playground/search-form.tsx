import { PendingButton } from "@/components/pending-button";
import type { DemoMode } from "@/lib/roles";

export const MAX_QUERY_LENGTH = 300;

const SUGGESTED_QUERIES = [
  "Greet the bot",
  "What are the collimator alignment offsets for betatron cleaning?",
  "What are the LHC cryogenic interlock thresholds?",
  "How do I shut down the Sector 4 injection magnets?",
  "Which VME registers configure the SPS beam instrumentation?",
];

export function SearchForm({ query, mode }: { query: string; mode: DemoMode }) {
  return (
    <form action="/playground" method="GET" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          key={query}
          name="q"
          defaultValue={query}
          required
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Ask about accelerator operations…"
          className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
        />
        <ModeToggle mode={mode} />
        <PendingButton
          pendingLabel="Comparing…"
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          Compare
        </PendingButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUERIES.map((suggestion) => (
          <button
            key={suggestion}
            type="submit"
            name="suggested_q"
            value={suggestion}
            formNoValidate
            className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer bg-transparent"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </form>
  );
}

function ModeToggle({ mode }: { mode: DemoMode }) {
  return (
    <fieldset className="flex shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 p-0.5 text-sm">
      <label className="cursor-pointer w-1/2">
        <input
          key={`search-${mode}`}
          type="radio"
          name="mode"
          value="search"
          defaultChecked={mode !== "answer"}
          className="peer sr-only"
        />
        <span className="block text-center rounded px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400 peer-checked:bg-sky-600 peer-checked:text-white">
          Retrieval
        </span>
      </label>
      <label className="cursor-pointer w-1/2">
        <input
          key={`answer-${mode}`}
          type="radio"
          name="mode"
          value="answer"
          defaultChecked={mode === "answer"}
          className="peer sr-only"
        />
        <span className="block text-center rounded px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400 peer-checked:bg-violet-600 peer-checked:text-white">
          LangGraph
        </span>
      </label>
    </fieldset>
  );
}

export function SearchFormSkeleton({
  query,
  mode,
}: {
  query: string;
  mode: DemoMode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          defaultValue={query}
          disabled
          className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none opacity-50"
        />
        <div className="flex shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 p-0.5 text-sm opacity-50">
          <span
            className={`rounded px-4 py-2 font-medium ${mode === "search" ? "bg-sky-600 text-white" : "text-zinc-600"}`}
          >
            Retrieval
          </span>
          <span
            className={`rounded px-4 py-2 font-medium ${mode === "answer" ? "bg-violet-600 text-white" : "text-zinc-600"}`}
          >
            LangGraph
          </span>
        </div>
        <button
          disabled
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white opacity-50"
        >
          Compare
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUERIES.map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-400"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}
