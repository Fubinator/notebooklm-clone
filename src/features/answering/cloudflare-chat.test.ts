import { describe, expect, it, vi } from "vitest";

import { generateWithCloudflare } from "./cloudflare-chat";
import type { ChatModelRequest } from "./model";

const input: ChatModelRequest = {
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

describe("Cloudflare chat adapter", () => {
  it("requests a constrained JSON response without exposing credentials in content", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            response: {
              answer: "Trustworthiness depends on context.",
              citation_ids: ["passage-1"],
            },
          },
        }),
      ),
    );

    await expect(
      generateWithCloudflare(
        input,
        { accountId: "account/id", apiToken: "secret-token" },
        "@cf/example/model",
        request,
      ),
    ).resolves.toMatchObject({ citation_ids: ["passage-1"] });

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
      response_format: { json_schema: { properties: Record<string, unknown> } };
    };
    expect(body.response_format.json_schema.properties).toHaveProperty(
      "citation_ids",
    );
    expect(String(options?.body)).not.toContain("secret-token");
  });
});
