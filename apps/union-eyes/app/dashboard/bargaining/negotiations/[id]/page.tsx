/**
 * Single Negotiation View Page
 * 
 * Detailed view of a specific negotiation with all related data:
 * - Negotiation details and timeline
 * - Proposals (union demands and management offers)
 * - Tentative agreements
 * - Bargaining team
 * - Session notes
 */


export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Users, FileText, CheckCircle, Settings } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ProposalManager } from "@/components/bargaining/ProposalManager";
import { NegotiationTimeline } from "@/components/bargaining/NegotiationTimeline";
import { ProposalComparisonTool } from "@/components/bargaining/ProposalComparisonTool";
import { TentativeAgreementViewer } from "@/components/bargaining/TentativeAgreementViewer";
import { BargainingTeamList } from "@/components/bargaining/BargainingTeamList";
import { ProposalStatusTracker } from "@/components/bargaining/ProposalStatusTracker";
import { NegotiationSessionNotes } from "@/components/bargaining/NegotiationSessionNotes";
import { logger } from '@/lib/logger';

interface PageProps {
  params: { id: string };
}

async function fetchNegotiationData(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/bargaining/negotiations/${id}`, {
      cache: "no-store",
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch negotiation");
    }
    
    return response.json();
  } catch (error) {
    logger.error("Error fetching negotiation:", error);
    return null;
  }
}

async function NegotiationDetailContent({ params }: PageProps) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const data = await fetchNegotiationData(params.id);
  
  if (!data) {
    notFound();
  }

  const { negotiation, proposals, tentativeAgreements, sessions, teamMembers, statistics } = data;

  const statusColors: Record<string, string> = {
    scheduled: "bg-gray-500",
    active: "bg-blue-500",
    impasse: "bg-orange-500",
    conciliation: "bg-yellow-500",
    tentative: "bg-purple-500",
    ratified: "bg-green-500",
    rejected: "bg-red-500",
    strike_lockout: "bg-red-700",
    completed: "bg-green-700",
    abandoned: "bg-gray-700",
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Scheduled",
    active: "Active",
    impasse: "Impasse",
    conciliation: "Conciliation",
    tentative: "Tentative Agreement",
    ratified: "Ratified",
    rejected: "Rejected",
    strike_lockout: "Strike/Lockout",
    completed: "Completed",
    abandoned: "Abandoned",
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/bargaining">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{negotiation.title}</h1>
            <Badge className={statusColors[negotiation.status]}>
              {statusLabels[negotiation.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {negotiation.unionName} vs {negotiation.employerName}
          </p>
        </div>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Edit Negotiation
        </Button>
      </div>

      {/* Key Information Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              First Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {negotiation.firstSessionDate
                ? format(new Date(negotiation.firstSessionDate), "MMM d, yyyy")
                : "Not scheduled"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Proposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{statistics.totalProposals}</p>
            <p className="text-sm text-muted-foreground">
              {statistics.acceptedProposals} accepted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Agreements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{statistics.tentativeAgreements}</p>
            <p className="text-sm text-muted-foreground">
              {statistics.ratifiedAgreements} ratified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{statistics.teamSize}</p>
            <p className="text-sm text-muted-foreground">
              {statistics.totalSessions} sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="agreements">Tentative Agreements</TabsTrigger>
          <TabsTrigger value="team">Bargaining Team</TabsTrigger>
          <TabsTrigger value="notes">Session Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Negotiation Details */}
          <Card>
            <CardHeader>
              <CardTitle>Negotiation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {negotiation.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{negotiation.description}</p>
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Union</h4>
                  <p className="text-sm">
                    {negotiation.unionName}
                    {negotiation.unionLocal && <span className="text-muted-foreground"> • Local {negotiation.unionLocal}</span>}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Employer</h4>
                  <p className="text-sm">{negotiation.employerName}</p>
                </div>
                {negotiation.bargainingUnitSize && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Bargaining Unit Size</h4>
                    <p className="text-sm">{negotiation.bargainingUnitSize} members</p>
                  </div>
                )}
                {negotiation.targetCompletionDate && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Target Completion</h4>
                    <p className="text-sm">
                      {format(new Date(negotiation.targetCompletionDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>

              {negotiation.keyIssues && negotiation.keyIssues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Key Issues</h4>
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {negotiation.keyIssues.map((issue: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{issue.issue}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{issue.priority}</Badge>
                          <Badge>{issue.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <ProposalStatusTracker proposals={proposals} />
            <NegotiationTimeline
              negotiationId={negotiation.id}
              sessions={sessions}
              proposals={proposals}
              agreements={tentativeAgreements}
            />
          </div>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-6">
          <ProposalManager negotiationId={negotiation.id} />
          <ProposalComparisonTool proposals={proposals} />
        </TabsContent>

        <TabsContent value="agreements">
          <TentativeAgreementViewer agreements={tentativeAgreements} />
        </TabsContent>

        <TabsContent value="team">
          <BargainingTeamList teamMembers={teamMembers} />
        </TabsContent>

        <TabsContent value="notes">
          <NegotiationSessionNotes
            negotiationId={negotiation.id}
            cbaId={negotiation.expiringCbaId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NegotiationDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<LoadingNegotiation />}>
      <NegotiationDetailContent params={params} />
    </Suspense>
  );
}

function LoadingNegotiation() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      
      <Skeleton className="h-[600px]" />
    </div>
  );
}
