"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { EvidenceRef } from "@/lib/intelligence/types";
import type { InsightView } from "@/lib/intelligence/insights";
import { getRecordIntelligence, refreshRecordIntelligence } from "@/actions/intelligence/insights";
import { Evidence } from "./evidence";
import { SignalList, SeverityMark } from "./signal-list";
import { CreateTaskDialog } from "./create-task-dialog";

type EntityType = "contact" | "account" | "opportunity";
type Cited = { sources: EvidenceRef[] };

interface RelationshipPayload {
  summary: string | null;
  summarySources: EvidenceRef[];
  keyInteractions: ({ text: string } & Cited)[];
  commitments: ({ text: string; owedBy: "us" | "them" | "unclear"; status: "open" | "fulfilled" | "unclear" } & Cited)[];
  openQuestions: ({ text: string } & Cited)[];
  engagement: { trend: string; explanation: string | null } & Cited;
  nextActions: ({ action: string; rationale: string; priority: "high" | "medium" | "low" } & Cited)[];
}

interface DealPayload {
  progression: string | null;
  progressionSources: EvidenceRef[];
  risks: ({ risk: string; severity: "high" | "medium" | "low" } & Cited)[];
  unresolvedRequirements: ({ text: string } & Cited)[];
  stakeholderGaps: ({ text: string } & Cited)[];
  nextSteps: ({ action: string; rationale: string } & Cited)[];
}

const POLL_MS = 2500;
const MAX_POLLS = 60;

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{children}</h3>
      {hint ? <span className="text-[11px] text-muted-foreground/70">{hint}</span> : null}
    </div>
  );
}

function CitedList<T extends Cited>({ items, render, empty }: { items: T[]; render: (i: T) => React.ReactNode; empty: string }) {
  if (!items?.length) return <p className="py-1 text-sm text-muted-foreground/80">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((it, idx) => (
        <li key={idx} className="text-sm">
          {render(it)}
          <Evidence refs={it.sources} />
        </li>
      ))}
    </ul>
  );
}

const OWED: Record<string, string> = { us: "We owe", them: "They owe", unclear: "Owner unclear" };
const TREND: Record<string, string> = {
  increasing: "Increasing",
  stable: "Stable",
  declining: "Declining",
  insufficient_data: "Not enough history",
};

