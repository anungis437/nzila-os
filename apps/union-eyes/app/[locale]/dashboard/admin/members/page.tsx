/**
 * Admin Members Management Page (server component wrapper)
 * Enforces platform RBAC before rendering the client console.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { Metadata } from 'next';
import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';
import MembersConsole from "@/components/admin/members-console";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminMembersPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function AdminMembersPage() {
  await requireUser();

  const isAdmin = await hasMinRole("support_manager");
  if (!isAdmin) redirect("/dashboard");

  return <MembersConsole />;
}
