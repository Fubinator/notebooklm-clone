import type { LocatedParagraph } from "./source-reader";

export const PASSAGE_TARGET_CHARACTERS = 900;
export const PASSAGE_OVERLAP_PARAGRAPHS = 1;
export const PASSAGE_OVERLAP_CHARACTERS = 150;

export type BuiltPassage = {
  ordinal: number;
  content: string;
  paragraphStart: number;
  paragraphEnd: number;
  pageNumber?: number;
};

export function buildPassages(
  paragraphs: LocatedParagraph[],
  targetCharacters = PASSAGE_TARGET_CHARACTERS,
  overlapParagraphs = PASSAGE_OVERLAP_PARAGRAPHS,
): BuiltPassage[] {
  const passages: BuiltPassage[] = [];
  let start = 0;

  while (start < paragraphs.length) {
    let end = start;
    let length = 0;
    while (end < paragraphs.length) {
      const nextLength =
        length + paragraphs[end]!.content.length + (length ? 2 : 0);
      if (end > start && nextLength > targetCharacters) break;
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
    start = Math.max(start + 1, end - overlapParagraphs);
  }

  return passages;
}

export function buildPdfPassages(
  pages: Array<{ page: number; content: string }>,
  targetCharacters = PASSAGE_TARGET_CHARACTERS,
  overlapCharacters = PASSAGE_OVERLAP_CHARACTERS,
): BuiltPassage[] {
  if (overlapCharacters < 0 || overlapCharacters >= targetCharacters) {
    throw new Error("passage_overlap_invalid");
  }
  const step = targetCharacters - overlapCharacters;
  const passages: BuiltPassage[] = [];
  for (const page of pages) {
    for (let start = 0; start < page.content.length; start += step) {
      passages.push({
        ordinal: passages.length,
        content: page.content.slice(start, start + targetCharacters).trim(),
        paragraphStart: 0,
        paragraphEnd: 0,
        pageNumber: page.page,
      });
      if (start + targetCharacters >= page.content.length) break;
    }
  }
  return passages.filter(({ content }) => Boolean(content));
}
