"use client";

import { useId, useState } from "react";
import { ArrowUp, Check } from "lucide-react";
import s from "../welcome.module.css";

const TABS = [
  {
    id: "relationship",
    title: "Relationship intelligence",
    body: "A living summary of every contact and company: what was promised, what is still open, and whether engagement is rising or fading.",
  },
  {
    id: "deal",
    title: "Deal intelligence",
    body: "Why a deal is at risk, shown as evidence rather than a probability. Missing decision-makers, unanswered requirements, stages that stopped moving.",
  },
  {
    id: "briefing",
    title: "Daily briefing",
    body: "Three things to do today, ranked by urgency and deal value. Turn any of them into a task, or dismiss it until it matters again.",
  },
  {
    id: "command",
    title: "Command Center",
    body: "Ask in plain language. Harbor answers from your records, and any change it suggests waits for your confirmation.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* Product frames use the app's own palette so visitors see the real product language. */
const Frame = ({ children, title }: { children: React.ReactNode; title: string }) => (
  <div className="overflow-hidden rounded-lg border border-[#e3e1dc] bg-[#fdfcfa] text-[#181b22] shadow-[0_30px_60px_-30px_rgba(15,36,54,0.35)]">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#e3e1dc] px-5 py-3">
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-[#6a6f78]">Generated 2 hours ago from 24 records</span>
    </div>
    <div className="px-5 py-5 text-sm">{children}</div>
  </div>
);
const Dot = ({ c }: { c: "red" | "amber" | "grey" }) => (
  <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${c === "red" ? "bg-[#c2362b]" : c === "amber" ? "bg-[#b9680d]" : "bg-[#b9bcc2]"}`} aria-hidden />
);
const Src = ({ n }: { n: number }) => <span className="ml-1 text-xs text-[#6a6f78]">{n === 1 ? "1 source" : `${n} sources`}</span>;

function Panel({ id }: { id: TabId }) {
  if (id === "relationship")
    return (
      <Frame title="Relationship intelligence">
        <p className="text-[15px] leading-relaxed">
          Sarah has led the Acme renewal since August. On Oct 20 she asked for revised three-year pricing, and no follow-up is recorded since.
        </p>
        <Src n={2} />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-[#6a6f78]">Outstanding commitments</p>
            <p>
              <span className="mr-1 text-xs font-medium text-[#6a6f78]">We owe</span>Revised proposal with 3-year pricing
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#6a6f78]">Unresolved questions</p>
            <p>Is SSO included in the enterprise tier?</p>
          </div>
        </div>
        <div className="mt-5 flex items-start justify-between gap-3 rounded-md border border-[#e3e1dc] px-3 py-2.5">
          <div className="flex gap-2.5">
            <Dot c="red" />
            <div>
              <p className="font-medium">Send the revised 3-year proposal</p>
              <p className="text-[#6a6f78]">Requested Oct 20, no follow-up recorded.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-[#dcdad4] px-2.5 py-1 text-xs font-medium">Create task</span>
        </div>
      </Frame>
    );
  if (id === "deal")
    return (
      <Frame title="Deal intelligence">
        <p className="text-[15px] leading-relaxed">Initech rollout moved from Qualified to Negotiation on Oct 3. Pricing questions on Oct 15 are the last recorded contact.</p>
        <Src n={3} />
        <p className="mb-2 mt-5 text-xs text-[#6a6f78]">Risk assessment, based on the cited records</p>
        <ul className="space-y-2">
          <li className="flex gap-2.5"><Dot c="red" />No activity for 23 days while in Negotiation</li>
          <li className="flex gap-2.5"><Dot c="amber" />No one from Finance is linked, though budget approval is pending</li>
          <li className="flex gap-2.5"><Dot c="amber" />Data-residency requirement raised Oct 15 has no answer</li>
        </ul>
      </Frame>
    );
  if (id === "briefing")
    return (
      <Frame title="Today's priorities">
        <ol className="divide-y divide-[#e3e1dc]">
          {[
            ["Expected close date for Acme renewal has passed", "Close date was Oct 31 and the deal is still open."],
            ["No interaction with Sarah Chen in 18 days", "She asked for a revised proposal on Oct 20."],
            ["Invoice 2026-0142 for Globex is 12 days overdue", "€4,800 outstanding."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#dcdad4] text-xs tabular-nums text-[#6a6f78]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t}</p>
                <p className="text-[#6a6f78]">{d}</p>
              </div>
              <span className="hidden shrink-0 rounded-md border border-[#dcdad4] px-2.5 py-1 text-xs font-medium sm:inline">Create task</span>
            </li>
          ))}
        </ol>
      </Frame>
    );
  return (
    <Frame title="Command Center">
      <div className="flex items-center justify-between rounded-md border border-[#dcdad4] px-3 py-2">
        <span>Create follow-up tasks for opportunities quiet for 14 days</span>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[#1f4e96] text-white"><ArrowUp className="h-3.5 w-3.5" /></span>
      </div>
      <p className="mt-4 leading-relaxed">Three open opportunities have had no activity in 14 days. I&apos;ve prepared a follow-up task for each; review and confirm below.</p>
      <div className="mt-4 rounded-md border border-[#1f4e96]/30 bg-[#1f4e96]/[0.03]">
        <p className="border-b border-[#1f4e96]/20 px-3 py-2 font-medium">Create 3 follow-up tasks</p>
        {["Initech rollout", "Globex expansion", "Umbrella pilot"].map((n) => (
          <div key={n} className="flex items-center gap-2.5 border-b border-[#e3e1dc] px-3 py-2 last:border-0">
            <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#1f4e96] text-white"><Check className="h-3 w-3" /></span>
            <span>Re-engage on {n}</span>
            <span className="ml-auto text-xs text-[#6a6f78]">due tomorrow</span>
          </div>
        ))}
        <div className="flex justify-end gap-2 px-3 py-2">
          <span className="px-2.5 py-1 text-xs">Cancel</span>
          <span className="rounded-md bg-[#1f4e96] px-2.5 py-1 text-xs font-medium text-white">Create 3 tasks</span>
        </div>
      </div>
    </Frame>
  );
}

export function ProductTabs() {
  const [tab, setTab] = useState<TabId>("relationship");
  const base = useId();
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <div role="tablist" aria-orientation="vertical" aria-label="Harbor intelligence" className="flex flex-col">
        {TABS.map((t, i) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              id={`${base}-t-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-p-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const next = TABS[(i + (e.key === "ArrowDown" ? 1 : TABS.length - 1)) % TABS.length];
                setTab(next.id);
                document.getElementById(`${base}-t-${next.id}`)?.focus();
              }}
              className={`${s.focusRing} group border-l-2 py-4 pl-5 text-left transition-colors ${
                on ? "border-[var(--harbor)]" : "border-[var(--rule)] hover:border-[var(--ink-soft)]"
              }`}
            >
              <span className={`${s.heading} block text-[1.35rem] ${on ? "text-[var(--ink)]" : "text-[var(--ink)]/50 group-hover:text-[var(--ink)]/80"}`}>{t.title}</span>
              <span className={`mt-1.5 block max-w-md text-[15px] leading-relaxed text-[var(--ink-soft)] ${on ? "" : "hidden lg:block lg:opacity-60"}`}>{t.body}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-p-${tab}`} aria-labelledby={`${base}-t-${tab}`} className="self-center">
        <Panel id={tab} />
      </div>
    </div>
  );
}
