export const PASTED_TEXT_CHARACTER_LIMIT = 50_000;

export type LocatedParagraph = {
  paragraph: number;
  content: string;
};

export type SourceReader = {
  read(content: string): LocatedParagraph[];
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
