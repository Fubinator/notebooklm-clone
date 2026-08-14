import { ArrowRight, Database, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

export function ConfigurationRequired() {
  return (
    <main className="min-h-dvh bg-[var(--paper)] px-6 py-8 sm:px-10">
      <BrandMark />
      <section className="mx-auto grid max-w-5xl items-center gap-12 py-20 lg:grid-cols-[1.1fr_.9fr] lg:py-28">
        <div>
          <p className="eyebrow">Local setup</p>
          <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.02] font-semibold tracking-[-0.045em] text-[var(--ink)] sm:text-6xl">
            Connect the research desk to Supabase.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)]">
            The interface is ready. Add the two safe public values below, apply
            the migration, and refresh to enter automatically as a private
            Guest.
          </p>
        </div>

        <div className="rounded-[26px] border border-[var(--line)] bg-white p-6 shadow-[0_20px_60px_rgba(24,38,31,.08)] sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--sage)] text-[var(--ink)]">
              <Database className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
              <ShieldCheck className="size-3.5" /> No service key
            </span>
          </div>
          <ol className="space-y-5 text-sm text-[var(--muted)]">
            <li className="flex gap-3">
              <span className="step-number">1</span>
              <span>
                Copy <code>.env.example</code> to <code>.env.local</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="step-number">2</span>
              <span>
                Set the project URL and publishable key from Supabase.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="step-number">3</span>
              <span>Run the migration and enable anonymous sign-ins.</span>
            </li>
          </ol>
          <a
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-4"
            href="https://github.com/Fubinator/notebooklm-clone#setup"
          >
            Open setup instructions <ArrowRight className="size-4" />
          </a>
        </div>
      </section>
    </main>
  );
}
