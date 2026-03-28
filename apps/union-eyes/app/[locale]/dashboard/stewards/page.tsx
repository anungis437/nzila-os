export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, TrendingUp, AlertCircle, Calendar, Star } from "lucide-react";
import Link from "next/link";

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

  // Fetch steward stats from API
  let stewardStats = {
    totalStewards: 0,
    activeCases: 0,
    pendingEscalations: 0,
    completedThisMonth: 0,
    successRate: 0,
    upcomingTraining: 0
  };
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const res = await fetch(`${baseUrl}/api/v2/stewards/stats`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      stewardStats = { ...stewardStats, ...json };
    }
  } catch {
    // API not available — empty state
  }

  // Fetch steward performance and escalations
  let stewardPerformance: { name: string; active: number; completed: number; successRate: number }[] = [];
  let pendingEscalationsList: { id: string; member: string; steward: string; reason: string }[] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const perfRes = await fetch(`${baseUrl}/api/v2/stewards/performance`, { cache: 'no-store' });
    if (perfRes.ok) {
      const json = await perfRes.json();
      stewardPerformance = Array.isArray(json) ? json : json?.data ?? [];
    }
    const escRes = await fetch(`${baseUrl}/api/v2/stewards/escalations`, { cache: 'no-store' });
    if (escRes.ok) {
      const json = await escRes.json();
      pendingEscalationsList = Array.isArray(json) ? json : json?.data ?? [];
    }
  } catch {
    // API not available — empty state
  }

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
        {/* LRO Satisfaction Ratings Link */}
        <div className="md:col-span-2">
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium">LRO Satisfaction Ratings</p>
                  <p className="text-sm text-muted-foreground">
                    View member feedback and performance rankings for all representatives
                  </p>
                </div>
              </div>
              <Link href="/dashboard/stewards/ratings">
                <Button variant="outline" size="sm">
                  View Ratings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Steward Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Steward Performance</CardTitle>
            <CardDescription>Case handling statistics by steward</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stewardPerformance.map((steward, idx) => (
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
              {pendingEscalationsList.map((escalation, idx) => (
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
