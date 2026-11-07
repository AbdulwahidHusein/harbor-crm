"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarCheck,
  CheckSquare,
  ChevronDown,
  FileText,
  Handshake,
  History,
  Mail,
  Receipt,
  StickyNote,
  User,
  Building2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceRef } from "@/lib/intelligence/types";
import { formatDate } from "@/lib/intelligence/format";

const ICONS: Record<EvidenceRef["type"], React.ComponentType<{ className?: string }>> = {
  activity: CalendarCheck,
  task: CheckSquare,
  opportunity: Handshake,
  invoice: Receipt,
  email: Mail,
  contact: User,
  account: Building2,
  lead: UserPlus,
  note: StickyNote,
  audit: History,
};

export function EvidenceItem({ item: r }: { item: EvidenceRef }) {
  const Icon = ICONS[r.type] ?? FileText;
  const body = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{r.label}</span>
      {r.date ? <span className="shrink-0 tabular-nums text-muted-foreground">{formatDate(r.date)}</span> : null}
    </>
  );
  const cls = "flex items-center gap-2 rounded px-1.5 py-1 text-xs";
  return r.href ? (
    <Link href={r.href} className={cn(cls, "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * "N sources" disclosure under any insight. Lets the user verify exactly
 * which CRM records an AI statement or signal is based on.
 */
export function Evidence({ refs, defaultOpen = false, className }: { refs: EvidenceRef[]; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!refs?.length) return null;
  return (
    <div className={cn("mt-1", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {refs.length} {refs.length === 1 ? "source" : "sources"}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-1 space-y-0.5 border-l border-border pl-2">
          {refs.map((r) => (
            <EvidenceItem key={`${r.type}:${r.id}`} item={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
