import { describe, expect, it } from "vitest";

import { buildPassages } from "./passage-builder";
import {
  PASTED_TEXT_CHARACTER_LIMIT,
  pastedTextReader,
  validatePastedText,
} from "./source-reader";

describe("pasted-text Source Reader", () => {
  it("normalizes text while preserving stable paragraph locations", () => {
    expect(
      pastedTextReader.read(
        " First  line\r\ncontinues.\r\n\r\n Second paragraph. ",
      ),
    ).toEqual([
      { paragraph: 1, content: "First line continues." },
      { paragraph: 2, content: "Second paragraph." },
    ]);
  });

  it("rejects empty and oversized content at the configured boundary", () => {
    expect(validatePastedText(" \n ").ok).toBe(false);
    expect(validatePastedText("a".repeat(PASTED_TEXT_CHARACTER_LIMIT)).ok).toBe(
      true,
    );
    expect(
      validatePastedText("a".repeat(PASTED_TEXT_CHARACTER_LIMIT + 1)).ok,
    ).toBe(false);
    expect(validatePastedText("abcd", 4).ok).toBe(true);
    expect(validatePastedText("abcde", 4).ok).toBe(false);
  });

  it("builds ordered overlapping Passages with paragraph ranges", () => {
    const paragraphs = [1, 2, 3].map((paragraph) => ({
      paragraph,
      content: `${paragraph}: ${"x".repeat(400)}`,
    }));
    expect(
      buildPassages(paragraphs).map(
        ({ ordinal, paragraphStart, paragraphEnd }) => ({
          ordinal,
          paragraphStart,
          paragraphEnd,
        }),
      ),
    ).toEqual([
      { ordinal: 0, paragraphStart: 1, paragraphEnd: 2 },
      { ordinal: 1, paragraphStart: 2, paragraphEnd: 3 },
    ]);
  });
});
