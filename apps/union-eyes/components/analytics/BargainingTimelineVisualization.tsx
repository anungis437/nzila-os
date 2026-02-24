/**
 * Bargaining Timeline Visualization Component
 * 
 * Interactive timeline display for bargaining notes and negotiation history.
 * Shows chronological progression of negotiations with filtering and detail views.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, FileText, Tag, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface BargainingNote {
  id: string;
  cbaId: string;
  cbaNumber: string;
  employerName: string;
  unionName: string;
  sessionDate: string;
  sessionType: 'initial_meeting' | 'negotiation' | 'mediation' | 'arbitration' | 'ratification';
  summary: string;
  detailedNotes: string;
  attendees: string[];
  keyIssues: string[];
  proposalsMade: string[];
  agreements: string[];
  outstandingIssues: string[];
  nextSteps: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: BargainingNote['sessionType'];
  cba: string;
  summary: string;
  keyIssues: string[];
  tags: string[];
  hasAgreements: boolean;
  hasOutstandingIssues: boolean;
}

interface BargainingTimelineVisualizationProps {
  cbaId?: string;
  organizationId?: string;
  limit?: number;
}

export function BargainingTimelineVisualization({
  cbaId,
  organizationId,
  limit = 50,
}: BargainingTimelineVisualizationProps) {
  const [notes, setNotes] = useState<BargainingNote[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<BargainingNote | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

  useEffect(() => {
    fetchBargainingNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cbaId, organizationId, filterType]);

  const fetchBargainingNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (cbaId) params.append('cbaId', cbaId);
      if (organizationId) params.append('organizationId', organizationId);
      params.append('limit', limit.toString());
      params.append('timeline', 'true');

      const response = await fetch(`/api/bargaining-notes?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch bargaining notes');

      const data = await response.json();
      const fetchedNotes = data.notes || [];
      setNotes(fetchedNotes);

      // Transform notes into timeline events
      const timelineEvents: TimelineEvent[] = fetchedNotes.map((note: BargainingNote) => ({
        id: note.id,
        date: note.sessionDate,
        type: note.sessionType,
        cba: `${note.employerName} - ${note.unionName}`,
        summary: note.summary,
        keyIssues: note.keyIssues,
        tags: note.tags,
        hasAgreements: note.agreements.length > 0,
        hasOutstandingIssues: note.outstandingIssues.length > 0,
      }));

      // Filter by session type if selected
      const filtered = filterType === 'all' 
        ? timelineEvents 
        : timelineEvents.filter(event => event.type === filterType);

      setEvents(filtered);
    } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const getSessionTypeColor = (type: BargainingNote['sessionType']): string => {
    switch (type) {
      case 'initial_meeting':
        return 'bg-blue-500';
      case 'negotiation':
        return 'bg-purple-500';
      case 'mediation':
        return 'bg-yellow-500';
      case 'arbitration':
        return 'bg-red-500';
      case 'ratification':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSessionTypeLabel = (type: BargainingNote['sessionType']): string => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Bargaining Timeline
              </CardTitle>
              <CardDescription>
                Chronological view of negotiation sessions and key events
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="initial_meeting">Initial Meetings</SelectItem>
                  <SelectItem value="negotiation">Negotiations</SelectItem>
                  <SelectItem value="mediation">Mediations</SelectItem>
                  <SelectItem value="arbitration">Arbitrations</SelectItem>
                  <SelectItem value="ratification">Ratifications</SelectItem>
                </SelectContent>
              </Select>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'timeline' | 'grid')}>
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="grid">Grid</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card>
          <CardContent className="pt-6">
            {events.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bargaining sessions found</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-8">
                  {events.map((event, _index) => {
                    const note = notes.find(n => n.id === event.id);
                    const isSelected = selectedEvent?.id === event.id;

                    return (
                      <div key={event.id} className="relative pl-20">
                        {/* Timeline dot */}
                        <div className={`absolute left-6 top-2 h-5 w-5 rounded-full border-4 border-background ${getSessionTypeColor(event.type)}`} />

                        {/* Event card */}
                        <Card 
                          className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => setSelectedEvent(isSelected ? null : note || null)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              {/* Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge className={getSessionTypeColor(event.type)}>
                                      {getSessionTypeLabel(event.type)}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      <Clock className="inline h-3 w-3 mr-1" />
                                      {format(new Date(event.date), 'MMM dd, yyyy')}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({formatDistanceToNow(new Date(event.date), { addSuffix: true })})
                                    </span>
                                  </div>
                                  <h4 className="font-semibold text-sm">{event.cba}</h4>
                                </div>
                                <div className="flex gap-2">
                                  {event.hasAgreements && (
                                    <Badge variant="outline" className="text-green-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Agreements
                                    </Badge>
                                  )}
                                  {event.hasOutstandingIssues && (
                                    <Badge variant="outline" className="text-yellow-600">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Outstanding
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Summary */}
                              <p className="text-sm">{event.summary}</p>

                              {/* Key Issues */}
                              {event.keyIssues.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {event.keyIssues.slice(0, 3).map((issue, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {issue}
                                    </Badge>
                                  ))}
                                  {event.keyIssues.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{event.keyIssues.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Expanded details */}
                              {isSelected && note && (
                                <div className="mt-4 pt-4 border-t space-y-3">
                                  {note.detailedNotes && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1">Detailed Notes</h5>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {note.detailedNotes}
                                      </p>
                                    </div>
                                  )}

                                  {note.attendees.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1 flex items-center gap-1">
                                        <Users className="h-4 w-4" />
                                        Attendees
                                      </h5>
                                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                                        {note.attendees.map((attendee, i) => (
                                          <li key={i}>{attendee}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {note.proposalsMade.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1">Proposals Made</h5>
                                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                                        {note.proposalsMade.map((proposal, i) => (
                                          <li key={i}>{proposal}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {note.agreements.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1 text-green-600">
                                        <CheckCircle className="inline h-4 w-4 mr-1" />
                                        Agreements Reached
                                      </h5>
                                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                                        {note.agreements.map((agreement, i) => (
                                          <li key={i}>{agreement}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {note.outstandingIssues.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1 text-yellow-600">
                                        <AlertCircle className="inline h-4 w-4 mr-1" />
                                        Outstanding Issues
                                      </h5>
                                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                                        {note.outstandingIssues.map((issue, i) => (
                                          <li key={i}>{issue}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {note.nextSteps.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1">Next Steps</h5>
                                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                                        {note.nextSteps.map((step, i) => (
                                          <li key={i}>{step}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {note.tags.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1 flex items-center gap-1">
                                        <Tag className="h-4 w-4" />
                                        Tags
                                      </h5>
                                      <div className="flex flex-wrap gap-1">
                                        {note.tags.map((tag, i) => (
                                          <Badge key={i} variant="outline" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => {
            const _note = notes.find(n => n.id === event.id);
            return (
              <Card key={event.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getSessionTypeColor(event.type)}>
                      {getSessionTypeLabel(event.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <CardTitle className="text-sm">{event.cba}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{event.summary}</p>
                  {event.keyIssues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.keyIssues.slice(0, 2).map((issue, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {issue}
                        </Badge>
                      ))}
                      {event.keyIssues.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{event.keyIssues.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Statistics */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { type: 'initial_meeting', label: 'Initial Meetings' },
              { type: 'negotiation', label: 'Negotiations' },
              { type: 'mediation', label: 'Mediations' },
              { type: 'arbitration', label: 'Arbitrations' },
              { type: 'ratification', label: 'Ratifications' },
            ].map(({ type, label }) => {
              const count = notes.filter(n => n.sessionType === type).length;
              return (
                <div key={type} className="text-center">
                  <div className={`h-2 w-full rounded-full ${getSessionTypeColor(type as BargainingNote['sessionType'])} mb-2`} />
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

