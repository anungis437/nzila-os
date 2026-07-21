"use client";

/**
 * CUPE 4373 demo — member-facing views.
 *
 * These components render a strictly member-scoped surface (no steward-only
 * data, no internal notes, no other members' files) for use in the demo
 * runtime when the logged-in user resolves to the `member` experience.
 *
 * The components are intentionally lighter than the steward consoles: they
 * surface "what's mine, what's next" and the publicly-shareable agreement
 * documents — and nothing else.
 */

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Button } from "@nzila/union-eyes-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nzila/union-eyes-ui/card";
import type { DemoCase, DemoDocument, InboxItem } from "@/lib/demo/cupe4373-demo";
import type { DemoMemberPersona } from "@/lib/demo/cupe4373-member-view";

const urgencyStyles: Record<DemoCase["urgency"], string> = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function MemberHeader({
  persona,
  title,
  description,
}: {
  persona: DemoMemberPersona;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge
            variant="outline"
            className="mb-3 border-emerald-200 bg-emerald-50 text-emerald-800"
          >
            Member view · {persona.displayName}
          </Badge>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-medium text-slate-700">{persona.role}</p>
          <p>{persona.unit}</p>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inbox
// ────────────────────────────────────────────────────────────────────────────

export function Cupe4373MemberInboxPage({
  persona,
  items,
  memberCases,
}: {
  persona: DemoMemberPersona;
  items: InboxItem[];
  memberCases: DemoCase[];
}) {
  const caseLookup = new Map(memberCases.map((c) => [c.id, c]));
  const messages = items.filter(
    (i) => i.channel === "member-message" || i.channel === "case",
  );
  const alerts = items.filter((i) => i.channel === "operational-alert");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MemberHeader
        persona={persona}
        title="Your inbox"
        description="Messages you've sent to your steward and updates on the files that involve you. Steward-only items, federation bulletins, and other members' files are not shown here."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryTile
          icon={MessageSquare}
          label="Messages sent"
          value={messages.length}
          tone="slate"
        />
        <SummaryTile
          icon={AlertTriangle}
          label="Updates on your files"
          value={alerts.length}
          tone={alerts.length > 0 ? "amber" : "slate"}
        />
        <SummaryTile
          icon={ClipboardList}
          label="Open files"
          value={memberCases.filter((c) => c.status !== "Closed").length}
          tone="slate"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-500" />
                Your messages
              </CardTitle>
              <CardDescription>
                Questions and intake notes you&apos;ve shared with your steward.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="#">
                <HelpCircle className="mr-1 h-4 w-4" />
                Ask your steward
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No messages yet"
              body="When you send a question to your steward it will appear here."
            />
          ) : (
            messages.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Sent {formatDateTime(item.received)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.body}</p>
                {item.linkedCaseId && caseLookup.has(item.linkedCaseId) ? (
                  <div className="mt-3 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span>
                      Linked to file <strong>{item.linkedCaseId}</strong>:{" "}
                      {caseLookup.get(item.linkedCaseId)?.title}
                    </span>
                    <Link
                      href={`/dashboard/cases/${item.linkedCaseId}`}
                      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Updates on your files
          </CardTitle>
          <CardDescription>
            Reminders and deadlines tied to files you&apos;re part of.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No updates right now"
              body="You&apos;ll see deadline reminders here when one of your files needs attention."
            />
          ) : (
            alerts.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-amber-200 bg-amber-50 p-4"
              >
                <p className="text-sm font-medium text-amber-900">
                  {item.subject}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {formatDateTime(item.received)}
                </p>
                <p className="mt-2 text-sm text-amber-900">{item.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cases
// ────────────────────────────────────────────────────────────────────────────

export function Cupe4373MemberCasesConsole({
  persona,
  cases,
}: {
  persona: DemoMemberPersona;
  cases: DemoCase[];
}) {
  const open = cases.filter((c) => c.status !== "Closed");
  const closed = cases.filter((c) => c.status === "Closed");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MemberHeader
        persona={persona}
        title="My files"
        description="Files where you are the member of record. You can see the status, the next step, and your steward — internal steward notes and other members' files are not shown here."
      />

      <Card>
        <CardHeader>
          <CardTitle>Open ({open.length})</CardTitle>
          <CardDescription>Files currently being worked on with your steward.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {open.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No open files"
              body="When your steward opens a file on your behalf it will appear here."
            />
          ) : (
            open.map((c) => <MemberCaseRow key={c.id} c={c} />)
          )}
        </CardContent>
      </Card>

      {closed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Closed ({closed.length})</CardTitle>
            <CardDescription>Files that have been resolved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {closed.map((c) => (
              <MemberCaseRow key={c.id} c={c} />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MemberCaseRow({ c }: { c: DemoCase }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{c.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            File {c.id} · Opened {formatDate(c.opened)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={urgencyStyles[c.urgency]}>
            {c.urgency}
          </Badge>
          <Badge variant="outline">{c.status}</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">{c.summary}</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
        <p>
          <span className="font-medium text-slate-800">Your steward:</span>{" "}
          {c.assignedSteward}
        </p>
        <p className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-800">Next step:</span>{" "}
          {c.nextStep}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Documents
// ────────────────────────────────────────────────────────────────────────────

export function Cupe4373MemberDocumentsPage({
  persona,
  documents,
}: {
  persona: DemoMemberPersona;
  documents: DemoDocument[];
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MemberHeader
        persona={persona}
        title="Documents"
        description="Collective agreement, memorandums, and meeting minutes shared with the bargaining unit. Case files and privileged steward documents are not shown here."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            Shared with members ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              body="Public documents shared with the bargaining unit will appear here."
            />
          ) : (
            documents.map((d) => (
              <div
                key={d.id}
                className="rounded-md border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {d.fileType} · Updated {formatDate(d.lastUpdated)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {d.category.replace(/-/g, " ")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{d.description}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────────────

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Mail;
  label: string;
  value: number;
  tone: "slate" | "amber";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-white text-slate-900";
  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Mail;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <Icon className="h-6 w-6 text-slate-400" />
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </div>
  );
}
