import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@nzila/platform-auth/entra/server";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { selectWorkspaceRoleInput } from "@/components/workspace/workspace-persona-availability";
import { getUserRole } from "@/lib/auth/rbac-server";
import { logger } from "@/lib/logger";
import { getOrganizationIdForUser } from "@/lib/organization-utils";

export const dynamic = "force-dynamic";

type WorkspacePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: WorkspacePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "workspaceNav" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale } = await params;
  const session = await auth();
  const { userId } = session;

  if (!userId) {
    logger.error("[workspace] auth() returned null userId — redirecting to /login", {
      stage: "auth",
      locale,
    });
    redirect("/login");
  }

  // Labeling input only. Does not grant routes. Unknown / failed resolution
  // is null so the shell fail-closes to stub (never all-available).
  let resolvedRole: string | null = null;
  if (!session.orgRole?.trim()) {
    try {
      const organizationId = session.orgId ?? (await getOrganizationIdForUser(userId));
      resolvedRole = await getUserRole(userId, organizationId);
    } catch (error) {
      logger.warn("[workspace] role resolution failed — labeling as unknown", {
        stage: "role",
        locale,
        detail: error instanceof Error ? error.message : "unknown",
      });
      resolvedRole = null;
    }
  }

  const role = selectWorkspaceRoleInput({
    orgRole: session.orgRole,
    resolvedRole,
  });

  return <WorkspaceShell role={role} />;
}
