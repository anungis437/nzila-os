"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  FileText,
  CheckSquare,
  Lightbulb,
  Users,
  Clock,
  AlertTriangle,
  Plus,
  ChevronLeft,
  Globe,
  Building,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ──────────────────────────────────────────────────────────────────

interface CommitteeDetail {
  id: string;
  name: string;
  committeeType: string;
  status: string;
  mandate: string | null;
  meetingFrequency: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  currentMemberCount: number;
  maxMembers: number | null;
  scope?: string | null;
  externalParticipants?: Array<{ name: string; organization: string; role?: string }> | null;
}

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
  minutes: string | null;
  minutesApprovedAt: string | null;
  attendeeCount: number;
  decisions: Array<{ description: string; outcome: string }> | null;
}

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  dueDate: string | null;
  carryCount: number | null;
}

interface CommitteeDoc {
  id: string;
  title: string;
  fileUrl: string | null;
  fileType: string | null;
  category: string | null;
  createdAt: string;
}

interface Stats {
  totalMeetings: number;
  upcomingMeetings: number;
  openActionItems: number;
  overdueActionItems: number;
  totalDocuments: number;
}

interface CommitteeWorkspaceProps {
  committeeId: string;
  organizationId: string;
  userId: string;
  userRole: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CommitteeWorkspace({
  committeeId,
  organizationId,
  userId,
  userRole,
}: CommitteeWorkspaceProps) {
  const [committee, setCommittee] = useState<CommitteeDetail | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [documents, setDocuments] = useState<CommitteeDoc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const canEdit = ["steward", "officer", "chief_steward", "secretary_treasurer",
    "vice_president", "president", "clerk", "platform_ops"].includes(userRole);

  // Fetch committee details
  const fetchCommittee = useCallback(async () => {
    try {
      const res = await fetch(`/api/committees/${committeeId}`);
      const json = await res.json();
      setCommittee(json?.data?.data ?? json?.data ?? json);
    } catch {
      // Committee fetch failed
    }
  }, [committeeId]);

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(`/api/committees/${committeeId}/meetings`);
      const json = await res.json();
      setMeetings(json?.data?.data ?? json?.data ?? []);
    } catch {
      // Meetings fetch failed
    }
  }, [committeeId]);

  // Fetch action items
  const fetchActionItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/committees/${committeeId}/action-items`);
      const json = await res.json();
      setActionItems(json?.data?.data ?? json?.data ?? []);
    } catch {
      // Action items fetch failed
    }
  }, [committeeId]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/committees/${committeeId}/documents`);
      const json = await res.json();
      setDocuments(json?.data?.data ?? json?.data ?? []);
    } catch {
      // Documents fetch failed
    }
  }, [committeeId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchCommittee(), fetchMeetings(), fetchActionItems(), fetchDocuments()]);
      setLoading(false);
    }
    load();
  }, [fetchCommittee, fetchMeetings, fetchActionItems, fetchDocuments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!committee) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Committee not found.</p>;
  }

  const scopeBadge = committee.scope
    ? { internal: "Internal", external: "External", national: "National", joint: "Joint" }[committee.scope] ?? committee.scope
    : null;

  const overdueItems = actionItems.filter(
    (i) => i.dueDate && new Date(i.dueDate) < new Date() && ["pending", "in_progress"].includes(i.status)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ChevronLeft size={16} />
            </Button>
            <h1 className="text-3xl font-bold">{committee.name}</h1>
          </div>
          <div className="flex items-center gap-2 ml-9">
            <Badge variant="outline" className="capitalize">{committee.committeeType?.replace(/_/g, " ") ?? committee.committeeType}</Badge>
            {scopeBadge && (
              <Badge variant="secondary" className="gap-1">
                {committee.scope === "national" || committee.scope === "external" ? (
                  <Globe size={12} />
                ) : (
                  <Building size={12} />
                )}
                {scopeBadge}
              </Badge>
            )}
            <Badge
              variant={committee.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {committee.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Overdue action items alert */}
      {overdueItems.length > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="text-orange-500" size={20} />
            <span className="text-sm font-medium">
              {overdueItems.length} overdue action item{overdueItems.length > 1 ? "s" : ""} need attention
            </span>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar size={14} />
              <span>Meetings</span>
            </div>
            <p className="text-2xl font-bold mt-1">{meetings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckSquare size={14} />
              <span>Open Items</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {actionItems.filter((i) => ["pending", "in_progress"].includes(i.status)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText size={14} />
              <span>Documents</span>
            </div>
            <p className="text-2xl font-bold mt-1">{documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users size={14} />
              <span>Members</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {committee.currentMemberCount}
              {committee.maxMembers ? ` / ${committee.maxMembers}` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed workspace */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Committee Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {committee.mandate && (
                  <div>
                    <span className="font-medium text-muted-foreground">Mandate</span>
                    <p className="mt-1">{committee.mandate}</p>
                  </div>
                )}
                {committee.meetingFrequency && (
                  <div>
                    <span className="font-medium text-muted-foreground">Meeting Schedule</span>
                    <p className="mt-1">
                      {committee.meetingFrequency}
                      {committee.meetingDay ? ` — ${committee.meetingDay}` : ""}
                      {committee.meetingTime ? ` at ${committee.meetingTime}` : ""}
                    </p>
                  </div>
                )}
                {committee.meetingLocation && (
                  <div>
                    <span className="font-medium text-muted-foreground">Location</span>
                    <p className="mt-1">{committee.meetingLocation}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* External participants for national/external committees */}
            {committee.externalParticipants && committee.externalParticipants.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">External Participants</CardTitle>
                  <CardDescription>Organizations and stakeholders involved</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {committee.externalParticipants.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2">— {p.organization}</span>
                        </div>
                        {p.role && <Badge variant="outline" className="text-xs">{p.role}</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent meetings */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Recent Meetings</CardTitle>
                {canEdit && (
                  <Button size="sm" variant="outline" className="gap-1">
                    <Plus size={14} /> Schedule
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {meetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No meetings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {meetings.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(m.meetingDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.minutes && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <FileText size={10} />
                              {m.minutesApprovedAt ? "Approved" : "Draft"}
                            </Badge>
                          )}
                          <Badge
                            variant={m.status === "completed" ? "default" : "secondary"}
                            className="capitalize text-xs"
                          >
                            {m.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open action items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Open Action Items</CardTitle>
                <Badge variant={overdueItems.length > 0 ? "destructive" : "secondary"} className="text-xs">
                  {actionItems.filter((i) => ["pending", "in_progress"].includes(i.status)).length} open
                </Badge>
              </CardHeader>
              <CardContent>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No action items.</p>
                ) : (
                  <div className="space-y-3">
                    {actionItems
                      .filter((i) => ["pending", "in_progress"].includes(i.status))
                      .slice(0, 5)
                      .map((item) => {
                        const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                            <div className="flex-1">
                              <p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                                {item.title}
                              </p>
                              {item.dueDate && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock size={10} />
                                  Due: {new Date(item.dueDate).toLocaleDateString()}
                                  {(item.carryCount ?? 0) > 0 && (
                                    <span className="text-orange-500">(carried {item.carryCount}x)</span>
                                  )}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={item.priority === "urgent" ? "destructive" : item.priority === "high" ? "default" : "outline"}
                              className="capitalize text-xs"
                            >
                              {item.priority}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Meetings ─────────────────────────────────────────────── */}
        <TabsContent value="meetings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Meeting History</CardTitle>
                <CardDescription>Minutes repository and meeting records</CardDescription>
              </div>
              {canEdit && (
                <Button size="sm" className="gap-1">
                  <Plus size={14} /> Schedule Meeting
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No meetings recorded yet. Schedule the first meeting to get started.
                </p>
              ) : (
                <div className="space-y-4">
                  {meetings.map((m) => (
                    <Card key={m.id} className="border">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold">{m.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(m.meetingDate).toLocaleDateString("en-CA", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                            {m.attendeeCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {m.attendeeCount} attendee{m.attendeeCount > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {m.minutes ? (
                              <Badge variant={m.minutesApprovedAt ? "default" : "outline"} className="gap-1">
                                <FileText size={12} />
                                {m.minutesApprovedAt ? "Minutes Approved" : "Minutes Draft"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">No Minutes</Badge>
                            )}
                            <Badge variant="outline" className="capitalize">{m.status}</Badge>
                          </div>
                        </div>

                        {/* Decisions summary */}
                        {m.decisions && m.decisions.length > 0 && (
                          <div className="mt-3 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Decisions</p>
                            <ul className="text-sm space-y-1">
                              {m.decisions.map((d, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <Badge
                                    variant={d.outcome === "carried" ? "default" : "secondary"}
                                    className="capitalize text-xs"
                                  >
                                    {d.outcome}
                                  </Badge>
                                  <span>{d.description}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Minutes preview */}
                        {m.minutes && (
                          <div className="mt-3 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Minutes</p>
                            <p className="text-sm whitespace-pre-wrap line-clamp-4">{m.minutes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Action Items ─────────────────────────────────────────── */}
        <TabsContent value="action-items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Action Items</CardTitle>
                <CardDescription>Tasks, follow-ups, and next steps</CardDescription>
              </div>
              {canEdit && (
                <Button size="sm" className="gap-1">
                  <Plus size={14} /> New Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No action items yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {actionItems.map((item) => {
                    const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && ["pending", "in_progress"].includes(item.status);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium text-sm ${isOverdue ? "text-destructive" : ""}`}>
                              {item.title}
                            </p>
                            {(item.carryCount ?? 0) > 0 && (
                              <Badge variant="outline" className="text-xs text-orange-500">
                                Carried {item.carryCount}x
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {item.dueDate && (
                              <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                                <Clock size={10} />
                                {new Date(item.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              item.status === "completed" ? "default" :
                              item.status === "in_progress" ? "secondary" :
                              "outline"
                            }
                            className="capitalize text-xs"
                          >
                            {item.status?.replace(/_/g, " ") ?? item.status}
                          </Badge>
                          <Badge
                            variant={item.priority === "urgent" ? "destructive" : item.priority === "high" ? "default" : "outline"}
                            className="capitalize text-xs"
                          >
                            {item.priority}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ─────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Document Repository</CardTitle>
                <CardDescription>Meeting minutes, reports, policies, and reference materials</CardDescription>
              </div>
              {canEdit && (
                <Button size="sm" className="gap-1">
                  <Plus size={14} /> Upload
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileType ? doc.fileType.toUpperCase() : "Document"}
                            {" · "}
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {doc.category && (
                        <Badge variant="outline" className="capitalize text-xs">{doc.category}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Intelligence ─────────────────────────────────────────── */}
        <TabsContent value="intelligence">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb size={20} className="text-yellow-500" />
                <div>
                  <CardTitle>Cross-Committee Intelligence</CardTitle>
                  <CardDescription>
                    AI-powered synthesis across committee minutes for a unified organizational voice
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-yellow-50 dark:bg-yellow-950/20 flex items-center justify-center">
                  <Lightbulb size={28} className="text-yellow-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Intelligence Synthesis</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Gather minutes across all your NLMCCs and UMCCs to identify key themes,
                    positions, and build a cohesive voice for your organization. The AI can analyze
                    what&apos;s been happening in committees you&apos;re not directly part of and surface
                    actionable intelligence.
                  </p>
                </div>
                {canEdit && (
                  <Button className="gap-2">
                    <Lightbulb size={14} /> Generate Intelligence Report
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
