export const DEMO_ROLES = ["JUNIOR_OP", "ATS_CORE_LEAD"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_MODES = ["search", "answer"] as const;
export type DemoMode = (typeof DEMO_MODES)[number];

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

export type AnswerResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };
