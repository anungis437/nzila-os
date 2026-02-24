/**
 * Election Schedule Calendar Component
 * 
 * Calendar view for elections with:
 * - Timeline visualization
 * - Important dates
 * - Election periods
 * - Deadline tracking
 * - Notifications
 * 
 * @module components/voting/election-schedule-calendar
 */

"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, isWithinInterval, addDays } from "date-fns";
import { cn } from "@/lib/utils";

export interface Election {
  id: string;
  title: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  nominationStart?: Date;
  nominationEnd?: Date;
  votingStart: Date;
  votingEnd: Date;
  resultsDate?: Date;
  type: "officer" | "contract" | "referendum" | "other";
}

export interface ElectionScheduleCalendarProps {
  elections: Election[];
  onSelectElection?: (election: Election) => void;
}

export function ElectionScheduleCalendar({
  elections,
  onSelectElection,
}: ElectionScheduleCalendarProps) {
  const [selectedDate, _setSelectedDate] = React.useState<Date>(new Date());

  // Get elections for selected date
  const _electionsOnDate = elections.filter((election) => {
    return (
      (election.nominationStart && isSameDay(election.nominationStart, selectedDate)) ||
      (election.nominationEnd && isSameDay(election.nominationEnd, selectedDate)) ||
      isSameDay(election.votingStart, selectedDate) ||
      isSameDay(election.votingEnd, selectedDate) ||
      (election.resultsDate && isSameDay(election.resultsDate, selectedDate)) ||
      isWithinInterval(selectedDate, {
        start: election.votingStart,
        end: election.votingEnd,
      })
    );
  });

  // Upcoming elections (next 30 days)
  const upcomingElections = elections.filter((election) => {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);
    return (
      election.status === "upcoming" &&
      election.votingStart >= now &&
      election.votingStart <= thirtyDaysFromNow
    );
  });

  // Active elections
  const activeElections = elections.filter((e) => e.status === "active");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <PlayCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeElections.length}</div>
                <div className="text-sm text-gray-600">Active Now</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{upcomingElections.length}</div>
                <div className="text-sm text-gray-600">Upcoming (30d)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {elections.filter((e) => e.status === "completed").length}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Elections */}
      {activeElections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Active Elections - Vote Now!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeElections.map((election) => (
              <ElectionItem
                key={election.id}
                election={election}
                onClick={() => onSelectElection?.(election)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Election Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {elections
              .sort((a, b) => a.votingStart.getTime() - b.votingStart.getTime())
              .map((election) => (
                <ElectionTimeline key={election.id} election={election} />
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Elections */}
      {upcomingElections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Elections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingElections.map((election) => (
              <ElectionItem
                key={election.id}
                election={election}
                onClick={() => onSelectElection?.(election)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ElectionItem({
  election,
  onClick,
}: {
  election: Election;
  onClick: () => void;
}) {
  const getStatusConfig = (status: Election["status"]) => {
    switch (status) {
      case "active":
        return { label: "Active", variant: "success" as const, icon: PlayCircle };
      case "upcoming":
        return { label: "Upcoming", variant: "default" as const, icon: Clock };
      case "completed":
        return { label: "Completed", variant: "secondary" as const, icon: CheckCircle2 };
      default:
        return { label: status, variant: "secondary" as const, icon: AlertCircle };
    }
  };

  const statusConfig = getStatusConfig(election.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">{election.title}</h3>
            <Badge variant={statusConfig.variant}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <Badge variant="outline">{election.type}</Badge>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" />
              <span>
                Voting: {format(election.votingStart, "MMM d")} -{" "}
                {format(election.votingEnd, "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ElectionTimeline({ election }: { election: Election }) {
  const now = new Date();

  const phases = [
    election.nominationStart && {
      label: "Nominations Open",
      date: election.nominationStart,
      isPast: election.nominationStart < now,
    },
    election.nominationEnd && {
      label: "Nominations Close",
      date: election.nominationEnd,
      isPast: election.nominationEnd < now,
    },
    {
      label: "Voting Opens",
      date: election.votingStart,
      isPast: election.votingStart < now,
    },
    {
      label: "Voting Closes",
      date: election.votingEnd,
      isPast: election.votingEnd < now,
    },
    election.resultsDate && {
      label: "Results Announced",
      date: election.resultsDate,
      isPast: election.resultsDate < now,
    },
  ].filter(Boolean);

  return (
    <div>
      <h4 className="font-semibold mb-3">{election.title}</h4>
      <div className="relative pl-6 space-y-4">
        {/* Vertical line */}
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {phases.map((phase: any, index) => (
          <div key={index} className="relative">
            <div
              className={cn(
                "absolute left-[-1.3rem] w-5 h-5 rounded-full border-2 bg-white",
                phase.isPast
                  ? "border-green-500"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  : index === phases.findIndex((p: any) => !p.isPast)
                  ? "border-blue-500"
                  : "border-gray-300"
              )}
            >
              {phase.isPast && (
                <CheckCircle2 className="absolute inset-0 h-full w-full text-green-500" />
              )}
            </div>
            <div>
              <div className={cn("font-medium", phase.isPast && "text-green-600")}>
                {phase.label}
              </div>
              <div className="text-sm text-gray-600">{format(phase.date, "PPP")}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

