import { afterEach, describe, expect, it } from "vitest";

import { getApplicationLimits, getDeploymentQuestionCeiling } from "./limits";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("application limits", () => {
  it("uses safe documented defaults", () => {
    delete process.env.NOTEBOOKS_PER_GUEST;
    delete process.env.SOURCES_PER_NOTEBOOK;
    delete process.env.CONCURRENT_INGESTIONS_PER_GUEST;
    delete process.env.QUESTIONS_PER_GUEST_PER_UTC_DAY;
    delete process.env.DEPLOYMENT_QUESTION_HARD_CEILING;
    delete process.env.PASTED_TEXT_CHARACTER_LIMIT;
    delete process.env.PDF_BYTE_LIMIT;
    delete process.env.PDF_PAGE_LIMIT;
    delete process.env.PASSAGE_TARGET_CHARACTERS;
    delete process.env.PASSAGE_OVERLAP_CHARACTERS;
    delete process.env.PASSAGE_OVERLAP_PARAGRAPHS;

    expect(getApplicationLimits()).toEqual({
      notebooksPerGuest: 5,
      sourcesPerNotebook: 5,
      concurrentIngestionsPerGuest: 1,
      questionsPerGuestPerUtcDay: 20,
      pastedTextCharacters: 50_000,
      pdfBytes: 10 * 1024 * 1024,
      pdfPages: 50,
      passageTargetCharacters: 900,
      passageOverlapCharacters: 150,
      passageOverlapParagraphs: 1,
    });
    expect(getDeploymentQuestionCeiling()).toBe(1000);
  });

  it("accepts positive integer overrides and rejects unsafe values", () => {
    process.env.NOTEBOOKS_PER_GUEST = "7";
    process.env.SOURCES_PER_NOTEBOOK = "0";
    process.env.QUESTIONS_PER_GUEST_PER_UTC_DAY = "12.5";
    process.env.DEPLOYMENT_QUESTION_HARD_CEILING = "500";
    process.env.PDF_PAGE_LIMIT = "25";
    process.env.PASSAGE_TARGET_CHARACTERS = "600";
    process.env.PASSAGE_OVERLAP_CHARACTERS = "100";
    process.env.PASSAGE_OVERLAP_PARAGRAPHS = "2";

    expect(getApplicationLimits().notebooksPerGuest).toBe(7);
    expect(getApplicationLimits().sourcesPerNotebook).toBe(5);
    expect(getApplicationLimits().questionsPerGuestPerUtcDay).toBe(20);
    expect(getApplicationLimits().pdfPages).toBe(25);
    expect(getApplicationLimits().passageTargetCharacters).toBe(600);
    expect(getApplicationLimits().passageOverlapCharacters).toBe(100);
    expect(getApplicationLimits().passageOverlapParagraphs).toBe(2);
    expect(getDeploymentQuestionCeiling()).toBe(500);
  });
});
