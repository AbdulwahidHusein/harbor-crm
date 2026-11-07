import Link from "next/link";
import { getTranslations } from "next-intl/server";

import "@/app/[locale]/globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import Footer from "@/app/[locale]/(routes)/components/Footer";
import { HarborWordmark } from "@/components/brand/harbor-mark";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const { locale } = params;

  const t = await getTranslations({ locale, namespace: "RootLayout" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/welcome" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <HarborWordmark markClassName="text-foreground [--harbor-mark-fg:hsl(var(--background))]" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex grow items-center justify-center px-5 py-10">{children}</main>
      <Footer />
    </div>
  );
};

export default AuthLayout;
