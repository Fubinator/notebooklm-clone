import { CLOUDFLARE_EMBEDDING, embedTexts } from "@/features/sources/embedding";
import { advanceSource } from "@/features/sources/ingestion";
import { createSourceIngestionPersistence } from "@/features/sources/ingestion-persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getApplicationLimits } from "@/lib/limits";
import { safeErrorCategory, writeStructuredLog } from "@/lib/structured-log";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json(
      { error: "Authentication is required." },
      { status: 401 },
    );

  const { sourceId } = await context.params;
  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  const admin = createAdminClient();
  const limits = getApplicationLimits();
  try {
    const source = await advanceSource(sourceId, correlationId, {
      persistence: createSourceIngestionPersistence(admin, user.id),
      embed: embedTexts,
      concurrentLimit: limits.concurrentIngestionsPerGuest,
      pdfPageLimit: limits.pdfPages,
      passageTargetCharacters: limits.passageTargetCharacters,
      passageOverlapCharacters: limits.passageOverlapCharacters,
    });
    writeStructuredLog("info", {
      operation: "source_ingestion",
      sourceId,
      guestId: user.id,
      correlationId,
      stage: source.processingStage,
      durationMs: Math.round(performance.now() - startedAt),
      outcome: source.processingStage === "failed" ? "failed" : "advanced",
      provider: CLOUDFLARE_EMBEDDING.provider,
      model: CLOUDFLARE_EMBEDDING.model,
    });
    return Response.json({ source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("source_not_authorized")) {
      return Response.json(
        { error: "That Source is not available." },
        { status: 404 },
      );
    }
    if (message.includes("ingestion_limit_reached")) {
      return Response.json(
        {
          error: `A Guest can process ${getApplicationLimits().concurrentIngestionsPerGuest} Source at a time. Wait for the current Source to finish.`,
        },
        { status: 409 },
      );
    }
    writeStructuredLog("error", {
      operation: "source_ingestion",
      sourceId,
      guestId: user.id,
      correlationId,
      stage: "advance",
      durationMs: Math.round(performance.now() - startedAt),
      outcome: "failed",
      category: safeErrorCategory(error),
      provider: CLOUDFLARE_EMBEDDING.provider,
      model: CLOUDFLARE_EMBEDDING.model,
    });
    return Response.json(
      { error: "The Source could not be processed safely." },
      { status: 500 },
    );
  }
}
