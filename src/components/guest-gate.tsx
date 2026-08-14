"use client";

import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GuestGate() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function enterAsGuest() {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInAnonymously();

      if (signInError) {
        setError(
          signInError.status === 429
            ? "Guest access is busy. Wait a moment and try again."
            : "We couldn't create your private Guest session.",
        );
        return;
      }

      router.refresh();
    }

    void enterAsGuest();
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--paper)] p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-10 flex justify-center">
          <BrandMark />
        </div>
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-[22px] border border-[var(--line)] bg-white shadow-[0_14px_40px_rgba(24,38,31,.08)]">
          {error ? (
            <AlertCircle className="size-6 text-[var(--danger)]" />
          ) : (
            <LoaderCircle className="size-6 animate-spin text-[var(--ink)]" />
          )}
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
          {error ? "Entry paused" : "Preparing your desk"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {error ??
            "Creating a private Guest workspace. No account or personal details needed."}
        </p>
        {error ? (
          <Button className="mt-6" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
        ) : null}
      </div>
    </main>
  );
}
