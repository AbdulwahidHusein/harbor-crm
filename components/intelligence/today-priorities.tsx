"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Signal } from "@/lib/intelligence/types";
import { getBriefingFocus } from "@/actions/intelligence/briefing";
import { Evidence } from "./evidence";
import { CreateTaskDialog } from "./create-task-dialog";
import { Button } from "@/components/ui/button";

type Focus = { focus: string; picks: { key: string; why: string }[]; generatedAt: string };

/**
 * "Three most important actions today". The ranked list is rule-based; when AI
 * is configured it may re-order those same items and add a one-line reason.
 * It can never introduce an item that isn't backed by records.
 */
export function TodayPriorities({ top, candidates, aiConfigured }: { top: Signal[]; candidates: Signal[]; aiConfigured: boolean }) {
  const [focus, setFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(aiConfigured && candidates.length > 0);

  useEffect(() => {
    if (!aiConfigured || !candidates.length) return;
    let cancelled = false;
    getBriefingFocus({ generate: true })
      .then((res) => {
        if (!cancelled && res && "data" in res && res.data) setFocus(res.data as Focus);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [aiConfigured, candidates.length]);

  const items = useMemo(() => {
    const byKey = new Map(candidates.map((c) => [c.key, c]));
    const picked = (focus?.picks ?? []).map((p) => ({ signal: byKey.get(p.key), why: p.why })).filter((p) => p.signal) as {
      signal: Signal;
      why: string;
    }[];
    return picked.length ? picked : top.map((signal) => ({ signal, why: null as string | null }));
  }, [focus, top, candidates]);

  if (!top.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm font-medium">You&apos;re on top of things</p>
        <p className="mt-1 text-sm text-muted-foreground">No overdue commitments, quiet customers or stalled deals in your records today.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="today-priorities" className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="today-priorities" className="text-sm font-semibold">
          Today&apos;s priorities
        </h2>
        <span className="text-xs text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Prioritizing
            </span>
          ) : focus ? (
            "Ordered by AI from your records"
          ) : (
            "Ranked by urgency and deal value"
          )}
        </span>
      </header>
      {focus?.focus ? <p className="border-b border-border px-5 py-3 text-sm text-foreground/90">{focus.focus}</p> : null}
      <ol className="divide-y divide-border">
        {items.map(({ signal, why }, i) => (
          <li key={signal.key} className="flex flex-wrap gap-x-4 gap-y-2 px-5 py-4 sm:flex-nowrap">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
              <p className="text-sm font-medium">{signal.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{why ?? signal.detail}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3">
                {signal.subject.type !== "task" ? (
                  <Link href={signal.subject.href} className="text-xs text-primary hover:underline">
                    Open {signal.subject.label}
                  </Link>
                ) : null}
                <Evidence refs={signal.evidence} />
              </div>
            </div>
            {signal.suggestedTask && signal.subject.type !== "task" ? (
              <CreateTaskDialog
                subjectType={signal.subject.type as "contact" | "account" | "opportunity" | "lead"}
                subjectId={signal.subject.id}
                subjectLabel={signal.subject.label}
                defaultTitle={signal.suggestedTask.title}
                defaultDueInDays={signal.suggestedTask.dueInDays}
                details={`${signal.title}. ${signal.detail}`}
                trigger={
                  <Button variant="outline" size="sm" className="ml-10 shrink-0 sm:ml-0">
                    Create task
                  </Button>
                }
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
