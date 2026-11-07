"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowUp, Check, Loader2, AlertCircle, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { CommandBlock, CommandResult, CommandTurn, Proposal, RecordRow } from "@/lib/intelligence/command/types";
import { executeTaskProposal, runCommandAction, runQuickCommandAction } from "@/actions/intelligence/command";
import { SeverityMark } from "./signal-list";

const EXAMPLES = [
  "Show me opportunities without activity in the last 14 days",
  "Summarize my relationship with Acme",
  "Which customers have overdue invoices?",
  "Find leads that need follow-up",
];

const QUICK: { id: string; label: string }[] = [
  { id: "stale_opportunities", label: "Stale opportunities" },
  { id: "overdue_invoices", label: "Overdue invoices" },
  { id: "leads_follow_up", label: "Leads to follow up" },
  { id: "my_overdue_tasks", label: "My overdue tasks" },
];

interface Exchange {
  id: number;
  query: string;
  status: "running" | "done" | "error";
  result?: CommandResult;
  error?: string;
}

function RecordsTable({ block }: { block: Extract<CommandBlock, { type: "records" }> }) {
  const [all, setAll] = useState(false);
  const rows = all ? block.rows : block.rows.slice(0, 8);
  return (
    <div className="rounded-md border border-border">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-medium">{block.title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{block.total ?? block.rows.length}</span>
      </div>
      {block.rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((r: RecordRow) => (
            <li key={r.id} className="flex items-start gap-3 px-3 py-2">
              {r.severity ? <SeverityMark severity={r.severity} /> : <span className="w-2 shrink-0" />}
              <div className="min-w-0 flex-1">
                {r.href ? (
                  <Link href={r.href} className="text-sm font-medium hover:underline">
                    {r.title}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{r.title}</span>
                )}
                {r.subtitle ? <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p> : null}
              </div>
              {r.meta?.length ? (
                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                  {r.meta.map((m, i) => (
                    <div key={i} className="tabular-nums">
                      {m}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-4 text-sm text-muted-foreground">No matching records.</p>
      )}
      {block.rows.length > 8 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
          {all ? "Show fewer" : `Show all ${block.rows.length}`}
        </button>
      ) : null}
    </div>
  );
}

function InsightCard({ block }: { block: Extract<CommandBlock, { type: "insight" }> }) {
  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <Link href={block.href} className="text-sm font-medium hover:underline">
          {block.title}
        </Link>
        <span className="text-xs text-muted-foreground">
          {block.generatedAt ? `AI summary · ${formatDistanceToNow(new Date(block.generatedAt), { addSuffix: true })}` : "Recorded signals"}
          {block.stale ? " · out of date" : ""}
        </span>
      </div>
      <div className="space-y-3 px-3 py-3">
        {block.summary ? <p className="text-sm leading-relaxed">{block.summary}</p> : null}
        {block.points.length ? (
          <dl className="space-y-1.5">
            {block.points.map((p, i) => (
              <div key={i} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-sm">
                <dt className="text-muted-foreground">{p.label}</dt>
                <dd>{p.text}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {block.signals.length ? (
          <ul className="space-y-1.5 border-t border-border pt-3">
            {block.signals.map((s) => (
              <li key={s.id} className="flex gap-2 text-sm">
                {s.severity ? <SeverityMark severity={s.severity} /> : null}
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Link href={block.href} className="inline-block text-xs text-primary hover:underline">
          Open record and sources
        </Link>
      </div>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(proposal.items.map((i) => i.subjectId)));
  const [results, setResults] = useState<Record<string, { ok: boolean; error?: string }> | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [pending, start] = useTransition();
  const chosen = proposal.items.filter((i) => selected.has(i.subjectId));

  const confirm = () =>
    start(async () => {
      const res = await executeTaskProposal(chosen.map(({ subjectType, subjectId, title, dueInDays }) => ({ subjectType, subjectId, title, dueInDays })));
      if (res.error || !res.data) {
        toast.error(res.error ?? "Tasks could not be created");
        return;
      }
      const map = Object.fromEntries(res.data.map((r) => [r.subjectId, r]));
      setResults(map);
      const ok = res.data.filter((r) => r.ok).length;
      if (ok) toast.success(`${ok} task${ok === 1 ? "" : "s"} created`);
      if (ok < res.data.length) toast.error(`${res.data.length - ok} could not be created`);
    });

  return (
    <div className="rounded-md border border-primary/30 bg-primary/[0.03]">
      <div className="border-b border-primary/20 px-3 py-2">
        <h3 className="text-sm font-medium">{proposal.summary}</h3>
        <p className="text-xs text-muted-foreground">Review the records below. Nothing is created until you confirm.</p>
      </div>
      <ul className="divide-y divide-border">
        {proposal.items.map((item) => {
          const r = results?.[item.subjectId];
          return (
            <li key={item.subjectId} className="flex items-start gap-3 px-3 py-2">
              {results ? (
                r?.ok ? (
                  <Check className="mt-0.5 h-4 w-4 text-success" aria-label="Created" />
                ) : r ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-label="Failed" />
                ) : (
                  <CircleSlash className="mt-0.5 h-4 w-4 text-muted-foreground" aria-label="Skipped" />
                )
              ) : (
                <Checkbox
                  className="mt-0.5"
                  checked={selected.has(item.subjectId)}
                  disabled={pending || cancelled}
                  aria-label={`Include ${item.subjectLabel}`}
                  onCheckedChange={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(item.subjectId);
                      else next.delete(item.subjectId);
                      return next;
                    })
                  }
                />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  <Link href={item.subjectHref} className="hover:underline">
                    {item.subjectLabel}
                  </Link>{" "}
                  · {item.subjectType} · due {item.dueInDays === 0 ? "today" : `in ${item.dueInDays} day${item.dueInDays === 1 ? "" : "s"}`}
                </p>
                {r && !r.ok ? <p className="text-xs text-destructive">{r.error}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {proposal.skipped.length ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Skipped: {proposal.skipped.join("; ")}</p>
      ) : null}
      {!results && !cancelled ? (
        <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setCancelled(true)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={confirm} disabled={pending || chosen.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Create {chosen.length} task{chosen.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : cancelled ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Cancelled. Nothing was created.</p>
      ) : null}
    </div>
  );
}

function ExchangeView({ ex }: { ex: Exchange }) {
  return (
    <article className="space-y-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium text-foreground">{ex.query}</p>
      {ex.status === "running" ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : ex.status === "error" ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" /> {ex.error}
        </p>
      ) : ex.result ? (
        <>
          {ex.result.reply ? <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{ex.result.reply}</p> : null}
          {ex.result.proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
          {ex.result.blocks.map((b, i) => (b.type === "records" ? <RecordsTable key={i} block={b} /> : <InsightCard key={i} block={b} />))}
        </>
      ) : null}
    </article>
  );
}

export function CommandCenter({ aiConfigured, initialQuery }: { aiConfigured: boolean; initialQuery?: string }) {
  const [input, setInput] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  // Requests handed over from the ⌘K menu (/intelligence?q=…) run once on arrival.
  const ranInitial = useRef(false);

  const history = (): CommandTurn[] =>
    exchanges
      .filter((e) => e.status === "done" && e.result)
      .flatMap((e) => [
        { role: "user" as const, content: e.query },
        { role: "assistant" as const, content: e.result!.reply || "(results shown)" },
      ]);

  const run = async (query: string, quick?: string) => {
    const q = query.trim();
    if (!q || busy) return;
    const id = ++counter.current;
    setExchanges((prev) => [...prev, { id, query: q, status: "running" }]);
    setInput("");
    setBusy(true);
    try {
      const res = quick ? await runQuickCommandAction(quick) : await runCommandAction([...history(), { role: "user", content: q }]);
      setExchanges((prev) =>
        prev.map((e) =>
          e.id === id
            ? res.data
              ? { ...e, status: "done", result: res.data }
              : { ...e, status: "error", error: res.error === "AI_NOT_CONFIGURED" ? "AI is not configured. Use the quick reports below, or add an OpenAI key under Administration → LLM keys." : res.error }
            : e,
        ),
      );
    } catch {
      setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, status: "error", error: "The request failed. Please try again." } : e)));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (ranInitial.current || !initialQuery?.trim() || !aiConfigured) return;
    ranInitial.current = true;
    const t = setTimeout(() => void run(initialQuery), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, aiConfigured]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(input);
        }}
        className="rounded-lg border border-input bg-card focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/20"
      >
        <label htmlFor="command-input" className="sr-only">
          Ask about your CRM
        </label>
        <textarea
          id="command-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run(input);
            }
          }}
          rows={2}
          maxLength={2000}
          disabled={!aiConfigured}
          placeholder={aiConfigured ? "Ask about your customers, deals and tasks…" : "Natural-language requests need an AI key. Quick reports below work without one."}
          className="block w-full resize-none bg-transparent px-4 pt-3 text-[15px] placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
          autoFocus
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className="text-xs text-muted-foreground">Reads your records with your permissions. Changes always need your confirmation.</span>
          <Button type="submit" size="icon" className="h-8 w-8" disabled={!aiConfigured || busy || !input.trim()} aria-label="Run request">
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </form>

      {!exchanges.length ? (
        <div className="grid gap-8 sm:grid-cols-2">
          {aiConfigured ? (
            <section>
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">Try asking</h2>
              <ul className="space-y-1">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button type="button" onClick={() => void run(ex)} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="mb-2 text-xs font-medium text-muted-foreground">Quick reports · no AI needed</h2>
            <ul className="space-y-1">
              {QUICK.map((q) => (
                <li key={q.id}>
                  <button type="button" onClick={() => void run(q.label, q.id)} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {q.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          {exchanges.map((ex) => (
            <ExchangeView key={ex.id} ex={ex} />
          ))}
          <div className={cn("flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground")}>
            <span>Quick reports:</span>
            {QUICK.map((q) => (
              <button key={q.id} type="button" disabled={busy} onClick={() => void run(q.label, q.id)} className="hover:text-foreground disabled:opacity-50">
                {q.label}
              </button>
            ))}
          </div>
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
