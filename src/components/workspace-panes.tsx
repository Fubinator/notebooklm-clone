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
    >
      <MobileTab
        active={active === "sources"}
        onClick={() => onChange("sources")}
        icon={FileText}
        label="Sources"
        controls="sources-panel"
      />
      <MobileTab
        active={active === "conversation"}
        onClick={() => onChange("conversation")}
        icon={MessageSquareText}
        label="Conversation"
        controls="conversation-panel"
      />
      <MobileTab
        active={active === "studio"}
        onClick={() => onChange("studio")}
        icon={PanelRight}
        label="Studio"
        controls="studio-panel"
      />
    </nav>
  );
}

function MobileTab({
  active,
  onClick,
  icon: Icon,
  label,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
  controls: string;
}) {
  return (
    <button
      aria-controls={controls}
      aria-expanded={label === "Conversation" ? undefined : active}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-inset",
        active &&
          "text-[var(--ink)] after:absolute after:right-5 after:bottom-0 after:left-5 after:h-0.5 after:rounded-full after:bg-[var(--accent-strong)]",
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
