"use client";

/**
 * Committee Workspace
 *
 * One committee, read from four routes: GET /api/committees/{id} (the CRUD item route: { data: row }) and the committee's meetings, action
 * items and documents (each answers withApi's { success, data: [rows] }). Each is read strictly. A section that could not be read is
 * said so, with the route's reason and a retry, and its figures are dashes: it is never shown as "No meetings yet" or as a count of zero.
 *
 * Meetings, action items and documents are shown, not written: no screen schedules a meeting, adds an item or uploads a document yet, and
 * the AI synthesis across committees is not built, so none of those is offered here.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import {
  Calendar,
  FileText,
  CheckSquare,
  Users,
  Clock,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { envelopeRow, readApiError } from "@/lib/client/api-envelope";
import { formatDay } from "@/lib/client/day";
import { ApiShapeError, asRecord, countOrNull, humanize, isRecord, optionalString, requiredDate, requiredString } from "@/lib/client/row-fields";

// ── Rows ───────────────────────────────────────────────────────────────────

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
  /** A count someone recorded by hand: null when nobody has. */
  currentMemberCount: number | null;
  maxMembers: number | null;
}

interface Decision {
  /** jsonb: the write schema takes any string, so an empty one is a stored value, not a malformed record. */
  description: string;
  outcome: string | null;
}

interface Meeting {
  id: string;
  title: string;
  meetingDate: Date;
  status: string;
  minutes: string | null;
  minutesApproved: boolean;
  attendeeCount: number | null;
  decisions: Decision[];
}

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  /** A calendar day (YYYY-MM-DD), not an instant. */
  dueDate: string | null;
  carryCount: number | null;
}

interface CommitteeDoc {
  id: string;
  title: string;
  fileType: string | null;
  category: string | null;
  /** The column is nullable: a document nobody dated has no date. */
  createdAt: Date | null;
}

const OPEN_STATUSES = ["pending", "in_progress"];

function toCommittee(row: Record<string, unknown>): CommitteeDetail {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    committeeType: requiredString(row, "committeeType"),
    status: requiredString(row, "status"),
    mandate: optionalString(row, "mandate"),
    meetingFrequency: optionalString(row, "meetingFrequency"),
    meetingDay: optionalString(row, "meetingDay"),
    meetingTime: optionalString(row, "meetingTime"),
    meetingLocation: optionalString(row, "meetingLocation"),
    currentMemberCount: countOrNull(row, "currentMemberCount"),
    maxMembers: countOrNull(row, "maxMembers"),
  };
}

function toDecisions(value: unknown): Decision[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new ApiShapeError("decisions is not a list");
  return value.map((entry) => {
    const decision = asRecord(entry, "decision");
    if (typeof decision.description !== "string") throw new ApiShapeError("description is missing");
    return { description: decision.description, outcome: optionalString(decision, "outcome") };
  });
}

function toMeeting(raw: unknown): Meeting {
  const row = asRecord(raw, "meeting");
  return {
    id: requiredString(row, "id"),
    title: requiredString(row, "title"),
    meetingDate: requiredDate(row, "meetingDate"),
    status: requiredString(row, "status"),
    minutes: optionalString(row, "minutes"),
    minutesApproved: optionalString(row, "minutesApprovedAt") !== null,
    attendeeCount: countOrNull(row, "attendeeCount"),
    decisions: toDecisions(row.decisions),
  };
}

function toActionItem(raw: unknown): ActionItem {
  const row = asRecord(raw, "action item");
  return {
    id: requiredString(row, "id"),
    title: requiredString(row, "title"),
    description: optionalString(row, "description"),
    status: requiredString(row, "status"),
    priority: requiredString(row, "priority"),
    dueDate: optionalString(row, "dueDate"),
    carryCount: countOrNull(row, "carryCount"),
  };
}

