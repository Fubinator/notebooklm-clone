import { afterEach, describe, expect, it, vi } from "vitest";

import { safeErrorCategory, writeStructuredLog } from "./structured-log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safe error categories", () => {
  it("allows known categories without retaining attached details", () => {
    expect(
      safeErrorCategory(
        new Error("embedding_provider_request_failed:private provider body"),
      ),
    ).toBe("embedding_provider_request_failed");
  });

  it("does not log arbitrary exception text", () => {
    expect(safeErrorCategory(new Error("Source content: do not log me"))).toBe(
      "unknown_failure",
    );
  });

  it("emits the complete content-free observability contract", () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    writeStructuredLog("info", {
      operation: "grounded_answering",
      correlationId: "correlation-1",
      guestId: "guest-1",
      notebookId: "notebook-1",
      stage: "complete",
      durationMs: 42,
      outcome: "completed",
      provider: "cloudflare-workers-ai",
      model: "answer-model",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      category: "answer_provider_request_failed",
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      operation: "grounded_answering",
      correlationId: "correlation-1",
      guestId: "guest-1",
      notebookId: "notebook-1",
      stage: "complete",
      durationMs: 42,
      outcome: "completed",
      provider: "cloudflare-workers-ai",
      model: "answer-model",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      category: "answer_provider_request_failed",
    });
    expect(serialized).not.toContain("Source content");
    expect(serialized).not.toContain("Passage text");
    expect(serialized).not.toContain("secret-token");
  });
});
