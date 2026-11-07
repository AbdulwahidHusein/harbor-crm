"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Severity, Signal } from "@/lib/intelligence/types";
import { dismissRecommendation, undoDismissRecommendation } from "@/actions/intelligence/recommendations";
import { Evidence } from "./evidence";
import { CreateTaskDialog } from "./create-task-dialog";

export function SeverityMark({ severity, className }: { severity: Severity; className?: string }) {
  const label = severity === "high" ? "High priority" : severity === "medium" ? "Medium priority" : "Low priority";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
        severity === "high" && "bg-destructive",
        severity === "medium" && "bg-warning",
        severity === "low" && "bg-muted-foreground/40",
        className,
      )}
    />
  );
}

/**
 * One deterministic recommendation: what, why (evidence), and what to do.
 * `showSubject` links to the related record (used in the briefing).
 */
export function SignalRow({
  signal,
  showSubject = false,
  dismissible = false,
  onDismissed,
}: {
  signal: Signal;
  showSubject?: boolean;
  dismissible?: boolean;
  onDismissed?: (key: string) => void;
}) {
  const [pending, start] = useTransition();
  const canCreateTask = signal.suggestedTask && signal.subject.type !== "task";

  const dismiss = () =>
    start(async () => {
      const res = await dismissRecommendation({ signalKey: signal.key, days: 7 });
      if (res.error) {
        toast.error("Could not dismiss");
        return;
      }
      onDismissed?.(signal.key);
      toast("Hidden for 7 days", {
        action: {
          label: "Undo",
          onClick: async () => {
            await undoDismissRecommendation({ signalKey: signal.key });
            window.location.reload();
          },
        },
      });
    });

  return (
    <li className={cn("group flex flex-wrap gap-x-3 gap-y-1 py-3 sm:flex-nowrap", pending && "opacity-50")}>
      <SeverityMark severity={signal.severity} />
      <div className="min-w-0 flex-1 basis-[calc(100%-1.25rem)] sm:basis-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-sm font-medium text-foreground">{signal.title}</p>
          {showSubject && signal.subject.type !== "task" ? (
            <Link href={signal.subject.href} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {signal.subject.label}
            </Link>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{signal.detail}</p>
        <Evidence refs={signal.evidence} />
      </div>
      <div className="-ml-2 flex shrink-0 items-start gap-1 pl-5 sm:ml-0 sm:pl-0">
        {canCreateTask ? (
          <CreateTaskDialog
            subjectType={signal.subject.type as "contact" | "account" | "opportunity" | "lead"}
            subjectId={signal.subject.id}
            subjectLabel={signal.subject.label}
            defaultTitle={signal.suggestedTask!.title}
            defaultDueInDays={signal.suggestedTask!.dueInDays}
            details={`${signal.title}. ${signal.detail}`}
            trigger={
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Create task
              </Button>
            }
          />
        ) : null}
        {dismissible ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={dismiss}
            disabled={pending}
            aria-label={`Dismiss: ${signal.title}`}
          >
            <X />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function SignalList({
  signals,
  showSubject,
  dismissible,
  empty,
  limit,
}: {
  signals: Signal[];
  showSubject?: boolean;
  dismissible?: boolean;
  empty?: React.ReactNode;
  limit?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const visible = signals.filter((s) => !hidden.has(s.key));
  if (!visible.length) return <>{empty ?? null}</>;
  const shown = limit && !expanded ? visible.slice(0, limit) : visible;
  return (
    <div>
      <ul className="divide-y divide-border">
        {shown.map((s) => (
          <SignalRow
            key={s.key}
            signal={s}
            showSubject={showSubject}
            dismissible={dismissible}
            onDismissed={(k) => setHidden((prev) => new Set(prev).add(k))}
          />
        ))}
      </ul>
      {limit && visible.length > limit ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show fewer" : `Show ${visible.length - limit} more`}
        </button>
      ) : null}
    </div>
  );
}
