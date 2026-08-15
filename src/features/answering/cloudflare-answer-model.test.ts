import { describe, expect, it, vi } from "vitest";

import { generateWithCloudflare } from "./cloudflare-answer-model";
import type { AnswerModelRequest } from "./model";

const input: AnswerModelRequest = {
  question: "What is trustworthy AI?",
  evidence: [
    {
      passageId: "passage-1",
      sourceId: "source-1",
      sourceTitle: "AI RMF",
      sourceKind: "pdf",
      content: "Trustworthiness depends on context.",
      pageNumber: 12,
      paragraphStart: null,
      paragraphEnd: null,
      similarity: 0.9,
    },
  ],
};

describe("Cloudflare Answer-model adapter", () => {
  it("requests JSON output without exposing credentials in content", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            response: {
              answer_kind: "grounded",
              answer: "Trustworthiness depends on context.",
              citation_ids: ["passage-1"],
            },
            usage: {
              prompt_tokens: 120,
              completion_tokens: 30,
              total_tokens: 150,
            },
          },
        }),
      ),
    );

    const recordUsage = vi.fn();
    await expect(
      generateWithCloudflare(
        input,
        { accountId: "account/id", apiToken: "secret-token" },
        "@cf/example/model",
        request,
        recordUsage,
      ),
    ).resolves.toMatchObject({ citation_ids: ["passage-1"] });
    expect(recordUsage).toHaveBeenCalledWith({
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
    });

    expect(request).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account%2Fid/ai/run/@cf/example/model",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        },
      }),
    );
    const options = request.mock.calls[0]?.[1];
    const body = JSON.parse(String(options?.body)) as {
      response_format: Record<string, unknown>;
    };
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(String(options?.body)).not.toContain("secret-token");
  });

  it("preserves safe Cloudflare status and error-code diagnostics", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 5007, message: "No such model" }],
        }),
        { status: 400 },
      ),
    );

    const failure = generateWithCloudflare(
      input,
      { accountId: "account-id", apiToken: "secret-token" },
      "@cf/example/model",
      request,
    );

    await expect(failure).rejects.toMatchObject({
      message: "answer_provider_request_failed",
      status: 400,
      providerCode: 5007,
    });
  });
});
