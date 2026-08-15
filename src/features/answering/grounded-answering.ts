import type {
  AnswerModel,
  EvidencePassage,
  ValidatedModelAnswer,
} from "./model";
import { validateModelAnswer } from "./model";
import type { AnsweringPersistence, PendingAnswer } from "./persistence";

export const INSUFFICIENT_EVIDENCE_ANSWER =
  "The Sources in this Notebook do not contain enough evidence to answer that Question. Try asking about a topic covered by the ready Sources.";

export type GroundedAnsweringDependencies = {
  retrieve(notebookId: string, question: string): Promise<EvidencePassage[]>;
  answerModel: AnswerModel;
  persistence: AnsweringPersistence;
};

export type GroundedAnsweringResult =
  | { status: "completed"; kind: "grounded" | "insufficient_evidence" }
  | { status: "failed"; kind: "safe_failure" };

export async function answerGroundedQuestion(
  input: { notebookId: string; question: string; correlationId: string },
  dependencies: GroundedAnsweringDependencies,
): Promise<GroundedAnsweringResult> {
  let pending: PendingAnswer | undefined;

  try {
    pending = await dependencies.persistence.begin(input);
    const evidence = await dependencies.retrieve(
      input.notebookId,
      input.question,
    );
    await dependencies.persistence.recordEvidence(
      pending.questionId,
      evidence.map(({ passageId }) => passageId),
    );

    if (evidence.length === 0) {
      await persistInsufficientEvidence(pending, dependencies, false);
      return { status: "completed", kind: "insufficient_evidence" };
    }

    const firstOutput = await dependencies.answerModel.generate({
      question: input.question,
      evidence,
    });
    let validation = validateModelAnswer(firstOutput, evidence);

    if (!validation.ok) {
      const repairedOutput = await dependencies.answerModel.generate({
        question: input.question,
        evidence,
        repair: {
          previousOutput: firstOutput,
          reason: validation.reason,
        },
      });
      validation = validateModelAnswer(repairedOutput, evidence);
    }

    if (!validation.ok) {
      await dependencies.persistence.fail(pending.answerId);
      return { status: "failed", kind: "safe_failure" };
    }

    if (validation.value.kind === "insufficient_evidence") {
      await persistInsufficientEvidence(pending, dependencies, true);
      return { status: "completed", kind: "insufficient_evidence" };
    }

    await persistValidatedAnswer(pending, validation.value, dependencies);
    return { status: "completed", kind: "grounded" };
  } catch (error) {
    if (pending) {
      await dependencies.persistence
        .fail(pending.answerId)
        .catch(() => undefined);
    }
    throw error;
  }
}

async function persistValidatedAnswer(
  pending: PendingAnswer,
  answer: Extract<ValidatedModelAnswer, { kind: "grounded" }>,
  dependencies: GroundedAnsweringDependencies,
) {
  await dependencies.persistence.complete({
    answerId: pending.answerId,
    content: answer.answer,
    kind: "grounded",
    provider: dependencies.answerModel.provider,
    model: dependencies.answerModel.model,
    citationIds: answer.citationIds,
  });
}

async function persistInsufficientEvidence(
  pending: PendingAnswer,
  dependencies: GroundedAnsweringDependencies,
  usedModel: boolean,
) {
  await dependencies.persistence.complete({
    answerId: pending.answerId,
    content: INSUFFICIENT_EVIDENCE_ANSWER,
    kind: "insufficient_evidence",
    provider: usedModel ? dependencies.answerModel.provider : null,
    model: usedModel ? dependencies.answerModel.model : null,
    citationIds: [],
  });
}
