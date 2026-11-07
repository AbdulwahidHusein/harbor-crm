/**
 * Product brand. The display name can still be overridden per deployment
 * with NEXT_PUBLIC_APP_NAME; internal identifiers (package names, NEXTCRM_*
 * env vars, plugin SDK) are intentionally unchanged.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Harbor CRM",
  shortName: "Harbor",
  tagline: "The CRM that knows where every relationship stands.",
  description:
    "Harbor CRM reads your calls, emails and deals, tells you who needs you today, and shows the record behind every insight.",
} as const;
