import type {
  AnswerResult,
  DemoRole,
  PaneResult,
  SearchChunk,
} from "@/lib/roles";
import { parseMarkdown } from "./markdown";

const HEX_TOKEN = /(0x[0-9A-Fa-f]{4,})/g;

export function extractHexTokens(text: string): string[] {
  return text.match(HEX_TOKEN) ?? [];
}

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

export function RolePaneShell({
  role,
  children,
}: {
  role: DemoRole;
  children: React.ReactNode;
}) {
  const meta = ROLE_META[role];

  return (
    <div className={`rounded-lg border bg-white dark:bg-zinc-900 ${meta.ring}`}>
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-medium ${meta.badge}`}
        >
          {role}
        </span>
        <p className="mt-2 text-xs text-zinc-500">{meta.blurb}</p>
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </div>
  );
}

export function PaneBody({
  role,
  result,
  juniorDocIds,
}: {
  role: DemoRole;
  result: PaneResult;
  juniorDocIds: Set<string>;
}) {
  if (!result.ok)
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {result.error}
      </p>
    );

  if (result.chunks.length === 0)
    return (
      <p className="text-sm text-zinc-500">
        No documents visible to this role matched the query.
      </p>
    );

  return (
    <>
      {result.chunks.map((chunk) => (
        <ChunkCard
          key={`${chunk.doc_id}-${chunk.chunk_index}`}
          chunk={chunk}
          restricted={
            role === "ATS_CORE_LEAD" && !juniorDocIds.has(chunk.doc_id)
          }
        />
      ))}
    </>
  );
}

export function AnswerBody({
  result,
  juniorTokens,
}: {
  role: DemoRole;
  result: AnswerResult;
  juniorTokens: Set<string>;
}) {
  if (!result.ok)
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {result.error}
      </p>
    );

  const { answer } = result;

  if (answer.includes("Security Exception"))
    return (
      <div className="rounded-md border border-rose-300 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
          <LockIcon className="size-3" />
          Blocked by guardrail
        </span>
        <p className="mt-2 text-sm leading-6 text-rose-700 dark:text-rose-300">
          {answer}
        </p>
      </div>
    );

  const isGreeting =
    answer.trim() ===
    "Hello! I am the CERN BE-CSS Operations Assistant. How can I help you with accelerator operations today?";

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
        {parseMarkdown(answer, juniorTokens)}
      </div>
      {isGreeting && (
        <p className="text-[11px] text-zinc-500 italic px-1">
          * LangGraph skipped everything because it detected a greeting
        </p>
      )}
    </div>
  );
}

function ChunkCard({
  chunk,
  restricted,
}: {
  chunk: SearchChunk;
  restricted: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        restricted
          ? "border-violet-300 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {chunk.url ? (
          <a
            href={chunk.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
          >
            {chunk.title || chunk.doc_id}
          </a>
        ) : (
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {chunk.title || chunk.doc_id}
          </span>
        )}
        <span className="font-mono text-xs text-zinc-400">
          chunk {chunk.chunk_index}
        </span>
        <span className="ml-auto font-mono text-xs text-sky-600 dark:text-sky-400">
          {(chunk.similarity_score * 100).toFixed(1)}%
        </span>
      </div>
      {restricted && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
          <LockIcon className="size-3" />
          Restricted — requires ATS_CORE_LEAD
        </span>
      )}
      <p className="mt-2 line-clamp-5 whitespace-pre-line text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        {chunk.text}
      </p>
    </div>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PaneSkeleton() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
        />
      ))}
    </>
  );
}
