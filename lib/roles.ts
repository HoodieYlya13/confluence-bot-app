export const DEMO_ROLES = ["JUNIOR_OP", "ATS_CORE_LEAD"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export type SearchChunk = {
  doc_id: string;
  space: string;
  chunk_index: number;
  allowed_roles: string[];
  text: string;
  similarity_score: number;
};

export type PaneResult =
  | { ok: true; chunks: SearchChunk[] }
  | { ok: false; error: string };

export type SearchResponse = {
  query: string;
  topK: number;
  results: Record<DemoRole, PaneResult>;
};
