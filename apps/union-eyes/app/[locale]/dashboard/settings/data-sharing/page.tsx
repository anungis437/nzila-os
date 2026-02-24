/**
 * Data Sharing Settings Page
 * 
 * Allows organizations to opt in/out of movement insights aggregation.
 * 
 * CONSENT MANAGEMENT:
 * - Explicit opt-in required
 * - Granular control over 5 data types
 * - Clear purpose statements
 * - Revocable anytime
 * - Full audit trail visible
 */


export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { dataAggregationConsent } from '@/db/schema/domains/marketing';
import { organizations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Info, CheckCircle2, XCircle, History } from 'lucide-react';
import Link from 'next/link';
import ConsentForm from '@/components/marketing/consent-form';
 
import RevokeConsentButton from '@/components/marketing/revoke-consent-button';

interface DataSharingPageProps {
  params: {
    locale: string;
  };
}

export default async function DataSharingPage({ params }: DataSharingPageProps) {
  const { locale: _locale } = params;

  // Get user's organization
  // TODO: Get from session context
  const organizationId = 'org-placeholder';

  const [_organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  // Get current consent status
  const [consent] = await db
    .select()
    .from(dataAggregationConsent)
    .where(
      and(
        eq(dataAggregationConsent.organizationId, organizationId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq((dataAggregationConsent as any).status, 'active')
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .limit(1) as any[];

  // Get consent history
  const consentHistory = await db
    .select()
    .from(dataAggregationConsent)
    .where(eq(dataAggregationConsent.organizationId, organizationId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .orderBy(desc((dataAggregationConsent as any).createdAt))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .limit(10) as any[];

  const hasActiveConsent = consent !== undefined;

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Data Sharing Settings</h1>
        <p className="text-muted-foreground mt-2">
          Control how your organization participates in movement-wide insights
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasActiveConsent ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Data Sharing Enabled
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-gray-400" />
                Data Sharing Disabled
              </>
            )}
          </CardTitle>
          <CardDescription>
            {hasActiveConsent
              ? 'Your organization is contributing to movement insights'
              : 'Your organization is not currently participating'}
          </CardDescription>
        </CardHeader>
        {consent && (
          <CardContent>
            <div className="space-y-4">
              {/* Current Preferences */}
              <div>
                <h3 className="font-semibold mb-3">Sharing Preferences</h3>
                <div className="grid gap-2">
                  <PreferenceItem
                    label="Impact Metrics"
                    description="Win rates, resolution outcomes"
                    enabled={consent.preferences.shareImpactMetrics}
                  />
                  <PreferenceItem
                    label="Case Resolution Times"
                    description="How long cases take to resolve"
                    enabled={consent.preferences.shareCaseResolutionTimes}
                  />
                  <PreferenceItem
                    label="Demographic Data"
                    description="Age ranges, employment sectors (anonymized)"
                    enabled={consent.preferences.shareDemographicData}
                  />
                  <PreferenceItem
                    label="Industry Insights"
                    description="Industry-specific patterns"
                    enabled={consent.preferences.shareIndustryInsights}
                  />
                  <PreferenceItem
                    label="Legislative Data"
                    description="Collective agreement patterns"
                    enabled={consent.preferences.shareLegislativeData}
                  />
                </div>
              </div>

              {/* Consent Details */}
              <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t">
                <div>
                  <strong>Granted by:</strong> {consent.consentGivenBy}
                </div>
                <div>
                  <strong>Date:</strong>{' '}
                  {new Date(consent.grantedAt).toLocaleDateString()}
                </div>
                {consent.expiresAt && (
                  <div>
                    <strong>Expires:</strong>{' '}
                    {new Date(consent.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Revoke Button */}
              <div className="pt-4">
                <RevokeConsentButton consentId={consent.id} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How Movement Insights Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Privacy Guarantees</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>Minimum 5 unions:</strong> Data only aggregated when at least 5
                  organizations participate
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>Minimum 10-25 cases:</strong> Higher thresholds for sensitive data like
                  demographics
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>Statistical noise:</strong> Random variation added to prevent reverse
                  engineering
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>No organization names:</strong> Your union is never identified in
                  aggregated data
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>Revocable anytime:</strong> Opt out instantly with no questions asked
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Why Participate?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • <strong>Learn from the movement:</strong> See how unions across Canada are
                resolving cases
              </li>
              <li>
                • <strong>Support CLC advocacy:</strong> Provide data for legislative briefs and
                policy work
              </li>
              <li>
                • <strong>Benchmark anonymously:</strong> Compare your outcomes to movement-wide
                trends
              </li>
              <li>
                • <strong>Strengthen solidarity:</strong> Help other unions improve their processes
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Opt-In Form */}
      {!hasActiveConsent && (
        <Card>
          <CardHeader>
            <CardTitle>Enable Data Sharing</CardTitle>
            <CardDescription>
              Choose what data to contribute to movement insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConsentForm organizationId={organizationId} />
          </CardContent>
        </Card>
      )}

      {/* Consent History */}
      {consentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Consent History
            </CardTitle>
            <CardDescription>
              Your organization&apos;s data sharing activity (last 10 records)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {consentHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start justify-between py-3 border-b last:border-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          record.status === 'active'
                            ? 'default'
                            : record.status === 'revoked'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {record.status}
                      </Badge>
                      <span className="text-sm font-medium">
                        {record.status === 'revoked'
                          ? 'Consent Revoked'
                          : record.status === 'expired'
                          ? 'Consent Expired'
                          : 'Consent Granted'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(record.createdAt).toLocaleString()}
                      {record.revokedAt && (
                        <span>
                          {' '}
                          → Revoked {new Date(record.revokedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {record.revocationReason && (
                      <div className="text-sm text-muted-foreground">
                        Reason: {record.revocationReason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Legal Notice</AlertTitle>
        <AlertDescription className="text-xs">
          By enabling data sharing, you authorize Union Eyes to aggregate anonymized data from your
          organization with data from other consenting unions. You can revoke consent at any time.
          All aggregation occurs in Canada. Data is never sold or shared with employers. See our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>{' '}
          for details.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * Preference item display component
 */
function PreferenceItem({
  label,
  description,
  enabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="mt-0.5">
        {enabled ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-gray-300" />
        )}
      </div>
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
