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

import { getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { dataAggregationConsent } from '@/db/schema/domains/marketing';
import { organizations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Info, CheckCircle2, XCircle, History } from 'lucide-react';
import { requireUser } from '@/lib/api-auth-guard';
import Link from 'next/link';
import ConsentForm from '@/components/marketing/consent-form';
 
import RevokeConsentButton from '@/components/marketing/revoke-consent-button';

interface DataSharingPageProps {
  params: {
    locale: string;
  };
}

export default async function DataSharingPage({ params }: DataSharingPageProps) {
  const t = await getTranslations('dataSharingPage');
  const { locale: _locale } = params;

  // Get user's organization
  const user = await requireUser();
  const organizationId = user.organizationId ?? '';

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
        <h1 className="text-4xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('pageSubtitle')}
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasActiveConsent ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {t('sharingEnabledTitle')}
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-gray-400" />
                {t('sharingDisabledTitle')}
              </>
            )}
          </CardTitle>
          <CardDescription>
            {hasActiveConsent
              ? t('sharingEnabledDescription')
              : t('sharingDisabledDescription')}
          </CardDescription>
        </CardHeader>
        {consent && (
          <CardContent>
            <div className="space-y-4">
              {/* Current Preferences */}
              <div>
                <h3 className="font-semibold mb-3">{t('sharingPreferencesTitle')}</h3>
                <div className="grid gap-2">
                  <PreferenceItem
                    label={t('impactMetricsLabel')}
                    description={t('impactMetricsDescription')}
                    enabled={consent.preferences.shareImpactMetrics}
                  />
                  <PreferenceItem
                    label={t('caseResolutionLabel')}
                    description={t('caseResolutionDescription')}
                    enabled={consent.preferences.shareCaseResolutionTimes}
                  />
                  <PreferenceItem
                    label={t('demographicDataLabel')}
                    description={t('demographicDataDescription')}
                    enabled={consent.preferences.shareDemographicData}
                  />
                  <PreferenceItem
                    label={t('industryInsightsLabel')}
                    description={t('industryInsightsDescription')}
                    enabled={consent.preferences.shareIndustryInsights}
                  />
                  <PreferenceItem
                    label={t('legislativeDataLabel')}
                    description={t('legislativeDataDescription')}
                    enabled={consent.preferences.shareLegislativeData}
                  />
                </div>
              </div>

              {/* Consent Details */}
              <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t">
                <div>
                  <strong>{t('grantedByLabel')}:</strong> {consent.consentGivenBy}
                </div>
                <div>
                  <strong>{t('dateLabel')}:</strong>{' '}
                  {new Date(consent.grantedAt).toLocaleDateString()}
                </div>
                {consent.expiresAt && (
                  <div>
                    <strong>{t('expiresLabel')}:</strong>{' '}
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
            {t('howItWorksTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{t('privacyGuaranteesTitle')}</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>{t('minimum5UnionsLabel')}:</strong> {t('minimum5UnionsDescription')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>{t('minimum10CasesLabel')}:</strong> {t('minimum10CasesDescription')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>{t('statisticalNoiseLabel')}:</strong> {t('statisticalNoiseDescription')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>{t('noOrgNamesLabel')}:</strong> {t('noOrgNamesDescription')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <span>
                  <strong>{t('revocableAnyTimeLabel')}:</strong> {t('revocableAnyTimeDescription')}
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{t('whyParticipateTitle')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • <strong>{t('learnFromMovementLabel')}:</strong> {t('learnFromMovementDescription')}
              </li>
              <li>
                • <strong>{t('supportAdvocacyLabel')}:</strong> {t('supportAdvocacyDescription')}
              </li>
              <li>
                • <strong>{t('benchmarkAnonymouslyLabel')}:</strong> {t('benchmarkAnonymouslyDescription')}
              </li>
              <li>
                • <strong>{t('strengthenSolidarityLabel')}:</strong> {t('strengthenSolidarityDescription')}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Opt-In Form */}
      {!hasActiveConsent && (
        <Card>
          <CardHeader>
            <CardTitle>{t('enableDataSharingTitle')}</CardTitle>
            <CardDescription>
              {t('enableDataSharingDescription')}
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
              {t('consentHistoryTitle')}
            </CardTitle>
            <CardDescription>
              {t('consentHistoryDescription')}
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
                          ? t('consentRevokedStatus')
                          : record.status === 'expired'
                          ? t('consentExpiredStatus')
                          : t('consentGrantedStatus')}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(record.createdAt).toLocaleString()}
                      {record.revokedAt && (
                        <span>
                          {' '} {t('revokedAtPrefix')} {new Date(record.revokedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {record.revocationReason && (
                      <div className="text-sm text-muted-foreground">
                        {t('revocationReasonLabel')}: {record.revocationReason}
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
        <AlertTitle>{t('legalNoticeTitle')}</AlertTitle>
        <AlertDescription className="text-xs">
          {t('legalNoticeText')}{' '}
          <Link href="/privacy" className="underline">
            {t('privacyPolicyLink')}
          </Link>{' '}
          {t('and')} {' '}
          <Link href="/terms" className="underline">
            {t('termsLink')}
          </Link>{' '}
          {t('forDetails')}.
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
