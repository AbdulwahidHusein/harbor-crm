import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Archivo } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { HarborMark } from "@/components/brand/harbor-mark";
import { HeroChart } from "./_components/hero-chart";
import { SourcesDemo } from "./_components/sources-demo";
import { ProductTabs } from "./_components/product-tabs";
import { contours } from "./_components/chart-geometry";
import s from "./welcome.module.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: `${BRAND.name}: know where every relationship stands`,
  description: BRAND.description,
};

const MODULES: [string, string][] = [
  ["Contacts and companies", "Profiles, ownership, tags, enrichment from the web"],
  ["Pipeline", "Opportunities, stages, line items, approvals"],
  ["Leads and targets", "Capture, qualify, convert; target lists for outreach"],
  ["Campaigns", "Email sequences with templates and tracking"],
  ["Invoicing", "Series, tax rates, payments, PDF and email delivery"],
  ["Contracts and products", "Catalog, price lists, orders, renewals"],
  ["Projects", "Boards, tasks, comments and watchers"],
  ["Documents", "Upload, preview and search by content"],
  ["Email and calendar", "Mailbox sync and meetings linked to records"],
  ["Open by design", "MCP server, API tokens, plugins, four languages"],
];

function Cta({ href, children, tone = "solid" }: { href: string; children: React.ReactNode; tone?: "solid" | "line" | "light" }) {
  const cls =
    tone === "solid"
      ? "bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--harbor)]"
      : tone === "light"
        ? "bg-[var(--paper)] text-[var(--ink)] hover:bg-white"
        : "border border-current text-current hover:bg-[var(--ink)]/[0.05]";
  return (
    <Link
      href={href}
      className={`${s.focusRing} inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-medium transition-colors duration-200 ${cls}`}
    >
      {children}
    </Link>
  );
}

