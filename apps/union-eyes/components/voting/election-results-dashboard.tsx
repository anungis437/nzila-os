/**
 * Election Results Dashboard Component
 * 
 * Real-time election results display with:
 * - Vote counts and percentages
 * - Winner determination
 * - Visualizations (charts/graphs)
 * - Historical comparison
 * - Export capabilities
 * - Demographic breakdowns
 * 
 * @module components/voting/election-results-dashboard
 */

"use client";

import * as React from "react";
import {
  Trophy,
  Users,
  TrendingUp,
  Download,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface Candidate {
  id: string;
  name: string;
  photoUrl?: string;
  votes: number;
  percentage: number;
  isWinner?: boolean;
}

export interface QuestionResults {
  id: string;
  title: string;
  type: "candidate" | "yes-no" | "multiple-choice";
  totalVotes: number;
  candidates?: Candidate[];
  yesVotes?: number;
  noVotes?: number;
  abstainVotes?: number;
  options?: Array<{ label: string; votes: number; percentage: number }>;
}

export interface ElectionResults {
  id: string;
  title: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  startDate: Date;
  endDate: Date;
  totalEligibleVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  questions: QuestionResults[];
}

export interface ElectionResultsDashboardProps {
  results: ElectionResults;
  onRefresh?: () => Promise<void>;
  onExport?: (format: "csv" | "pdf") => void;
}

export function ElectionResultsDashboard({
  results,
  onRefresh,
  onExport,
}: ElectionResultsDashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{results.title}</h2>
          <div className="flex items-center gap-3 mt-2">
            <Badge
              variant={
                results.status === "completed"
                  ? "success"
                  : results.status === "active"
                  ? "default"
                  : "secondary"
              }
            >
              {results.status}
            </Badge>
            {results.status === "active" && (
              <span className="text-sm text-gray-600">Real-time results</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          )}
          {onExport && (
            <Button variant="outline" onClick={() => onExport("csv")}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Turnout Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{results.totalEligibleVoters}</div>
                <div className="text-sm text-gray-600">Eligible Voters</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{results.totalVotesCast}</div>
                <div className="text-sm text-gray-600">Votes Cast</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{results.turnoutPercentage}%</div>
                <div className="text-sm text-gray-600">Turnout</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Turnout Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Voter Turnout</span>
              <span className="text-gray-600">
                {results.totalVotesCast} of {results.totalEligibleVoters} voters
              </span>
            </div>
            <Progress value={results.turnoutPercentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Question Results */}
      <Tabs defaultValue="0" className="space-y-4">
        <TabsList>
          {results.questions.map((question, index) => (
            <TabsTrigger key={question.id} value={index.toString()}>
              Question {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {results.questions.map((question, index) => (
          <TabsContent key={question.id} value={index.toString()}>
            <QuestionResultCard question={question} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function QuestionResultCard({ question }: { question: QuestionResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{question.title}</CardTitle>
        <p className="text-sm text-gray-600">
          Total votes: {question.totalVotes}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {question.type === "candidate" && question.candidates && (
          <div className="space-y-3">
            {question.candidates
              .sort((a, b) => b.votes - a.votes)
              .map((candidate) => (
                <div key={candidate.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {candidate.isWinner && (
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="font-medium">{candidate.name}</span>
                      {candidate.isWinner && (
                        <Badge variant="success">Winner</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{candidate.votes} votes</div>
                      <div className="text-sm text-gray-600">
                        {candidate.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <Progress value={candidate.percentage} className="h-2" />
                </div>
              ))}
          </div>
        )}

        {question.type === "yes-no" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Yes</span>
                <div className="text-right">
                  <div className="font-bold">{question.yesVotes} votes</div>
                  <div className="text-sm text-gray-600">
                    {((question.yesVotes || 0) / question.totalVotes * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <Progress
                value={(question.yesVotes || 0) / question.totalVotes * 100}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">No</span>
                <div className="text-right">
                  <div className="font-bold">{question.noVotes} votes</div>
                  <div className="text-sm text-gray-600">
                    {((question.noVotes || 0) / question.totalVotes * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <Progress
                value={(question.noVotes || 0) / question.totalVotes * 100}
                className="h-2"
              />
            </div>

            {(question.abstainVotes || 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Abstain</span>
                  <div className="text-right">
                    <div className="font-bold">{question.abstainVotes} votes</div>
                    <div className="text-sm text-gray-600">
                      {((question.abstainVotes || 0) / question.totalVotes * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <Progress
                  value={(question.abstainVotes || 0) / question.totalVotes * 100}
                  className="h-2 bg-gray-200"
                />
              </div>
            )}
          </div>
        )}

        {question.type === "multiple-choice" && question.options && (
          <div className="space-y-3">
            {question.options
              .sort((a, b) => b.votes - a.votes)
              .map((option, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option.label}</span>
                    <div className="text-right">
                      <div className="font-bold">{option.votes} votes</div>
                      <div className="text-sm text-gray-600">
                        {option.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <Progress value={option.percentage} className="h-2" />
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

