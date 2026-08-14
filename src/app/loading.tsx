import { BrandMark } from "@/components/brand-mark";

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--paper)]">
      <header className="flex h-[68px] items-center border-b border-[var(--line)] px-6">
        <BrandMark />
      </header>
      <div className="grid flex-1 lg:grid-cols-[286px_1fr_318px]">
        <div className="hidden animate-pulse border-r border-[var(--line)] bg-[var(--paper-deep)] p-5 lg:block">
          <div className="h-4 w-20 rounded-full bg-[var(--line)]" />
          <div className="mt-5 h-10 rounded-xl bg-white" />
        </div>
        <div className="grid place-items-center p-6">
          <div className="text-center">
            <div className="mx-auto size-14 animate-pulse rounded-[20px] bg-[var(--sage)]" />
            <div className="mx-auto mt-5 h-5 w-44 animate-pulse rounded-full bg-[var(--line)]" />
            <div className="mx-auto mt-3 h-3 w-64 animate-pulse rounded-full bg-[var(--line)]" />
          </div>
        </div>
        <div className="hidden border-l border-[var(--line)] bg-[#f7f3e9] lg:block" />
      </div>
    </main>
  );
}
