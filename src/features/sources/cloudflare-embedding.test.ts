import { describe, expect, it, vi } from "vitest";

import {
  CLOUDFLARE_EMBEDDING,
  embedWithCloudflare,
} from "./cloudflare-embedding";

const credentials = {
  accountId: "account/id",
  apiToken: "secret-token",
};

function vector(value = 0.01) {
  return Array.from({ length: CLOUDFLARE_EMBEDDING.dimensions }, () => value);
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Cloudflare embedding module", () => {
  it("returns no vectors without calling Cloudflare for empty input", async () => {
    const request = vi.fn<typeof fetch>();

    await expect(
      embedWithCloudflare([], credentials, request),
    ).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it("requests the configured model and validates returned vectors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        success: true,
        result: { data: [vector()], pooling: "cls" },
      }),
    );

    await expect(
      embedWithCloudflare(["Trustworthy AI"], credentials, request),
    ).resolves.toHaveLength(1);

    expect(request).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account%2Fid/ai/run/@cf/baai/bge-small-en-v1.5",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: ["Trustworthy AI"], pooling: "cls" }),
      }),
    );
  });

  it("classifies provider and vector-space failures", async () => {
    const failedRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, 403));
    await expect(
      embedWithCloudflare(["text"], credentials, failedRequest),
    ).rejects.toThrow("embedding_provider_request_failed:403");

    const wrongDimensions = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        success: true,
        result: { data: [[0.1]], pooling: "cls" },
      }),
    );
    await expect(
      embedWithCloudflare(["text"], credentials, wrongDimensions),
    ).rejects.toThrow("embedding_provider_dimension_mismatch");

    const wrongPooling = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        success: true,
        result: { data: [vector()], pooling: "mean" },
      }),
    );
    await expect(
      embedWithCloudflare(["text"], credentials, wrongPooling),
    ).rejects.toThrow("embedding_provider_pooling_mismatch");
  });
});
