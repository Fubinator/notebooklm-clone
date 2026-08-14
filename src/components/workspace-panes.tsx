"use client";

import { FileText, MessageSquareText, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobilePanel = "sources" | "conversation" | "studio";

export function WorkspacePanelTabs({
  active,
  onChange,
}: {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
}) {
  return (
    <nav
      className="flex h-12 shrink-0 border-b border-[var(--line)] bg-white/70 lg:hidden"
      aria-label="Workspace panels"
      role="tablist"
    >
      <MobileTab
        active={active === "sources"}
        onClick={() => onChange("sources")}
        icon={FileText}
        label="Sources"
      />
      <MobileTab
        active={active === "conversation"}
        onClick={() => onChange("conversation")}
        icon={MessageSquareText}
        label="Conversation"
      />
      <MobileTab
        active={active === "studio"}
        onClick={() => onChange("studio")}
        icon={PanelRight}
        label="Studio"
      />
    </nav>
  );
}

function MobileTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold text-[var(--muted)]",
        active &&
          "text-[var(--ink)] after:absolute after:right-5 after:bottom-0 after:left-5 after:h-0.5 after:rounded-full after:bg-[var(--accent-strong)]",
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
