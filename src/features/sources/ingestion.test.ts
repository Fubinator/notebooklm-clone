import { describe, expect, it, vi } from "vitest";

import {
  advanceSource,
  type IngestionSource,
  type SourceIngestionPersistence,
} from "./ingestion";
import type { BuiltPassage } from "./passage-builder";

function source(
  processingStage: IngestionSource["processingStage"],
): IngestionSource {
  return {
    id: "source",
    content: "First paragraph.\n\nSecond paragraph.",
    processingStage,
    retryStage: null,
    attemptCount: 0,
  };
}

function persistence(current: IngestionSource) {
  const passages: Array<{
    id: string;
    ordinal: number;
    content: string;
    paragraphStart: number;
    paragraphEnd: number;
    embedding: string | null;
  }> = [];
  const mock: SourceIngestionPersistence = {
    load: vi.fn(async () => current),
    transition: vi.fn(
      async (_id, _from, to) =>
        (current = { ...current, processingStage: to, retryStage: null }),
    ),
    replacePassages: vi.fn(async (_id: string, built: BuiltPassage[]) => {
      passages.splice(
        0,
        passages.length,
        ...built.map((item) => ({
          ...item,
          id: `p${item.ordinal}`,
          embedding: null,
        })),
      );
    }),
    listPassages: vi.fn(async () => passages),
    saveEmbeddings: vi.fn(
      async (
        _id: string,
        items: Array<{ ordinal: number; embedding: number[] }>,
      ) =>
        items.forEach((item) => {
          passages[item.ordinal]!.embedding = `[${item.embedding.join(",")}]`;
        }),
    ),
    markReady: vi.fn(
      async () => (current = { ...current, processingStage: "ready" }),
    ),
    markFailed: vi.fn(
      async (_id, retryStage) =>
        (current = {
          ...current,
          processingStage: "failed",
          retryStage,
          attemptCount: current.attemptCount + 1,
        }),
    ),
  };
  return { mock, passages };
}

describe("Source Ingestion", () => {
  it("advances one persisted Processing Stage per request", async () => {
    const state = persistence(source("uploaded"));
    await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi.fn(),
    });
    expect(state.mock.transition).toHaveBeenCalledWith(
      "source",
      "uploaded",
      "extracting",
    );
  });

  it("repeating chunking replaces stable ordinals instead of duplicating Passages", async () => {
    const state = persistence(source("chunking"));
    await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi.fn(),
    });
    const first = [...state.passages];
    await state.mock.replacePassages("source", first);
    expect(state.passages).toHaveLength(first.length);
    expect(state.passages.map(({ ordinal }) => ordinal)).toEqual(
      first.map(({ ordinal }) => ordinal),
    );
  });

  it("persists a safe retry stage when embedding fails", async () => {
    const state = persistence(source("embedding"));
    await state.mock.replacePassages("source", [
      { ordinal: 0, content: "Evidence", paragraphStart: 1, paragraphEnd: 1 },
    ]);
    const result = await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi
        .fn()
        .mockRejectedValue(
          new Error("embedding_provider_request_failed:secret response"),
        ),
    });
    expect(result).toMatchObject({
      processingStage: "failed",
      retryStage: "embedding",
      attemptCount: 1,
    });
    expect(state.mock.markFailed).toHaveBeenCalledWith(
      "source",
      "embedding",
      "embedding_provider_request_failed",
      "correlation",
    );
  });
});
