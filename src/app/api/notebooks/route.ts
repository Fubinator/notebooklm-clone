import { validateNotebookTitle } from "@/features/notebooks/model";
import { getApplicationLimits } from "@/lib/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeStructuredLog } from "@/lib/structured-log";
import { isUuid } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await authenticatedGuest();
  if (!auth) return unauthorized();
  const body = await readBody(request);
  const validation = validateNotebookTitle(
    typeof body?.title === "string" ? body.title : "",
  );
  if (!validation.ok)
    return Response.json({ error: validation.message }, { status: 400 });

  const admin = createAdminClient();
  const limit = getApplicationLimits().notebooksPerGuest;
  const { data, error } = await admin.rpc("create_private_notebook", {
    target_guest_id: auth.id,
    notebook_title: validation.title,
    notebook_limit: limit,
  });
  if (error?.message.includes("notebook_limit_reached"))
    return Response.json(
      { error: `A Guest can keep up to ${limit} Notebooks.` },
      { status: 409 },
    );
  const notebook = data?.[0];
  if (error || !notebook)
    return Response.json(
      { error: "The Notebook could not be created." },
      { status: 500 },
    );
  return Response.json({ notebook }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedGuest();
  if (!auth) return unauthorized();
  const body = await readBody(request);
  const validation = validateNotebookTitle(
    typeof body?.title === "string" ? body.title : "",
  );
  if (!isUuid(body?.id) || !validation.ok)
    return Response.json(
      {
        error: validation.ok ? "Choose a valid Notebook." : validation.message,
      },
      { status: 400 },
    );

  const { data, error } = await auth.client
    .from("notebooks")
    .update({ title: validation.title })
    .eq("id", body.id)
    .eq("owner_id", auth.id)
    .eq("is_example", false)
    .select()
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "The Notebook could not be renamed." },
      { status: 500 },
    );
  if (!data)
    return Response.json(
      { error: "That Notebook is not available." },
      { status: 404 },
    );
  return Response.json({ notebook: data });
}

export async function DELETE(request: Request) {
  const auth = await authenticatedGuest();
  if (!auth) return unauthorized();
  const body = await readBody(request);
  if (!isUuid(body?.id))
    return Response.json(
      { error: "Choose a valid Notebook." },
      { status: 400 },
    );

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  const { data: notebook, error: notebookError } = await auth.client
    .from("notebooks")
    .select("id")
    .eq("id", body.id)
    .eq("owner_id", auth.id)
    .eq("is_example", false)
    .maybeSingle();
  if (notebookError)
    return Response.json(
      { error: "The Notebook could not be deleted." },
      { status: 500 },
    );
  if (!notebook)
    return Response.json(
      { error: "That Notebook is not available." },
      { status: 404 },
    );
  const guestId = auth.id;
  const notebookId = notebook.id;

  const { data: sources, error: sourcesError } = await auth.client
    .from("sources")
    .select("id, storage_path")
    .eq("notebook_id", notebookId);
  if (sourcesError) {
    logNotebookRemoval("failed", "list_sources");
    return Response.json(
      { error: "Notebook removal did not finish. Try again." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const storagePaths = (sources ?? []).flatMap(({ storage_path }) =>
    storage_path ? [storage_path] : [],
  );
  if (storagePaths.length) {
    const { error: storageError } = await admin.storage
      .from("source-files")
      .remove(storagePaths);
    if (storageError) {
      logNotebookRemoval("failed", "storage");
      return Response.json(
        { error: "Notebook removal did not finish. Try again." },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await admin.rpc("delete_private_notebook", {
    target_guest_id: guestId,
    target_notebook_id: notebookId,
    expected_source_ids: (sources ?? []).map(({ id }) => id),
  });
  if (deleteError?.message.includes("notebook_not_authorized"))
    return Response.json(
      { error: "That Notebook is not available." },
      { status: 404 },
    );
  if (deleteError?.message.includes("notebook_sources_changed")) {
    logNotebookRemoval("failed", "source_set_changed");
    return Response.json(
      {
        error:
          "The Notebook changed while it was being removed. Try removal again.",
      },
      { status: 409 },
    );
  }
  if (deleteError) {
    logNotebookRemoval("failed", "database");
    return Response.json(
      { error: "Notebook removal did not finish. Try again." },
      { status: 500 },
    );
  }

  logNotebookRemoval("removed", "complete");
  return new Response(null, { status: 204 });

  function logNotebookRemoval(outcome: "removed" | "failed", stage: string) {
    writeStructuredLog(outcome === "removed" ? "info" : "error", {
      operation: "notebook_removal",
      correlationId,
      guestId,
      notebookId,
      stage,
      durationMs: Math.round(performance.now() - startedAt),
      outcome,
      ...(outcome === "failed"
        ? { category: "notebook_deletion_incomplete" }
        : {}),
    });
  }
}

async function authenticatedGuest() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? { id: user.id, client } : null;
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as { id?: unknown; title?: unknown };
  } catch {
    return null;
  }
}

function unauthorized() {
  return Response.json(
    { error: "Authentication is required." },
    { status: 401 },
  );
}
