import type { DemoRole, PaneResult, SearchChunk } from "@/lib/roles";

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
        <span className="mt-2 inline-block rounded-full bg-violet-100 dark:bg-violet-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
          🔒 Restricted — requires ATS_CORE_LEAD
        </span>
      )}
      <p className="mt-2 line-clamp-5 whitespace-pre-line text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        {chunk.text}
      </p>
    </div>
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
