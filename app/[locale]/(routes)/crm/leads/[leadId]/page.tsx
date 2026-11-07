import { getLead } from "@/actions/crm/get-lead";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import React from "react";
import { BasicView } from "./components/BasicView";
import { FindSimilarButton } from "@/components/crm/find-similar-button";
import DocumentsView from "../../components/DocumentsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryTab } from "./components/HistoryTab";
import { ActivitiesSection } from "./components/ActivitiesSection";
import Link from "next/link";

interface LeadDetailPageProps {
  params: Promise<{
    leadId: string;
  }>;
}

const LeadDetailPage = async (props: LeadDetailPageProps) => {
  const params = await props.params;
  const { leadId } = params;
  const lead: any = await getLead(leadId);

  if (!lead) {
    return (
      <Container title="Lead not found" description="It may have been deleted, or you don't have access to it.">
        <Link href="/crm/leads" className="text-sm text-primary hover:underline">
          Back to leads
        </Link>
      </Container>
    );
  }

  return (
    <Container
      title={[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
      description={[lead.jobTitle, lead.company].filter(Boolean).join(" · ") || undefined}
      eyebrow={
        <Link href="/crm/leads" className="hover:text-foreground">
          Leads
        </Link>
      }
      actions={<FindSimilarButton entityType="lead" recordId={leadId} />}
    >
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="space-y-8">
            <BasicView data={lead} />
            <ActivitiesSection leadId={lead.id} />
            {/*         <DocumentsView data={lead?.documents} /> */}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab leadId={leadId} />
        </TabsContent>
      </Tabs>
    </Container>
  );
};

export default LeadDetailPage;
