export type ApplicationLimits = {
  notebooksPerGuest: number;
  sourcesPerNotebook: number;
  concurrentIngestionsPerGuest: number;
  questionsPerGuestPerUtcDay: number;
  pastedTextCharacters: number;
  pdfBytes: number;
  pdfPages: number;
  passageTargetCharacters: number;
  passageOverlapCharacters: number;
  passageOverlapParagraphs: number;
};

export type SourceInputLimits = Pick<
  ApplicationLimits,
  "pastedTextCharacters" | "pdfBytes" | "pdfPages"
>;

export type PassageLimits = {
  targetCharacters: number;
  overlapCharacters: number;
  overlapParagraphs: number;
};

export const DEFAULT_APPLICATION_LIMITS: ApplicationLimits = {
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
};

export function getApplicationLimits(): ApplicationLimits {
  return {
    notebooksPerGuest: positiveInteger(
      process.env.NOTEBOOKS_PER_GUEST,
      DEFAULT_APPLICATION_LIMITS.notebooksPerGuest,
    ),
    sourcesPerNotebook: positiveInteger(
      process.env.SOURCES_PER_NOTEBOOK,
      DEFAULT_APPLICATION_LIMITS.sourcesPerNotebook,
    ),
    concurrentIngestionsPerGuest: positiveInteger(
      process.env.CONCURRENT_INGESTIONS_PER_GUEST,
      DEFAULT_APPLICATION_LIMITS.concurrentIngestionsPerGuest,
    ),
    questionsPerGuestPerUtcDay: positiveInteger(
      process.env.QUESTIONS_PER_GUEST_PER_UTC_DAY,
      DEFAULT_APPLICATION_LIMITS.questionsPerGuestPerUtcDay,
    ),
    pastedTextCharacters: positiveInteger(
      process.env.PASTED_TEXT_CHARACTER_LIMIT,
      DEFAULT_APPLICATION_LIMITS.pastedTextCharacters,
    ),
    pdfBytes: positiveInteger(
      process.env.PDF_BYTE_LIMIT,
      DEFAULT_APPLICATION_LIMITS.pdfBytes,
    ),
    pdfPages: positiveInteger(
      process.env.PDF_PAGE_LIMIT,
      DEFAULT_APPLICATION_LIMITS.pdfPages,
    ),
    passageTargetCharacters: positiveInteger(
      process.env.PASSAGE_TARGET_CHARACTERS,
      DEFAULT_APPLICATION_LIMITS.passageTargetCharacters,
    ),
    passageOverlapCharacters: boundedOverlap(
      process.env.PASSAGE_OVERLAP_CHARACTERS,
      positiveInteger(
        process.env.PASSAGE_TARGET_CHARACTERS,
        DEFAULT_APPLICATION_LIMITS.passageTargetCharacters,
      ),
      DEFAULT_APPLICATION_LIMITS.passageOverlapCharacters,
    ),
    passageOverlapParagraphs: nonNegativeInteger(
      process.env.PASSAGE_OVERLAP_PARAGRAPHS,
      DEFAULT_APPLICATION_LIMITS.passageOverlapParagraphs,
    ),
  };
}

export function sourceInputLimits(
  limits: ApplicationLimits,
): SourceInputLimits {
  return {
    pastedTextCharacters: limits.pastedTextCharacters,
    pdfBytes: limits.pdfBytes,
    pdfPages: limits.pdfPages,
  };
}

export function passageLimits(limits: ApplicationLimits): PassageLimits {
  return {
    targetCharacters: limits.passageTargetCharacters,
    overlapCharacters: limits.passageOverlapCharacters,
    overlapParagraphs: limits.passageOverlapParagraphs,
  };
}

export function formatMegabytes(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function boundedOverlap(
  value: string | undefined,
  target: number,
  fallback: number,
) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed < target
    ? parsed
    : Math.min(fallback, target - 1);
}

export function getDeploymentQuestionCeiling() {
  return nonNegativeInteger(process.env.DEPLOYMENT_QUESTION_HARD_CEILING, 1000);
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
