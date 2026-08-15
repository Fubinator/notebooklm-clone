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

export type AnswerModelRequest = {
  question: string;
  evidence: EvidencePassage[];
  repair?: {
    previousOutput: unknown;
    reason: string;
  };
};

export type AnswerModel = {
  provider: string;
  model: string;
  generate(request: AnswerModelRequest): Promise<unknown>;
  tokenUsage?():
    | { inputTokens: number; outputTokens: number; totalTokens: number }
    | undefined;
};

export type ValidatedModelAnswer =
  | {
      kind: "grounded";
      answer: string;
      citationIds: string[];
    }
  | { kind: "insufficient_evidence" };

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
  const answerKind = record.answer_kind;
  const answer = typeof record.answer === "string" ? record.answer.trim() : "";
  const citations = record.citation_ids;

  if (answerKind === "insufficient_evidence") {
    if (!Array.isArray(citations) || citations.length !== 0) {
      return {
        ok: false,
        reason: "An insufficient-evidence response cannot claim Citations.",
      };
    }

    return { ok: true, value: { kind: "insufficient_evidence" } };
  }

  if (answerKind !== "grounded") {
    return { ok: false, reason: "The Answer kind was invalid." };
  }

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

  return {
    ok: true,
    value: { kind: "grounded", answer, citationIds },
  };
}
