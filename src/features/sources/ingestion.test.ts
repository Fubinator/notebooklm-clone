import { afterEach, describe, expect, it, vi } from "vitest";

import {
  advanceSource,
  type IngestionSource,
  type SourceIngestionPersistence,
} from "./ingestion";
import type { BuiltPassage } from "./passage-builder";

afterEach(() => {
  vi.useRealTimers();
});

function source(
  processingStage: IngestionSource["processingStage"],
): IngestionSource {
  return {
    id: "source",
    content: "First paragraph.\n\nSecond paragraph.",
    kind: "pasted_text",
    storagePath: null,
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
    acquireLease: vi.fn(async () => undefined),
    renewLease: vi.fn(async () => undefined),
    releaseLease: vi.fn(async () => undefined),
    load: vi.fn(async () => current),
    loadOriginal: vi.fn(async () => new Uint8Array()),
    saveExtractedContent: vi.fn(async (_id, content) => {
      current = { ...current, content };
    }),
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
  return {
    mock,
    passages,
    setSource(next: IngestionSource) {
      current = next;
    },
    getSource() {
      return current;
    },
  };
}

describe("Source Ingestion", () => {
  it("never advances a Source whose removal has begun", async () => {
    const state = persistence(source("deleting"));

    await expect(
      advanceSource("source", "correlation", {
        persistence: state.mock,
        embed: vi.fn(),
        concurrentLimit: 1,
      }),
    ).rejects.toThrow("source_deleting");

    expect(state.mock.transition).not.toHaveBeenCalled();
    expect(state.mock.markFailed).not.toHaveBeenCalled();
    expect(state.mock.releaseLease).toHaveBeenCalledWith(
      "source",
      "correlation",
    );
  });

  it("owns the lease lifecycle and releases it after failures", async () => {
    const state = persistence(source("embedding"));
    await state.mock.replacePassages("source", [
      { ordinal: 0, content: "Evidence", paragraphStart: 1, paragraphEnd: 1 },
    ]);
    vi.mocked(state.mock.saveEmbeddings).mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi.fn(async () => [Array(384).fill(0.1)]),
      concurrentLimit: 1,
    });

    expect(state.mock.acquireLease).toHaveBeenCalledWith(
      "source",
      "correlation",
      1,
    );
    expect(state.mock.releaseLease).toHaveBeenCalledWith(
      "source",
      "correlation",
    );
  });

  it("stops without persisting when lease renewal fails", async () => {
    const state = persistence(source("embedding"));
    await state.mock.replacePassages("source", [
      { ordinal: 0, content: "Evidence", paragraphStart: 1, paragraphEnd: 1 },
    ]);
    vi.mocked(state.mock.renewLease).mockRejectedValueOnce(
      new Error("lease expired"),
    );

    await expect(
      advanceSource("source", "correlation", {
        persistence: state.mock,
        embed: vi.fn(async () => [Array(384).fill(0.1)]),
        concurrentLimit: 1,
      }),
    ).rejects.toThrow("ingestion_lease_lost");

    expect(state.mock.saveEmbeddings).not.toHaveBeenCalled();
    expect(state.mock.markReady).not.toHaveBeenCalled();
    expect(state.mock.markFailed).not.toHaveBeenCalled();
    expect(state.mock.releaseLease).toHaveBeenCalledWith(
      "source",
      "correlation",
    );
  });

  it("does not convert lease loss into an uploaded-stage failure", async () => {
    const state = persistence(source("uploaded"));
    vi.mocked(state.mock.renewLease).mockRejectedValue(
      new Error("lease expired"),
    );

    await expect(
      advanceSource("source", "correlation", {
        persistence: state.mock,
        embed: vi.fn(),
        concurrentLimit: 1,
      }),
    ).rejects.toThrow("ingestion_lease_lost");

    expect(state.mock.transition).not.toHaveBeenCalled();
    expect(state.mock.markFailed).not.toHaveBeenCalled();
  });

  it("surfaces a heartbeat failure before persisting provider output", async () => {
    vi.useFakeTimers();
    const state = persistence(source("embedding"));
    await state.mock.replacePassages("source", [
      { ordinal: 0, content: "Evidence", paragraphStart: 1, paragraphEnd: 1 },
    ]);
    vi.mocked(state.mock.renewLease).mockRejectedValue(
      new Error("lease expired"),
    );
    let finishEmbedding: (value: number[][]) => void = () => undefined;
    const embed = vi.fn(
      () =>
        new Promise<number[][]>((resolve) => {
          finishEmbedding = resolve;
        }),
    );

    const advancing = advanceSource("source", "correlation", {
      persistence: state.mock,
      embed,
      concurrentLimit: 1,
    });
    await vi.advanceTimersByTimeAsync(30_000);
    finishEmbedding([Array(384).fill(0.1)]);

    await expect(advancing).rejects.toThrow("ingestion_lease_lost");
    expect(state.mock.saveEmbeddings).not.toHaveBeenCalled();
    expect(state.mock.markReady).not.toHaveBeenCalled();
  });

  it("advances one persisted Processing Stage per request", async () => {
    const state = persistence(source("uploaded"));
    const embed = vi.fn(async (texts: string[]) =>
      texts.map(() => Array(384).fill(0.1)),
    );
    for (let request = 0; request < 4; request += 1) {
      await advanceSource("source", "correlation", {
        persistence: state.mock,
        embed,
        concurrentLimit: 1,
      });
    }
    expect(state.mock.transition).toHaveBeenCalledWith(
      "source",
      "uploaded",
      "extracting",
    );
    expect(state.getSource().processingStage).toBe("ready");
    expect(state.passages).toEqual([
      expect.objectContaining({
        ordinal: 0,
        paragraphStart: 1,
        paragraphEnd: 2,
        embedding: expect.any(String),
      }),
    ]);
  });

  it("repeating chunking replaces stable ordinals instead of duplicating Passages", async () => {
    const state = persistence(source("chunking"));
    await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi.fn(),
      concurrentLimit: 1,
    });
    const first = [...state.passages];
    state.setSource(source("chunking"));
    await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi.fn(),
      concurrentLimit: 1,
    });
    expect(state.passages).toHaveLength(first.length);
    expect(state.passages.map(({ ordinal }) => ordinal)).toEqual(
      first.map(({ ordinal }) => ordinal),
    );
  });

  it("persists safe failure metadata and retries through the confirmed interface", async () => {
    const state = persistence(source("embedding"));
    await state.mock.replacePassages("source", [
      { ordinal: 0, content: "Evidence", paragraphStart: 1, paragraphEnd: 1 },
    ]);
    const result = await advanceSource("source", "correlation", {
      persistence: state.mock,
      concurrentLimit: 1,
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

    await advanceSource("source", "retry-correlation", {
      persistence: state.mock,
      embed: vi.fn(),
      concurrentLimit: 1,
    });
    const embed = vi.fn(async () => [Array(384).fill(0.2)]);
    const ready = await advanceSource("source", "retry-correlation", {
      persistence: state.mock,
      embed,
      concurrentLimit: 1,
    });
    expect(ready.processingStage).toBe("ready");

    state.setSource(source("embedding"));
    await advanceSource("source", "repeated-correlation", {
      persistence: state.mock,
      embed,
      concurrentLimit: 1,
    });
    expect(state.passages).toHaveLength(1);
    expect(state.passages[0]!.embedding).toBe(
      `[${Array(384).fill(0.2).join(",")}]`,
    );
  });

  it("stores failure metadata when the uploaded transition fails", async () => {
    const state = persistence(source("uploaded"));
    vi.mocked(state.mock.transition).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const result = await advanceSource("source", "correlation", {
      persistence: state.mock,
      embed: vi.fn(),
      concurrentLimit: 1,
    });
    expect(result).toMatchObject({
      processingStage: "failed",
      retryStage: "extracting",
      attemptCount: 1,
    });
    expect(state.mock.markFailed).toHaveBeenCalledWith(
      "source",
      "extracting",
      "processing_failed",
      "correlation",
    );
  });
});
