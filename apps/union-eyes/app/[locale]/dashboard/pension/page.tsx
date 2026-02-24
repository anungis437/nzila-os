'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useOrganizationId } from '@/lib/hooks/use-organization';
import { Briefcase, TrendingUp, Calendar, DollarSign, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
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
}

interface Contribution {
  id: string;
  contributionPeriodStart: string;
  contributionPeriodEnd: string;
  totalContributionAmount: string;
  paymentStatus: string;
}

interface BenefitEstimate {
  eligibilityAge: number;
  estimatedMonthlyBenefit: number;
  estimatedAnnualPension: number;
  yearsOfService: number;
  vestingPercentage: number;
}

export default function PensionDashboard() {
  const organizationId = useOrganizationId();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PensionPlan | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [_benefitEstimate, _setBenefitEstimate] = useState<BenefitEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPensionData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First, fetch pension plans for the organization
      const plansRes = await fetch(`/api/pension/plans?organizationId=${organizationId}&limit=12`);
      if (!plansRes.ok) {
        throw new Error('Failed to fetch pension plans');
      }
      
      const plansData = await plansRes.json();
      if (!plansData.data || plansData.data.length === 0) {
        // No plans available
        setLoading(false);
        return;
      }

      // Use the first plan to fetch member details
      const firstPlanId = plansData.data[0].id;
      
      // Fetch pension plan membership for this plan
      const planRes = await fetch(`/api/pension/members?planId=${firstPlanId}`);
      if (planRes.ok) {
        const planData = await planRes.json();
        if (planData.data && planData.data.length > 0) {
          setPlan(planData.data[0]);
        }
      }

      // Store contribution data (would be filtered by member in production)
      setContributions([]);

      // Note: Benefit estimate would be fetched separately after plan is set
      // This is handled by a separate effect when plan changes

    } catch (_err) {
setError('Unable to load pension information. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchPensionData();
  }, [fetchPensionData]);

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
                    <span className="text-sm">Estimated Years to Normal Retirement</span>
                    <span className="font-semibold">-- years</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Request Benefit Estimate
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    View Benefit Summary
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Update Beneficiaries
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Download Pension Handbook
                  </Button>
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
                  <p className="text-sm text-muted-foreground mb-1">Plan Administrator</p>
                  <p className="font-medium">Contact Union Office</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Registration Number</p>
                  <p className="font-medium">--</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4">
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
                          {contrib.contributionPeriodStart} - {contrib.contributionPeriodEnd}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Status: {contrib.paymentStatus}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${contrib.totalContributionAmount}</p>
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
                  <p className="text-4xl font-bold">$--</p>
                  <p className="text-sm text-muted-foreground mt-1">Based on current service and earnings</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded">
                    <p className="text-sm text-muted-foreground mb-1">Years of Service</p>
                    <p className="text-2xl font-bold">{plan.yearsOfService || '0'}</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <p className="text-sm text-muted-foreground mb-1">Vesting</p>
                    <p className="text-2xl font-bold">--%</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <p className="text-sm text-muted-foreground mb-1">Annual Pension</p>
                    <p className="text-2xl font-bold">$--</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pension Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Annual Pension Statement (2024)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Plan Member Handbook
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Beneficiary Designation Form
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Retirement Application Form
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Tax Information (T4A Slips)
                </Button>
              </div>

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
