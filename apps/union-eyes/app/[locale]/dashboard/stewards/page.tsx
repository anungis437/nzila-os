export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, AlertCircle, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Chief Steward Dashboard | UnionEyes",
  description: "Steward supervision and case management tools",
};

export default async function StewardsDashboardPage() {
  const _user = await requireUser();
  
  // Require chief_steward level (70) to access
  const hasAccess = await hasMinRole("chief_steward");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Mock data - replace with actual API calls
  const stewardStats = {
    totalStewards: 12,
    activeCases: 45,
    pendingEscalations: 8,
    completedThisMonth: 23,
    successRate: 87.5,
    upcomingTraining: 2
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chief Steward Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Supervise stewards and manage case escalations
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stewards</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.totalStewards}</div>
            <p className="text-xs text-muted-foreground">Active stewards</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.activeCases}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalations</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.pendingEscalations}</div>
            <p className="text-xs text-amber-500">Require review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.completedThisMonth}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.successRate}%</div>
            <p className="text-xs text-green-500">+5% vs last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.upcomingTraining}</div>
            <p className="text-xs text-muted-foreground">Upcoming sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Steward Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Steward Performance</CardTitle>
            <CardDescription>Case handling statistics by steward</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "John Smith", active: 8, completed: 15, successRate: 92 },
                { name: "Sarah Johnson", active: 6, completed: 12, successRate: 89 },
                { name: "Michael Chen", active: 5, completed: 10, successRate: 85 },
                { name: "Emily Davis", active: 7, completed: 14, successRate: 88 },
              ].map((steward, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{steward.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {steward.active} active • {steward.completed} completed
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700">
                    {steward.successRate}% success
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Escalations */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Escalations</CardTitle>
            <CardDescription>Cases requiring chief steward review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: "G-2026-045", member: "Alex Brown", steward: "John Smith", reason: "Requires arbitration decision" },
                { id: "G-2026-042", member: "Lisa Wong", steward: "Sarah Johnson", reason: "Complex interpretation issue" },
                { id: "G-2026-038", member: "David Lee", steward: "Michael Chen", reason: "Management escalation" },
              ].map((escalation, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{escalation.id}</Badge>
                    <Badge variant="secondary" className="text-amber-700">Escalated</Badge>
                  </div>
                  <div>
                    <div className="font-medium">Member: {escalation.member}</div>
                    <div className="text-sm text-muted-foreground">
                      Steward: {escalation.steward}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {escalation.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
