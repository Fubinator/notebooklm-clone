import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ProcessingStage } from "@/lib/database.types";

import type {
  IngestionSource,
  RetryStage,
  SourceIngestionPersistence,
} from "./ingestion";
import type { BuiltPassage } from "./passage-builder";

export function createSourceIngestionPersistence(
  supabase: SupabaseClient<Database>,
  guestId: string,
): SourceIngestionPersistence {
  async function load(sourceId: string): Promise<IngestionSource> {
    const { data, error } = await supabase
      .from("sources")
      .select(
        "id, content, processing_stage, retry_stage, attempt_count, notebooks!inner(owner_id, is_example)",
      )
      .eq("id", sourceId)
      .eq("notebooks.owner_id", guestId)
      .eq("notebooks.is_example", false)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("source_not_authorized");
    return mapSource(data);
  }

  async function transition(
    sourceId: string,
    from: ProcessingStage,
    to: ProcessingStage,
  ) {
    const { data, error } = await supabase
      .from("sources")
      .update({
        processing_stage: to,
        failure_category: null,
        retry_stage: null,
        correlation_id: null,
      })
      .eq("id", sourceId)
      .eq("processing_stage", from)
      .select("id, content, processing_stage, retry_stage, attempt_count")
      .maybeSingle();
    if (error) throw error;
    return data ? mapSource(data) : load(sourceId);
  }

  return {
    load,
    transition,
    async replacePassages(sourceId: string, passages: BuiltPassage[]) {
      const { error: upsertError } = await supabase.from("passages").upsert(
        passages.map((passage) => ({
          source_id: sourceId,
          ordinal: passage.ordinal,
          content: passage.content,
          page_number: null,
          paragraph_start: passage.paragraphStart,
          paragraph_end: passage.paragraphEnd,
          embedding: null,
        })),
        { onConflict: "source_id,ordinal" },
      );
      if (upsertError) throw upsertError;
      const { error: deleteError } = await supabase
        .from("passages")
        .delete()
        .eq("source_id", sourceId)
        .gte("ordinal", passages.length);
      if (deleteError) throw deleteError;
    },
    async listPassages(sourceId) {
      const { data, error } = await supabase
        .from("passages")
        .select(
          "id, ordinal, content, paragraph_start, paragraph_end, embedding",
        )
        .eq("source_id", sourceId)
        .order("ordinal");
      if (error) throw error;
      return (data ?? []).map((passage) => ({
        id: passage.id,
        ordinal: passage.ordinal,
        content: passage.content,
        paragraphStart: passage.paragraph_start!,
        paragraphEnd: passage.paragraph_end!,
        embedding: passage.embedding,
      }));
    },
    async saveEmbeddings(sourceId, embeddings) {
      for (const item of embeddings) {
        const { error } = await supabase
          .from("passages")
          .update({ embedding: `[${item.embedding.join(",")}]` })
          .eq("source_id", sourceId)
          .eq("ordinal", item.ordinal);
        if (error) throw error;
      }
    },
    async markReady(sourceId) {
      const passages = await this.listPassages(sourceId);
      if (!passages.length || passages.some(({ embedding }) => !embedding)) {
        throw new Error("passages_not_queryable");
      }
      return transition(sourceId, "embedding", "ready");
    },
    async markFailed(
      sourceId,
      retryStage: RetryStage,
      category,
      correlationId,
    ) {
      const current = await load(sourceId);
      const { data, error } = await supabase
        .from("sources")
        .update({
          processing_stage: "failed",
          failure_category: category,
          retry_stage: retryStage,
          attempt_count: current.attemptCount + 1,
          correlation_id: correlationId,
        })
        .eq("id", sourceId)
        .eq("processing_stage", current.processingStage)
        .select("id, content, processing_stage, retry_stage, attempt_count")
        .maybeSingle();
      if (error) throw error;
      return data ? mapSource(data) : load(sourceId);
    },
  };
}

function mapSource(source: {
  id: string;
  content: string;
  processing_stage: ProcessingStage;
  retry_stage: RetryStage | null;
  attempt_count: number;
}): IngestionSource {
  return {
    id: source.id,
    content: source.content,
    processingStage: source.processing_stage,
    retryStage: source.retry_stage,
    attemptCount: source.attempt_count,
  };
}
