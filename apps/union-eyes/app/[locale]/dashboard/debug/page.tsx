/**
 * Debug page to view current user information
 * This helps link auth users to database records
 * 
 * GATED: Only accessible in development. Returns 404 in production.
 */

export const dynamic = 'force-dynamic';

import { currentUser } from '@nzila/platform-auth/entra/server';
import { requireUser } from "@/lib/api-auth-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClaimsAssignedToUser } from "@/db/queries/claims-queries";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DebugPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "debugPage" });

  // Gate: only available in development
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const authContext = await requireUser();
  const userId = authContext.userId;
  const orgId = authContext.organizationId;
  const user = await currentUser();
  
  // Get assigned claims
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignedClaims: any[] = [];
  if (userId) {
    try {
      assignedClaims = await getClaimsAssignedToUser(userId);
    } catch (_error) {
}
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>{t("authCard.title")}</CardTitle>
          <CardDescription>{t("authCard.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("authCard.userId")}</p>
            <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
              {userId || t("authCard.notAuthenticated")}
            </code>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("authCard.organizationId")}</p>
            <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
              {orgId || t("authCard.noOrganization")}
            </code>
          </div>
          
          {user && (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("authCard.email")}</p>
                <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
                  {user.emailAddresses[0]?.emailAddress || t("authCard.noEmail")}
                </code>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("authCard.fullName")}</p>
                <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
                  {user.firstName} {user.lastName}
                </code>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("claimsCard.title")}</CardTitle>
          <CardDescription>{t("claimsCard.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("claimsCard.none")}</p>
          ) : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {assignedClaims.map((claim: any) => (
                <div key={claim.id} className="p-3 border rounded">
                  <p className="font-medium">{claim.claimNumber}</p>
                  <p className="text-sm text-muted-foreground">{claim.title}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dbCard.title")}</CardTitle>
          <CardDescription>{t("dbCard.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("dbCard.step1")}</p>
            <p className="text-sm font-medium">{t("dbCard.step2")}</p>
            <code className="block mt-1 p-3 bg-muted rounded text-xs font-mono whitespace-pre">
{`UPDATE users 
SET user_id = 'your_clerk_user_id_here'
WHERE email = 'your.email@example.com';`}
            </code>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("dbCard.step3")}</p>
            <code className="block mt-1 p-3 bg-muted rounded text-xs font-mono whitespace-pre">
{`UPDATE claims 
SET assigned_to = 'your_clerk_user_id_here'
WHERE claim_number = 'CLM-2025-004';`}
            </code>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {t("dbCard.tip")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
