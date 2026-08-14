"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--paper)] p-6">
      <div className="max-w-md text-center">
        <div className="mb-10 flex justify-center">
          <BrandMark />
        </div>
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#f9e6df] text-[var(--danger)]">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-6 font-serif text-4xl font-semibold tracking-[-0.04em]">
          The desk needs a moment.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Your work remains saved. Try loading the private workspace again.
        </p>
        <Button className="mt-6" onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </div>
    </main>
  );
}
