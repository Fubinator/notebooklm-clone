import "server-only";

import {
  CLOUDFLARE_EMBEDDING,
  embedWithCloudflare,
} from "./cloudflare-embedding";

export { CLOUDFLARE_EMBEDDING };

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("embedding_provider_not_configured");
  }

  return embedWithCloudflare(texts, { accountId, apiToken });
}
