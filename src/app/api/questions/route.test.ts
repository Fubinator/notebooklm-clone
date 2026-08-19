import { beforeEach, describe, expect, it, vi } from "vitest";

const guestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const notebookId = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  answerGroundedQuestion: vi.fn(),
  writeStructuredLog: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));
vi.mock("@/features/answering/answer-model", () => ({
  createAnswerModel: () => ({
    provider: "test",
    model: "test-model",
    generate: vi.fn(),
  }),
}));
vi.mock("@/features/answering/cloudflare-answer-model", () => ({
  AnswerProviderRequestError: class extends Error {},
}));
vi.mock("@/features/answering/grounded-answering", () => ({
  answerGroundedQuestion: mocks.answerGroundedQuestion,
}));
vi.mock("@/features/answering/persistence", () => ({
  createAnsweringPersistence: () => ({}),
}));
vi.mock("@/features/answering/retrieval", () => ({
  retrieveEvidence: vi.fn(),
}));
vi.mock("@/lib/structured-log", () => ({
  safeErrorCategory: () => "unknown_failure",
  writeStructuredLog: mocks.writeStructuredLog,
}));

import { POST } from "./route";

describe("POST /api/questions Source-removal race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: guestId } } });
  });

  it.each(["invalid_evidence", "citation_unavailable"])(
    "returns a retryable Source-changed response for %s",
    async (category) => {
      mocks.answerGroundedQuestion.mockRejectedValue(new Error(category));

      const response = await POST(
        new Request("http://localhost/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notebookId,
            question: "What evidence supports this?",
          }),
        }),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error:
          "A Source was removed while this Answer was being prepared. Ask the Question again.",
        category: "source_changed_during_answer",
      });
    },
  );
});
