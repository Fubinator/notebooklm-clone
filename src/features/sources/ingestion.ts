import type { ProcessingStage } from "@/lib/database.types";

import { CLOUDFLARE_EMBEDDING } from "./cloudflare-embedding";
import {
  buildPassages,
  buildPdfPassages,
  PASSAGE_OVERLAP_CHARACTERS,
  PASSAGE_TARGET_CHARACTERS,
  type BuiltPassage,
} from "./passage-builder";
import {
  deserializePdfPages,
  PDF_PAGE_LIMIT,
  pastedTextReader,
  pdfReader,
  serializePdfPages,
} from "./source-reader";

export type IngestionSource = {
  id: string;
  content: string;
  kind: "pdf" | "pasted_text";
  storagePath: string | null;
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
  acquireLease(
    sourceId: string,
    correlationId: string,
    concurrentLimit: number,
  ): Promise<void>;
  renewLease(sourceId: string, correlationId: string): Promise<void>;
  releaseLease(sourceId: string, correlationId: string): Promise<void>;
  load(sourceId: string): Promise<IngestionSource>;
  transition(
    sourceId: string,
    from: ProcessingStage,
    to: ProcessingStage,
  ): Promise<IngestionSource>;
  replacePassages(sourceId: string, passages: BuiltPassage[]): Promise<void>;
  loadOriginal(sourceId: string): Promise<Uint8Array>;
  saveExtractedContent(sourceId: string, content: string): Promise<void>;
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
    concurrentLimit: number;
    pdfPageLimit?: number;
    passageTargetCharacters?: number;
    passageOverlapCharacters?: number;
  },
) {
  await dependencies.persistence.acquireLease(
    sourceId,
    correlationId,
    dependencies.concurrentLimit,
  );
  let leaseLost = false;
  let renewalInFlight = false;
  const renewLease = async () => {
    if (leaseLost) throw new Error("ingestion_lease_lost");
    try {
      await dependencies.persistence.renewLease(sourceId, correlationId);
    } catch {
      leaseLost = true;
      throw new Error("ingestion_lease_lost");
    }
  };
  const heartbeat = setInterval(() => {
    if (renewalInFlight || leaseLost) return;
    renewalInFlight = true;
    void renewLease()
      .catch(() => {
        leaseLost = true;
      })
      .finally(() => {
        renewalInFlight = false;
      });
  }, 30_000);
  const assertLease = async () => {
    await renewLease();
  };
  try {
    return await advanceSourceStage(sourceId, correlationId, {
      ...dependencies,
      pdfPageLimit: dependencies.pdfPageLimit ?? PDF_PAGE_LIMIT,
      passageTargetCharacters:
        dependencies.passageTargetCharacters ?? PASSAGE_TARGET_CHARACTERS,
      passageOverlapCharacters:
        dependencies.passageOverlapCharacters ?? PASSAGE_OVERLAP_CHARACTERS,
      assertLease,
    });
  } finally {
    clearInterval(heartbeat);
    await dependencies.persistence.releaseLease(sourceId, correlationId);
  }
}

async function advanceSourceStage(
  sourceId: string,
  correlationId: string,
  dependencies: {
    persistence: SourceIngestionPersistence;
    embed: (texts: string[]) => Promise<number[][]>;
    pdfPageLimit: number;
    passageTargetCharacters: number;
    passageOverlapCharacters: number;
    assertLease: () => Promise<void>;
  },
) {
  let source = await dependencies.persistence.load(sourceId);
  if (source.processingStage === "ready") return source;

  if (source.processingStage === "failed") {
    await dependencies.assertLease();
    source = await dependencies.persistence.transition(
      sourceId,
      "failed",
      source.retryStage ?? "extracting",
    );
    return source;
  }

  if (source.processingStage === "uploaded") {
    try {
      await dependencies.assertLease();
      return await dependencies.persistence.transition(
        sourceId,
        "uploaded",
        "extracting",
      );
    } catch (error) {
      if (isIngestionLeaseLost(error)) throw error;
      await dependencies.assertLease();
      return dependencies.persistence.markFailed(
        sourceId,
        "extracting",
        safeIngestionCategory(error),
        correlationId,
      );
    }
  }

  const retryStage = source.processingStage as RetryStage;
  try {
    if (source.processingStage === "extracting") {
      if (source.kind === "pdf") {
        const pages = await pdfReader.read(
          await dependencies.persistence.loadOriginal(sourceId),
          dependencies.pdfPageLimit,
        );
        await dependencies.assertLease();
        await dependencies.persistence.saveExtractedContent(
          sourceId,
          serializePdfPages(pages),
        );
      } else {
        pastedTextReader.read(source.content);
      }
      await dependencies.assertLease();
      return dependencies.persistence.transition(
        sourceId,
        "extracting",
        "chunking",
      );
    }

    if (source.processingStage === "chunking") {
      const passages =
        source.kind === "pdf"
          ? buildPdfPassages(
              deserializePdfPages(source.content),
              dependencies.passageTargetCharacters,
              dependencies.passageOverlapCharacters,
            )
          : buildPassages(
              pastedTextReader.read(source.content),
              dependencies.passageTargetCharacters,
            );
      if (!passages.length) throw new Error("source_content_empty");
      await dependencies.assertLease();
      await dependencies.persistence.replacePassages(sourceId, passages);
      await dependencies.assertLease();
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
      await dependencies.assertLease();
      await dependencies.persistence.saveEmbeddings(
        sourceId,
        batch.map((passage, index) => ({
          ordinal: passage.ordinal,
          embedding: embeddings[index]!,
        })),
      );
    }
    await dependencies.assertLease();
    return dependencies.persistence.markReady(sourceId);
  } catch (error) {
    if (isIngestionLeaseLost(error)) throw error;
    await dependencies.assertLease();
    return dependencies.persistence.markFailed(
      sourceId,
      retryStage,
      safeIngestionCategory(error),
      correlationId,
    );
  }
}

function isIngestionLeaseLost(error: unknown) {
  return error instanceof Error && error.message === "ingestion_lease_lost";
}

export function safeIngestionCategory(error: unknown) {
  const category =
    error instanceof Error
      ? error.message.split(":", 1)[0]
      : "processing_failed";
  return [
    "source_content_empty",
    "pdf_type_unsupported",
    "pdf_content_empty",
    "pdf_encrypted",
    "pdf_unreadable",
    "pdf_page_limit",
    "pdf_storage_missing",
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
