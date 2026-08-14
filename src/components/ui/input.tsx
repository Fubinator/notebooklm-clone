import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3.5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--sage)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