function RelationshipBody({ p, entityType, entityId, subjectLabel }: { p: RelationshipPayload; entityType: EntityType; entityId: string; subjectLabel: string }) {
  return (
    <div className="space-y-6">
      {p.summary ? (
        <div>
          <p className="text-[15px] leading-relaxed text-foreground">{p.summary}</p>
          <Evidence refs={p.summarySources} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">There isn&apos;t enough recorded history to summarize this relationship yet.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionLabel>Outstanding commitments</SectionLabel>
          <CitedList
            items={p.commitments.filter((c) => c.status !== "fulfilled")}
            empty="No open commitments found in the records."
            render={(c) => (
              <>
                <span className="mr-1.5 text-xs font-medium text-muted-foreground">{OWED[c.owedBy]}</span>
                {c.text}
              </>
            )}
          />
        </div>
        <div>
          <SectionLabel>Unresolved questions</SectionLabel>
          <CitedList items={p.openQuestions} empty="No unanswered questions found." render={(q) => q.text} />
        </div>
        <div>
          <SectionLabel>Important interactions</SectionLabel>
          <CitedList items={p.keyInteractions} empty="No notable interactions recorded." render={(k) => k.text} />
        </div>
        <div>
          <SectionLabel>Engagement</SectionLabel>
          <p className="text-sm">
            <span className="font-medium">{TREND[p.engagement.trend] ?? p.engagement.trend}</span>
            {p.engagement.explanation ? <span className="text-muted-foreground"> — {p.engagement.explanation}</span> : null}
          </p>
          <Evidence refs={p.engagement.sources} />
        </div>
      </div>

      <div>
        <SectionLabel>Suggested next actions</SectionLabel>
        {p.nextActions.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {p.nextActions.map((a, i) => (
              <li key={i} className="flex gap-3 px-3 py-2.5">
                <SeverityMark severity={a.priority} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="text-sm text-muted-foreground">{a.rationale}</p>
                  <Evidence refs={a.sources} />
                </div>
                <CreateTaskDialog
                  subjectType={entityType}
                  subjectId={entityId}
                  subjectLabel={subjectLabel}
                  defaultTitle={a.action}
                  details={a.rationale}
                  trigger={
                    <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground">
                      Create task
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground/80">No actions suggested.</p>
        )}
      </div>
    </div>
  );
}

function DealBody({ p, entityId, subjectLabel }: { p: DealPayload; entityId: string; subjectLabel: string }) {
  return (
    <div className="space-y-6">
      {p.progression ? (
        <div>
          <p className="text-[15px] leading-relaxed">{p.progression}</p>
          <Evidence refs={p.progressionSources} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not enough recorded history to describe how this deal has progressed.</p>
      )}
      <div>
        <SectionLabel hint="Assessment based on the cited records — not a forecast">Risk assessment</SectionLabel>
        {p.risks.length ? (
          <ul className="space-y-2.5">
            {p.risks.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <SeverityMark severity={r.severity} />
                <div className="min-w-0">
                  {r.risk}
                  <Evidence refs={r.sources} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground/80">No evidence-based risks identified.</p>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionLabel>Unresolved requirements</SectionLabel>
          <CitedList items={p.unresolvedRequirements} empty="None found in the records." render={(x) => x.text} />
        </div>
        <div>
          <SectionLabel>Stakeholder gaps</SectionLabel>
          <CitedList items={p.stakeholderGaps} empty="No gaps identified from linked contacts." render={(x) => x.text} />
        </div>
      </div>
      <div>
        <SectionLabel>Possible next steps</SectionLabel>
        {p.nextSteps.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {p.nextSteps.map((s, i) => (
              <li key={i} className="flex gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.action}</p>
                  <p className="text-sm text-muted-foreground">{s.rationale}</p>
                  <Evidence refs={s.sources} />
                </div>
                <CreateTaskDialog
                  subjectType="opportunity"
                  subjectId={entityId}
                  subjectLabel={subjectLabel}
                  defaultTitle={s.action}
                  details={s.rationale}
                  trigger={
                    <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground">
                      Create task
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground/80">No next steps suggested.</p>
        )}
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading intelligence">
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-4 pt-3 lg:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

/**
 * Intelligence section for a contact, company or deal.
 * Top: AI synthesis (cached, cited, marked as AI). Bottom: rule-based signals
 * computed live from records. The page stays useful when AI is unavailable.
 */
export function RecordIntelligence({ entityType, entityId, className }: { entityType: EntityType; entityId: string; className?: string }) {
  const [view, setView] = useState<InsightView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, start] = useTransition();
  const polls = useRef(0);
  const autoRequested = useRef(false);

  const apply = useCallback((res: Awaited<ReturnType<typeof getRecordIntelligence>>) => {
    if (res.error) {
      setLoadError(res.error);
      return;
    }
    setLoadError(null);
    setView(res.data!);
  }, []);

  const load = useCallback(
    () => getRecordIntelligence({ entityType, entityId }).then(apply),
    [entityType, entityId, apply],
  );

  const refresh = useCallback(
    (force: boolean) =>
      start(async () => {
        polls.current = 0;
        const res = await refreshRecordIntelligence({ entityType, entityId, force });
        if (res.error && res.error !== "AI_NOT_CONFIGURED") setLoadError(res.error);
        await load();
      }),
    [entityType, entityId, load],
  );

  useEffect(() => {
    let alive = true;
    getRecordIntelligence({ entityType, entityId }).then((res) => {
      if (alive) apply(res);
    });
    return () => {
      alive = false;
    };
  }, [entityType, entityId, apply]);

  // First visit: generate automatically when AI is configured.
  useEffect(() => {
    if (view && view.aiConfigured && view.status === "NONE" && !autoRequested.current) {
      autoRequested.current = true;
      refresh(false);
    }
  }, [view, refresh]);

  // Poll while a background job is running.
  useEffect(() => {
    if (!view || (view.status !== "PENDING" && view.status !== "GENERATING")) return;
    if (polls.current >= MAX_POLLS) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [view, load]);

  if (loadError === "FORBIDDEN" || loadError === "UNAUTHORIZED") return null;

  const working = refreshing || view?.status === "PENDING" || view?.status === "GENERATING";
  const label = entityType === "opportunity" ? "Deal intelligence" : "Relationship intelligence";

  return (
    <section aria-labelledby={`ci-${entityId}`} className={cn("rounded-lg border border-border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 id={`ci-${entityId}`} className="text-sm font-semibold">
            {label}
          </h2>
          <p className="text-xs text-muted-foreground">
            {view?.generatedAt ? (
              <>
                AI summary · generated {formatDistanceToNow(new Date(view.generatedAt), { addSuffix: true })} · from {view.evidenceCount} linked records
              </>
            ) : view && !view.aiConfigured ? (
              "AI summaries are off · showing recorded signals only"
            ) : (
              "AI summary grounded in this record's history"
            )}
          </p>
        </div>
        {view?.aiConfigured ? (
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={working} aria-label="Regenerate summary">
            {working ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {working ? "Analyzing" : "Refresh"}
          </Button>
        ) : null}
      </header>

      <div className="space-y-6 px-5 py-5">
        {!view && !loadError ? <PanelSkeleton /> : null}

        {loadError && loadError !== "FORBIDDEN" ? (
          <div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" /> Intelligence couldn&apos;t be loaded. The rest of this page is unaffected.
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {view ? (
          <>
            {view.stale && !working ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Records changed since this summary was generated.</span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => refresh(true)}>
                  Update summary
                </Button>
              </div>
            ) : null}

            {view.status === "FAILED" && view.error ? (
              <div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {view.error} {view.insight ? "Showing the previous summary." : ""}
              </div>
            ) : null}

            {view.insight && !(working && !view.generatedAt) ? (
              <div className={cn(working && "opacity-60 transition-opacity")}>
                {entityType === "opportunity" ? (
                  <DealBody p={view.insight as DealPayload} entityId={entityId} subjectLabel={view.subject.label} />
                ) : (
                  <RelationshipBody p={view.insight as RelationshipPayload} entityType={entityType} entityId={entityId} subjectLabel={view.subject.label} />
                )}
              </div>
            ) : working ? (
              <PanelSkeleton />
            ) : !view.aiConfigured ? (
              <p className="text-sm text-muted-foreground">
                Connect an OpenAI key under Administration → LLM keys to add AI summaries, commitments and suggested actions. Recorded
                signals below are always available.
              </p>
            ) : null}

            <div className={cn(view.insight || working ? "border-t border-border pt-5" : "")}>
              <SectionLabel hint="Computed from records, not AI">Needs attention</SectionLabel>
              <SignalList
                signals={view.signals}
                empty={<p className="py-1 text-sm text-muted-foreground/80">Nothing needs attention right now.</p>}
                limit={5}
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
