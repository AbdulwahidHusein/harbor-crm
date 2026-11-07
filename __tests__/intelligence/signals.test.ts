import {
  DAY_MS,
  dealSignals,
  invoiceSignals,
  lastInteraction,
  leadSignals,
  rankSignals,
  relationshipSignals,
  type ActivityLite,
  type OpportunityLite,
} from "@/lib/intelligence/signals";
import type { Signal, SubjectRef } from "@/lib/intelligence/types";

const NOW = new Date("2026-11-07T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const subject: SubjectRef = { type: "contact", id: uuid(1), label: "Sarah Chen", href: "/crm/contacts/x" };

const act = (id: number, days: number, status: ActivityLite["status"] = "completed", type = "call"): ActivityLite => ({
  id: uuid(id),
  type,
  title: `Activity ${id}`,
  date: daysAgo(days),
  status,
});

const deal = (over: Partial<OpportunityLite> = {}): OpportunityLite => ({
  id: uuid(50),
  name: "Acme renewal",
  status: "ACTIVE",
  value: 12000,
  currency: "EUR",
  closeDate: null,
  stageName: "Proposal",
  stageEnteredAt: daysAgo(5),
  nextStep: "Send revised proposal",
  contactCount: 2,
  createdAt: daysAgo(40),
  ...over,
});

describe("lastInteraction", () => {
  it("ignores cancelled, scheduled and future items", () => {
    const acts = [act(1, 30), act(2, 3, "cancelled"), act(3, 2, "scheduled"), { ...act(4, -2), status: "completed" as const }];
    expect(lastInteraction(acts, NOW)?.id).toBe(uuid(1));
  });
});

describe("relationshipSignals", () => {
  it("flags a quiet relationship with open deals as high severity, citing the last interaction", () => {
    const s = relationshipSignals({ subject, activities: [act(1, 50), act(2, 80)], tasks: [], hasOpenDeals: true, now: NOW });
    const quiet = s.find((x) => x.kind === "no_recent_interaction")!;
    expect(quiet.severity).toBe("high");
    expect(quiet.title).toContain("50 days");
    expect(quiet.evidence.map((e) => e.id)).toEqual([uuid(1)]);
  });

  it("does not flag a relationship with a recent interaction", () => {
    const s = relationshipSignals({ subject, activities: [act(1, 4)], tasks: [], hasOpenDeals: true, now: NOW });
    expect(s.find((x) => x.kind === "no_recent_interaction")).toBeUndefined();
  });

  it("reports scheduled activities that never got an outcome", () => {
    const s = relationshipSignals({ subject, activities: [act(1, 3, "scheduled", "meeting")], tasks: [], hasOpenDeals: false, now: NOW });
    expect(s.map((x) => x.kind)).toContain("missed_scheduled_activity");
  });

  it("reports overdue open tasks but not completed ones", () => {
    const s = relationshipSignals({
      subject,
      activities: [],
      tasks: [
        { id: uuid(9), title: "Send proposal", dueDateAt: daysAgo(10), taskStatus: "ACTIVE" },
        { id: uuid(10), title: "Done", dueDateAt: daysAgo(10), taskStatus: "COMPLETE" },
      ],
      hasOpenDeals: false,
      now: NOW,
    });
    const overdue = s.filter((x) => x.kind === "overdue_task");
    expect(overdue).toHaveLength(1);
    expect(overdue[0].severity).toBe("high");
  });

  it("detects an engagement drop against the prior 60 days", () => {
    const prior = [35, 40, 45, 50, 60, 70].map((d, i) => act(20 + i, d));
    const s = relationshipSignals({ subject, activities: prior, tasks: [], hasOpenDeals: false, now: NOW });
    expect(s.map((x) => x.kind)).toContain("engagement_drop");
  });
});

describe("dealSignals", () => {
  it("returns nothing for closed deals", () => {
    expect(dealSignals({ opportunity: deal({ status: "CLOSED" }), activities: [], tasks: [], now: NOW })).toEqual([]);
  });

  it("flags inactivity, stalled stage, passed close date and missing contacts", () => {
    const s = dealSignals({
      opportunity: deal({ stageEnteredAt: daysAgo(70), closeDate: daysAgo(3), contactCount: 0 }),
      activities: [act(1, 35)],
      tasks: [],
      now: NOW,
    });
    const kinds = s.map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["deal_no_activity", "deal_stage_stalled", "deal_close_date_passed", "deal_no_contacts"]));
    expect(s.every((x) => x.value === 12000)).toBe(true);
  });

  it("does not report a missing next step when one is recorded", () => {
    const s = dealSignals({ opportunity: deal(), activities: [act(1, 2)], tasks: [], now: NOW });
    expect(s.map((x) => x.kind)).not.toContain("deal_no_next_step");
  });
});

describe("invoiceSignals", () => {
  it("only reports unpaid invoices past due with a balance", () => {
    const base = { currency: "EUR", accountId: uuid(70), accountName: "Acme" };
    const s = invoiceSignals(
      [
        { ...base, id: uuid(71), number: "2026-001", dueDate: daysAgo(40), balanceDue: 500, status: "SENT" },
        { ...base, id: uuid(72), number: "2026-002", dueDate: daysAgo(40), balanceDue: 0, status: "PAID" },
        { ...base, id: uuid(73), number: "2026-003", dueDate: daysAgo(-5), balanceDue: 900, status: "SENT" },
      ],
      NOW,
    );
    expect(s).toHaveLength(1);
    expect(s[0].severity).toBe("high");
    expect(s[0].evidence[0].href).toBe(`/invoices/${uuid(71)}`);
  });
});

describe("leadSignals", () => {
  it("flags uncontacted leads and skips converted ones", () => {
    const lead = { id: uuid(80), name: "Jo Park", company: "Globex", createdAt: daysAgo(20), statusName: "New" };
    expect(leadSignals(lead, [], NOW)[0].severity).toBe("high");
    expect(leadSignals({ ...lead, statusName: "Converted" }, [], NOW)).toEqual([]);
    expect(leadSignals(lead, [act(1, 2)], NOW)).toEqual([]);
  });
});

describe("rankSignals", () => {
  it("orders by severity then value", () => {
    const mk = (key: string, severity: "high" | "medium" | "low", value: number): Signal => ({
      key,
      kind: "deal_no_activity",
      severity,
      title: key,
      detail: "",
      subject,
      evidence: [],
      value,
    });
    const ranked = rankSignals([mk("a", "medium", 100), mk("b", "high", 1), mk("c", "medium", 900)]);
    expect(ranked.map((s) => s.key)).toEqual(["b", "c", "a"]);
  });
});
