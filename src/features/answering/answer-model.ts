import "server-only";

import {
  DEFAULT_CLOUDFLARE_ANSWER_MODEL,
  generateWithCloudflare,
} from "./cloudflare-answer-model";
import type { AnswerModel } from "./model";

export function createAnswerModel(): AnswerModel {
  const model =
    process.env.CLOUDFLARE_ANSWER_MODEL || DEFAULT_CLOUDFLARE_ANSWER_MODEL;

  return {
    provider: "cloudflare-workers-ai",
    model,
    async generate(input) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      if (!accountId || !apiToken) {
        throw new Error("answer_provider_not_configured");
      }

      return generateWithCloudflare(input, { accountId, apiToken }, model);
    },
  };
}
