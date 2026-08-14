import "server-only";

import { InferenceClient } from "@huggingface/inference";

export const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

export async function embedTexts(texts: string[]) {
  const token = process.env.HUGGINGFACE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("embedding_provider_not_configured");
  }

  const client = new InferenceClient(token);
  const result = await client.featureExtraction({
    provider: "hf-inference",
    model: EMBEDDING_MODEL,
    inputs: texts,
    normalize: true,
    truncate: true,
  });

  if (!Array.isArray(result) || !Array.isArray(result[0])) {
    throw new Error("embedding_provider_invalid_response");
  }

  const embeddings = result as number[][];
  if (
    embeddings.length !== texts.length ||
    embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error("embedding_provider_dimension_mismatch");
  }

  return embeddings;
}
