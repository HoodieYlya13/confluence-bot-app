import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tryCatch } from "./utils";

export const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL ??
  "https://hoodieylya13-mcp-confluence-documentation-rag.hf.space";

export type UpstreamHealth = {
  status: string;
  indexed_documents: number;
  total_chunks: number;
  retriever_backend: string;
};

export async function fetchHealth(): Promise<UpstreamHealth | null> {
  const [err, res] = await tryCatch(
    fetch(new URL("/health", MCP_SERVER_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (err || !res.ok) return null;

  const [jsonErr, data] = await tryCatch(res.json());
  if (jsonErr) return null;

  return data as UpstreamHealth;
}

export async function fetchMetricsText(): Promise<string | null> {
  const [err, res] = await tryCatch(
    fetch(new URL("/metrics", MCP_SERVER_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (err || !res.ok) return null;

  const [textErr, text] = await tryCatch(res.text());
  if (textErr) return null;

  return text;
}

export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

export type ReleaseData = {
  tagName: string;
  assets: {
    mac?: ReleaseAsset;
    win?: ReleaseAsset;
    linuxDeb?: ReleaseAsset;
    linuxAppImage?: ReleaseAsset;
  };
};

export async function fetchLatestRelease(): Promise<ReleaseData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("latest-release");

  const [err, res] = await tryCatch(
    fetch(
      "https://api.github.com/repos/HoodieYlya13/confluence-spotlight/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "confluence-bot-app",
        },
        signal: AbortSignal.timeout(5000),
      },
    ),
  );
  if (err || !res.ok) return null;

  const [jsonErr, data] = await tryCatch(res.json());
  if (jsonErr || !data) return null;

  const rawAssets = (data.assets || []) as {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
  const assets: ReleaseData["assets"] = {};

  for (const asset of rawAssets) {
    const name = asset.name.toLowerCase();
    const mappedAsset: ReleaseAsset = {
      name: asset.name,
      browser_download_url: asset.browser_download_url,
      size: asset.size,
    };

    const extension = name.split(".").pop();
    switch (extension) {
      case "dmg":
        assets.mac = mappedAsset;
        break;
      case "exe":
        if (name.includes("setup")) assets.win = mappedAsset;
        break;
      case "msi":
        if (!assets.win) assets.win = mappedAsset;
        break;
      case "deb":
        assets.linuxDeb = mappedAsset;
        break;
      case "appimage":
        assets.linuxAppImage = mappedAsset;
        break;
    }
  }

  return {
    tagName: data.tag_name,
    assets,
  };
}
