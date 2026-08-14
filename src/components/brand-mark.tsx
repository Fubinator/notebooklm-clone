import { BookOpenText } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--ink)] text-white shadow-sm">
        <BookOpenText className="size-[18px]" strokeWidth={1.8} />
      </span>
      <span
        className={cn(
          "font-serif text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]",
          compact && "hidden sm:inline",
        )}
      >
        Margin
      </span>
    </div>
  );
}
