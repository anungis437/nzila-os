export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, CheckCircle, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Audits & Compliance | UnionEyes",
  description: "Financial audits and compliance tracking",
};

export default async function AuditsPage() {
  const _user = await requireUser();
  
  // Require at least officer level (60) to view audits
  const hasAccess = await hasMinRole("officer");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Mock data - replace with actual API calls
  const audits = [
    {
      id: "1",
      title: "Annual Financial Audit 2025",
      type: "Financial",
      status: "completed",
      dateCompleted: "2026-01-15",
      auditor: "Smith & Associates",
      findings: 0,
      hasReport: true
    },
    {
      id: "2",
      title: "Q4 2025 Internal Review",
      type: "Internal",
      status: "completed",
      dateCompleted: "2025-12-20",
      auditor: "Internal Audit Committee",
      findings: 2,
      hasReport: true
    },
    {
      id: "3",
      title: "Compliance Review 2026",
      type: "Compliance",
      status: "in-progress",
      dateScheduled: "2026-03-01",
      auditor: "Labor Board",
      findings: 0,
      hasReport: false
    },
    {
      id: "4",
      title: "Membership Verification",
      type: "Membership",
      status: "scheduled",
      dateScheduled: "2026-04-15",
      auditor: "External Auditor",
      findings: 0,
      hasReport: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "in-progress": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "scheduled": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Financial": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "Internal": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "Compliance": return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "Membership": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audits & Compliance</h1>
          <p className="text-muted-foreground mt-2">
            Financial audits, compliance reviews, and organizational oversight
          </p>
        </div>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Audit
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audits.length}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audits.filter(a => a.status === "completed").length}
            </div>
            <p className="text-xs text-green-500">All clear</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audits.filter(a => a.status === "in-progress").length}
            </div>
            <p className="text-xs text-muted-foreground">Active reviews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audits.filter(a => a.status === "scheduled").length}
            </div>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
      </div>

      {/* Audits List */}
      <div className="grid gap-4">
        {audits.map((audit) => (
          <Card key={audit.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{audit.title}</CardTitle>
                    <Badge variant="outline" className={getTypeColor(audit.type)}>
                      {audit.type}
                    </Badge>
                  </div>
                  <CardDescription>
                    Auditor: {audit.auditor}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={getStatusColor(audit.status)}>
                  {audit.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {audit.dateCompleted && `Completed: ${new Date(audit.dateCompleted).toLocaleDateString()}`}
                    {audit.dateScheduled && `Scheduled: ${new Date(audit.dateScheduled).toLocaleDateString()}`}
                  </div>
                  {audit.findings > 0 && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      {audit.findings} finding{audit.findings !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                {audit.hasReport && (
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download Report
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
