import type { ProcessingStage } from "@/lib/database.types";

import { CLOUDFLARE_EMBEDDING } from "./cloudflare-embedding";
import { buildPassages, type BuiltPassage } from "./passage-builder";
import { pastedTextReader } from "./source-reader";

export type IngestionSource = {
  id: string;
  content: string;
  processingStage: ProcessingStage;
  retryStage: RetryStage | null;
  attemptCount: number;
};

export type RetryStage = "extracting" | "chunking" | "embedding";
export const EMBEDDING_BATCH_SIZE = 16;

export type IngestionPassage = BuiltPassage & {
  id: string;
  embedding: string | null;
};

export type SourceIngestionPersistence = {
  load(sourceId: string): Promise<IngestionSource>;
  transition(
    sourceId: string,
    from: ProcessingStage,
    to: ProcessingStage,
  ): Promise<IngestionSource>;
  replacePassages(sourceId: string, passages: BuiltPassage[]): Promise<void>;
  listPassages(sourceId: string): Promise<IngestionPassage[]>;
  saveEmbeddings(
    sourceId: string,
    embeddings: Array<{ ordinal: number; embedding: number[] }>,
  ): Promise<void>;
  markReady(sourceId: string): Promise<IngestionSource>;
  markFailed(
    sourceId: string,
    retryStage: RetryStage,
    category: string,
    correlationId: string,
  ): Promise<IngestionSource>;
};

export async function advanceSource(
  sourceId: string,
  correlationId: string,
  dependencies: {
    persistence: SourceIngestionPersistence;
    embed: (texts: string[]) => Promise<number[][]>;
  },
) {
  let source = await dependencies.persistence.load(sourceId);
  if (source.processingStage === "ready") return source;

  if (source.processingStage === "failed") {
    source = await dependencies.persistence.transition(
      sourceId,
      "failed",
      source.retryStage ?? "extracting",
    );
    return source;
  }

  if (source.processingStage === "uploaded") {
    return dependencies.persistence.transition(
      sourceId,
      "uploaded",
      "extracting",
    );
  }

  const retryStage = source.processingStage as RetryStage;
  try {
    if (source.processingStage === "extracting") {
      pastedTextReader.read(source.content);
      return dependencies.persistence.transition(
        sourceId,
        "extracting",
        "chunking",
      );
    }

    if (source.processingStage === "chunking") {
      const passages = buildPassages(pastedTextReader.read(source.content));
      if (!passages.length) throw new Error("source_content_empty");
      await dependencies.persistence.replacePassages(sourceId, passages);
      return dependencies.persistence.transition(
        sourceId,
        "chunking",
        "embedding",
      );
    }

    const passages = await dependencies.persistence.listPassages(sourceId);
    if (!passages.length) throw new Error("passages_missing");
    for (
      let start = 0;
      start < passages.length;
      start += EMBEDDING_BATCH_SIZE
    ) {
      const batch = passages.slice(start, start + EMBEDDING_BATCH_SIZE);
      const embeddings = await dependencies.embed(
        batch.map(({ content }) => content),
      );
      if (
        embeddings.length !== batch.length ||
        embeddings.some(
          ({ length }) => length !== CLOUDFLARE_EMBEDDING.dimensions,
        )
      ) {
        throw new Error("embedding_provider_dimension_mismatch");
      }
      await dependencies.persistence.saveEmbeddings(
        sourceId,
        batch.map((passage, index) => ({
          ordinal: passage.ordinal,
          embedding: embeddings[index]!,
        })),
      );
    }
    return dependencies.persistence.markReady(sourceId);
  } catch (error) {
    return dependencies.persistence.markFailed(
      sourceId,
      retryStage,
      safeIngestionCategory(error),
      correlationId,
    );
  }
}

export function safeIngestionCategory(error: unknown) {
  const category =
    error instanceof Error
      ? error.message.split(":", 1)[0]
      : "processing_failed";
  return [
    "source_content_empty",
    "passages_missing",
    "embedding_provider_not_configured",
    "embedding_provider_request_failed",
    "embedding_provider_invalid_response",
    "embedding_provider_dimension_mismatch",
    "embedding_provider_pooling_mismatch",
  ].includes(category)
    ? category
    : "processing_failed";
}
