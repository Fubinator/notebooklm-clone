export type EvidencePassage = {
  passageId: string;
  sourceId: string;
  sourceTitle: string;
  sourceKind: "pdf" | "pasted_text";
  content: string;
  pageNumber: number | null;
  paragraphStart: number | null;
  paragraphEnd: number | null;
  similarity: number;
};

export type ChatModelRequest = {
  question: string;
  evidence: EvidencePassage[];
  repair?: {
    previousOutput: unknown;
    reason: string;
  };
};

export type ChatModel = {
  provider: string;
  model: string;
  generate(request: ChatModelRequest): Promise<unknown>;
};

export type ValidatedModelAnswer = {
  answer: string;
  citationIds: string[];
};

export type ModelAnswerValidation =
  { ok: true; value: ValidatedModelAnswer } | { ok: false; reason: string };

export function validateModelAnswer(
  output: unknown,
  evidence: EvidencePassage[],
): ModelAnswerValidation {
  let candidate = output;

  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return { ok: false, reason: "The response was not valid JSON." };
    }
  }

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, reason: "The response was not an object." };
  }

  const record = candidate as Record<string, unknown>;
  const answer = typeof record.answer === "string" ? record.answer.trim() : "";
  const citations = record.citation_ids;

  if (!answer || answer.length > 12_000) {
    return { ok: false, reason: "The Answer text was empty or too long." };
  }

  if (
    !Array.isArray(citations) ||
    citations.length === 0 ||
    citations.some((citation) => typeof citation !== "string")
  ) {
    return { ok: false, reason: "At least one Citation ID is required." };
  }

  const citationIds = citations as string[];
  if (new Set(citationIds).size !== citationIds.length) {
    return { ok: false, reason: "Citation IDs must not be repeated." };
  }

  const evidenceIds = new Set(evidence.map(({ passageId }) => passageId));
  if (citationIds.some((citationId) => !evidenceIds.has(citationId))) {
    return {
      ok: false,
      reason: "A Citation ID was outside the retrieved evidence set.",
    };
  }

  return { ok: true, value: { answer, citationIds } };
}