function toDocument(raw: unknown): CommitteeDoc {
  const row = asRecord(raw, "document");
  return {
    id: requiredString(row, "id"),
    title: requiredString(row, "title"),
    fileType: optionalString(row, "fileType"),
    category: optionalString(row, "category"),
    createdAt: row.createdAt === null ? null : requiredDate(row, "createdAt"),
  };
}

// ── Reading ────────────────────────────────────────────────────────────────

class ReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ReadError";
  }
}

async function readBody(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) throw new ReadError(await readApiError(response, `Request failed with status ${response.status}`), response.status);
  return response.json();
}

/** The rows of a route whose handler returns a plain list, which withApi sends as { success, data: [rows] }. */
function plainRows(body: unknown): unknown[] {
  if (isRecord(body) && Array.isArray(body.data)) return body.data;
  throw new ApiShapeError("no list");
}

type Section<T> = { status: "loading" } | { status: "ready"; rows: T[] } | { status: "failed"; message: string };
type CommitteeSection = { status: "loading" } | { status: "ready"; committee: CommitteeDetail } | { status: "failed"; message: string; notFound: boolean };

interface Workspace {
  committeeId: string;
  committee: CommitteeSection;
  meetings: Section<Meeting>;
  actionItems: Section<ActionItem>;
  documents: Section<CommitteeDoc>;
}

const initialWorkspace = (committeeId: string): Workspace => ({
  committeeId,
  committee: { status: "loading" },
  meetings: { status: "loading" },
  actionItems: { status: "loading" },
  documents: { status: "loading" },
});

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "");

/** What the meetings route returns when no limit is asked for: at most this many, most recent first. */
const MEETINGS_PAGE = 50;

// ── Dates ──────────────────────────────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, "0");
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const isOpen = (item: ActionItem) => OPEN_STATUSES.includes(item.status);
const isOverdue = (item: ActionItem) => item.dueDate !== null && isOpen(item) && item.dueDate.slice(0, 10) < todayIso();

// ── Component ──────────────────────────────────────────────────────────────

interface CommitteeWorkspaceProps {
  committeeId: string;
  organizationId: string;
  userId: string;
  userRole: string;
}

function SectionFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-destructive">Could not be loaded{message ? `: ${message}` : "."}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** A figure on its way is "…" and one that could not be read is "—": neither is shown as a count of zero. */
function figureOf<T>(section: Section<T>, value: (rows: T[]) => string): string {
  if (section.status === "loading") return "…";
  return section.status === "ready" ? value(section.rows) : "—";
}

function Stat({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent role="group" aria-label={label} className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold mt-1">{children}</p>
      </CardContent>
    </Card>
  );
}

