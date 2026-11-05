"use client";

/**
 * The profile page. Everyone sees the same honest view: their identity as the server states it, read-only (the profile service persists no change, so there is no form to
 * fill in), and, for staff, the one setting that is real and has a page of its own (two-factor authentication). The screens that used to be here (save, photo, password,
 * session, notification, appearance, language and privacy controls) saved nothing: they kept their values in this page's state, said "Settings saved" and lost them on reload.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useUser, useAuthActions } from "@nzila/platform-auth/entra/client";
import { useOrganization } from "@/contexts/organization-context";
import { getDashboardExperience } from "@/lib/dashboard/role-experience";
import { MemberProfile } from "@/components/profile/member-profile";

interface ServerSummary {
  user?: { name?: string; email?: string; phone?: string };
  organization?: { id?: string; name?: string } | null;
  role?: string;
}

const titleCase = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useUser();
  const { signOut } = useAuthActions();
  const { organization, organizationId, userMemberships } = useOrganization();
  const [summaryChecked, setSummaryChecked] = useState(false);
  const [serverSummary, setServerSummary] = useState<ServerSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/users/me/profile", { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as ServerSummary;
        if (!cancelled) setServerSummary(data);
      } catch {
        // The identity the browser holds for the signed-in person is shown when the server's summary cannot be read.
      } finally {
        if (!cancelled) setSummaryChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The role comes from the active organization's membership; the organization id is the fallback because the organization object can be null while the context hydrates.
  const activeOrgId = organization?.id ?? organizationId;
  const currentMembership =
    userMemberships.find((membership) => membership.organizationId === activeOrgId) ?? userMemberships.find((membership) => membership.isPrimary) ?? userMemberships[0];

  const roleKey = serverSummary?.role ?? currentMembership?.role ?? null;
  const roleDisplay = serverSummary?.role ? titleCase(serverSummary.role) : currentMembership?.role ? titleCase(currentMembership.role) : "Member";

  const email = serverSummary?.user?.email || user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  const name =
    serverSummary?.user?.name || user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || (email ? email.split("@")[0] : "");
  const phone = serverSummary?.user?.phone || user?.primaryPhoneNumber?.phoneNumber || "";
  const organizationName = serverSummary?.organization?.name || organization?.name || "";

  // Wait for the role before choosing the view, so a member never sees the staff view flash.
  if (roleKey === null && !summaryChecked) {
    return <div className="p-8" role="status" aria-busy="true" />;
  }

  const isMember = getDashboardExperience(roleKey) === "member";

  return (
    <MemberProfile
      name={name}
      email={email}
      phone={phone}
      organization={organizationName}
      role={roleDisplay}
      onSignOut={() => signOut("/")}
      manage={
        isMember
          ? undefined
          : [{ href: `/${locale}/settings/mfa`, title: t("memberProfile.securityLink"), description: t("memberProfile.securityDescription") }]
      }
    />
  );
}
