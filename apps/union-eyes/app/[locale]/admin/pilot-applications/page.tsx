/**
 * Admin Pilot Applications Management Page
 * 
 * Review and manage pilot program applications.
 * 
 * Features:
 * - List all applications with readiness scores
 * - Filter by status
 * - Approve/reject with notes
 * - Email notifications (future)
 */


export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { pilotApplications } from '@/db/schema/domains/marketing';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import PilotApplicationActions from '@/components/admin/pilot-application-actions';

interface AdminPilotApplicationsPageProps {
  searchParams: {
    status?: 'submitted' | 'review' | 'approved' | 'active' | 'completed' | 'declined';
  };
}

export default async function AdminPilotApplicationsPage({
  searchParams,
}: AdminPilotApplicationsPageProps) {
  const { status } = searchParams;

  // Build query
  const query = status ? eq(pilotApplications.status, status) : undefined;

  // Fetch applications
  const applications = await db
    .select()
    .from(pilotApplications)
    .where(query)
    .orderBy(desc(pilotApplications.submittedAt))
    .limit(100);

  // Calculate statistics
  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === 'submitted' || a.status === 'review').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    active: applications.filter((a) => a.status === 'active').length,
    completed: applications.filter((a) => a.status === 'completed').length,
    rejected: applications.filter((a) => a.status === 'declined').length,
  };

  // Calculate average readiness score
  const avgReadiness =
    applications.length > 0
      ? Math.round(
          applications.reduce((sum, a) => sum + Number(a.readinessScore || 0), 0) /
            applications.length
        )
      : 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Pilot Applications</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage pilot program applications
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} variant="warning" />
        <StatCard label="Approved" value={stats.approved} variant="success" />
        <StatCard label="Active" value={stats.active} variant="primary" />
        <StatCard label="Completed" value={stats.completed} variant="secondary" />
        <StatCard label="Rejected" value={stats.rejected} variant="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Average Readiness Score</CardTitle>
          <CardDescription>
            Across all applications ({applications.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{avgReadiness}/100</div>
          <p className="text-sm text-muted-foreground mt-2">
            {avgReadiness >= 80
              ? 'Excellent - Most applicants are well-prepared'
              : avgReadiness >= 60
              ? 'Good - Most applicants need some support'
              : 'Fair - Most applicants need significant support'}
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Select defaultValue={status || 'all'}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Applications ({applications.length})</CardTitle>
          <CardDescription>
            Click on an application to view full details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No applications found with this filter
                  </TableCell>
                </TableRow>
              )}
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="font-medium">
                    {application.organizationName}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{application.contactName}</div>
                      <div className="text-muted-foreground">
                        {application.contactEmail}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{application.memberCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {application.readinessScore}/100
                      </div>
                      <Badge
                        variant={
                          Number(application.readinessScore || 0) >= 80
                            ? 'default'
                            : Number(application.readinessScore || 0) >= 50
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {Number(application.readinessScore || 0) >= 80 ? 'high' : Number(application.readinessScore || 0) >= 50 ? 'medium' : 'low'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        application.status === 'approved' ||
                        application.status === 'active'
                          ? 'default'
                          : application.status === 'submitted' || application.status === 'review'
                          ? 'secondary'
                          : application.status === 'completed'
                          ? 'outline'
                          : 'destructive'
                      }
                    >
                      {application.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(application.submittedAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <PilotApplicationActions application={application as any} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'secondary' | 'primary' | 'destructive';
}) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    secondary: 'bg-gray-50 border-gray-200',
    primary: 'bg-blue-50 border-blue-200',
    destructive: 'bg-red-50 border-red-200',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
