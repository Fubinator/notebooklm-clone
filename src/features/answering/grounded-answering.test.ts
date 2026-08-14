import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerGroundedQuestion,
  INSUFFICIENT_EVIDENCE_ANSWER,
  type GroundedAnsweringDependencies,
} from "./grounded-answering";
import type { EvidencePassage } from "./model";

const pending = {
  conversationId: "conversation-1",
  questionId: "question-1",
  answerId: "answer-1",
};

const evidence: EvidencePassage[] = [
  {
    passageId: "passage-1",
    sourceId: "source-1",
    sourceTitle: "AI RMF",
    sourceKind: "pdf",
    content: "Trustworthy AI must be valid and reliable.",
    pageNumber: 12,
    paragraphStart: null,
    paragraphEnd: null,
    similarity: 0.8,
  },
];

const input = {
  notebookId: "notebook-1",
  question: "What makes AI trustworthy?",
  correlationId: "correlation-1",
};

function createDependencies(): GroundedAnsweringDependencies {
  return {
    retrieve: vi.fn().mockResolvedValue(evidence),
    chatModel: {
      provider: "test-provider",
      model: "test-model",
      generate: vi.fn().mockResolvedValue({
        answer_kind: "grounded",
        answer: "It must be valid and reliable.",
        citation_ids: ["passage-1"],
      }),
    },
    persistence: {
      begin: vi.fn().mockResolvedValue(pending),
      recordEvidence: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("Grounded Answering", () => {
  let dependencies: GroundedAnsweringDependencies;

  beforeEach(() => {
    dependencies = createDependencies();
  });

  it("persists a supported Answer only after its Citation is validated", async () => {
    await expect(answerGroundedQuestion(input, dependencies)).resolves.toEqual({
      status: "completed",
      kind: "grounded",
    });

    expect(dependencies.persistence.recordEvidence).toHaveBeenCalledWith(
      "question-1",
      ["passage-1"],
    );
    expect(dependencies.persistence.complete).toHaveBeenCalledWith({
      answerId: "answer-1",
      content: "It must be valid and reliable.",
      kind: "grounded",
      provider: "test-provider",
      model: "test-model",
      citationIds: ["passage-1"],
    });
  });

  it("repairs invalid Citation output once", async () => {
    vi.mocked(dependencies.chatModel.generate)
      .mockResolvedValueOnce({
        answer_kind: "grounded",
        answer: "Unverified",
        citation_ids: ["invented-passage"],
      })
      .mockResolvedValueOnce({
        answer_kind: "grounded",
        answer: "Verified",
        citation_ids: ["passage-1"],
      });

    await answerGroundedQuestion(input, dependencies);

    expect(dependencies.chatModel.generate).toHaveBeenCalledTimes(2);
    expect(dependencies.chatModel.generate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        repair: expect.objectContaining({
          reason: "A Citation ID was outside the retrieved evidence set.",
        }),
      }),
    );
    expect(dependencies.persistence.complete).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Verified" }),
    );
  });

  it("becomes a safe failure when the repair is still invalid", async () => {
    vi.mocked(dependencies.chatModel.generate).mockResolvedValue({
      answer_kind: "grounded",
      answer: "Unverified",
      citation_ids: ["invented-passage"],
    });

    await expect(answerGroundedQuestion(input, dependencies)).resolves.toEqual({
      status: "failed",
      kind: "safe_failure",
    });
    expect(dependencies.chatModel.generate).toHaveBeenCalledTimes(2);
    expect(dependencies.persistence.fail).toHaveBeenCalledWith("answer-1");
    expect(dependencies.persistence.complete).not.toHaveBeenCalled();
  });

  it("persists insufficient evidence without calling the chat model", async () => {
    vi.mocked(dependencies.retrieve).mockResolvedValue([]);

    await answerGroundedQuestion(input, dependencies);

    expect(dependencies.chatModel.generate).not.toHaveBeenCalled();
    expect(dependencies.persistence.complete).toHaveBeenCalledWith({
      answerId: "answer-1",
      content: INSUFFICIENT_EVIDENCE_ANSWER,
      kind: "insufficient_evidence",
      provider: null,
      model: null,
      citationIds: [],
    });
  });

  it("persists the model's insufficient-evidence decision without a Citation", async () => {
    vi.mocked(dependencies.chatModel.generate).mockResolvedValue({
      answer_kind: "insufficient_evidence",
      answer: "",
      citation_ids: [],
    });

    await expect(answerGroundedQuestion(input, dependencies)).resolves.toEqual({
      status: "completed",
      kind: "insufficient_evidence",
    });
    expect(dependencies.chatModel.generate).toHaveBeenCalledTimes(1);
    expect(dependencies.persistence.complete).toHaveBeenCalledWith({
      answerId: "answer-1",
      content: INSUFFICIENT_EVIDENCE_ANSWER,
      kind: "insufficient_evidence",
      provider: null,
      model: null,
      citationIds: [],
    });
  });

  it("marks interrupted provider work failed instead of completed", async () => {
    vi.mocked(dependencies.chatModel.generate).mockRejectedValue(
      new Error("provider interrupted"),
    );

    await expect(answerGroundedQuestion(input, dependencies)).rejects.toThrow(
      "provider interrupted",
    );
    expect(dependencies.persistence.fail).toHaveBeenCalledWith("answer-1");
    expect(dependencies.persistence.complete).not.toHaveBeenCalled();
  });
});
