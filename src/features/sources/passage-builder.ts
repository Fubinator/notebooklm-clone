import type { LocatedParagraph } from "./source-reader";

export const PASSAGE_TARGET_CHARACTERS = 900;
export const PASSAGE_OVERLAP_PARAGRAPHS = 1;

export type BuiltPassage = {
  ordinal: number;
  content: string;
  paragraphStart: number;
  paragraphEnd: number;
  pageNumber?: number;
};

export function buildPassages(paragraphs: LocatedParagraph[]): BuiltPassage[] {
  const passages: BuiltPassage[] = [];
  let start = 0;

  while (start < paragraphs.length) {
    let end = start;
    let length = 0;
    while (end < paragraphs.length) {
      const nextLength =
        length + paragraphs[end]!.content.length + (length ? 2 : 0);
      if (end > start && nextLength > PASSAGE_TARGET_CHARACTERS) break;
      length = nextLength;
      end += 1;
    }

    const selected = paragraphs.slice(start, end);
    passages.push({
      ordinal: passages.length,
      content: selected.map(({ content }) => content).join("\n\n"),
      paragraphStart: selected[0]!.paragraph,
      paragraphEnd: selected.at(-1)!.paragraph,
    });

    if (end >= paragraphs.length) break;
    start = Math.max(start + 1, end - PASSAGE_OVERLAP_PARAGRAPHS);
  }

  return passages;
}

export function buildPdfPassages(
  pages: Array<{ page: number; content: string }>,
): BuiltPassage[] {
  const passages: BuiltPassage[] = [];
  for (const page of pages) {
    for (
      let start = 0;
      start < page.content.length;
      start += PASSAGE_TARGET_CHARACTERS
    ) {
      passages.push({
        ordinal: passages.length,
        content: page.content
          .slice(start, start + PASSAGE_TARGET_CHARACTERS)
          .trim(),
        paragraphStart: 0,
        paragraphEnd: 0,
        pageNumber: page.page,
      });
    }
  }
  return passages.filter(({ content }) => Boolean(content));
}
