import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import { requireAuthenticated } from "@/lib/authz";
import { Decimal } from "@prisma/client/runtime/client";

import Container from "./components/ui/Container";
import { SignalList } from "@/components/intelligence/signal-list";
import { TodayPriorities } from "@/components/intelligence/today-priorities";
import { formatDate } from "@/lib/intelligence/format";
import { buildBriefing, type Briefing } from "@/lib/intelligence/briefing";
import { isAiConfigured } from "@/lib/intelligence/llm";
import { logAiError } from "@/lib/intelligence/log";

import { getTasksCount, getUsersTasksCount } from "@/actions/dashboard/get-tasks-count";
import { getInvoicesCount } from "@/actions/dashboard/get-invoices-count";
import { getLeadsCount } from "@/actions/dashboard/get-leads-count";
import { getBoardsCount } from "@/actions/dashboard/get-boards-count";
import { getStorageSize } from "@/actions/documents/get-storage-size";
import { getContactCount } from "@/actions/dashboard/get-contacts-count";
import { getAccountsCount } from "@/actions/dashboard/get-accounts-count";
import { getContractsCount } from "@/actions/dashboard/get-contracts-count";
import { getDocumentsCount } from "@/actions/dashboard/get-documents-count";
import { getOpportunitiesCount } from "@/actions/dashboard/get-opportunities-count";
import { getCampaignsCount } from "@/actions/dashboard/get-campaigns-count";
import { getExpectedRevenue } from "@/actions/crm/opportunity/get-expected-revenue";
import { getDefaultCurrency, formatCurrency } from "@/lib/currency";

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function BriefingSection({ title, description, signals, empty }: { title: string; description: string; signals: Briefing["top"]; empty: string }) {
  return (
    <section aria-label={title}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {title}
          {signals.length ? <span className="ml-2 font-normal tabular-nums text-muted-foreground">{signals.length}</span> : null}
        </h2>
      </div>
      <p className="mb-1 text-xs text-muted-foreground">{description}</p>
      <SignalList signals={signals} showSubject dismissible limit={4} empty={<p className="py-3 text-sm text-muted-foreground/80">{empty}</p>} />
    </section>
  );
}

function Metric({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center justify-between px-2 py-1.5">{inner}</div>
  );
}

const DashboardPage = async () => {
  const session = await getSession({ partner: true });
  if (!session) return null;

  const userId = session.user.id;
  const isPartner = (session.user as { role?: string }).role === "partner";
  const dict = await getTranslations("DashboardPage");
  const cookieStore = await cookies();
  const defaultCurrency = await getDefaultCurrency();
  const displayCurrency = cookieStore.get("display_currency")?.value || defaultCurrency;

  // Briefing is rule-based; if it fails the rest of the dashboard still renders.
  let briefing: Briefing | null = null;
  let aiConfigured = false;
  if (!isPartner) {
    try {
      const user = await requireAuthenticated();
      [briefing, aiConfigured] = await Promise.all([buildBriefing(user), isAiConfigured(user.id)]);
    } catch (e) {
      logAiError("dashboard.briefing", e);
    }
  }

  const [revenue, opportunities, accounts, contacts, leads, contracts, invoices, campaigns, projects, tasks, myTasks, documents, storage] =
    await Promise.all([
      getExpectedRevenue(displayCurrency),
      getOpportunitiesCount(),
      getAccountsCount(),
      getContactCount(),
      getLeadsCount(),
      getContractsCount(),
      getInvoicesCount(),
      getCampaignsCount(),
      getBoardsCount(),
      getTasksCount(),
      getUsersTasksCount(userId),
      getDocumentsCount(),
      getStorageSize(),
    ]);

  const now = new Date();
  const firstName = session.user.name?.split(" ")[0];
  const candidates = briefing ? [...briefing.top, ...Object.values(briefing.sections).flat()] : [];

  return (
    <Container
      title={`${greeting(now)}${firstName ? `, ${firstName}` : ""}`}
      description={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          {briefing ? (
            <>
              <TodayPriorities top={briefing.top} candidates={candidates} aiConfigured={aiConfigured} />
              <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
                <BriefingSection
                  title="Customers needing attention"
                  description="Contacts with open deals and no recent interaction."
                  signals={briefing.sections.attention}
                  empty="Every active relationship has a recent touchpoint."
                />
                <BriefingSection
                  title="Overdue commitments"
                  description="Tasks past due, meetings without an outcome, unpaid invoices."
                  signals={briefing.sections.commitments}
                  empty="No overdue commitments."
                />
                <BriefingSection
                  title="Stalled opportunities"
                  description="Your open deals without activity or movement."
                  signals={briefing.sections.deals}
                  empty="All your open deals are moving."
                />
                <BriefingSection
                  title="Pending follow-ups"
                  description="Recent leads assigned to you that haven't been contacted."
                  signals={briefing.sections.followUps}
                  empty="No leads waiting for follow-up."
                />
              </div>
              {briefing.dismissedCount ? (
                <p className="text-xs text-muted-foreground">
                  {briefing.dismissedCount} dismissed {briefing.dismissedCount === 1 ? "item is" : "items are"} hidden and will return if still relevant.
                </p>
              ) : null}
            </>
          ) : !isPartner ? (
            <p className="rounded-lg border border-border px-5 py-6 text-sm text-muted-foreground">
              Your briefing couldn&apos;t be prepared right now. Your records are unaffected — try reloading in a moment.
            </p>
          ) : null}
        </div>

        <aside className="space-y-8 xl:border-l xl:border-border xl:pl-8">
          {briefing?.upcoming.length ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Coming up</h2>
              <ul className="space-y-2">
                {briefing.upcoming.map((s) => (
                  <li key={s.key} className="text-sm">
                    <Link href={s.subject.href} className="font-medium hover:underline">
                      {s.title.replace(/^Upcoming /, "")}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.evidence[0]?.date)} · {s.subject.label}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-1 text-sm font-semibold">At a glance</h2>
            <dl className="-mx-2">
              <Metric label={dict("expectedRevenue")} value={formatCurrency(new Decimal(revenue), displayCurrency)} href="/crm/opportunities" />
              <Metric label={dict("opportunities")} value={opportunities} href="/crm/opportunities" />
              <Metric label={dict("accounts")} value={accounts} href="/crm/accounts" />
              <Metric label={dict("contacts")} value={contacts} href="/crm/contacts" />
              <Metric label={dict("leads")} value={leads} href="/crm/leads" />
              <Metric label={dict("contracts")} value={contracts} href="/crm/contracts" />
              <Metric label={dict("invoices")} value={invoices} href="/invoices" />
              <Metric label={dict("campaigns")} value={campaigns} href="/campaigns" />
            </dl>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold">Work</h2>
            <dl className="-mx-2">
              <Metric label={dict("myTasks")} value={myTasks} href={`/projects/tasks/${userId}`} />
              <Metric label={dict("tasks")} value={tasks} href="/projects/tasks" />
              <Metric label={dict("projects")} value={projects} href="/projects" />
              <Metric label={dict("documents")} value={documents} href="/documents" />
              <Metric label={dict("storage")} value={`${storage} MB`} href="/documents" />
            </dl>
          </section>
        </aside>
      </div>
    </Container>
  );
};

export default DashboardPage;
