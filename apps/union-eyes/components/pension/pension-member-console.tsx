'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganizationId } from '@/lib/hooks/use-organization';
import { Briefcase, TrendingUp, Calendar, DollarSign, FileText, AlertCircle, CheckCircle, Clock, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PensionPlan {
  id: string;
  planName: string;
  planType: string;
  membershipStatus: string;
  vestingStatus: string;
  yearsOfService: number;
  enrollmentDate: string | null;
  totalAssets: string;
  fundingStatus: string;
  activeMembers: number;
  status: string;
  description: string | null;
}

interface Contribution {
  id: string;
  memberName: string;
  period: string;
  amount: string;
  paymentStatus: string;
  paymentDate: string | null;
}

interface BenefitEstimate {
  eligibilityAge: number;
  estimatedMonthlyBenefit: number;
  estimatedAnnualPension: number;
  yearsOfService: number;
  vestingPercentage: number;
}

interface PensionDocument {
  id: string;
  name: string;
  category: string | null;
  fileType: string;
  createdAt: string;
}

interface T4aRecord {
  id: string;
  memberName: string;
  taxYear: number;
  pensionIncome: string;
  status: string;
  generatedDate: string | null;
}

export default function PensionMemberConsole() {
  const organizationId = useOrganizationId();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PensionPlan | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [benefitEstimate, setBenefitEstimate] = useState<BenefitEstimate | null>(null);
  const [documents, setDocuments] = useState<PensionDocument[]>([]);
  const [t4aRecords, setT4aRecords] = useState<T4aRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPensionData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const plansRes = await fetch(`/api/pension/plans?organizationId=${encodeURIComponent(organizationId)}&limit=12`);
      if (!plansRes.ok) {
        throw new Error('Failed to fetch pension plans');
      }

      const plansData = await plansRes.json();
      if (!plansData.data || plansData.data.length === 0) {
        setLoading(false);
        return;
      }

      const firstPlan = plansData.data[0];
      const firstPlanId = firstPlan.id;

      const planRes = await fetch(`/api/pension/members?planId=${encodeURIComponent(firstPlanId)}`);
      if (planRes.ok) {
        const planData = await planRes.json();
        if (planData.data && planData.data.length > 0) {
          // Merge plan-level fields into the member record
          setPlan({
            ...planData.data[0],
            planType: firstPlan.planType,
            totalAssets: firstPlan.totalAssets,
            fundingStatus: firstPlan.fundingStatus,
            activeMembers: firstPlan.activeMembers,
            status: firstPlan.status,
            description: firstPlan.description,
          });
        }
      }

      // Fetch contributions
      const contribRes = await fetch(`/api/pension/contributions?organizationId=${encodeURIComponent(organizationId)}`);
      if (contribRes.ok) {
        const contribData = await contribRes.json();
        if (contribData.data && contribData.data.length > 0) {
          setContributions(contribData.data);
        }
      }

      // Fetch pension-related documents
      const docsRes = await fetch(`/api/documents?organizationId=${encodeURIComponent(organizationId)}&category=pension&limit=20`);
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        if (docsData.data && docsData.data.length > 0) {
          setDocuments(docsData.data);
        }
      }

      // Fetch T4A tax records
      const t4aRes = await fetch(`/api/pension/t4a?organizationId=${encodeURIComponent(organizationId)}`);
      if (t4aRes.ok) {
        const t4aData = await t4aRes.json();
        if (t4aData.data && t4aData.data.length > 0) {
          setT4aRecords(t4aData.data);
        }
      }
    } catch {
      setError('Unable to load pension information. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchPensionData();
  }, [fetchPensionData]);

  // Compute benefit estimate from real data
  useEffect(() => {
    if (!plan) {
      setBenefitEstimate(null);
      return;
    }

    const years = plan.yearsOfService || 0;
    // Standard 5-year graded vesting: 20% per year, fully vested at 5+
    const vestingPct = Math.min(years * 20, 100);

    const totalContributions = contributions.reduce(
      (sum, c) => sum + parseFloat(c.amount || '0'),
      0,
    );

    // Estimate: use a 2% accrual factor × years × average annual contribution
    const yearsWithContributions = Math.max(years, 1);
    const avgAnnualContrib = totalContributions / yearsWithContributions;
    const estimatedAnnual = years * 0.02 * avgAnnualContrib * 12 * (vestingPct / 100);
    const estimatedMonthly = estimatedAnnual / 12;

    setBenefitEstimate({
      eligibilityAge: 65,
      estimatedMonthlyBenefit: Math.round(estimatedMonthly * 100) / 100,
      estimatedAnnualPension: Math.round(estimatedAnnual * 100) / 100,
      yearsOfService: years,
      vestingPercentage: vestingPct,
    });
  }, [plan, contributions]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading your pension information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Briefcase className="w-8 h-8" />
              My Pension & Benefits
            </h1>
            <p className="text-muted-foreground mt-1">
              Retirement planning and benefit tracking
            </p>
          </div>
        </div>

        <Card className="border-2 border-dashed bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Pension Plan Enrollment</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                You are not currently enrolled in a pension plan. Contact your union representative
                to learn about available retirement benefits and enrollment options.
              </p>
              <Button variant="outline">
                Contact Union Office
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Briefcase className="w-8 h-8" />
            My Pension & Benefits
          </h1>
          <p className="text-muted-foreground mt-1">
            {plan.planName}
          </p>
        </div>
      </div>

      {/* Plan Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plan Type</p>
                <p className="text-2xl font-bold">{plan.planType}</p>
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
                <p className="text-2xl font-bold">{plan.yearsOfService || '0'}</p>
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
                <Badge variant={plan.vestingStatus === 'fully_vested' ? 'default' : 'secondary'}>
                  {plan.vestingStatus || 'Not Vested'}
                </Badge>
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
                <Badge variant={plan.membershipStatus === 'active' ? 'default' : 'secondary'}>
                  {plan.membershipStatus || 'Active'}
                </Badge>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="benefits">Benefit Estimate</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Retirement Eligibility */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Retirement Eligibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Normal Retirement Age</span>
                    <span className="font-semibold">65 years</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Early Retirement Age</span>
                    <span className="font-semibold">55 years</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Years of Service</span>
                    <span className="font-semibold">{plan.yearsOfService || 0} years</span>
                  </div>
                  {plan.enrollmentDate && (
                    <div className="flex justify-between items-center p-3 bg-muted rounded">
                      <span className="text-sm">Enrolled Since</span>
                      <span className="font-semibold">{new Date(plan.enrollmentDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Fund Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Fund Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Total Plan Assets</span>
                    <span className="font-semibold">
                      ${parseFloat(plan.totalAssets || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Funding Status</span>
                    <span className="font-semibold">{parseFloat(plan.fundingStatus || '0')}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Active Members</span>
                    <span className="font-semibold">{plan.activeMembers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <span className="text-sm">Plan Status</span>
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                      {plan.status || 'active'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan Information */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan Name</p>
                  <p className="font-medium">{plan.planName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan Type</p>
                  <p className="font-medium">{plan.planType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vesting Status</p>
                  <Badge variant={plan.vestingStatus === 'fully_vested' ? 'default' : 'secondary'}>
                    {plan.vestingStatus || 'Not Vested'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
                  <p className="font-medium">
                    ${contributions.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {plan.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{plan.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4">
          {/* Contribution Summary */}
          {contributions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Contributions</p>
                  <p className="text-2xl font-bold">
                    ${contributions.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Contribution Periods</p>
                  <p className="text-2xl font-bold">{contributions.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Latest Status</p>
                  <Badge variant={contributions[0]?.paymentStatus === 'received' ? 'default' : 'secondary'} className="mt-1">
                    {contributions[0]?.paymentStatus || 'N/A'}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Contribution History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contributions.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No contribution history available. Contributions will appear here once processed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contributions.map((contrib) => (
                    <div key={contrib.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">
                          {contrib.period}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {contrib.memberName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={contrib.paymentStatus === 'received' ? 'default' : contrib.paymentStatus === 'overdue' ? 'destructive' : 'secondary'}>
                          {contrib.paymentStatus}
                        </Badge>
                        <p className="font-semibold">${parseFloat(contrib.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Retirement Benefit Estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center p-6 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Estimated Monthly Benefit at Age 65</p>
                  <p className="text-4xl font-bold">
                    {benefitEstimate
                      ? `$${benefitEstimate.estimatedMonthlyBenefit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '$--'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Based on current service and contributions</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded">
                    <p className="text-sm text-muted-foreground mb-1">Years of Service</p>
                    <p className="text-2xl font-bold">{benefitEstimate?.yearsOfService ?? plan.yearsOfService ?? '0'}</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <p className="text-sm text-muted-foreground mb-1">Vesting</p>
                    <p className="text-2xl font-bold">{benefitEstimate ? `${benefitEstimate.vestingPercentage}%` : '--%'}</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <p className="text-sm text-muted-foreground mb-1">Annual Pension</p>
                    <p className="text-2xl font-bold">
                      {benefitEstimate
                        ? `$${benefitEstimate.estimatedAnnualPension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '$--'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Estimate Disclaimer</p>
                      <p className="text-sm text-blue-800 mt-1">
                        This is an estimate only. Actual benefits may vary based on final plan provisions,
                        earnings history, and actuarial calculations. For a personalized benefit estimate,
                        contact the pension plan administrator.
                      </p>
                    </div>
                  </div>
                </div>

                <Button className="w-full">
                  Request Detailed Benefit Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {/* T4A Tax Records */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                T4A Tax Slips
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t4aRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No T4A records available yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {t4aRecords.map((record) => (
                    <div key={record.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">T4A — {record.taxYear}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.memberName} · Pension Income: ${parseFloat(record.pensionIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Badge variant={record.status === 'filed' ? 'default' : 'secondary'}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pension Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pension Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No pension documents available. Documents will appear here once uploaded by your plan administrator.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
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
                            {doc.fileType.toUpperCase()} · {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-muted rounded">
                <p className="text-sm text-muted-foreground">
                  Need help? Contact the pension plan administrator at your union office
                  or call the trust fund office for assistance with your pension benefits.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
