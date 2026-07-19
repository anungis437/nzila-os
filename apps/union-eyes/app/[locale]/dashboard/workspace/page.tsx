import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@nzila/platform-auth/entra/server";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace | UnionEyes",
  description: "One operating surface for the union.",
};

type WorkspacePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale } = await params;
  const { userId } = await auth();

  if (!userId) {
    logger.error("[workspace] auth() returned null userId — redirecting to /login", {
      stage: "auth",
      locale,
    });
    redirect("/login");
  }

  return <WorkspaceShell />;
}
