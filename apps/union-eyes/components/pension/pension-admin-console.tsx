'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { Shield, DollarSign, FileCheck, Users, FileText, AlertTriangle } from 'lucide-react';
import {
  fetchPensionRows,
  PensionServerMessage,
  readClaim,
  readContribution,
  readPensionMember,
  readPlan,
  readT4a,
  type BenefitClaim,
  type PensionContribution,
  type PensionMember,
  type PensionPlan,
  type T4ARecord,
} from './pension-readers';

type Section<T> = { state: 'loading' } | { state: 'ready'; rows: T[] } | { state: 'failed'; message: string };

const LOAD_FAILED = 'Failed to load pension data. Please try again.';
const DASH = '—';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
const words = (code: string) => code.replace(/_/g, ' ');

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const lower = status.toLowerCase();
  if (lower.includes('active') || lower.includes('paid') || lower.includes('approved') || lower.includes('received') || lower.includes('sent')) return 'default';
  if (lower.includes('pending') || lower.includes('review')) return 'secondary';
  if (lower.includes('overdue') || lower.includes('requires')) return 'destructive';
  return 'outline';
}

function failure(error: unknown): { state: 'failed'; message: string } {
  return { state: 'failed', message: error instanceof PensionServerMessage ? error.message : LOAD_FAILED };
}