export default async function WelcomePage() {
  const signedIn = Boolean((await cookies()).getAll().some((c) => c.name.endsWith("better-auth.session_token")));
  const primary = signedIn ? { href: "/", label: "Open Harbor" } : { href: "/sign-in", label: "Get started" };

  return (
    <div className={`${s.page} ${archivo.variable} min-h-screen antialiased`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Header */}
      <header className="relative z-20 mx-auto flex max-w-[1360px] items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/welcome" className={`${s.focusRing} inline-flex items-center gap-2.5 rounded-md`}>
          <HarborMark className="h-8 w-8 text-[var(--ink)]" />
          <span className={`${s.heading} text-lg`}>{BRAND.name}</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 text-[15px] text-[var(--ink-soft)] md:flex">
          <a href="#sources" className={`${s.focusRing} rounded hover:text-[var(--ink)]`}>How it works</a>
          <a href="#product" className={`${s.focusRing} rounded hover:text-[var(--ink)]`}>Product</a>
          <a href="#self-host" className={`${s.focusRing} rounded hover:text-[var(--ink)]`}>Self-host</a>
        </nav>
        <div className="flex items-center gap-5">
          {!signedIn ? (
            <Link href="/sign-in" className={`${s.focusRing} hidden rounded text-[15px] font-medium sm:inline`}>
              Sign in
            </Link>
          ) : null}
          <Link
            href={primary.href}
            className={`${s.focusRing} inline-flex h-10 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--paper)] transition-colors hover:bg-[var(--harbor)]`}
          >
            {primary.label}
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none relative mx-auto max-w-[1360px] lg:absolute lg:inset-x-0 lg:top-0 lg:h-full">
            <div className="relative ml-auto w-full max-w-[880px] px-2 sm:px-6 lg:absolute lg:-right-10 lg:-top-24 lg:w-[64%] lg:max-w-none lg:px-0">
              <div className="aspect-[900/720] w-full">
                <HeroChart />
              </div>
            </div>
          </div>
          <div className="relative mx-auto max-w-[1360px] px-6 pb-20 pt-4 sm:px-10 lg:min-h-[720px] lg:pb-16 lg:pt-20">
            <div className="relative z-10 max-w-[620px]">
              <h1 className={`${s.display} ${s.hero} text-[clamp(3.1rem,6.6vw,6.4rem)]`}>
                Chart every relationship.
              </h1>
              <p className="mt-8 max-w-[34ch] text-[clamp(1.1rem,1.6vw,1.3rem)] leading-[1.55] text-[var(--ink-soft)]">
                Harbor reads your calls, emails and deals, tells you who needs you today, and shows the record behind every
                word it says.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Cta href={primary.href}>{primary.label}</Cta>
                <Cta href="#sources" tone="line">
                  See how it works
                </Cta>
              </div>
              <p className="mt-8 text-sm text-[var(--ink-soft)]">Self-host on your own server. Bring your own OpenAI key, or run without one.</p>
            </div>

            {/* Today's course: the same briefing the product shows on its dashboard */}
            <aside
              aria-label="Example daily briefing"
              className={`${s.card} relative z-10 mt-12 w-full max-w-[380px] rounded-lg border border-[var(--rule)] bg-white p-5 shadow-[0_24px_50px_-28px_rgba(15,36,54,0.45)] lg:absolute lg:bottom-8 lg:right-10 lg:mt-0`}
            >
              <div className="flex items-baseline justify-between">
                <p className={`${s.heading} text-[1.05rem]`}>Today&apos;s course</p>
                <p className="text-xs text-[var(--ink-soft)]">3 of 41 accounts</p>
              </div>
              <ol className="mt-3 space-y-3">
                {[
                  ["Acme Corp", "Sarah asked for a revised proposal 18 days ago. No follow-up recorded."],
                  ["Globex", "Invoice 2026-0142 is 12 days overdue, €4,800 outstanding."],
                  ["Initech", "No activity in 23 days while in Negotiation."],
                ].map(([who, what], i) => (
                  <li key={who} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--port)] text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">{who}.</span> <span className="text-[var(--ink-soft)]">{what}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>

        {/* Sources */}
        <section id="sources" className="scroll-mt-8 border-t border-[var(--rule)]">
          <div className="mx-auto max-w-[1360px] px-6 py-24 sm:px-10 lg:py-32">
            <div className="mb-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
              <h2 className={`${s.heading} text-[clamp(2.4rem,5vw,4.2rem)]`}>AI that shows its work.</h2>
              <p className="max-w-[46ch] self-end text-lg leading-relaxed text-[var(--ink-soft)]">
                Every sentence Harbor writes cites the calls, emails and tasks it came from. If a claim has no source, Harbor drops
                it before you ever see it. Point at a sentence below.
              </p>
            </div>
            <SourcesDemo />
          </div>
        </section>

        {/* Product */}
        <section id="product" className="scroll-mt-8 bg-[var(--depth)]/60">
          <div className="mx-auto max-w-[1360px] px-6 py-24 sm:px-10 lg:py-32">
            <h2 className={`${s.heading} mb-16 max-w-[18ch] text-[clamp(2.4rem,5vw,4.2rem)]`}>Intelligence where you already work.</h2>
            <ProductTabs />
          </div>
        </section>

        {/* Trust */}
        <section className="border-b border-[var(--rule)]">
          <div className="mx-auto max-w-[1360px] px-6 py-24 sm:px-10 lg:py-28">
            <h2 className={`${s.heading} mb-14 max-w-[22ch] text-[clamp(2rem,3.6vw,3rem)]`}>Built to be trusted with your book of business.</h2>
            <div className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[var(--rule)]">
              {[
                ["Your permissions, everywhere", "The assistant sees exactly what you can see. Private mailboxes stay private, and summaries are kept per person."],
                ["Nothing changes without you", "Harbor suggests tasks and follow-ups. It creates them only after you confirm, record by record."],
                ["Useful with AI switched off", "Briefings, risk signals and reports are computed from your records. AI adds summaries on top."],
              ].map(([t, b]) => (
                <div key={t} className="md:px-10 md:first:pl-0 md:last:pr-0">
                  <h3 className={`${s.heading} text-[1.4rem]`}>{t}</h3>
                  <p className="mt-3 max-w-[38ch] leading-relaxed text-[var(--ink-soft)]">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modules */}
        <section>
          <div className="mx-auto grid max-w-[1360px] gap-12 px-6 py-24 sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-28">
            <div>
              <h2 className={`${s.heading} text-[clamp(2rem,3.6vw,3rem)]`}>The rest of the CRM comes with it.</h2>
              <p className="mt-5 max-w-[40ch] leading-relaxed text-[var(--ink-soft)]">
                Harbor is a complete CRM, not an AI layer on someone else&apos;s. Every module feeds the same intelligence.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {MODULES.map(([t, d]) => (
                <div key={t} className="border-t border-[var(--rule)] py-4">
                  <dt className="font-medium">{t}</dt>
                  <dd className="mt-1 text-[15px] text-[var(--ink-soft)]">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Self-host */}
        <section id="self-host" className="scroll-mt-8 border-t border-[var(--rule)]">
          <div className="mx-auto grid max-w-[1360px] gap-12 px-6 py-24 sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-28">
            <div>
              <h2 className={`${s.heading} text-[clamp(2rem,3.6vw,3rem)]`}>Run it on your own server.</h2>
              <p className="mt-5 max-w-[40ch] leading-relaxed text-[var(--ink-soft)]">
                One Docker Compose file brings up Harbor, Postgres, file storage and background jobs. Migrations run on start.
                Add an OpenAI key in Administration to switch on Intelligence.
              </p>
            </div>
            <figure className="min-w-0">
              <pre className="overflow-x-auto rounded-lg bg-[var(--ink)] p-6 text-[15px] leading-[1.9] text-[#d9e3e8]">
                <code>
                  <span className="text-[#7f97aa]">$ </span>git clone &lt;your-harbor-repo&gt; harbor{"\n"}
                  <span className="text-[#7f97aa]">$ </span>cd harbor &amp;&amp; cp .env.docker .env{"\n"}
                  <span className="text-[#7f97aa]">$ </span>docker compose up -d
                </code>
              </pre>
              <figcaption className="mt-3 text-sm text-[var(--ink-soft)]">Then open port 3000 and sign in.</figcaption>
            </figure>
          </div>
        </section>

        {/* Closing */}
        <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--paper)]">
          <svg aria-hidden viewBox="0 0 900 720" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-[0.22]">
            <g fill="none" stroke="#8fb0c4" strokeWidth="1">
              {contours.map((d, i) => (
                <path key={i} d={d} transform="translate(-220 300) scale(1.25)" />
              ))}
            </g>
          </svg>
          <div className="relative mx-auto max-w-[1360px] px-6 py-28 sm:px-10 lg:py-40">
            <h2 className={`${s.display} max-w-[14ch] text-[clamp(2.8rem,7vw,6rem)]`}>Bring every relationship into harbor.</h2>
            <div className="mt-12 flex flex-wrap gap-3">
              <Cta href={primary.href} tone="light">
                {primary.label}
              </Cta>
              <Cta href="#self-host" tone="line">
                Self-host with Docker
              </Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--ink-soft)] sm:px-10">
        <span className="inline-flex items-center gap-2">
          <HarborMark className="h-5 w-5 text-[var(--ink)]" />
          {BRAND.name}
        </span>
        <span className="flex gap-6">
          <Link href="/sign-in" className={`${s.focusRing} rounded hover:text-[var(--ink)]`}>Sign in</Link>
          <a href="#self-host" className={`${s.focusRing} rounded hover:text-[var(--ink)]`}>Self-host</a>
        </span>
      </footer>
    </div>
  );
}
