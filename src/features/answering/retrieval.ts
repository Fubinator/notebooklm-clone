import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CLOUDFLARE_EMBEDDING, embedTexts } from "@/features/sources/embedding";
import type { Database } from "@/lib/database.types";

import type { EvidencePassage } from "./model";

export const RETRIEVAL_DEFAULTS = {
  matchCount: 5,
  minimumSimilarity: 0.42,
} as const;

export async function retrieveEvidence(
  supabase: SupabaseClient<Database>,
  notebookId: string,
  question: string,
): Promise<EvidencePassage[]> {
  const [embedding] = await embedTexts([question]);
  if (!embedding || embedding.length !== CLOUDFLARE_EMBEDDING.dimensions) {
    throw new Error("question_embedding_invalid");
  }

  const { data, error } = await supabase.rpc("retrieve_passages", {
    target_notebook_id: notebookId,
    question_embedding: `[${embedding.join(",")}]`,
    match_count: readIntegerEnvironment(
      "RETRIEVAL_MATCH_COUNT",
      RETRIEVAL_DEFAULTS.matchCount,
      1,
      8,
    ),
    minimum_similarity: readNumberEnvironment(
      "RETRIEVAL_MIN_SIMILARITY",
      RETRIEVAL_DEFAULTS.minimumSimilarity,
      0,
      1,
    ),
  });

  if (error) throw error;
  return (data ?? []).map((passage) => ({
    passageId: passage.passage_id,
    sourceId: passage.source_id,
    sourceTitle: passage.source_title,
    sourceKind: passage.source_kind,
    content: passage.content,
    pageNumber: passage.page_number,
    paragraphStart: passage.paragraph_start,
    paragraphEnd: passage.paragraph_end,
    similarity: passage.similarity,
  }));
}

function readNumberEnvironment(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function readIntegerEnvironment(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = readNumberEnvironment(name, fallback, minimum, maximum);
  return Number.isInteger(value) ? value : fallback;
}
