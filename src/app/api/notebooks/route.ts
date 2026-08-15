import { validateNotebookTitle } from "@/features/notebooks/model";
import { getApplicationLimits } from "@/lib/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

  const { data, error } = await createAdminClient()
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

  const { data, error } = await createAdminClient()
    .from("notebooks")
    .delete()
    .eq("id", body.id)
    .eq("owner_id", auth.id)
    .eq("is_example", false)
    .select("id")
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "The Notebook could not be deleted." },
      { status: 500 },
    );
  if (!data)
    return Response.json(
      { error: "That Notebook is not available." },
      { status: 404 },
    );
  return new Response(null, { status: 204 });
}

async function authenticatedGuest() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  return user;
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
