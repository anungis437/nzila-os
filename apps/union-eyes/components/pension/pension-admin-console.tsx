'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganizationId } from '@/lib/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Clock,
  Settings,
  DollarSign,
  FileCheck,
  Users,
  FileText,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Upload,
  Plus,
  Edit,
  Eye,
} from 'lucide-react';

interface PensionPlan {
  id: string;
  planName: string;
  planType: string;
  status: string;
  activeMembers: number;
  totalAssets: number;
  fundingStatus: number;
}

interface Contribution {
  id: string;
  memberId: string;
  memberName: string;
  period: string;
  amount: number;
  paymentStatus: string;
  paymentDate?: string;
}

interface BenefitClaim {
  id: string;
  memberId: string;
  memberName: string;
  claimType: string;
  status: string;
  amount: number;
  submittedDate: string;
  processedDate?: string;
}

interface PensionMember {
  id: string;
  name: string;
  enrollmentDate: string;
  planId: string;
  planName: string;
  membershipStatus: string;
  yearsOfService: number;
  vestingStatus: string;
}

interface T4ARecord {
  id: string;
  memberId: string;
  memberName: string;
  taxYear: number;
  pensionIncome: number;
  status: string;
  generatedDate?: string;
}

export default function PensionAdminConsole() {
  const organizationId = useOrganizationId();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans');

  const [plans, setPlans] = useState<PensionPlan[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [claims, setClaims] = useState<BenefitClaim[]>([]);
  const [members, setMembers] = useState<PensionMember[]>([]);
  const [t4aRecords, setT4ARecords] = useState<T4ARecord[]>([]);

  const loadAdminData = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      const plansRes = await fetch(`/api/pension/plans?organizationId=${encodeURIComponent(organizationId)}`);

      if (!plansRes.ok) {
        throw new Error('Failed to fetch pension plans');
      }

      const plansData = await plansRes.json();
      const fetchedPlans: PensionPlan[] = plansData.data ?? [];
      setPlans(fetchedPlans);
      const firstPlanId = fetchedPlans[0]?.id;

      const [contributionsRes, claimsRes, membersRes, t4aRes] = await Promise.all([
        fetch(`/api/pension/contributions?organizationId=${encodeURIComponent(organizationId)}`),
        fetch(`/api/pension/benefits?organizationId=${encodeURIComponent(organizationId)}`),
        firstPlanId
          ? fetch(`/api/pension/members?planId=${encodeURIComponent(firstPlanId)}&organizationId=${encodeURIComponent(organizationId)}`)
          : Promise.resolve(null),
        fetch(`/api/pension/t4a?organizationId=${encodeURIComponent(organizationId)}`),
      ]);

      if (contributionsRes.ok) {
        const contribData = await contributionsRes.json();
        setContributions(contribData?.data ?? []);
      } else {
        setContributions([]);
      }

      if (claimsRes.ok) {
        const claimsData = await claimsRes.json();
        setClaims(claimsData?.data ?? []);
      } else {
        setClaims([]);
      }

      if (membersRes && membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData?.data ?? []);
      } else {
        setMembers([]);
      }

      if (t4aRes.ok) {
        const t4aData = await t4aRes.json();
        setT4ARecords(t4aData?.data ?? []);
      } else {
        setT4ARecords([]);
      }
    } catch {
      // Error state handled by empty data arrays; API errors surface via response status
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadAdminData();
    }
  }, [organizationId, loadAdminData]);

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase();
    if (
      statusLower.includes('active') ||
      statusLower.includes('paid') ||
      statusLower.includes('approved') ||
      statusLower.includes('sent')
    ) {
      return 'default';
    } else if (statusLower.includes('pending') || statusLower.includes('review')) {
      return 'secondary';
    } else if (statusLower.includes('overdue') || statusLower.includes('requires')) {
      return 'destructive';
    }
    return 'outline';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading pension administration data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalMembers = plans.reduce((sum, p) => sum + (p.activeMembers || 0), 0);
  const totalAssets = plans.reduce((sum, p) => sum + (p.totalAssets || 0), 0);
  const pendingClaims = claims.filter((c) => c.status === 'pending' || c.status === 'under_review').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Pension Administration
          </h1>
          <p className="text-muted-foreground mt-1">Manage pension plans, members, contributions, and compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Plan
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.filter((p) => p.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">{plans.length} total plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingClaims}</div>
            <p className="text-xs text-muted-foreground">{claims.length} total claims</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAssets)}</div>
            <p className="text-xs text-muted-foreground">Combined fund value</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          {plans.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No pension plans found. Create a new plan to get started.
              </CardContent>
            </Card>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{plan.planName}</CardTitle>
                      <CardDescription>{plan.planType}</CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(plan.status)}>{plan.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Members</p>
                      <p className="text-lg font-semibold">{plan.activeMembers.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Assets</p>
                      <p className="text-lg font-semibold">{formatCurrency(plan.totalAssets)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Funding Status</p>
                      <p className="text-lg font-semibold">{plan.fundingStatus}%</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Contributions Tab */}
        <TabsContent value="contributions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contribution Tracking</CardTitle>
                  <CardDescription>Monitor and manage member contributions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {contributions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No contributions found.</p>
              ) : (
                <div className="space-y-2">
                  {contributions.map((contrib) => (
                    <div key={contrib.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{contrib.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          Period: {contrib.period} • Amount: {formatCurrency(contrib.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(contrib.paymentStatus)}>{contrib.paymentStatus}</Badge>
                        {contrib.paymentDate && (
                          <span className="text-xs text-muted-foreground">{formatDate(contrib.paymentDate)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claims Tab */}
        <TabsContent value="claims" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Benefit Claims</CardTitle>
              <CardDescription>Review and process member benefit claims</CardDescription>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No benefit claims found.</p>
              ) : (
                <div className="space-y-2">
                  {claims.map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{claim.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          {claim.claimType} • {formatCurrency(claim.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">Submitted: {formatDate(claim.submittedDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(claim.status)}>{claim.status}</Badge>
                        {claim.status === 'pending' && (
                          <>
                            <Button variant="outline" size="sm">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button variant="outline" size="sm">
                              <XCircle className="w-4 h-4 mr-1" />
                              Deny
                            </Button>
                          </>
                        )}
                        {claim.status === 'under_review' && (
                          <>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                            <Button variant="outline" size="sm">
                              <FileText className="w-4 h-4 mr-1" />
                              Request Documents
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plan Members</CardTitle>
                  <CardDescription>Manage pension plan membership</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Enroll New Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No pension members found.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.planName}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Enrolled: {formatDate(member.enrollmentDate)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Service: {member.yearsOfService} years
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(member.membershipStatus)}>
                          {member.membershipStatus}
                        </Badge>
                        <Badge variant="outline">{member.vestingStatus}</Badge>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Reporting (T4A Slips)</CardTitle>
              <CardDescription>Generate and manage T4A tax slips for pension income</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate T4A for 2024
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export All T4A Records
                </Button>
              </div>

              {t4aRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No T4A records found.</p>
              ) : (
                <div className="space-y-2">
                  {t4aRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{record.memberName}</p>
                          <p className="text-sm text-muted-foreground">
                            Tax Year {record.taxYear} • Pension Income: {formatCurrency(record.pensionIncome)}
                          </p>
                          {record.generatedDate && (
                            <p className="text-xs text-muted-foreground">
                              Generated: {formatDate(record.generatedDate)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(record.status)}>{record.status}</Badge>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance & Annual Reports</CardTitle>
              <CardDescription>Generate regulatory and compliance reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto py-4 justify-start">
                  <div className="flex items-start gap-3">
                    <FileText className="w-6 h-6 mt-1" />
                    <div className="text-left">
                      <p className="font-semibold">Annual Pension Statement</p>
                      <p className="text-sm text-muted-foreground">Member benefit statements for all participants</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="h-auto py-4 justify-start">
                  <div className="flex items-start gap-3">
                    <FileCheck className="w-6 h-6 mt-1" />
                    <div className="text-left">
                      <p className="font-semibold">Actuarial Valuation Summary</p>
                      <p className="text-sm text-muted-foreground">Plan funding and liability assessment</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="h-auto py-4 justify-start">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-6 h-6 mt-1" />
                    <div className="text-left">
                      <p className="font-semibold">Contribution Summary Report</p>
                      <p className="text-sm text-muted-foreground">Year-to-date contribution tracking</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="h-auto py-4 justify-start">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-6 h-6 mt-1" />
                    <div className="text-left">
                      <p className="font-semibold">Regulatory Filing Checklist</p>
                      <p className="text-sm text-muted-foreground">Track compliance deadlines and filings</p>
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