function SectionStatus<T>({ section, onRetry, empty }: { section: Section<T>; onRetry: () => void; empty: string }) {
  if (section.state === 'loading') {
    return (
      <p role="status" className="text-center text-muted-foreground py-4">
        Loading...
      </p>
    );
  }
  if (section.state === 'failed') {
    return (
      <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <span>{section.message}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  return section.rows.length === 0 ? <p className="text-center text-muted-foreground py-4">{empty}</p> : null;
}

export default function PensionAdminConsole() {
  const locale = useLocale();
  const [plans, setPlans] = useState<Section<PensionPlan>>({ state: 'loading' });
  const [contributions, setContributions] = useState<Section<PensionContribution>>({ state: 'loading' });
  const [claims, setClaims] = useState<Section<BenefitClaim>>({ state: 'loading' });
  const [members, setMembers] = useState<Section<PensionMember>>({ state: 'loading' });
  const [t4aRecords, setT4aRecords] = useState<Section<T4ARecord>>({ state: 'loading' });

  const loadPlans = useCallback(
    () => fetchPensionRows('/api/pension/plans', readPlan, LOAD_FAILED).then((rows) => setPlans({ state: 'ready', rows }), (error) => setPlans(failure(error))),
    [],
  );
  const loadContributions = useCallback(
    () =>
      fetchPensionRows('/api/pension/contributions', readContribution, LOAD_FAILED).then(
        (rows) => setContributions({ state: 'ready', rows }),
        (error) => setContributions(failure(error)),
      ),
    [],
  );
  const loadClaims = useCallback(
    () => fetchPensionRows('/api/pension/benefits', readClaim, LOAD_FAILED).then((rows) => setClaims({ state: 'ready', rows }), (error) => setClaims(failure(error))),
    [],
  );
  // Every enrolment of the organization, not the first plan's only.
  const loadMembers = useCallback(
    () => fetchPensionRows('/api/pension/members', readPensionMember, LOAD_FAILED).then((rows) => setMembers({ state: 'ready', rows }), (error) => setMembers(failure(error))),
    [],
  );
  const loadT4a = useCallback(
    () => fetchPensionRows('/api/pension/t4a', readT4a, LOAD_FAILED).then((rows) => setT4aRecords({ state: 'ready', rows }), (error) => setT4aRecords(failure(error))),
    [],
  );

  useEffect(() => {
    void Promise.all([loadPlans(), loadContributions(), loadClaims(), loadMembers(), loadT4a()]);
  }, [loadPlans, loadContributions, loadClaims, loadMembers, loadT4a]);

  const planRows = plans.state === 'ready' ? plans.rows : null;
  // A total is shown only when every row holds the figure: a row without it (an administrator's record the route did not send) is not zero.
  const sumOf = (pick: (plan: PensionPlan) => number | null) => {
    if (planRows === null) return null;
    const values = planRows.map(pick);
    return values.every((value): value is number => value !== null) ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const totalMembers = sumOf((plan) => plan.activeMembers);
  const totalAssets = sumOf((plan) => plan.totalAssets);
  const claimRows = claims.state === 'ready' ? claims.rows : null;
  const pendingClaims = claimRows === null ? null : claimRows.filter((claim) => claim.status === 'pending' || claim.status === 'under_review').length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          Pension Administration
        </h1>
        <p className="text-muted-foreground mt-1">Pension plans, members, contributions, claims and tax records</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planRows === null ? DASH : planRows.filter((plan) => plan.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">{planRows === null ? DASH : `${planRows.length} total plans`}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers === null ? DASH : totalMembers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active enrolments across all plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingClaims === null ? DASH : pendingClaims}</div>
            <p className="text-xs text-muted-foreground">{claimRows === null ? DASH : `${claimRows.length} total claims`}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recorded Total Assets</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets === null ? DASH : formatCurrency(totalAssets)}</div>
            <p className="text-xs text-muted-foreground">As entered by the plan administrator</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <SectionStatus section={plans} onRetry={() => void loadPlans()} empty="No pension plans found." />
          {plans.state === 'ready' &&
            plans.rows.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{plan.planName}</CardTitle>
                      <CardDescription>{words(plan.planType)}</CardDescription>
                    </div>
                    <Badge variant={statusVariant(plan.status)}>{words(plan.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Members</p>
                      <p className="text-lg font-semibold">{plan.activeMembers === null ? DASH : plan.activeMembers.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Recorded Assets</p>
                      <p className="text-lg font-semibold">{plan.totalAssets === null ? DASH : formatCurrency(plan.totalAssets)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Recorded Funding Status</p>
                      <p className="text-lg font-semibold">{plan.fundingStatus === null ? DASH : `${plan.fundingStatus}%`}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contribution Tracking</CardTitle>
              <CardDescription>Contributions recorded for plan members</CardDescription>
            </CardHeader>
            <CardContent>
              <SectionStatus section={contributions} onRetry={() => void loadContributions()} empty="No contributions found." />
              {contributions.state === 'ready' && (
                <div className="space-y-2">
                  {contributions.rows.map((contribution) => (
                    <div key={contribution.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{contribution.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          Period: {contribution.period} • Amount: {formatCurrency(contribution.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(contribution.paymentStatus)}>{contribution.paymentStatus}</Badge>
                        {contribution.paymentDate !== null && (
                          <span className="text-xs text-muted-foreground">{formatDate(contribution.paymentDate)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
          <CapabilityUnavailable locale={locale} capability="UE-FIN-PENSION-TRUSTEE-ADMIN" />
          <Card>
            <CardHeader>
              <CardTitle>Benefit Claims</CardTitle>
              <CardDescription>Claims as filed; a claim is decided by the plan&apos;s trustees, and no approval or denial is recorded here</CardDescription>
            </CardHeader>
            <CardContent>
              <SectionStatus section={claims} onRetry={() => void loadClaims()} empty="No benefit claims found." />
              {claims.state === 'ready' && (
                <div className="space-y-2">
                  {claims.rows.map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{claim.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          {claim.claimType} • {formatCurrency(claim.amount)} • Submitted {formatDate(claim.submittedDate)}
                        </p>
                        {claim.processedDate !== null && (
                          <p className="text-xs text-muted-foreground">Processed {formatDate(claim.processedDate)}</p>
                        )}
                      </div>
                      <Badge variant={statusVariant(claim.status)}>{words(claim.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Members</CardTitle>
              <CardDescription>Every pension enrolment of the organization</CardDescription>
            </CardHeader>
            <CardContent>
              <SectionStatus section={members} onRetry={() => void loadMembers()} empty="No pension members found." />
              {members.state === 'ready' && (
                <div className="space-y-2">
                  {members.rows.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.planName}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">Enrolled: {formatDate(member.enrollmentDate)}</span>
                          <span className="text-xs text-muted-foreground">Service: {member.yearsOfService} years</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(member.membershipStatus)}>{words(member.membershipStatus)}</Badge>
                        <Badge variant="outline">{words(member.vestingStatus)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <CapabilityUnavailable locale={locale} capability="UE-FIN-PENSION-REPORTS" />
          <Card>
            <CardHeader>
              <CardTitle>Tax Records (T4A)</CardTitle>
              <CardDescription>Records already on file; none is generated or filed from this screen</CardDescription>
            </CardHeader>
            <CardContent>
              <SectionStatus section={t4aRecords} onRetry={() => void loadT4a()} empty="No T4A records found." />
              {t4aRecords.state === 'ready' && (
                <div className="space-y-2">
                  {t4aRecords.rows.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{record.memberName}</p>
                          <p className="text-sm text-muted-foreground">
                            Tax Year {record.taxYear} • Pension Income: {formatCurrency(record.pensionIncome)}
                          </p>
                          {record.generatedDate !== null && (
                            <p className="text-xs text-muted-foreground">Generated: {formatDate(record.generatedDate)}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={statusVariant(record.status)}>{words(record.status)}</Badge>
                    </div>
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
