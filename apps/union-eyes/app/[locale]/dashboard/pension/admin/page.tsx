'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
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

export default function PensionAdminPage() {
  const organizationId = useOrganizationId();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans');
  
  // State for each section
  const [plans, setPlans] = useState<PensionPlan[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [claims, setClaims] = useState<BenefitClaim[]>([]);
  const [members, setMembers] = useState<PensionMember[]>([]);
  const [t4aRecords, setT4ARecords] = useState<T4ARecord[]>([]);

  useEffect(() => {
    if (organizationId) {
      loadAdminData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const loadAdminData = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      
      // First fetch plans to get a planId
      const plansRes = await fetch(`/api/pension/plans?organizationId=${organizationId}`);
      
      if (!plansRes.ok) {
        throw new Error('Failed to fetch pension plans');
      }
      
      const plansData = await plansRes.json();
      const firstPlanId = plansData.data?.[0]?.id;
      
      // Load remaining admin data in parallel
      const [_contributionsRes, _claimsRes, _membersRes, _t4aRes] = await Promise.all([
        fetch(`/api/pension/plans?organizationId=${organizationId}`), // Reusing for contributions demo
        fetch('/api/pension/benefits'),
        firstPlanId ? fetch(`/api/pension/members?planId=${firstPlanId}`) : Promise.resolve({ ok: false }),
        fetch('/api/tax/t4a')
      ]);

      // Mock data for demonstration
      setPlans([
        {
          id: '1',
          planName: 'CUPE Local 1234 Defined Benefit Plan',
          planType: 'Defined Benefit',
          status: 'Active',
          activeMembers: 456,
          totalAssets: 12500000,
          fundingStatus: 94.5
        },
        {
          id: '2',
          planName: 'CUPE Local 1234 Defined Contribution Plan',
          planType: 'Defined Contribution',
          status: 'Active',
          activeMembers: 123,
          totalAssets: 3200000,
          fundingStatus: 100
        }
      ]);

      setContributions([
        {
          id: '1',
          memberId: 'M001',
          memberName: 'John Doe',
          period: 'January 2024',
          amount: 450,
          paymentStatus: 'Paid',
          paymentDate: '2024-01-15'
        },
        {
          id: '2',
          memberId: 'M002',
          memberName: 'Jane Smith',
          period: 'January 2024',
          amount: 450,
          paymentStatus: 'Pending'
        },
        {
          id: '3',
          memberId: 'M003',
          memberName: 'Robert Johnson',
          period: 'January 2024',
          amount: 450,
          paymentStatus: 'Overdue'
        }
      ]);

      setClaims([
        {
          id: '1',
          memberId: 'M001',
          memberName: 'Mary Wilson',
          claimType: 'Retirement Benefit',
          status: 'Pending Review',
          amount: 2500,
          submittedDate: '2024-01-10'
        },
        {
          id: '2',
          memberId: 'M002',
          memberName: 'David Brown',
          claimType: 'Disability Benefit',
          status: 'Approved',
          amount: 1800,
          submittedDate: '2024-01-05',
          processedDate: '2024-01-12'
        },
        {
          id: '3',
          memberId: 'M003',
          memberName: 'Sarah Davis',
          claimType: 'Survivor Benefit',
          status: 'Requires Information',
          amount: 1200,
          submittedDate: '2024-01-08'
        }
      ]);

      setMembers([
        {
          id: 'M001',
          name: 'John Doe',
          enrollmentDate: '2010-03-15',
          planId: '1',
          planName: 'CUPE Local 1234 Defined Benefit Plan',
          membershipStatus: 'Active',
          yearsOfService: 14,
          vestingStatus: 'Fully Vested'
        },
        {
          id: 'M002',
          name: 'Jane Smith',
          enrollmentDate: '2018-06-01',
          planId: '1',
          planName: 'CUPE Local 1234 Defined Benefit Plan',
          membershipStatus: 'Active',
          yearsOfService: 6,
          vestingStatus: 'Partially Vested (60%)'
        },
        {
          id: 'M003',
          name: 'Robert Johnson',
          enrollmentDate: '2020-01-10',
          planId: '2',
          planName: 'CUPE Local 1234 Defined Contribution Plan',
          membershipStatus: 'Active',
          yearsOfService: 4,
          vestingStatus: 'Not Vested'
        }
      ]);

      setT4ARecords([
        {
          id: '1',
          memberId: 'M001',
          memberName: 'Mary Wilson',
          taxYear: 2023,
          pensionIncome: 30000,
          status: 'Generated',
          generatedDate: '2024-02-15'
        },
        {
          id: '2',
          memberId: 'M002',
          memberName: 'David Brown',
          taxYear: 2023,
          pensionIncome: 21600,
          status: 'Sent',
          generatedDate: '2024-02-15'
        }
      ]);

    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('active') || statusLower.includes('paid') || statusLower.includes('approved') || statusLower.includes('sent')) {
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
      currency: 'CAD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Pension Administration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage pension plans, contributions, benefit claims, and member enrollment
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Plans</p>
                <p className="text-2xl font-bold">{plans.filter(p => p.status === 'Active').length}</p>
              </div>
              <Shield className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{plans.reduce((sum, p) => sum + p.activeMembers, 0)}</p>
              </div>
              <Users className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Claims</p>
                <p className="text-2xl font-bold">{claims.filter(c => c.status.includes('Pending')).length}</p>
              </div>
              <FileCheck className="w-10 h-10 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(plans.reduce((sum, p) => sum + p.totalAssets, 0))}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pension Plans</CardTitle>
                  <CardDescription>Manage all pension plans for your union</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {plans.map((plan) => (
                  <Card key={plan.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1">{plan.planName}</h3>
                          <p className="text-sm text-muted-foreground">{plan.planType}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(plan.status)}>{plan.status}</Badge>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Active Members</p>
                          <p className="text-xl font-semibold">{plan.activeMembers}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Assets</p>
                          <p className="text-xl font-semibold">{formatCurrency(plan.totalAssets)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Funding Status</p>
                          <p className="text-xl font-semibold">{plan.fundingStatus}%</p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
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
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contributions Tab */}
        <TabsContent value="contributions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contribution Tracking</CardTitle>
                  <CardDescription>Monitor member contributions and payment status</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Contributions
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {contributions.map((contribution) => (
                  <div key={contribution.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <DollarSign className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{contribution.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          {contribution.period} â€¢ {formatCurrency(contribution.amount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(contribution.paymentStatus)}>
                        {contribution.paymentStatus}
                      </Badge>
                      {contribution.paymentDate && (
                        <p className="text-sm text-muted-foreground">
                          Paid: {formatDate(contribution.paymentDate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">Total Contributions This Period:</p>
                  <p className="font-semibold">
                    {formatCurrency(contributions.reduce((sum, c) => sum + c.amount, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claims Tab */}
        <TabsContent value="claims" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Benefit Claims Administration</CardTitle>
              <CardDescription>Review and process pension benefit claims</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {claims.map((claim) => (
                  <Card key={claim.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold">{claim.memberName}</h3>
                          <p className="text-sm text-muted-foreground">{claim.claimType}</p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(claim.status)}>{claim.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Amount</p>
                          <p className="text-lg font-semibold">{formatCurrency(claim.amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Submitted</p>
                          <p className="text-lg font-semibold">{formatDate(claim.submittedDate)}</p>
                        </div>
                      </div>

                      {claim.status.includes('Pending') && (
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve Claim
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <XCircle className="w-4 h-4 mr-2" />
                            Deny Claim
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            Review Details
                          </Button>
                        </div>
                      )}

                      {claim.status === 'Requires Information' && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Request Documents
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            View Claim
                          </Button>
                        </div>
                      )}

                      {claim.processedDate && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Processed: {formatDate(claim.processedDate)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Member Enrollment</CardTitle>
                  <CardDescription>Manage pension plan member roster</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Enroll New Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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

              <div className="space-y-2">
                {t4aRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{record.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          Tax Year {record.taxYear} â€¢ Pension Income: {formatCurrency(record.pensionIncome)}
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
