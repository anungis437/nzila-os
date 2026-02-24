"use client";


export const dynamic = 'force-dynamic';
/**
 * Strike Fund Details Page
 * Comprehensive fund management with 6 tabs: Overview, Eligibility, Attendance, Stipends, Donations, Analytics
 * Phase 4: Strike Fund Management
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingDown,
  AlertCircle,
  Users,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Heart,
  ArrowLeft,
  Edit,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

interface StrikeFund {
  id: string;
  organizationId: string;
  fundName: string;
  fundCode: string;
  description: string | null;
  fundType: 'general' | 'local' | 'emergency' | 'hardship';
  currentBalance: number;
  targetAmount: number | null;
  minimumThreshold: number | null;
  contributionRate: number | null;
  contributionFrequency: string | null;
  strikeStatus: 'inactive' | 'preparing' | 'active' | 'suspended' | 'resolved';
  strikeStartDate: string | null;
  strikeEndDate: string | null;
  weeklyStipendAmount: number | null;
  dailyPicketBonus: number | null;
  minimumAttendanceHours: number | null;
  estimatedBurnRate: number | null;
  estimatedDurationWeeks: number | null;
  fundDepletionDate: string | null;
  lastPredictionUpdate: string | null;
  acceptsPublicDonations: boolean;
  donationPageUrl: string | null;
  fundraisingGoal: number | null;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface EligibilityRecord {
  id: string;
  memberId: string;
  memberName: string;
  eligibilityStatus: 'pending' | 'approved' | 'denied' | 'suspended';
  duesStatus: 'current' | 'arrears';
  goodStanding: boolean;
  approvedDate: string | null;
  denialReason: string | null;
}

interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  checkInTime: string;
  checkOutTime: string | null;
  checkInMethod: 'nfc' | 'qr_code' | 'gps' | 'manual';
  locationVerified: boolean;
  deviceId: string | null;
  coordinatorOverride: boolean;
  hoursWorked: number | null;
}

interface StipendRecord {
  id: string;
  memberId: string;
  memberName: string;
  weekStartDate: string;
  weekEndDate: string;
  hoursWorked: number;
  daysAttended: number;
  baseAmount: number;
  bonusAmount: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'processed' | 'paid' | 'failed';
  paymentDate: string | null;
}

interface DonationRecord {
  id: string;
  donorName: string | null;
  donorEmail: string | null;
  amount: number;
  isAnonymous: boolean;
  donationDate: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
}

const STATUS_COLORS = {
  inactive: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  preparing: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  active: "bg-red-100 text-red-800 hover:bg-red-100",
  suspended: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  resolved: "bg-green-100 text-green-800 hover:bg-green-100",
};

const FUND_TYPE_LABELS = {
  general: "General Fund",
  local: "Local Fund",
  emergency: "Emergency Fund",
  hardship: "Hardship Fund",
};

export default function StrikeFundDetailsPage() {
  const params = useParams();
  const locale = useLocale();
  const { userId, orgId } = useAuth();
  const fundId = params.fundId as string;

  const [fund, setFund] = useState<StrikeFund | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [stipends, setStipends] = useState<StipendRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchFundData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch fund details
      const fundResponse = await fetch(`/api/strike/funds/${fundId}?organizationId=${orgId}`);
      if (!fundResponse.ok) throw new Error('Failed to fetch fund details');
      const fundResult = await fundResponse.json();
      setFund(fundResult.data);

      // Fetch eligibility data
      const eligibilityResponse = await fetch(`/api/strike/eligibility?fundId=${fundId}`);
      if (eligibilityResponse.ok) {
        const eligibilityResult = await eligibilityResponse.json();
        setEligibility(eligibilityResult.data || []);
      }

      // Fetch attendance data
      const attendanceResponse = await fetch(`/api/strike/picket-lines?fundId=${fundId}`);
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        setAttendance(attendanceResult.data || []);
      }

      // Fetch stipend data
      const stipendsResponse = await fetch(`/api/strike/stipends?fundId=${fundId}`);
      if (stipendsResponse.ok) {
        const stipendsResult = await stipendsResponse.json();
        setStipends(stipendsResult.data || []);
      }

      // Fetch donations data  
      const donationsResponse = await fetch(`/api/strike/donations?fundId=${fundId}`);
      if (donationsResponse.ok) {
        const donationsResult = await donationsResponse.json();
        setDonations(donationsResult.data || []);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, orgId, fundId]);

  useEffect(() => {
    if (userId && orgId && fundId) {
      fetchFundData();
    }
  }, [userId, orgId, fundId, fetchFundData]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDaysUntilDepletion = (depletionDate: string | null) => {
    if (!depletionDate) return null;
    const today = new Date();
    const depletion = new Date(depletionDate);
    const diffTime = depletion.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getBalancePercentage = (current: number, target: number | null) => {
    if (!target) return 100;
    return Math.min(100, (current / target) * 100);
  };

  const getHealthStatus = (current: number, threshold: number | null) => {
    if (!threshold) return { label: "Unknown", color: "text-gray-500" };
    if (current < threshold) return { label: "Critical", color: "text-red-500" };
    if (current < threshold * 1.5) return { label: "Warning", color: "text-yellow-500" };
    return { label: "Healthy", color: "text-green-500" };
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !fund) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Fund not found'}
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href={`/${locale}/dashboard/strike-fund`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Funds
          </Link>
        </Button>
      </div>
    );
  }

  const daysUntilDepletion = getDaysUntilDepletion(fund.fundDepletionDate);
  const balancePercentage = getBalancePercentage(Number(fund.currentBalance), fund.targetAmount ? Number(fund.targetAmount) : null);
  const healthStatus = getHealthStatus(Number(fund.currentBalance), fund.minimumThreshold ? Number(fund.minimumThreshold) : null);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${locale}/dashboard/strike-fund`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                {fund.fundName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground font-mono">{fund.fundCode}</p>
                <Badge className={STATUS_COLORS[fund.strikeStatus]}>
                  {fund.strikeStatus}
                </Badge>
                <Badge variant="outline">{FUND_TYPE_LABELS[fund.fundType]}</Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit Fund
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(Number(fund.currentBalance))}</div>
            <p className={`text-xs ${healthStatus.color} font-medium`}>
              {healthStatus.label}
            </p>
            {fund.targetAmount && (
              <Progress value={balancePercentage} className="mt-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Burn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fund.estimatedBurnRate ? formatCurrency(Number(fund.estimatedBurnRate)) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              per week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Until Depletion</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${daysUntilDepletion !== null && daysUntilDepletion < 30 ? 'text-red-500' : ''}`}>
              {daysUntilDepletion !== null ? daysUntilDepletion : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {fund.fundDepletionDate ? formatDate(fund.fundDepletionDate) : "Not calculated"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {eligibility.filter(e => e.eligibilityStatus === 'approved').length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {eligibility.length} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {daysUntilDepletion !== null && daysUntilDepletion < 30 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical:</strong> Fund will be depleted in {daysUntilDepletion} days. Consider increasing contributions or reducing stipends.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="eligibility">
            Eligibility
            <Badge variant="secondary" className="ml-2">{eligibility.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="attendance">
            Attendance
            <Badge variant="secondary" className="ml-2">{attendance.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="stipends">
            Stipends
            <Badge variant="secondary" className="ml-2">{stipends.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="donations">
            Donations
            <Badge variant="secondary" className="ml-2">{donations.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fund Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fund.description && (
                  <div>
                    <span className="text-sm font-medium">Description</span>
                    <p className="text-sm text-muted-foreground mt-1">{fund.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium">Fund Type</span>
                    <p className="text-sm text-muted-foreground">{FUND_TYPE_LABELS[fund.fundType]}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Status</span>
                    <p className="text-sm text-muted-foreground">{fund.status}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Target Amount</span>
                    <p className="text-sm text-muted-foreground">
                      {fund.targetAmount ? formatCurrency(Number(fund.targetAmount)) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Minimum Threshold</span>
                    <p className="text-sm text-muted-foreground">
                      {fund.minimumThreshold ? formatCurrency(Number(fund.minimumThreshold)) : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strike Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Start Date
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(fund.strikeStartDate)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      End Date
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(fund.strikeEndDate)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Duration</span>
                    <p className="text-sm text-muted-foreground">
                      {fund.estimatedDurationWeeks ? `${fund.estimatedDurationWeeks} weeks` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Last Updated</span>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(fund.lastPredictionUpdate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stipend Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium">Weekly Stipend</span>
                    <p className="text-sm text-muted-foreground">
                      {fund.weeklyStipendAmount ? formatCurrency(Number(fund.weeklyStipendAmount)) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Daily Bonus</span>
                    <p className="text-sm text-muted-foreground">
                      {fund.dailyPicketBonus ? formatCurrency(Number(fund.dailyPicketBonus)) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Min. Hours/Day</span>
                    <p className="text-sm text-muted-foreground">
                      {fund.minimumAttendanceHours ? `${fund.minimumAttendanceHours} hours` : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Donations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium">Accepts Public Donations</span>
                  <p className="text-sm text-muted-foreground">
                    {fund.acceptsPublicDonations ? "Yes" : "No"}
                  </p>
                </div>
                {fund.acceptsPublicDonations && (
                  <>
                    <div>
                      <span className="text-sm font-medium">Fundraising Goal</span>
                      <p className="text-sm text-muted-foreground">
                        {fund.fundraisingGoal ? formatCurrency(Number(fund.fundraisingGoal)) : "N/A"}
                      </p>
                    </div>
                    {fund.donationPageUrl && (
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <a href={fund.donationPageUrl} target="_blank" rel="noopener noreferrer">
                          <Heart className="h-4 w-4 mr-2" />
                          View Donation Page
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Eligibility Tab */}
        <TabsContent value="eligibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Eligibility</CardTitle>
              <CardDescription>
                Manage member eligibility for strike fund benefits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eligibility.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No eligibility records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dues</TableHead>
                      <TableHead>Good Standing</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibility.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.memberName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.eligibilityStatus === 'approved' ? 'default' :
                              record.eligibilityStatus === 'denied' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {record.eligibilityStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.duesStatus === 'current' ? 'default' : 'destructive'}>
                            {record.duesStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.goodStanding ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(record.approvedDate)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Picket Line Attendance</CardTitle>
              <CardDescription>
                Track member check-ins and location verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.memberName}</TableCell>
                        <TableCell>{formatDateTime(record.checkInTime)}</TableCell>
                        <TableCell>{formatDateTime(record.checkOutTime)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.checkInMethod.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          {record.locationVerified ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">Verified</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Unverified</span>
                            </div>
                          )}
                          {record.coordinatorOverride && (
                            <Badge variant="secondary" className="text-xs ml-1">Override</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : "In progress"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stipends Tab */}
        <TabsContent value="stipends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Stipend Disbursements</CardTitle>
              <CardDescription>
                Track weekly payments and bonus calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stipends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No stipend records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Week</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stipends.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.memberName}</TableCell>
                        <TableCell>
                          {formatDate(record.weekStartDate)} - {formatDate(record.weekEndDate)}
                        </TableCell>
                        <TableCell>{record.hoursWorked.toFixed(1)}</TableCell>
                        <TableCell>{record.daysAttended}</TableCell>
                        <TableCell>{formatCurrency(record.baseAmount)}</TableCell>
                        <TableCell>{formatCurrency(record.bonusAmount)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(record.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.paymentStatus === 'paid' ? 'default' :
                              record.paymentStatus === 'failed' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {record.paymentStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Donations Tab */}
        <TabsContent value="donations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Public Donations</CardTitle>
              <CardDescription>
                Track contributions from public supporters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {donations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No donation records yet</p>
                  {fund.acceptsPublicDonations && fund.donationPageUrl && (
                    <Button variant="outline" className="mt-4" asChild>
                      <a href={fund.donationPageUrl} target="_blank" rel="noopener noreferrer">
                        Share Donation Page
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {fund.fundraisingGoal && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Fundraising Progress</span>
                        <span className="font-medium">
                          {formatCurrency(donations.reduce((sum, d) => sum + d.amount, 0))} / {formatCurrency(Number(fund.fundraisingGoal))}
                        </span>
                      </div>
                      <Progress
                        value={(donations.reduce((sum, d) => sum + d.amount, 0) / Number(fund.fundraisingGoal)) * 100}
                      />
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Donor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {donations.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {record.isAnonymous ? (
                              <span className="text-muted-foreground italic">Anonymous</span>
                            ) : (
                              <span className="font-medium">{record.donorName || "Unknown"}</span>
                            )}
                          </TableCell>
                          <TableCell className="font-bold">{formatCurrency(record.amount)}</TableCell>
                          <TableCell>{formatDate(record.donationDate)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.paymentStatus === 'completed' ? 'default' :
                                record.paymentStatus === 'failed' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {record.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fund Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Balance vs Target</span>
                    <span className={healthStatus.color}>
                      {healthStatus.label}
                    </span>
                  </div>
                  <Progress value={balancePercentage} />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Burn Rate</span>
                    <p className="text-lg font-bold">
                      {fund.estimatedBurnRate ? formatCurrency(Number(fund.estimatedBurnRate)) : "N/A"}
                    </p>
                    <span className="text-xs text-muted-foreground">per week</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Depletion Date</span>
                    <p className="text-lg font-bold">
                      {daysUntilDepletion !== null ? `${daysUntilDepletion} days` : "N/A"}
                    </p>
                    <span className="text-xs text-muted-foreground">{formatDate(fund.fundDepletionDate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Participation Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Eligible Members</span>
                    <p className="text-2xl font-bold">
                      {eligibility.filter(e => e.eligibilityStatus === 'approved').length}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Check-ins</span>
                    <p className="text-2xl font-bold">{attendance.length}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Stipends Paid</span>
                    <p className="text-2xl font-bold">
                      {stipends.filter(s => s.paymentStatus === 'paid').length}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Donations</span>
                    <p className="text-2xl font-bold">{donations.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Current Balance</span>
                    <p className="text-xl font-bold">{formatCurrency(Number(fund.currentBalance))}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Stipends</span>
                    <p className="text-xl font-bold">
                      {formatCurrency(stipends.reduce((sum, s) => sum + s.totalAmount, 0))}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Donations</span>
                    <p className="text-xl font-bold">
                      {formatCurrency(donations.reduce((sum, d) => sum + d.amount, 0))}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Net Outflow</span>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(
                        stipends.reduce((sum, s) => sum + s.totalAmount, 0) -
                        donations.reduce((sum, d) => sum + d.amount, 0)
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
