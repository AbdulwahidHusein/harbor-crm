"use client";

import { useState } from "react";
import { CalendarCheck, CheckSquare, Mail, User } from "lucide-react";
import s from "../welcome.module.css";

type Rec = { id: string; kind: "meeting" | "email" | "task" | "contact"; title: string; date: string; excerpt: string };

const RECORDS: Rec[] = [
  { id: "m1", kind: "meeting", title: "Kickoff with procurement", date: "Aug 14", excerpt: "Sarah Chen joins as renewal owner. Budget review in Q4." },
  { id: "c1", kind: "contact", title: "Sarah Chen", date: "Head of Procurement", excerpt: "Acme Corp. Owner: you." },
  { id: "e1", kind: "email", title: "Re: renewal terms", date: "Oct 18", excerpt: "“…and is SSO included in the enterprise tier? That decides it for IT.”" },
  { id: "m2", kind: "meeting", title: "Proposal walkthrough", date: "Oct 20", excerpt: "Outcome: asked for a revised proposal with three-year pricing." },
  { id: "t1", kind: "task", title: "Send revised proposal", date: "Due Oct 24", excerpt: "Open. Assigned to you." },
];

const SENTENCES: { text: string; sources: string[] }[] = [
  { text: "Sarah has led procurement for the Acme renewal since August.", sources: ["m1", "c1"] },
  { text: "On October 20 she asked for a revised proposal with three-year pricing.", sources: ["m2"] },
  { text: "She also asked whether SSO is part of the enterprise tier, and nobody has answered.", sources: ["e1"] },
  { text: "The follow-up task is two weeks overdue.", sources: ["t1"] },
];

const ICON = { meeting: CalendarCheck, email: Mail, task: CheckSquare, contact: User };

/** Point at (or tab to) a sentence to light up the records it was written from. */
export function SourcesDemo() {
  const [active, setActive] = useState(1);
  const lit = new Set(SENTENCES[active].sources);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <p className="mb-4 text-sm text-[var(--ink-soft)]">Relationship summary for Sarah Chen, Acme Corp</p>
        <p className="text-[clamp(1.35rem,2.4vw,1.85rem)] leading-[1.45] tracking-[-0.01em]">
          {SENTENCES.map((sent, i) => (
            <span key={i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                className={`${s.focusRing} inline rounded-[3px] text-left [-webkit-box-decoration-break:clone] [box-decoration-break:clone] transition-colors duration-200 ${
                  active === i
                    ? "bg-[var(--depth)] text-[var(--ink)] [box-shadow:0_2px_0_var(--harbor)]"
                    : "text-[var(--ink)]/55 hover:text-[var(--ink)]"
                }`}
              >
                {sent.text}
              </button>{" "}
            </span>
          ))}
        </p>
        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          {SENTENCES[active].sources.length === 1 ? "1 source" : `${SENTENCES[active].sources.length} sources`} for this sentence
        </p>
      </div>

      <ul className="relative space-y-2" aria-label="Records behind the summary">
        {RECORDS.map((r) => {
          const Icon = ICON[r.kind];
          const on = lit.has(r.id);
          return (
            <li
              key={r.id}
              className={`flex gap-3 rounded-md border px-4 py-3 transition-all duration-300 ${
                on
                  ? "translate-x-0 border-[var(--harbor)] bg-white"
                  : "border-[var(--rule)] bg-transparent opacity-45 lg:translate-x-2"
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-[var(--harbor)]" : "text-[var(--ink-soft)]"}`} aria-hidden />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-[var(--ink-soft)]">{r.date}</span>
                </p>
                <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{r.excerpt}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
