import { embedTexts } from "@/features/sources/embedding";
import { advanceSource } from "@/features/sources/ingestion";
import { createSourceIngestionPersistence } from "@/features/sources/ingestion-persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  try {
    const source = await advanceSource(sourceId, correlationId, {
      persistence: createSourceIngestionPersistence(
        createAdminClient(),
        user.id,
      ),
      embed: embedTexts,
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
    console.error(
      JSON.stringify({
        operation: "source_ingestion",
        sourceId,
        guestId: user.id,
        correlationId,
        outcome: "failed",
      }),
    );
    return Response.json(
      { error: "The Source could not be processed safely." },
      { status: 500 },
    );
  }
}
