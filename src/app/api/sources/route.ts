import { CLOUDFLARE_EMBEDDING } from "@/features/sources/cloudflare-embedding";
import { validatePastedText } from "@/features/sources/source-reader";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CreateSourceRequest = {
  notebookId?: unknown;
  title?: unknown;
  content?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json(
      { error: "Authentication is required." },
      { status: 401 },
    );

  let body: CreateSourceRequest;
  try {
    body = (await request.json()) as CreateSourceRequest;
  } catch {
    return Response.json(
      { error: "The Source request was invalid." },
      { status: 400 },
    );
  }

  const content = typeof body.content === "string" ? body.content : "";
  const contentValidation = validatePastedText(content);
  const title =
    typeof body.title === "string"
      ? body.title.trim().replace(/\s+/g, " ")
      : "";
  if (
    !contentValidation.ok ||
    !isUuid(body.notebookId) ||
    !title ||
    title.length > 120
  ) {
    return Response.json(
      {
        error: !contentValidation.ok
          ? contentValidation.message
          : !title || title.length > 120
            ? "Source title must be between 1 and 120 characters."
            : "Choose a valid Notebook.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: notebook } = await admin
    .from("notebooks")
    .select("id")
    .eq("id", body.notebookId)
    .eq("owner_id", user.id)
    .eq("is_example", false)
    .maybeSingle();
  if (!notebook)
    return Response.json(
      { error: "That Notebook is not available." },
      { status: 404 },
    );

  const { count } = await admin
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", notebook.id);
  if ((count ?? 0) >= 5)
    return Response.json(
      { error: "This Notebook already has 5 Sources." },
      { status: 409 },
    );

  const { data, error } = await admin
    .from("sources")
    .insert({
      notebook_id: notebook.id,
      title,
      kind: "pasted_text",
      content,
      processing_stage: "uploaded",
      attribution: "Added by this Guest",
      license_name: "Private Source",
      license_url: "",
      embedding_provider: CLOUDFLARE_EMBEDDING.provider,
      embedding_model: CLOUDFLARE_EMBEDDING.model,
      embedding_dimensions: CLOUDFLARE_EMBEDDING.dimensions,
      embedding_pooling: CLOUDFLARE_EMBEDDING.pooling,
    })
    .select()
    .single();

  if (error)
    return Response.json(
      { error: "The Source could not be saved." },
      { status: 500 },
    );
  return Response.json({ source: data }, { status: 201 });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
