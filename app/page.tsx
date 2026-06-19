import Link from "next/link";
import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import Image from "next/image";
import Logo from "@/assets/logo.png";
import { refreshOverview } from "@/app/actions";
import { PendingButton } from "@/components/pending-button";
import { Arrow } from "@/components/arrow";
import {
  groupByLabel,
  parsePrometheus,
  singleValue,
  type Sample,
} from "@/lib/prometheus";
import {
  fetchHealth,
  fetchMetricsText,
  fetchLatestRelease,
  type ReleaseData,
  MCP_SERVER_URL,
} from "@/lib/upstream";

const DENIAL_LAYERS: Record<string, string> = {
  http_auth: "HTTP bearer auth",
  role_validation: "Role validation",
  document_acl: "Document ACL filter",
};

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Live server overview
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Health and Prometheus metrics, read straight from the deployed MCP
            server on Hugging Face Spaces.
          </p>
        </div>
        <form action={refreshOverview}>
          <PendingButton
            pendingLabel="Refreshing…"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh
          </PendingButton>
        </form>
      </section>
      <Suspense fallback={<OverviewSkeleton />}>
        <LiveOverview />
      </Suspense>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}

async function LiveOverview() {
  await connection();
  const [health, metricsText, latestRelease] = await Promise.all([
    fetchHealth(),
    fetchMetricsText(),
    fetchLatestRelease(),
  ]);
  const samples: Sample[] = metricsText ? parsePrometheus(metricsText) : [];

  const userAgent = (await headers()).get("user-agent") || "";
  const lowercaseUA = userAgent.toLowerCase();

  let userOS: "mac" | "win" | "linux" | "unknown" = "unknown";
  switch (true) {
    case lowercaseUA.includes("macintosh") || lowercaseUA.includes("mac os x"):
      userOS = "mac";
      break;
    case lowercaseUA.includes("windows") || lowercaseUA.includes("win32"):
      userOS = "win";
      break;
    case lowercaseUA.includes("linux") ||
      lowercaseUA.includes("ubuntu") ||
      lowercaseUA.includes("debian"):
      userOS = "linux";
      break;
    default:
      userOS = "unknown";
  }

  const toolCalls = groupByLabel(samples, "mcp_tool_calls_total", "tool");
  const denials = groupByLabel(samples, "rbac_denials_total", "layer");
  const syncRuns = groupByLabel(samples, "sync_runs_total", "trigger");
  const lastSync = singleValue(samples, "sync_last_success_timestamp");
  const indexedDocs =
    health?.indexed_documents ?? singleValue(samples, "indexed_documents");
  const indexedChunks =
    health?.total_chunks ?? singleValue(samples, "indexed_chunks");

  const latencySums = groupByLabel(
    samples,
    "mcp_tool_latency_seconds_sum",
    "tool",
  );
  const latencyCounts = groupByLabel(
    samples,
    "mcp_tool_latency_seconds_count",
    "tool",
  );

  const online = health !== null;
  const totalDenials = Object.values(denials).reduce((a, b) => a + b, 0);
  const totalCalls = Object.values(toolCalls).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-8">
      <section
        className={`rounded-lg border p-5 ${
          online
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              online ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
            }`}
          />
          <span className="font-medium">
            {online ? "Server online" : "Server unreachable"}
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {online
              ? `retriever: ${health.retriever_backend}`
              : "The free-tier Space sleeps when idle — it wakes on first request. Hit refresh in ~30 seconds."}
          </span>
          <a
            href={new URL("/health", MCP_SERVER_URL).toString()}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-0.5 text-sm text-sky-600 dark:text-sky-400 hover:underline group"
          >
            raw /health
            <Arrow direction="up-right" />
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Indexed documents" value={formatCount(indexedDocs)} />
        <StatCard label="Indexed chunks" value={formatCount(indexedChunks)} />
        <StatCard label="Tool calls served" value={formatCount(totalCalls)} />
        <StatCard
          label="Blocked attempts"
          value={formatCount(totalDenials)}
          accent="text-rose-600 dark:text-rose-400"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="MCP tool calls">
          <KeyValueList
            entries={Object.entries(toolCalls)}
            empty="No tool calls recorded since the last restart."
          />
        </Card>

        <Card title="RBAC denials by security layer">
          <KeyValueList
            entries={Object.entries(denials).map(([layer, count]) => [
              DENIAL_LAYERS[layer] ?? layer,
              count,
            ])}
            empty="No blocked attempts since the last restart."
          />
          <p className="mt-3 text-xs text-zinc-500">
            Every denial here is the layered security model doing its job —
            details in{" "}
            <a
              className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 hover:underline group"
              href="https://github.com/HoodieYlya13/mcp-confluence-documentation-rag/blob/main/SECURITY.md"
              target="_blank"
              rel="noreferrer"
            >
              SECURITY.md
              <Arrow direction="up-right" />
            </a>
          </p>
        </Card>

        <Card title="Average tool latency">
          <KeyValueList
            entries={Object.entries(latencySums).map(([tool, sum]) => [
              tool,
              latencyCounts[tool]
                ? `${((sum / latencyCounts[tool]) * 1000).toFixed(0)} ms`
                : "—",
            ])}
            empty="No latency data since the last restart."
          />
        </Card>

        <Card title="Confluence sync">
          <KeyValueList
            entries={[
              ...Object.entries(syncRuns).map(
                ([trigger, count]) =>
                  [`runs (${trigger})`, count] as [string, number | string],
              ),
              [
                "last successful sync",
                lastSync ? new Date(lastSync * 1000).toUTCString() : "—",
              ],
            ]}
            empty="No sync data available."
          />
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between">
          <div>
            <h2 className="font-medium">Try the RBAC playground</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Ask the same question as a junior operator and as a core-team
              lead, and watch the document ACL filter produce different
              retrieval results — live, against the real index.
            </p>
          </div>
          <div>
            <Link
              href="/playground"
              className="mt-4 inline-flex items-center gap-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 group"
            >
              Open playground
              <Arrow direction="right" />
            </Link>
          </div>
        </div>

        <DownloadCard release={latestRelease} userOS={userOS} />
      </section>
    </div>
  );
}

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className={`text-2xl font-semibold font-mono ${accent ?? ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </div>
  );
}

function KeyValueList({
  entries,
  empty,
}: {
  entries: [string, number | string][];
  empty: string;
}) {
  if (entries.length === 0)
    return <p className="text-sm text-zinc-500">{empty}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([key, value]) => (
        <li
          key={key}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-zinc-600 dark:text-zinc-400 font-mono">
            {key}
          </span>
          <span className="font-mono font-medium">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function DownloadCard({
  release,
  userOS,
}: {
  release: ReleaseData | null;
  userOS: "mac" | "win" | "linux" | "unknown";
}) {
  const hotkey = userOS === "mac" ? "Cmd+Shift+Space" : "Ctrl+Shift+Space";

  if (!release)
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between">
        <div>
          <h2 className="font-medium flex items-center gap-2">
            <Image
              src={Logo}
              alt="Confluence Spotlight Logo"
              width={20}
              height={20}
              className="rounded"
            />
            Confluence Spotlight
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {userOS === "linux" ? (
              <>
                Summon the assistant search bar with the global shortcut{" "}
                <kbd className="font-mono text-xs border border-zinc-300 dark:border-zinc-700 rounded px-1 bg-zinc-50 dark:bg-zinc-800">
                  {hotkey}
                </kbd>{" "}
                to query the RAG agent instantly.
              </>
            ) : (
              <>
                An unsigned developer demo of the Spotlight search bar. Once
                running, summon it using the global shortcut{" "}
                <kbd className="font-mono text-xs border border-zinc-300 dark:border-zinc-700 rounded px-1 bg-zinc-50 dark:bg-zinc-800">
                  {hotkey}
                </kbd>
                .
              </>
            )}
          </p>
        </div>
        <div>
          <a
            href="https://github.com/HoodieYlya13/confluence-spotlight/releases"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-zinc-800 dark:bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 group"
          >
            View releases on GitHub
            <Arrow direction="up-right" />
          </a>
        </div>
      </div>
    );

  const { tagName, assets } = release;

  let targetAsset = null;
  let osName = "";

  switch (userOS) {
    case "mac":
      if (assets.mac) {
        targetAsset = assets.mac;
        osName = "macOS";
      }
      break;
    case "win":
      if (assets.win) {
        targetAsset = assets.win;
        osName = "Windows";
      }
      break;
    case "linux":
      targetAsset = assets.linuxAppImage || assets.linuxDeb;
      osName = "Linux";
      break;
  }

  if (!targetAsset) {
    targetAsset = assets.mac || assets.win || assets.linuxAppImage;
    osName = assets.mac ? "macOS" : assets.win ? "Windows" : "Linux";
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between gap-4 min-w-0 overflow-hidden">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium flex items-center gap-2">
            <Image
              src={Logo}
              alt="Confluence Spotlight Logo"
              width={20}
              height={20}
              className="rounded"
            />
            Confluence Spotlight
          </h2>
          <span className="rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 px-2 py-0.5 text-xs font-mono font-medium text-sky-600 dark:text-sky-400">
            {tagName}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {userOS === "linux" ? (
            <>
              Summon the client using the global shortcut{" "}
              <kbd className="font-mono text-xs border border-zinc-300 dark:border-zinc-700 rounded px-1 bg-zinc-50 dark:bg-zinc-800">
                {hotkey}
              </kbd>{" "}
              to query the RAG agent instantly.
            </>
          ) : (
            <>
              An unsigned developer demo of the Spotlight search bar. Once
              running, summon it using the global shortcut{" "}
              <kbd className="font-mono text-xs border border-zinc-300 dark:border-zinc-700 rounded px-1 bg-zinc-50 dark:bg-zinc-800">
                {hotkey}
              </kbd>
              .
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        {targetAsset && (
          <a
            href={targetAsset.browser_download_url}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            Download for {osName}
            <span className="text-xs font-normal opacity-85">
              ({(targetAsset.size / (1024 * 1024)).toFixed(1)} MB)
            </span>
          </a>
        )}

        <div className="text-center text-xs text-zinc-500 flex flex-wrap items-center justify-center gap-1.5">
          <span>Other platforms:</span>
          {assets.mac && (
            <a
              href={assets.mac.browser_download_url}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
            >
              macOS (.dmg)
            </a>
          )}
          {assets.mac &&
            (assets.win || assets.linuxDeb || assets.linuxAppImage) && (
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
            )}
          {assets.win && (
            <a
              href={assets.win.browser_download_url}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
            >
              Windows (.exe)
            </a>
          )}
          {assets.win && (assets.linuxDeb || assets.linuxAppImage) && (
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
          )}
          {assets.linuxAppImage && (
            <a
              href={assets.linuxAppImage.browser_download_url}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
            >
              Linux (AppImage)
            </a>
          )}
        </div>

        {userOS === "mac" && (
          <div className="rounded border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 leading-normal min-w-0 overflow-hidden">
            <strong>Bypass Gatekeeper:</strong> Drag the app to{" "}
            <code className="font-mono text-zinc-800 dark:text-zinc-200 bg-amber-100/50 dark:bg-amber-950/50 px-1 rounded">
              /Applications
            </code>
            , then run this in your Terminal:
            <pre className="mt-1.5 overflow-x-auto rounded bg-zinc-900 text-zinc-200 p-1.5 font-mono text-[10px] select-all leading-tight w-full max-w-full">
              xattr -dr com.apple.quarantine &quot;/Applications/Confluence
              Spotlight.app&quot;
            </pre>
          </div>
        )}
        {userOS === "win" && (
          <div className="rounded border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 leading-normal">
            <strong>SmartScreen Warning:</strong> Click <em>More info</em> then{" "}
            <em>Run anyway</em>. If blocked at work by antivirus (like Cortex
            XDR), please build and run the app from source.
          </div>
        )}
      </div>
    </div>
  );
}
