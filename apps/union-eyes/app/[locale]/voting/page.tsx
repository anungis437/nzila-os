"use client";

export const dynamic = 'force-dynamic';

/**
 * Voting & Elections Page
 * 
 * Comprehensive elections management interface integrating:
 * - Ballot builder for creating elections
 * - Vote casting interface
 * - Election results dashboard
 * - Election schedule calendar
 * - Voter eligibility manager
 * - Election audit log
 * 
 * @page app/[locale]/voting/page.tsx
 */

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BallotBuilder } from "@/components/voting/ballot-builder";
import { VoteCastingInterface } from "@/components/voting/vote-casting-interface";
import { ElectionResultsDashboard } from "@/components/voting/election-results-dashboard";
import { ElectionScheduleCalendar } from "@/components/voting/election-schedule-calendar";
import { VoterEligibilityManager } from "@/components/voting/voter-eligibility-manager";
import { ElectionAuditLog } from "@/components/voting/election-audit-log";

export default function VotingPage() {
  const [showBallotBuilder, setShowBallotBuilder] = React.useState(false);
  const [activeElectionId, setActiveElectionId] = React.useState<string | null>(null);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voting & Elections</h1>
          <p className="text-gray-600 mt-2">
            Participate in elections, view results, and manage voting processes
          </p>
        </div>
        <Button onClick={() => setShowBallotBuilder(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Election
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Elections</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeElectionId ? (
            <VoteCastingInterface
              ballot={{
                id: activeElectionId,
                title: "Sample Election",
                description: "",
                questions: [],
                isAnonymous: false,
                requiresVerification: false,
                allowsAbstain: false,
              }}
              onSubmit={async (_votes) => {
setActiveElectionId(null);
              }}
              onCancel={() => setActiveElectionId(null)}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No active elections at this time</p>
              <Button variant="link" onClick={() => setActiveElectionId("demo-election")}>
                View Sample Election
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results">
          <ElectionResultsDashboard
            results={{
              id: "",
              title: "No Results",
              status: "upcoming",
              startDate: new Date(),
              endDate: new Date(),
              totalEligibleVoters: 0,
              totalVotesCast: 0,
              turnoutPercentage: 0,
              questions: [],
            }}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <ElectionScheduleCalendar
            elections={[]}
            onSelectElection={(election) => setActiveElectionId(election.id)}
          />
        </TabsContent>

        <TabsContent value="eligibility">
          <VoterEligibilityManager
            electionId=""
            electionTitle="Voter Eligibility"
            members={[]}
          />
        </TabsContent>

        <TabsContent value="audit">
          <ElectionAuditLog
            electionId=""
            electionTitle="Election Audit"
            entries={[]}
          />
        </TabsContent>
      </Tabs>

      {/* Ballot Builder Modal */}
      {showBallotBuilder && (
        <BallotBuilder
          onSave={async (_ballot) => {
setShowBallotBuilder(false);
          }}
          onCancel={() => setShowBallotBuilder(false)}
        />
      )}
    </div>
  );
}
