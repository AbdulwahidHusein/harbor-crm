import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Property, PropertyList, PropertySection } from "@/components/crm/detail/property-list";

const SOCIALS: { key: string; label: string }[] = [
  { key: "social_linkedin", label: "LinkedIn" },
  { key: "social_twitter", label: "X / Twitter" },
  { key: "social_facebook", label: "Facebook" },
  { key: "social_instagram", label: "Instagram" },
  { key: "social_youtube", label: "YouTube" },
  { key: "social_tiktok", label: "TikTok" },
  { key: "social_skype", label: "Skype" },
];

const asUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const fmt = (d?: string | Date | null) => (d ? format(new Date(d), "MMM d, yyyy") : null);

/** Right-hand record sidebar on the contact workspace. Read-only; editing stays in ContactDetailActions. */
export function ContactProfile({ data }: { data: any }) {
  const socials = SOCIALS.filter((s) => data[s.key]);
  return (
    <div className="divide-y divide-border">
      <PropertySection title="Contact">
        <PropertyList>
          <Property label="Email">
            {data.email ? (
              <a href={`mailto:${data.email}`} className="text-primary hover:underline">
                {data.email}
              </a>
            ) : null}
          </Property>
          {data.personal_email ? (
            <Property label="Personal email">
              <a href={`mailto:${data.personal_email}`} className="text-primary hover:underline">
                {data.personal_email}
              </a>
            </Property>
          ) : null}
          <Property label="Office phone">{data.office_phone ? <a href={`tel:${data.office_phone}`}>{data.office_phone}</a> : null}</Property>
          <Property label="Mobile">{data.mobile_phone ? <a href={`tel:${data.mobile_phone}`}>{data.mobile_phone}</a> : null}</Property>
          <Property label="Website">
            {data.website ? (
              <a href={asUrl(data.website)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {data.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </Property>
        </PropertyList>
      </PropertySection>

      <PropertySection title="Details">
        <PropertyList>
          <Property label="Company">
            {data.assigned_accounts ? (
              <Link href={`/crm/accounts/${data.assigned_accounts.id}`} className="text-primary hover:underline">
                {data.assigned_accounts.name}
              </Link>
            ) : null}
          </Property>
          <Property label="Position">{data.position}</Property>
          <Property label="Type">{data.contact_type?.name}</Property>
          <Property label="Owner">{data.assigned_to_user?.name}</Property>
          <Property label="Status">
            <Badge variant={data.status ? "success" : "muted"}>{data.status ? "Active" : "Inactive"}</Badge>
          </Property>
          <Property label="Birthday">{fmt(data.birthday)}</Property>
          <Property label="Created">
            {fmt(data.created_on)}
            {data.crate_by_user?.name ? <span className="text-muted-foreground"> by {data.crate_by_user.name}</span> : null}
          </Property>
          <Property label="Updated">{fmt(data.updatedAt)}</Property>
        </PropertyList>
      </PropertySection>

      {data.tags?.length ? (
        <PropertySection title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag: string) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </PropertySection>
      ) : null}

      {data.description ? (
        <PropertySection title="About">
          <p className="whitespace-pre-line text-sm text-foreground/90">{data.description}</p>
        </PropertySection>
      ) : null}

      {socials.length ? (
        <PropertySection title="Profiles">
          <PropertyList>
            {socials.map((s) => (
              <Property key={s.key} label={s.label}>
                <a href={asUrl(data[s.key])} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {String(data[s.key]).replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </Property>
            ))}
          </PropertyList>
        </PropertySection>
      ) : null}
    </div>
  );
}
