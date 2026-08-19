export const SOURCE_TITLE_CHARACTER_LIMIT = 120;

const UNTITLED_PDF_SOURCE = "Untitled PDF";

export function normalizeSourceTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function sourceTitleFromPdfFilename(filename: string) {
  const basename = filename.split(/[\\/]/).at(-1) ?? "";
  const stem = basename.replace(/\.pdf$/i, "");
  const readableStem = normalizeSourceTitle(stem.replace(/[_-]+/g, " "));

  return (readableStem || UNTITLED_PDF_SOURCE)
    .slice(0, SOURCE_TITLE_CHARACTER_LIMIT)
    .trimEnd();
}
