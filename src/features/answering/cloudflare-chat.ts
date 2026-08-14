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
  errors?: Array<{ code?: unknown }>;
};

export class ChatProviderRequestError extends Error {
  readonly status: number;
  readonly providerCode: number | null;

  constructor(status: number, providerCode: number | null) {
    super("chat_provider_request_failed");
    this.name = "ChatProviderRequestError";
    this.status = status;
    this.providerCode = providerCode;
  }
}

export async function generateWithCloudflare(
  input: ChatModelRequest,
  credentials: CloudflareChatCredentials,
  model = DEFAULT_CLOUDFLARE_CHAT_MODEL,
  request: typeof fetch = fetch,
) {
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
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new ChatProviderRequestError(
      response.status,
      await readProviderErrorCode(response),
    );
  }

  const payload = (await response.json()) as CloudflareChatResponse;
  if (!payload.success || payload.result?.response === undefined) {
    throw new Error("chat_provider_invalid_response");
  }

  return payload.result.response;
}

async function readProviderErrorCode(response: Response) {
  const payload = (await response
    .json()
    .catch(() => null)) as CloudflareChatResponse | null;
  const code = payload?.errors?.[0]?.code;
  return typeof code === "number" && Number.isSafeInteger(code) ? code : null;
}
