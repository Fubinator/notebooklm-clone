import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIMENSIONS,
  MODEL,
  POOLING,
  PROVIDER,
  sources,
} from "./generate-example-seed.mjs";

describe("committed Example seed", () => {
  it("matches the configured Cloudflare vector space", async () => {
    const seed = await readFile(resolve("supabase/seed.sql"), "utf8");
    const sourceConfiguration = `'${PROVIDER}', '${MODEL}', ${DIMENSIONS}, '${POOLING}'`;

    expect(
      seed.includes(
        "embedding_provider, embedding_model, embedding_dimensions, embedding_pooling",
      ),
      "source inserts must include every vector-space metadata column",
    ).toBe(true);
    expect(
      seed.split(sourceConfiguration).length - 1,
      "every seeded Source must use the configured vector space",
    ).toBe(sources.length);
    expect(
      seed.includes("all-MiniLM-L6-v2"),
      "the retired MiniLM vector space must not remain in the seed",
    ).toBe(false);
  });
});
