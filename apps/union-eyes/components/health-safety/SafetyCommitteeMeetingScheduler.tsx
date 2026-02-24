/**
 * Safety Committee Meeting Scheduler Component
 * 
 * Schedules and manages health & safety committee meetings with:
 * - Meeting calendar view
 * - Recurring meetings support
 * - Attendance tracking
 * - Agenda management
 * - Meeting minutes integration
 * 
 * @module components/health-safety/SafetyCommitteeMeetingScheduler
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
  Calendar as CalendarIcon, 
  Users, 
  Plus,
  Clock,
  MapPin,
  FileText,
  Video
} from "lucide-react";
import { format } from "date-fns";

export interface SafetyMeeting {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: string;
  type: "regular" | "special" | "emergency";
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  attendees?: string[];
  agenda?: string[];
  minutesUrl?: string;
  isVirtual: boolean;
  meetingLink?: string;
}

export interface SafetyCommitteeMeetingSchedulerProps {
  organizationId: string;
  onScheduleMeeting?: () => void;
  onViewMeeting?: (meetingId: string) => void;
}

export function SafetyCommitteeMeetingScheduler({
  organizationId,
  onScheduleMeeting,
  onViewMeeting
}: SafetyCommitteeMeetingSchedulerProps) {
  const { toast } = useToast();
  const [meetings, setMeetings] = React.useState<SafetyMeeting[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadMeetings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function loadMeetings() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/health-safety/committee/meetings?organizationId=${organizationId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load meetings");
      }

      const data = await response.json();
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMeetings(data.meetings.map((m: any) => ({
          ...m,
          date: new Date(m.date)
        })));
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load committee meetings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const upcomingMeetings = meetings
    .filter(m => m.status === "scheduled" && m.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const pastMeetings = meetings
    .filter(m => m.status === "completed" || (m.status === "scheduled" && m.date < new Date()))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "scheduled":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      case "cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "emergency":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      case "special":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
      case "regular":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingMeetings.length}</div>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => {
                const now = new Date();
                return m.date.getMonth() === now.getMonth() && 
                       m.date.getFullYear() === now.getFullYear();
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Total meetings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {meetings.filter(m => m.status === "completed").length}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Upcoming Meetings
              </CardTitle>
              <CardDescription>
                Scheduled safety committee meetings
              </CardDescription>
            </div>
            {onScheduleMeeting && (
              <Button size="sm" onClick={onScheduleMeeting}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No upcoming meetings scheduled</p>
              {onScheduleMeeting && (
                <Button size="sm" className="mt-4" onClick={onScheduleMeeting}>
                  Schedule First Meeting
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{meeting.title}</h3>
                          <Badge className={getTypeColor(meeting.type)}>
                            {meeting.type}
                          </Badge>
                          <Badge className={getStatusColor(meeting.status)}>
                            {meeting.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(meeting.date, "PPP")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {meeting.time}
                          </div>
                          <div className="flex items-center gap-2">
                            {meeting.isVirtual ? (
                              <>
                                <Video className="h-4 w-4" />
                                Virtual Meeting
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4" />
                                {meeting.location}
                              </>
                            )}
                          </div>
                          {meeting.attendees && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>

                        {meeting.agenda && meeting.agenda.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs font-medium mb-1">Agenda:</p>
                            <ul className="text-xs text-muted-foreground list-disc list-inside">
                              {meeting.agenda.slice(0, 3).map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                              {meeting.agenda.length > 3 && (
                                <li>... and {meeting.agenda.length - 3} more items</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewMeeting?.(meeting.id)}
                        >
                          View Details
                        </Button>
                        {meeting.isVirtual && meeting.meetingLink && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => window.open(meeting.meetingLink, '_blank')}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Meetings</CardTitle>
            <CardDescription>
              View meeting history and minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meeting</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Minutes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastMeetings.slice(0, 10).map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell className="font-medium">{meeting.title}</TableCell>
                      <TableCell>{format(meeting.date, "MMM dd, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getTypeColor(meeting.type)}>
                          {meeting.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(meeting.status)}>
                          {meeting.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {meeting.minutesUrl ? (
                          <a
                            href={meeting.minutesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not available</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewMeeting?.(meeting.id)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
