'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Briefcase, Calendar, DollarSign, FileText, CheckCircle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { readApiError } from '@/lib/client/api-envelope';
import { formatDay } from '@/lib/client/day';
import {
  fetchPensionRows,
  PensionServerMessage,
  readContribution,
  readPensionDocument,
  readPensionMember,
  readPensionRows,
  readPlan,
  readT4a,
  type PensionContribution,
  type PensionDocument,
  type PensionMember,
  type PensionPlan,
  type T4ARecord,
} from './pension-readers';

type Section<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed'; message: string };

const LOAD_FAILED = 'Unable to load pension information. Please try again later.';
const words = (code: string) => code.replace(/_/g, ' ');

function failure(error: unknown): { state: 'failed'; message: string } {
  return { state: 'failed', message: error instanceof PensionServerMessage ? error.message : LOAD_FAILED };
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

async function fetchDocuments(): Promise<PensionDocument[]> {
  // Pension documents come from the canonical repository, which applies each document's classification policy.
  const response = await fetch('/api/documents/repository?documentType=pension&limit=50');
  if (!response.ok) throw new PensionServerMessage(await readApiError(response, LOAD_FAILED));
  return readPensionRows(await response.json()).map(readPensionDocument);
}

export default function PensionMemberConsole() {
  const locale = useLocale();
  // The application's locale, never the host's: the same amount reads the same everywhere.
  const money = (value: number) => value.toLocaleString(locale, { style: 'currency', currency: 'CAD' });
  const [plans, setPlans] = useState<Section<PensionPlan[]>>({ state: 'loading' });
  const [enrolments, setEnrolments] = useState<Section<PensionMember[]>>({ state: 'loading' });
  const [documents, setDocuments] = useState<Section<PensionDocument[]>>({ state: 'loading' });
  const [selectedEnrolmentId, setSelectedEnrolmentId] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Section<PensionContribution[]>>({ state: 'loading' });
  const [t4aRecords, setT4aRecords] = useState<Section<T4ARecord[]>>({ state: 'loading' });

  const loadPlans = useCallback(
    () => fetchPensionRows('/api/pension/plans', readPlan, LOAD_FAILED).then((value) => setPlans({ state: 'ready', value }), (error) => setPlans(failure(error))),
    [],
  );
  // For a member the route answers their own enrolments only, one per plan.
  const loadEnrolments = useCallback(
    () =>
      fetchPensionRows('/api/pension/members', readPensionMember, LOAD_FAILED).then(
        (value) => setEnrolments({ state: 'ready', value }),
        (error) => setEnrolments(failure(error)),
      ),
    [],
  );
  const loadDocuments = useCallback(
    () => fetchDocuments().then((value) => setDocuments({ state: 'ready', value }), (error) => setDocuments(failure(error))),
    [],
  );

  useEffect(() => {
    void Promise.all([loadPlans(), loadEnrolments(), loadDocuments()]);
  }, [loadPlans, loadEnrolments, loadDocuments]);

  const enrolmentRows = enrolments.state === 'ready' ? enrolments.value : null;
  const enrolment = enrolmentRows === null ? null : (enrolmentRows.find((row) => row.id === selectedEnrolmentId) ?? enrolmentRows[0] ?? null);
  const enrolmentId = enrolment?.id ?? null;

  const loadContributions = useCallback(
    () =>
      enrolmentId === null
        ? Promise.resolve()
        : fetchPensionRows(`/api/pension/contributions?memberId=${encodeURIComponent(enrolmentId)}`, readContribution, LOAD_FAILED).then(
            (value) => setContributions({ state: 'ready', value }),
            (error) => setContributions(failure(error)),
          ),
    [enrolmentId],
  );
  const loadT4a = useCallback(
    () =>
      enrolmentId === null
        ? Promise.resolve()
        : fetchPensionRows(`/api/pension/t4a?memberId=${encodeURIComponent(enrolmentId)}`, readT4a, LOAD_FAILED).then(
            (value) => setT4aRecords({ state: 'ready', value }),
            (error) => setT4aRecords(failure(error)),
          ),
    [enrolmentId],
  );

  useEffect(() => {
    setContributions({ state: 'loading' });
    setT4aRecords({ state: 'loading' });
    void Promise.all([loadContributions(), loadT4a()]);
  }, [loadContributions, loadT4a]);

  const heading = (
    <div>
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Briefcase className="w-8 h-8" />
        My Pension &amp; Benefits
      </h1>
    </div>
  );

  if (plans.state === 'loading' || enrolments.state === 'loading') {
    return (
      <div className="p-6 space-y-6">
        {heading}
        <p role="status" className="text-muted-foreground">
          Loading your pension information...
        </p>
      </div>
    );
  }
  if (plans.state === 'failed' || enrolments.state === 'failed') {
    return (
      <div className="p-6 space-y-6">
        {heading}
        <Failed
          message={plans.state === 'failed' ? plans.message : (enrolments as { message: string }).message}
          onRetry={() => void Promise.all([loadPlans(), loadEnrolments()])}
        />
      </div>
    );
  }

  // The plans route sends the figures an administrator keeps (assets, funding, enrolment count) to an administrator only. An administrator is
  // sent every enrolment of the organization, so none of them can be called "my" pension.
  const administrator = plans.value.some((plan) => plan.activeMembers !== null || plan.totalAssets !== null);
  if (administrator) {
    return (
      <div className="p-6 space-y-6">
        {heading}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p>This page shows a member&apos;s own pension. Pension administrators manage every plan, enrolment and contribution from Pension Administration.</p>
            <Button asChild variant="outline">
              <Link href={`/${locale}/dashboard/pension/admin`}>Open Pension Administration</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enrolment === null || enrolmentRows === null) {
    return (
      <div className="p-6 space-y-6">
        {heading}
        <Card className="border-2 border-dashed bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Pension Plan Enrollment</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You are not currently enrolled in a pension plan. Contact your union representative to learn about available retirement benefits and
                enrollment options.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = plans.value.find((row) => row.id === enrolment.planId) ?? null;
  const contributionRows = contributions.state === 'ready' ? contributions.value : null;
  const totalContributions = contributionRows === null ? null : contributionRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Briefcase className="w-8 h-8" />
          My Pension &amp; Benefits
        </h1>
        <p className="text-muted-foreground mt-1">{enrolment.planName}</p>
      </div>

      {enrolmentRows.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Your pension plans">
          {enrolmentRows.map((row) => (
            <Button
              key={row.id}
              type="button"
              size="sm"
              variant={row.id === enrolment.id ? 'default' : 'outline'}
              aria-pressed={row.id === enrolment.id}
              onClick={() => setSelectedEnrolmentId(row.id)}
            >
              {row.planName}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plan Type</p>
                <p className="text-2xl font-bold capitalize">{plan === null ? '—' : words(plan.planType)}</p>
              </div>
              <Briefcase className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Years of Service</p>
                <p className="text-2xl font-bold">{enrolment.yearsOfService}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vesting Status</p>
                <Badge variant={enrolment.vestingStatus === 'fully_vested' ? 'default' : 'secondary'}>{words(enrolment.vestingStatus)}</Badge>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Membership</p>
                <Badge variant={enrolment.membershipStatus === 'active' ? 'default' : 'secondary'}>{words(enrolment.membershipStatus)}</Badge>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="benefits">Benefit Estimate</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan Name</p>
                  <p className="font-medium">{enrolment.planName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan Status</p>
                  <p className="font-medium capitalize">{plan === null ? '—' : words(plan.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Enrolled Since</p>
                  <p className="font-medium">{formatDay(enrolment.enrollmentDate, locale, 'numeric')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
                  <p className="font-medium">{totalContributions === null ? '—' : money(totalContributions)}</p>
                </div>
              </div>
              {plan?.description != null && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{plan.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4">
          {contributions.state === 'loading' && (
            <p role="status" className="text-muted-foreground">
              Loading...
            </p>
          )}
          {contributions.state === 'failed' && <Failed message={contributions.message} onRetry={() => void loadContributions()} />}
          {contributions.state === 'ready' && contributions.value.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Contributions</p>
                  <p className="text-2xl font-bold">{money(totalContributions ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Contribution Periods</p>
                  <p className="text-2xl font-bold">{contributions.value.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Latest Status</p>
                  <Badge variant={contributions.value[0].paymentStatus === 'received' ? 'default' : 'secondary'} className="mt-1">
                    {contributions.value[0].paymentStatus}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}
          {contributions.state === 'ready' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Contribution History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contributions.value.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No contribution history available. Contributions will appear here once processed.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contributions.value.map((contribution) => (
                      <div key={contribution.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">{contribution.period}</p>
                          <p className="text-sm text-muted-foreground">{contribution.memberName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={contribution.paymentStatus === 'received' ? 'default' : contribution.paymentStatus === 'overdue' ? 'destructive' : 'secondary'}
                          >
                            {contribution.paymentStatus}
                          </Badge>
                          <p className="font-semibold">{money(contribution.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="benefits" className="space-y-4">
          <CapabilityUnavailable locale={locale} capability="UE-FIN-PENSION-BENEFIT-ESTIMATE" />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                T4A Tax Slips
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t4aRecords.state === 'loading' && (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading...
                </p>
              )}
              {t4aRecords.state === 'failed' && <Failed message={t4aRecords.message} onRetry={() => void loadT4a()} />}
              {t4aRecords.state === 'ready' && t4aRecords.value.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No T4A records available yet.</p>
              )}
              {t4aRecords.state === 'ready' && t4aRecords.value.length > 0 && (
                <div className="space-y-2">
                  {t4aRecords.value.map((record) => (
                    <div key={record.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">T4A — {record.taxYear}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.memberName} · Pension Income: {money(record.pensionIncome)}
                        </p>
                      </div>
                      <Badge variant={record.status === 'filed' ? 'default' : 'secondary'}>{record.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pension Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.state === 'loading' && (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading...
                </p>
              )}
              {documents.state === 'failed' && <Failed message={documents.message} onRetry={() => void loadDocuments()} />}
              {documents.state === 'ready' && documents.value.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No pension documents available. Documents will appear here once uploaded by your plan administrator.</p>
                </div>
              )}
              {documents.state === 'ready' && documents.value.length > 0 && (
                <div className="space-y-2">
                  {documents.value.map((doc) => (
                    <a
                      key={doc.id}
                      href={`/api/documents/${doc.id}/download`}
                      className="flex justify-between items-center p-3 border rounded hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.fileType.toUpperCase()} · {new Date(doc.createdAt).toLocaleDateString(locale)}
                          </p>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
