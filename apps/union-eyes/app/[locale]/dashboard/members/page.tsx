export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import MembersConsole from '@/components/members/members-console';
import { Cupe4373MembersConsole, type MemberRow } from '@/components/demo/cupe4373-members-console';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, isNull, and, asc } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core/telemetry';

const log = createLogger('members-page');
const CUPE4373_ORG_ID = '11111111-1111-4111-8111-111111111111';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "membersPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function MembersPage({ params }: PageProps) {
  const { locale } = await params;
  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  // In demo mode all authenticated users have access to the members directory
  if (!isCupe4373DemoRuntime()) {
    const hasAccess = await hasMinRole("steward");
    if (!hasAccess) {
      redirect(`/${locale}/dashboard`);
    }
  }

  if (isCupe4373DemoRuntime()) {
    let members: MemberRow[] = [];
    try {
      const rows = await db
        .select({
          id:                     organizationMembers.id,
          name:                   organizationMembers.name,
          email:                  organizationMembers.email,
          phone:                  organizationMembers.phone,
          role:                   organizationMembers.role,
          status:                 organizationMembers.status,
          department:             organizationMembers.department,
          position:               organizationMembers.position,
          location:               organizationMembers.location,
          seniority:              organizationMembers.seniority,
          membershipNumber:       organizationMembers.membershipNumber,
          hireDate:               organizationMembers.hireDate,
          unionJoinDate:          organizationMembers.unionJoinDate,
          preferredContactMethod: organizationMembers.preferredContactMethod,
          memberCategory:         organizationMembers.memberCategory,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, CUPE4373_ORG_ID),
            isNull(organizationMembers.deletedAt),
          ),
        )
        .orderBy(asc(organizationMembers.name));

      // Serialize Date objects to ISO strings (RSC → Client Component boundary)
      members = rows.map((r) => ({
        ...r,
        phone:                  r.phone ?? null,
        department:             r.department ?? null,
        position:               r.position ?? null,
        location:               r.location ?? null,
        seniority:              r.seniority ?? null,
        membershipNumber:       r.membershipNumber ?? null,
        hireDate:               r.hireDate instanceof Date ? r.hireDate.toISOString() : (r.hireDate ?? null),
        unionJoinDate:          r.unionJoinDate instanceof Date ? r.unionJoinDate.toISOString() : (r.unionJoinDate ?? null),
        preferredContactMethod: r.preferredContactMethod ?? null,
        memberCategory:         r.memberCategory ?? null,
      }));
    } catch (err) {
      log.error('DB query failed', { error: err });
    }
    return <Cupe4373MembersConsole members={members} locale={locale} />;
  }

  return <MembersConsole />;
}