export function CommitteeWorkspace({
  committeeId,
  organizationId: _organizationId,
  userId: _userId,
  userRole: _userRole,
}: CommitteeWorkspaceProps) {
  const locale = useLocale();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let current = true;
    const update = (patch: Partial<Workspace>) =>
      setWorkspace((previous) => ({ ...(previous?.committeeId === committeeId ? previous : initialWorkspace(committeeId)), ...patch }));
    const id = encodeURIComponent(committeeId);

    readBody(`/api/committees/${id}`).then(
      (body) => {
        if (current) update({ committee: { status: "ready", committee: toCommittee(envelopeRow(body)) } });
      },
      (error: unknown) => {
        logger.error("Failed to load committee", error);
        if (current) update({ committee: { status: "failed", message: messageOf(error), notFound: error instanceof ReadError && error.status === 404 } });
      },
    ).catch((error: unknown) => {
      // A committee that arrived in a shape this page cannot read.
      logger.error("Failed to read committee", error);
      if (current) update({ committee: { status: "failed", message: messageOf(error), notFound: false } });
    });

    const list = <T,>(path: string, read: (raw: unknown) => T, put: (section: Section<T>) => Partial<Workspace>) => {
      readBody(path).then(
        (body) => {
          if (current) update(put({ status: "ready", rows: plainRows(body).map(read) }));
        },
        (error: unknown) => {
          logger.error(`Failed to load ${path}`, error);
          if (current) update(put({ status: "failed", message: messageOf(error) }));
        },
      ).catch((error: unknown) => {
        logger.error(`Failed to read ${path}`, error);
        if (current) update(put({ status: "failed", message: messageOf(error) }));
      });
    };
    list(`/api/committees/${id}/meetings`, toMeeting, (meetings) => ({ meetings }));
    list(`/api/committees/${id}/action-items`, toActionItem, (actionItems) => ({ actionItems }));
    list(`/api/committees/${id}/documents`, toDocument, (documents) => ({ documents }));

    return () => {
      current = false;
    };
  }, [committeeId, reloadKey]);

  const retry = () => {
    setWorkspace(null);
    setReloadKey((key) => key + 1);
  };

  // What was read for another committee is not shown for this one.
  const view = workspace?.committeeId === committeeId ? workspace : initialWorkspace(committeeId);
  const { committee: committeeSection, meetings, actionItems, documents } = view;

  if (committeeSection.status === "loading") {
    return (
      <div role="status" aria-label="Loading committee" className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (committeeSection.status === "failed") {
    return committeeSection.notFound ? (
      <p className="text-sm text-muted-foreground py-8 text-center">Committee not found.</p>
    ) : (
      <SectionFailed message={committeeSection.message} onRetry={retry} />
    );
  }

  const committee = committeeSection.committee;
  const openItems = actionItems.status === "ready" ? actionItems.rows.filter(isOpen) : null;
  const overdueItems = actionItems.status === "ready" ? actionItems.rows.filter(isOverdue) : [];

  const meetingsFigure = figureOf(meetings, (rows) => (rows.length >= MEETINGS_PAGE ? `${rows.length}+` : String(rows.length)));
  const openItemsFigure = figureOf(actionItems, (rows) => String(rows.filter(isOpen).length));
  const documentsFigure = figureOf(documents, (rows) => String(rows.length));

  const sectionBody = <T,>(section: Section<T>, empty: string, render: (rows: T[]) => ReactNode) => {
    if (section.status === "loading") return <p className="text-sm text-muted-foreground py-8 text-center">…</p>;
    if (section.status === "failed") return <SectionFailed message={section.message} onRetry={retry} />;
    return section.rows.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{empty}</p> : render(section.rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" aria-label="Back" onClick={() => window.history.back()}>
              <ChevronLeft size={16} />
            </Button>
            <h1 className="text-3xl font-bold">{committee.name}</h1>
          </div>
          <div className="flex items-center gap-2 ml-9">
            <Badge variant="outline" className="capitalize">{humanize(committee.committeeType)}</Badge>
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
              {overdueItems.length === 1 ? "1 overdue action item needs" : `${overdueItems.length} overdue action items need`} attention
            </span>
          </CardContent>
        </Card>
      )}

      {/* Stats cards: a figure that could not be read is a dash, never a zero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Calendar size={14} />} label="Meetings">
          {meetingsFigure}
        </Stat>
        <Stat icon={<CheckSquare size={14} />} label="Open Items">
          {openItemsFigure}
        </Stat>
        <Stat icon={<FileText size={14} />} label="Documents">
          {documentsFigure}
        </Stat>
        <Stat icon={<Users size={14} />} label="Members">
          {committee.currentMemberCount ?? "—"}
          {committee.maxMembers !== null ? ` / ${committee.maxMembers}` : ""}
        </Stat>
      </div>

      {/* Tabbed workspace */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
                {!committee.mandate && !committee.meetingFrequency && !committee.meetingLocation && (
                  <p className="text-muted-foreground">No mandate or meeting schedule is recorded.</p>
                )}
              </CardContent>
            </Card>

            {/* Recent meetings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Meetings</CardTitle>
              </CardHeader>
              <CardContent>
                {sectionBody(meetings, "No meetings yet.", (rows) => (
                  <div className="space-y-3">
                    {rows.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.meetingDate.toLocaleDateString(locale)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.minutes && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <FileText size={10} />
                              {m.minutesApproved ? "Approved" : "Draft"}
                            </Badge>
                          )}
                          <Badge
                            variant={m.status === "completed" ? "default" : "secondary"}
                            className="capitalize text-xs"
                          >
                            {humanize(m.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Open action items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Open Action Items</CardTitle>
                {openItems !== null && (
                  <Badge variant={overdueItems.length > 0 ? "destructive" : "secondary"} className="text-xs">
                    {openItems.length} open
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {sectionBody(actionItems, "No action items.", (rows) => {
                  const open = rows.filter(isOpen);
                  return open.length > 0 ? (
                    <div className="space-y-3">
                      {open.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                          <div className="flex-1">
                            <p className={`font-medium ${isOverdue(item) ? "text-destructive" : ""}`}>
                              {item.title}
                            </p>
                            {item.dueDate && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock size={10} />
                                Due: {formatDay(item.dueDate, locale, "numeric")}
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
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No open action items.</p>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Meetings ─────────────────────────────────────────────── */}
        <TabsContent value="meetings">
          <Card>
            <CardHeader>
              <CardTitle>Meeting History</CardTitle>
              <CardDescription>Minutes repository and meeting records</CardDescription>
            </CardHeader>
            <CardContent>
              {sectionBody(meetings, "No meetings recorded yet.", (rows) => (
                <div className="space-y-4">
                  {rows.map((m) => (
                    <Card key={m.id} className="border">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold">{m.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {m.meetingDate.toLocaleDateString(locale, {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                            {m.attendeeCount !== null && m.attendeeCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {m.attendeeCount} attendee{m.attendeeCount > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {m.minutes ? (
                              <Badge variant={m.minutesApproved ? "default" : "outline"} className="gap-1">
                                <FileText size={12} />
                                {m.minutesApproved ? "Minutes Approved" : "Minutes Draft"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">No Minutes</Badge>
                            )}
                            <Badge variant="outline" className="capitalize">{humanize(m.status)}</Badge>
                          </div>
                        </div>

                        {/* Decisions summary */}
                        {m.decisions.length > 0 && (
                          <div className="mt-3 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Decisions</p>
                            <ul className="text-sm space-y-1">
                              {m.decisions.map((d, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  {d.outcome && (
                                    <Badge
                                      variant={d.outcome === "carried" ? "default" : "secondary"}
                                      className="capitalize text-xs"
                                    >
                                      {d.outcome}
                                    </Badge>
                                  )}
                                  <span>{d.description || <span className="italic text-muted-foreground">No description recorded</span>}</span>
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
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Action Items ─────────────────────────────────────────── */}
        <TabsContent value="action-items">
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>Open tasks, follow-ups, and next steps</CardDescription>
            </CardHeader>
            <CardContent>
              {sectionBody(actionItems, "No action items yet.", (rows) => (
                <div className="space-y-3">
                  {rows.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm ${isOverdue(item) ? "text-destructive" : ""}`}>
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
                            <span className={`flex items-center gap-1 ${isOverdue(item) ? "text-destructive font-medium" : ""}`}>
                              <Clock size={10} />
                              {formatDay(item.dueDate, locale, "numeric")}
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
                          {humanize(item.status)}
                        </Badge>
                        <Badge
                          variant={item.priority === "urgent" ? "destructive" : item.priority === "high" ? "default" : "outline"}
                          className="capitalize text-xs"
                        >
                          {item.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ─────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Document Repository</CardTitle>
              <CardDescription>Meeting minutes, reports, policies, and reference materials</CardDescription>
            </CardHeader>
            <CardContent>
              {sectionBody(documents, "No documents are linked to this committee yet.", (rows) => (
                <div className="space-y-3">
                  {rows.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileType ? doc.fileType.toUpperCase() : "Document"}
                            {doc.createdAt ? ` · ${doc.createdAt.toLocaleDateString(locale)}` : ""}
                          </p>
                        </div>
                      </div>
                      {doc.category && (
                        <Badge variant="outline" className="capitalize text-xs">{doc.category}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
