import { redirect } from "next/navigation";
import Container from "../components/ui/Container";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";
import { isAiConfigured } from "@/lib/intelligence/llm";
import { CommandCenter } from "@/components/intelligence/command-center";

export const metadata = { title: "Command Center" };

/** Natural-language access to CRM data. Partners are not given this surface. */
export default async function CommandCenterPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await props.searchParams;
  let user;
  try {
    user = await requireAuthenticated();
  } catch (e) {
    if (e instanceof AuthenticationError) redirect("/");
    throw e;
  }
  const aiConfigured = await isAiConfigured(user.id);
  return (
    <Container title="Command Center" description="Ask questions about your CRM or prepare follow-ups. Answers are built from your records, within your permissions.">
      <CommandCenter aiConfigured={aiConfigured} initialQuery={typeof q === "string" ? q.slice(0, 500) : undefined} />
    </Container>
  );
}
