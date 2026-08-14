export const PASTED_TEXT_CHARACTER_LIMIT = 50_000;
export const PDF_BYTE_LIMIT = 10 * 1024 * 1024;
export const PDF_PAGE_LIMIT = 50;
export const PDF_MIME_TYPE = "application/pdf";

export type LocatedParagraph = {
  paragraph: number;
  content: string;
};

export type SourceReader = {
  read(content: string): LocatedParagraph[];
};

export type LocatedPage = {
  page: number;
  content: string;
};

export type PdfSourceReader = {
  read(content: Uint8Array): Promise<LocatedPage[]>;
};

export function validatePastedText(content: string) {
  if (!content.trim()) {
    return { ok: false as const, message: "Paste some text to add a Source." };
  }
  if (content.length > PASTED_TEXT_CHARACTER_LIMIT) {
    return {
      ok: false as const,
      message: `Pasted text must be ${PASTED_TEXT_CHARACTER_LIMIT.toLocaleString()} characters or fewer.`,
    };
  }
  return { ok: true as const, content };
}

export const pastedTextReader: SourceReader = {
  read(content) {
    const normalized = content.replace(/\r\n?/g, "\n").trim();
    if (!normalized) throw new Error("source_content_empty");

    return normalized
      .split(/\n\s*\n+/)
      .map((paragraph) =>
        paragraph
          .replace(/[ \t]+/g, " ")
          .replace(/\n/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .map((paragraph, index) => ({
        paragraph: index + 1,
        content: paragraph,
      }));
  },
};

export function hasPdfSignature(content: Uint8Array) {
  if (content.length < 5) return false;
  return new TextDecoder("ascii").decode(content.slice(0, 5)) === "%PDF-";
}

export async function readPdf(content: Uint8Array): Promise<LocatedPage[]> {
  if (!hasPdfSignature(content)) throw new Error("pdf_type_unsupported");

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    // PDF.js transfers its input buffer to its worker. Parse a copy so callers
    // can still persist or otherwise reuse the original upload bytes.
    const document = await getDocumentProxy(content.slice());
    if (document.numPages > PDF_PAGE_LIMIT) throw new Error("pdf_page_limit");
    const result = await extractText(document, { mergePages: false });
    const pages = (result.text as string[])
      .map((page, index) => ({
        page: index + 1,
        content: page.replace(/\s+/g, " ").trim(),
      }))
      .filter(({ content: pageContent }) => Boolean(pageContent));
    if (!pages.length) throw new Error("pdf_content_empty");
    return pages;
  } catch (error) {
    if (
      error instanceof Error &&
      ["pdf_page_limit", "pdf_content_empty"].includes(error.message)
    ) {
      throw error;
    }
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") throw new Error("pdf_encrypted");
    if (name === "InvalidPDFException") throw new Error("pdf_unreadable");
    throw new Error("pdf_unreadable");
  }
}

export const pdfReader: PdfSourceReader = { read: readPdf };

export function serializePdfPages(pages: LocatedPage[]) {
  return JSON.stringify(pages);
}

export function deserializePdfPages(content: string): LocatedPage[] {
  try {
    const pages = JSON.parse(content) as LocatedPage[];
    if (
      !Array.isArray(pages) ||
      !pages.length ||
      pages.some(
        (page) =>
          !Number.isInteger(page.page) ||
          page.page < 1 ||
          typeof page.content !== "string" ||
          !page.content.trim(),
      )
    ) {
      throw new Error();
    }
    return pages;
  } catch {
    throw new Error("pdf_content_empty");
  }
}
