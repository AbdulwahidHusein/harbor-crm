import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";
import { ac, admin, manager, user } from "@/lib/auth-permissions";

export const authClient = createAuthClient({
  // Relative /api/auth on the current host. NEXT_PUBLIC_APP_URL is fixed at
  // build time and was sending the browser to a placeholder domain.
  plugins: [
    emailOTPClient(),
    adminClient({
      ac,
      roles: { admin, manager, user },
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
