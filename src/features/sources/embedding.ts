import "server-only";

export const EMBEDDING_PROVIDER = "cloudflare-workers-ai";
export const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_POOLING = "cls";

type CloudflareEmbeddingResponse = {
  success?: boolean;
  result?: {
    data?: unknown;
    shape?: unknown;
    pooling?: unknown;
  };
};

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("embedding_provider_not_configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${EMBEDDING_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts, pooling: EMBEDDING_POOLING }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok) {
    throw new Error(`embedding_provider_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as CloudflareEmbeddingResponse;
  const embeddings = payload.result?.data;

  if (!payload.success || !Array.isArray(embeddings)) {
    throw new Error("embedding_provider_invalid_response");
  }

  if (
    embeddings.length !== texts.length ||
    embeddings.some(
      (embedding) =>
        !Array.isArray(embedding) ||
        embedding.length !== EMBEDDING_DIMENSIONS ||
        embedding.some(
          (value) => typeof value !== "number" || !Number.isFinite(value),
        ),
    )
  ) {
    throw new Error("embedding_provider_dimension_mismatch");
  }

  if (
    payload.result?.pooling !== undefined &&
    payload.result.pooling !== EMBEDDING_POOLING
  ) {
    throw new Error("embedding_provider_pooling_mismatch");
  }

  return embeddings as number[][];
}
