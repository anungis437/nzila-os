/**
 * Create New Member Page
 *
 * Direct member creation is not available. POST /api/organization/members is read-only, and POST /api/organizations/{id}/members
 * needs the identity-provider user id of someone who already has an account and only records a pending membership, so neither
 * can take this page's form. A person joins an organization by invitation (Member Management > Invite User).
 */
"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { User, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapabilityUnavailable } from "@/components/system/capability-unavailable";

export const dynamic = 'force-dynamic';

const COPY = {
  en: {
    summary: "Members cannot be created directly in this release. A person joins the organization by invitation.",
    how: "An administrator can send an invitation from Member Management.",
    link: "Go to Member Management",
  },
  fr: {
    summary: "Les membres ne peuvent pas être créés directement dans cette version. Une personne se joint à l’organisation sur invitation.",
    how: "Un administrateur peut envoyer une invitation depuis la gestion des membres.",
    link: "Aller à la gestion des membres",
  },
} as const;

export default function CreateMemberPage() {
  const t = useTranslations('membersNewPage');
  const locale = useLocale();
  const router = useRouter();
  const copy = locale.toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          className="mb-4 hover:bg-white/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToMembers')}
        </Button>
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('pageTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CapabilityUnavailable locale={locale} capability="UE-MEMBERS-DIRECT-CREATE" />
            <p className="text-gray-600">{copy.summary}</p>
            <p className="text-gray-600">{copy.how}</p>
            <Link href="/dashboard/admin/members" className="inline-block text-sm font-medium text-blue-600 hover:underline">
              {copy.link}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
