import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeStructuredLog } from "@/lib/structured-log";
import { isUuid } from "@/lib/validation";

export async function DELETE(
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
  const guestId = user.id;

  const { sourceId } = await context.params;
  if (!isUuid(sourceId))
    return Response.json({ error: "Choose a valid Source." }, { status: 400 });

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  const admin = createAdminClient();
  const { data: deletionRows, error: beginError } = await admin.rpc(
    "begin_private_source_deletion",
    {
      target_guest_id: guestId,
      target_source_id: sourceId,
    },
  );
  const deletion = deletionRows?.[0];

  if (beginError || !deletion) {
    if (beginError?.message.includes("source_not_authorized")) {
      return Response.json(
        { error: "That Source is not available." },
        { status: 404 },
      );
    }
    logRemoval("failed", "authorize", "source_deletion_incomplete");
    return Response.json(
      { error: "Source removal did not finish. Try again." },
      { status: 500 },
    );
  }

  if (deletion.storage_path) {
    const { error: storageError } = await admin.storage
      .from("source-files")
      .remove([deletion.storage_path]);
    if (storageError) {
      logRemoval("failed", "storage", "source_deletion_incomplete");
      return Response.json(
        { error: "Source removal did not finish. Try again." },
        { status: 500 },
      );
    }
  }

  const { error: completeError } = await admin.rpc(
    "complete_private_source_deletion",
    {
      target_guest_id: guestId,
      target_source_id: sourceId,
    },
  );
  if (completeError) {
    if (completeError.message.includes("source_not_authorized")) {
      return Response.json(
        { error: "That Source is not available." },
        { status: 404 },
      );
    }
    logRemoval("failed", "database", "source_deletion_incomplete");
    return Response.json(
      { error: "Source removal did not finish. Try again." },
      { status: 500 },
    );
  }

  logRemoval("removed", "complete");
  return new Response(null, { status: 204 });

  function logRemoval(
    outcome: "removed" | "failed",
    stage: string,
    category?: string,
  ) {
    writeStructuredLog(outcome === "removed" ? "info" : "error", {
      operation: "source_removal",
      correlationId,
      guestId,
      notebookId: deletion?.notebook_id,
      sourceId,
      stage,
      durationMs: Math.round(performance.now() - startedAt),
      outcome,
      ...(category ? { category } : {}),
    });
  }
}
