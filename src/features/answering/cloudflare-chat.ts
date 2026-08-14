import { buildGroundedMessages } from "./prompt";
import type { ChatModelRequest } from "./model";

export const DEFAULT_CLOUDFLARE_CHAT_MODEL =
  "@cf/meta/llama-3.1-8b-instruct-fast";

export type CloudflareChatCredentials = {
  accountId: string;
  apiToken: string;
};

type CloudflareChatResponse = {
  success?: boolean;
  result?: { response?: unknown };
};

export async function generateWithCloudflare(
  input: ChatModelRequest,
  credentials: CloudflareChatCredentials,
  model = DEFAULT_CLOUDFLARE_CHAT_MODEL,
  request: typeof fetch = fetch,
) {
  const evidenceIds = input.evidence.map(({ passageId }) => passageId);
  const response = await request(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: buildGroundedMessages(input),
        temperature: 0.1,
        max_tokens: 900,
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              answer: { type: "string" },
              citation_ids: {
                type: "array",
                minItems: 1,
                uniqueItems: true,
                items: { type: "string", enum: evidenceIds },
              },
            },
            required: ["answer", "citation_ids"],
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`chat_provider_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as CloudflareChatResponse;
  if (!payload.success || payload.result?.response === undefined) {
    throw new Error("chat_provider_invalid_response");
  }

  return payload.result.response;
}
