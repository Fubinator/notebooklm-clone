import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

vi.mock("unpdf", () => mocks);

import { buildPdfPassages } from "./passage-builder";
import {
  PDF_PAGE_LIMIT,
  deserializePdfPages,
  hasPdfSignature,
  readPdf,
  serializePdfPages,
} from "./source-reader";

describe("PDF Source Reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentProxy.mockResolvedValue({ numPages: 2 });
    mocks.extractText.mockResolvedValue({
      totalPages: 2,
      text: ["Page one evidence.", "Page two evidence."],
    });
  });

  it("detects PDF content independently of its filename or declared MIME type", () => {
    expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasPdfSignature(new TextEncoder().encode("not a pdf"))).toBe(false);
  });

  it("preserves representative page boundaries through Passage construction", async () => {
    const pages = await readPdf(new TextEncoder().encode("%PDF-1.7"));
    const persisted = deserializePdfPages(serializePdfPages(pages));
    expect(buildPdfPassages(persisted)).toEqual([
      expect.objectContaining({
        ordinal: 0,
        pageNumber: 1,
        content: "Page one evidence.",
      }),
      expect.objectContaining({
        ordinal: 1,
        pageNumber: 2,
        content: "Page two evidence.",
      }),
    ]);
  });

  it("classifies encrypted, unreadable, empty, and over-length PDFs safely", async () => {
    mocks.getDocumentProxy.mockResolvedValueOnce({
      numPages: PDF_PAGE_LIMIT + 1,
    });
    await expect(readPdf(new TextEncoder().encode("%PDF-x"))).rejects.toThrow(
      "pdf_page_limit",
    );

    mocks.getDocumentProxy.mockRejectedValueOnce(
      Object.assign(new Error("secret"), { name: "PasswordException" }),
    );
    await expect(readPdf(new TextEncoder().encode("%PDF-x"))).rejects.toThrow(
      "pdf_encrypted",
    );

    mocks.getDocumentProxy.mockRejectedValueOnce(
      Object.assign(new Error("details"), { name: "InvalidPDFException" }),
    );
    await expect(readPdf(new TextEncoder().encode("%PDF-x"))).rejects.toThrow(
      "pdf_unreadable",
    );

    mocks.getDocumentProxy.mockResolvedValueOnce({ numPages: 1 });
    mocks.extractText.mockResolvedValueOnce({ totalPages: 1, text: ["  "] });
    await expect(readPdf(new TextEncoder().encode("%PDF-x"))).rejects.toThrow(
      "pdf_content_empty",
    );
  });
});
