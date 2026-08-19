import { describe, expect, it } from "vitest";

import {
  SOURCE_TITLE_CHARACTER_LIMIT,
  normalizeSourceTitle,
  sourceTitleFromPdfFilename,
} from "./source-title";

describe("Source titles", () => {
  it("normalizes whitespace in an entered title", () => {
    expect(normalizeSourceTitle("  Interview   notes\n2026  ")).toBe(
      "Interview notes 2026",
    );
  });

  it("generates a readable title from a PDF filename", () => {
    expect(sourceTitleFromPdfFilename("AI_Risk-Management Guide.PDF")).toBe(
      "AI Risk Management Guide",
    );
  });

  it("falls back when the filename has no usable stem", () => {
    expect(sourceTitleFromPdfFilename(".pdf")).toBe("Untitled PDF");
  });

  it("caps generated titles at the Source title limit", () => {
    const title = sourceTitleFromPdfFilename(
      `${"a".repeat(SOURCE_TITLE_CHARACTER_LIMIT + 20)}.pdf`,
    );

    expect(title).toHaveLength(SOURCE_TITLE_CHARACTER_LIMIT);
  });
});
