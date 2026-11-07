import Link from "next/link";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { FindSimilarButton } from "@/components/crm/find-similar-button";
import { RecordIntelligence } from "@/components/intelligence/record-intelligence";

import { getContact } from "@/actions/crm/get-contact";
import { getOpportunitiesFullByContactId } from "@/actions/crm/get-opportunities-with-includes-by-contactId";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getDocumentsByContactId } from "@/actions/documents/get-documents-by-contactId";
import { getAccountsByContactId } from "@/actions/crm/get-accounts-by-contactId";

import AccountsView from "../../components/AccountsView";
import OpportunitiesView from "../../components/OpportunitiesView";
import DocumentsView from "../../components/DocumentsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryTab } from "./components/HistoryTab";
import { ActivitiesSection } from "./components/ActivitiesSection";
import { ContactProfile } from "./components/ContactProfile";
import { EnrichButton } from "./components/EnrichButton";
import { ContactDetailActions } from "./components/ContactDetailActions";

/**
 * Contact workspace: relationship intelligence and the activity timeline in
 * the main column, the record's properties in a compact sidebar.
 */
const ContactViewPage = async (props: { params: Promise<{ contactId: string }> }) => {
  const { contactId } = await props.params;
  const contact: any = await getContact(contactId);

  if (!contact) {
    return (
      <Container title="Contact not found" description="It may have been deleted, or you don't have access to it.">
        <Link href="/crm/contacts" className="text-sm text-primary hover:underline">
          Back to contacts
        </Link>
      </Container>
    );
  }

  const [opportunities, documents, accounts, crmData] = await Promise.all([
    getOpportunitiesFullByContactId(contactId) as Promise<any>,
    getDocumentsByContactId(contactId),
    getAccountsByContactId(contactId),
    getAllCrmData(),
  ]);

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const subtitle = [contact.position, contact.assigned_accounts?.name].filter(Boolean).join(" · ");

  return (
    <Container
      title={name}
      description={subtitle || undefined}
      eyebrow={
        <Link href="/crm/contacts" className="hover:text-foreground">
          Contacts
        </Link>
      }
      actions={
        <>
          <FindSimilarButton entityType="contact" recordId={contactId} />
          <EnrichButton
            contactId={contact.id}
            contactEmail={contact.email ?? null}
            contactCurrentData={{
              position: contact.position ?? null,
              website: contact.website ?? null,
              social_linkedin: contact.social_linkedin ?? null,
              social_twitter: contact.social_twitter ?? null,
              social_facebook: contact.social_facebook ?? null,
              social_instagram: contact.social_instagram ?? null,
              description: contact.description ?? null,
              office_phone: contact.office_phone ?? null,
              mobile_phone: contact.mobile_phone ?? null,
            }}
          />
          <ContactDetailActions contact={contact} contactTypes={crmData.contactTypes} />
        </>
      }
    >
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="related">Deals & documents</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-8">
              <RecordIntelligence entityType="contact" entityId={contact.id} />
              <ActivitiesSection contactId={contact.id} />
            </div>
            <aside className="order-first xl:order-none xl:border-l xl:border-border xl:pl-8">
              <ContactProfile data={contact} />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="related">
          <div className="space-y-8">
            <OpportunitiesView data={opportunities} crmData={crmData} />
            <AccountsView data={accounts} crmData={crmData} />
            <DocumentsView data={documents} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab contactId={contactId} />
        </TabsContent>
      </Tabs>
    </Container>
  );
};

export default ContactViewPage;
