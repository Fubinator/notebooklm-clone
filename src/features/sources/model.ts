import type { Database } from "@/lib/database.types";

export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type Passage = Database["public"]["Tables"]["passages"]["Row"];

export type ReadablePassage = Omit<Passage, "embedding">;
export type ReadableSource = Source & { passages: ReadablePassage[] };

export function sortSources(sources: ReadableSource[]) {
  return [...sources].map((source) => ({
    ...source,
    passages: [...source.passages].sort(
      (left, right) => left.ordinal - right.ordinal,
    ),
  }));
}

export function formatPassageLocation(passage: ReadablePassage) {
  if (passage.page_number !== null) {
    return `PDF page ${passage.page_number}`;
  }

  if (passage.paragraph_start === passage.paragraph_end) {
    return `Paragraph ${passage.paragraph_start}`;
  }

  return `Paragraphs ${passage.paragraph_start}–${passage.paragraph_end}`;
}
