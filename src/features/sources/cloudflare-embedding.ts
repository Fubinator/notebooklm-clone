export const CLOUDFLARE_EMBEDDING = {
  provider: "cloudflare-workers-ai",
  model: "@cf/baai/bge-small-en-v1.5",
  dimensions: 384,
  pooling: "cls",
} as const;

export type CloudflareCredentials = {
  accountId: string;
  apiToken: string;
};

type CloudflareEmbeddingResponse = {
  success?: boolean;
  result?: {
    data?: unknown;
    pooling?: unknown;
  };
};

export async function embedWithCloudflare(
  texts: string[],
  credentials: CloudflareCredentials,
  request: typeof fetch = fetch,
) {
  if (texts.length === 0) return [];

  const response = await request(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/ai/run/${CLOUDFLARE_EMBEDDING.model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        pooling: CLOUDFLARE_EMBEDDING.pooling,
      }),
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
        embedding.length !== CLOUDFLARE_EMBEDDING.dimensions ||
        embedding.some(
          (value) => typeof value !== "number" || !Number.isFinite(value),
        ),
    )
  ) {
    throw new Error("embedding_provider_dimension_mismatch");
  }

  if (
    payload.result?.pooling !== undefined &&
    payload.result.pooling !== CLOUDFLARE_EMBEDDING.pooling
  ) {
    throw new Error("embedding_provider_pooling_mismatch");
  }

  return embeddings as number[][];
}
