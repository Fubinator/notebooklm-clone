import "server-only";

import {
  DEFAULT_CLOUDFLARE_CHAT_MODEL,
  generateWithCloudflare,
} from "./cloudflare-chat";
import type { ChatModel } from "./model";

export function createChatModel(): ChatModel {
  const model =
    process.env.CLOUDFLARE_CHAT_MODEL || DEFAULT_CLOUDFLARE_CHAT_MODEL;

  return {
    provider: "cloudflare-workers-ai",
    model,
    async generate(input) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      if (!accountId || !apiToken) {
        throw new Error("chat_provider_not_configured");
      }

      return generateWithCloudflare(input, { accountId, apiToken }, model);
    },
  };
}
