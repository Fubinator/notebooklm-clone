import { describe, expect, it } from "vitest";

import type { EvidencePassage } from "./model";
import { validateModelAnswer } from "./model";

const evidence: EvidencePassage[] = [
  {
    passageId: "passage-1",
    sourceId: "source-1",
    sourceTitle: "Trustworthy AI",
    sourceKind: "pdf",
    content: "Evidence text",
    pageNumber: 12,
    paragraphStart: null,
    paragraphEnd: null,
    similarity: 0.8,
  },
];

describe("model Answer validation", () => {
  it("accepts unique Citation IDs from the retrieved evidence set", () => {
    expect(
      validateModelAnswer(
        { answer: "A supported Answer.", citation_ids: ["passage-1"] },
        evidence,
      ),
    ).toEqual({
      ok: true,
      value: {
        answer: "A supported Answer.",
        citationIds: ["passage-1"],
      },
    });
  });

  it("rejects malformed, duplicate, and out-of-evidence Citations", () => {
    expect(validateModelAnswer("not json", evidence)).toMatchObject({
      ok: false,
    });
    expect(
      validateModelAnswer(
        { answer: "Answer", citation_ids: ["passage-1", "passage-1"] },
        evidence,
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateModelAnswer(
        { answer: "Answer", citation_ids: ["invented-passage"] },
        evidence,
      ),
    ).toEqual({
      ok: false,
      reason: "A Citation ID was outside the retrieved evidence set.",
    });
  });
});
