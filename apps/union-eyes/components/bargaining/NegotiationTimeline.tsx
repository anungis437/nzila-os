/**
 * Negotiation Timeline Component
 * 
 * Visual timeline of bargaining sessions, proposals, and key milestones.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, FileText, AlertCircle } from "lucide-react";
 
import { format } from "date-fns";

interface TimelineEvent {
  id: string;
  type: "session" | "proposal" | "agreement" | "milestone";
  title: string;
  description?: string;
  date: string;
  status?: string;
  icon?: React.ReactNode;
}

interface NegotiationTimelineProps {
  negotiationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proposals?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agreements?: any[];
}

export function NegotiationTimeline({
  negotiationId: _negotiationId,
  sessions = [],
  proposals = [],
  agreements = [],
}: NegotiationTimelineProps) {
  // Combine all events into timeline
  const timelineEvents: TimelineEvent[] = [
    ...sessions.map(s => ({
      id: s.id,
      type: "session" as const,
      title: `Session ${s.sessionNumber}: ${s.title}`,
      description: s.summary,
      date: s.scheduledDate || s.actualStartDate,
      status: s.status,
      icon: <Calendar className="h-4 w-4" />,
    })),
    ...proposals.map(p => ({
      id: p.id,
      type: "proposal" as const,
      title: `Proposal: ${p.title}`,
      description: `${p.proposalType} - ${p.status}`,
      date: p.submittedDate || p.createdAt,
      status: p.status,
      icon: <FileText className="h-4 w-4" />,
    })),
    ...agreements.map(a => ({
      id: a.id,
      type: "agreement" as const,
      title: `Tentative Agreement: ${a.title}`,
      description: `Category: ${a.clauseCategory}`,
      date: a.agreedDate,
      status: a.ratified ? 'ratified' : 'pending',
      icon: <CheckCircle className="h-4 w-4" />,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getEventColor = (type: string, status?: string) => {
    if (type === "agreement") {
      return status === "ratified" ? "border-green-500" : "border-purple-500";
    }
    if (type === "session") {
      return status === "completed" ? "border-blue-500" : "border-gray-500";
    }
    if (type === "proposal") {
      if (status === "accepted") return "border-green-500";
      if (status === "rejected") return "border-red-500";
      return "border-yellow-500";
    }
    return "border-gray-300";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Negotiation Timeline</CardTitle>
        <CardDescription>
          Chronological view of all bargaining activities
        </CardDescription>
      </CardHeader>
      <CardContent>
        {timelineEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4" />
            <p>No timeline events yet</p>
            <p className="text-sm">Events will appear as sessions and proposals are added</p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
            
            {timelineEvents.map((event, _index) => (
              <div key={event.id} className="relative pl-16">
                {/* Timeline dot */}
                <div className={`absolute left-6 top-2 h-4 w-4 rounded-full border-2 bg-background ${getEventColor(event.type, event.status)}`} />
                
                {/* Event card */}
                <div className={`border-l-2 pl-4 pb-4 ${getEventColor(event.type, event.status)}`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {event.icon}
                        <h4 className="font-semibold">{event.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {event.type}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <time className="text-sm text-muted-foreground">
                      {format(new Date(event.date), "MMM d, yyyy")}
                    </time>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
