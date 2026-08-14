import { CLOUDFLARE_EMBEDDING } from "@/features/sources/cloudflare-embedding";
import {
  PDF_BYTE_LIMIT,
  readPdf,
  validatePastedText,
} from "@/features/sources/source-reader";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

type CreateInput =
  | {
      kind: "pasted_text";
      notebookId: unknown;
      title: unknown;
      content: unknown;
    }
  | { kind: "pdf"; notebookId: unknown; title: unknown; file: File | null };

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

  const input = await parseInput(request);
  if (!input)
    return Response.json(
      { error: "The Source request was invalid." },
      { status: 400 },
    );

  const title =
    typeof input.title === "string"
      ? input.title.trim().replace(/\s+/g, " ")
      : "";
  if (!isUuid(input.notebookId))
    return Response.json(
      { error: "Choose a valid Notebook." },
      { status: 400 },
    );
  if (!title || title.length > 120)
    return Response.json(
      { error: "Source title must be between 1 and 120 characters." },
      { status: 400 },
    );

  let pdfBytes: Uint8Array | undefined;
  if (input.kind === "pasted_text") {
    const validation = validatePastedText(
      typeof input.content === "string" ? input.content : "",
    );
    if (!validation.ok)
      return Response.json({ error: validation.message }, { status: 400 });
  } else {
    if (!input.file || input.file.size === 0)
      return Response.json(
        { error: "Choose a non-empty PDF to upload." },
        { status: 400 },
      );
    if (input.file.size > PDF_BYTE_LIMIT)
      return Response.json(
        { error: "PDFs must be 10 MB or smaller." },
        { status: 413 },
      );
    pdfBytes = new Uint8Array(await input.file.arrayBuffer());
    try {
      await readPdf(pdfBytes);
    } catch (error) {
      return Response.json({ error: pdfFeedback(error) }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: notebook } = await admin
    .from("notebooks")
    .select("id")
    .eq("id", input.notebookId)
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

  const sourceId = crypto.randomUUID();
  const storagePath =
    input.kind === "pdf"
      ? `${user.id}/${notebook.id}/${sourceId}/original.pdf`
      : null;
  if (storagePath && pdfBytes) {
    const { error } = await admin.storage
      .from("source-files")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (error)
      return Response.json(
        { error: "The private PDF could not be stored. Try again." },
        { status: 500 },
      );
  }

  const content =
    input.kind === "pasted_text" && typeof input.content === "string"
      ? input.content
      : "";
  const { data, error } = await admin
    .from("sources")
    .insert({
      id: sourceId,
      notebook_id: notebook.id,
      title,
      kind: input.kind,
      content,
      storage_path: storagePath,
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

  if (error) {
    if (storagePath)
      await admin.storage.from("source-files").remove([storagePath]);
    return Response.json(
      { error: "The Source could not be saved." },
      { status: 500 },
    );
  }
  return Response.json({ source: data }, { status: 201 });
}

async function parseInput(request: Request): Promise<CreateInput | null> {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      return {
        kind: "pdf",
        notebookId: form.get("notebookId"),
        title: form.get("title"),
        file: file instanceof File ? file : null,
      };
    }
    const body = (await request.json()) as {
      notebookId?: unknown;
      title?: unknown;
      content?: unknown;
    };
    return {
      kind: "pasted_text",
      notebookId: body.notebookId,
      title: body.title,
      content: body.content,
    };
  } catch {
    return null;
  }
}

function pdfFeedback(error: unknown) {
  const category = error instanceof Error ? error.message : "pdf_unreadable";
  return (
    (
      {
        pdf_type_unsupported:
          "That file is not a PDF. Choose a genuine PDF file.",
        pdf_content_empty:
          "That PDF has no readable text. Scanned or empty PDFs are not supported.",
        pdf_encrypted:
          "That PDF is password-protected. Remove the password and try again.",
        pdf_page_limit: "PDFs must contain 50 pages or fewer.",
        pdf_unreadable:
          "That PDF is damaged or unreadable. Export a new copy and try again.",
      } as Record<string, string>
    )[category] ??
    "That PDF could not be read safely. Export a new copy and try again."
  );
}
