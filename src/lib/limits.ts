export type ApplicationLimits = {
  notebooksPerGuest: number;
  sourcesPerNotebook: number;
  concurrentIngestionsPerGuest: number;
  questionsPerGuestPerUtcDay: number;
};

export const DEFAULT_APPLICATION_LIMITS: ApplicationLimits = {
  notebooksPerGuest: 5,
  sourcesPerNotebook: 5,
  concurrentIngestionsPerGuest: 1,
  questionsPerGuestPerUtcDay: 20,
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
  };
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
