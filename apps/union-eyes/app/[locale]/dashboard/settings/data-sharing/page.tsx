/**
 * Data Sharing Settings Page
 *
 * Read-only status of this organization's movement-insights consent. It reads data_aggregation_consent, the table the
 * Movement Trends page reads.
 *
 * Consent cannot be granted or revoked from here. The application's runtime role may only SELECT that table and no
 * route writes it. POST /api/consent writes consent_records, a different table the feature never reads, so a form
 * posting there would report a consent that nothing acts on. The page says the action is unavailable and never claims
 * a consent it did not read or a right the user cannot exercise.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserRole, requireUser } from '@/lib/api-auth-guard';
import { canManageOrganizationSettings } from '@/lib/auth/org-settings-access';
import { movementTrendCategoryLabel } from '@/lib/movement-insights/category-labels';
import { readOrganizationConsent } from '@/lib/movement-insights/consent-read';

const GRANT_CAPABILITY = 'UE-MOVEMENT-INSIGHTS-CONSENT-GRANT';
const REVOKE_CAPABILITY = 'UE-MOVEMENT-INSIGHTS-CONSENT-REVOCATION';

const COPY = {
  en: {
    subtitle: 'Whether your organization has consented to contribute to movement-wide insights',
    onRecordTitle: 'Consent on record',
    onRecordDescription: 'Your organization has consented to contribute to movement insights.',
    noneTitle: 'No consent on record',
    noneDescription: 'Your organization has not consented to contribute to movement insights.',
    consentDate: 'Date of consent',
    expires: 'Expires on',
    expired: 'Expired on',
    categories: 'Categories covered',
    noCategories: 'No categories are recorded with this consent.',
    grantUnavailable:
      'Recording your organization’s consent is not available in this release, so it cannot be given from this page. The status above is read directly from your organization’s record and has not been changed.',
    revokeUnavailable:
      'Withdrawing your organization’s consent is not available in this release, so it cannot be done from this page. The status above is read directly from your organization’s record and has not been changed.',
    storedTitle: 'What movement insights are made of',
    storedAggregates:
      'Movement trends are stored as aggregates: a category, a dimension, a timeframe, a count, the number of contributing organizations and a summary text. A stored trend has no column for organization names or identifiers.',
    storedScope: 'This page shows what is stored. It does not calculate the trends and does not check how they were produced.',
    legalTitle: 'Legal notice',
    legalLead: 'For how data is handled, see the',
    legalAnd: 'and the',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
  },
  fr: {
    subtitle: 'Indique si votre organisation a consenti à contribuer aux analyses à l’échelle du mouvement',
    onRecordTitle: 'Consentement enregistré',
    onRecordDescription: 'Votre organisation a consenti à contribuer aux analyses du mouvement.',
    noneTitle: 'Aucun consentement enregistré',
    noneDescription: 'Votre organisation n’a pas consenti à contribuer aux analyses du mouvement.',
    consentDate: 'Date du consentement',
    expires: 'Expire le',
    expired: 'Expiré le',
    categories: 'Catégories visées',
    noCategories: 'Aucune catégorie n’est enregistrée avec ce consentement.',
    grantUnavailable:
      'L’enregistrement du consentement de votre organisation n’est pas disponible dans cette version; il ne peut donc pas être donné depuis cette page. Le statut ci-dessus est lu directement dans le dossier de votre organisation et n’a pas été modifié.',
    revokeUnavailable:
      'Le retrait du consentement de votre organisation n’est pas disponible dans cette version; il ne peut donc pas être effectué depuis cette page. Le statut ci-dessus est lu directement dans le dossier de votre organisation et n’a pas été modifié.',
    storedTitle: 'Ce qui compose les analyses du mouvement',
    storedAggregates:
      'Les tendances du mouvement sont conservées sous forme d’agrégats : une catégorie, une dimension, une période, un compte, le nombre d’organisations contributrices et un texte de synthèse. Une tendance conservée n’a aucune colonne pour le nom ou l’identifiant des organisations.',
    storedScope: 'Cette page montre ce qui est conservé. Elle ne calcule pas les tendances et ne vérifie pas comment elles ont été produites.',
    legalTitle: 'Avis juridique',
    legalLead: 'Pour savoir comment les données sont traitées, consultez la',
    legalAnd: 'et les',
    privacy: 'Politique de confidentialité',
    terms: 'Conditions d’utilisation',
  },
} as const;

type Language = keyof typeof COPY;

function formatDate(value: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(value);
}

function hasPassed(value: Date): boolean {
  return value.getTime() < Date.now();
}

interface DataSharingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function DataSharingPage({ params }: DataSharingPageProps) {
  const { locale } = await params;
  const t = await getTranslations('dataSharingPage');
  const language: Language = locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const copy = COPY[language];

  const user = await requireUser();
  const organizationId = user.organizationId;
  if (!organizationId) {
    redirect(`/${locale}/dashboard/profile`);
  }

  // Organization data-sharing consent is an administrator decision.
  const role = await getUserRole(user.userId, organizationId);
  if (!canManageOrganizationSettings(role)) {
    redirect(`/${locale}/dashboard/profile`);
  }

  const consent = await readOrganizationConsent(organizationId);

  // A stored row whose consent_given is false records no consent, so it is shown the same way as no row.
  const onRecord = consent?.consentGiven ? consent : null;

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-4xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">{copy.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {onRecord ? (
              <>
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-green-600" />
                {copy.onRecordTitle}
              </>
            ) : (
              <>
                <XCircle aria-hidden="true" className="h-5 w-5 text-gray-400" />
                {copy.noneTitle}
              </>
            )}
          </CardTitle>
          <CardDescription>{onRecord ? copy.onRecordDescription : copy.noneDescription}</CardDescription>
        </CardHeader>
        {onRecord && (
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">{copy.consentDate}</dt>
                <dd className="text-muted-foreground">{formatDate(onRecord.consentDate, language)}</dd>
              </div>
              {onRecord.expiresAt && (
                <div>
                  <dt className="font-medium">{hasPassed(onRecord.expiresAt) ? copy.expired : copy.expires}</dt>
                  <dd className="text-muted-foreground">{formatDate(onRecord.expiresAt, language)}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="font-medium">{copy.categories}</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {onRecord.categories.length > 0 ? (
                    onRecord.categories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {movementTrendCategoryLabel(category, language)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">{copy.noCategories}</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        )}
      </Card>

      <div className="space-y-3">
        <CapabilityUnavailable locale={locale} capability={onRecord ? REVOKE_CAPABILITY : GRANT_CAPABILITY} />
        <p className="text-sm text-muted-foreground">{onRecord ? copy.revokeUnavailable : copy.grantUnavailable}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info aria-hidden="true" className="h-5 w-5" />
            {copy.storedTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{copy.storedAggregates}</p>
          <p className="text-muted-foreground">{copy.storedScope}</p>
        </CardContent>
      </Card>

      <Alert role="note">
        <Info aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>{copy.legalTitle}</AlertTitle>
        <AlertDescription className="text-xs">
          {copy.legalLead}{' '}
          <Link href={`/${locale}/legal/privacy`} className="underline">
            {copy.privacy}
          </Link>{' '}
          {copy.legalAnd}{' '}
          <Link href={`/${locale}/legal/terms`} className="underline">
            {copy.terms}
          </Link>
          .
        </AlertDescription>
      </Alert>
    </div>
  );
}
