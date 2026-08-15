import { describe, expect, it } from "vitest";

import { safeErrorCategory } from "./structured-log";

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
});
