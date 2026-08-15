import { CLOUDFLARE_EMBEDDING } from "@/features/sources/cloudflare-embedding";
import {
  PDF_BYTE_LIMIT,
  readPdf,
  validatePastedText,
} from "@/features/sources/source-reader";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";
import { getApplicationLimits } from "@/lib/limits";
import { safeErrorCategory, writeStructuredLog } from "@/lib/structured-log";

type CreateInput =
  | {
      kind: "pasted_text";
      notebookId: unknown;
      title: unknown;
      content: unknown;
    }
  | { kind: "pdf"; notebookId: unknown; title: unknown; file: File | null };

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
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

  const sourceLimit = getApplicationLimits().sourcesPerNotebook;
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
  const { data: createdSources, error } = await admin.rpc(
    "create_private_source",
    {
      target_guest_id: user.id,
      target_source_id: sourceId,
      target_notebook_id: notebook.id,
      source_title: title,
      source_kind: input.kind,
      source_content: content,
      source_storage_path: storagePath,
      source_limit: sourceLimit,
      source_embedding_provider: CLOUDFLARE_EMBEDDING.provider,
      source_embedding_model: CLOUDFLARE_EMBEDDING.model,
      source_embedding_dimensions: CLOUDFLARE_EMBEDDING.dimensions,
      source_embedding_pooling: CLOUDFLARE_EMBEDDING.pooling,
    },
  );
  const data = createdSources?.[0];

  if (error || !data) {
    if (storagePath)
      await admin.storage.from("source-files").remove([storagePath]);
    if (error?.message.includes("source_limit_reached"))
      return Response.json(
        { error: `This Notebook already has ${sourceLimit} Sources.` },
        { status: 409 },
      );
    writeStructuredLog("error", {
      operation: "source_creation",
      correlationId,
      guestId: user.id,
      notebookId: notebook.id,
      sourceId,
      stage: "persist",
      durationMs: Math.round(performance.now() - startedAt),
      outcome: "failed",
      category: safeErrorCategory(error),
    });
    return Response.json(
      { error: "The Source could not be saved." },
      { status: 500 },
    );
  }
  writeStructuredLog("info", {
    operation: "source_creation",
    correlationId,
    guestId: user.id,
    notebookId: notebook.id,
    sourceId,
    sourceKind: input.kind,
    stage: "persist",
    durationMs: Math.round(performance.now() - startedAt),
    outcome: "created",
    provider: CLOUDFLARE_EMBEDDING.provider,
    model: CLOUDFLARE_EMBEDDING.model,
  });
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
