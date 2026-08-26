"use client";

/**
 * Cupe 4373 Communications — Foundation-tier "continuity-safe communication" surface.
 *
 * Sent broadcast log + demo-only compose sheet. Every broadcast is attributable,
 * audience-scoped, and bound to the retention policy. Demo composing queues to
 * session state with a clear "would send to N members in production" notice.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Mail,
  MessageSquare,
  Megaphone,
  Pin,
  PlusCircle,
  Radio,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Button } from "@nzila/union-eyes-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nzila/union-eyes-ui/card";
import { Label } from "@nzila/union-eyes-ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@nzila/union-eyes-ui/sheet";
import { Textarea } from "@nzila/union-eyes-ui/textarea";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373DoctrineFooter } from "@/components/demo/cupe4373-doctrine-footer";
import {
  broadcastHistory,
  broadcastTemplates,
  retentionPolicy,
  type BroadcastMessage,
} from "@/lib/demo/cupe4373-demo";

const STORAGE_KEY = "ue-demo-queued-broadcasts";

const channelIcons: Record<BroadcastMessage["channel"], typeof Mail> = {
  email: Mail,
  sms: Radio,
  "bulletin-board": Pin,
};

const audienceSizes: Record<string, number> = {
  "All members": 612,
  "Stewards only": 14,
  "Acute care services": 38,
  "Long-Term Care": 95,
  "5 East": 32,
  "Emergency Department": 47,
};

const audienceOptions = Object.keys(audienceSizes);

type DraftBroadcast = {
  id: string;
  queuedAt: string;
  audience: string;
  audienceCount: number;
  subject: string;
  body: string;
  channel: BroadcastMessage["channel"];
};

export function Cupe4373CommunicationsPage() {
  const [drafts, setDrafts] = useState<DraftBroadcast[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    audience: "All members",
    channel: "email" as BroadcastMessage["channel"],
    subject: "",
    body: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (raw) setDrafts(JSON.parse(raw) as DraftBroadcast[]);
      } catch {
        /* no-op */
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function persist(next: DraftBroadcast[]) {
    setDrafts(next);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* no-op */
    }
  }

  function queueBroadcast() {
    if (!form.subject.trim() || !form.body.trim()) return;
    const draft: DraftBroadcast = {
      id: `BR-DRAFT-${String(drafts.length + 1).padStart(3, "0")}`,
      queuedAt: new Date().toISOString(),
      audience: form.audience,
      audienceCount: audienceSizes[form.audience] ?? 0,
      subject: form.subject.trim(),
      body: form.body.trim(),
      channel: form.channel,
    };
    persist([draft, ...drafts]);
    setForm({ audience: "All members", channel: "email", subject: "", body: "" });
    setOpen(false);
  }

  function applyTemplate(templateId: string) {
    const tpl = broadcastTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setForm((f) => ({ ...f, body: tpl.body }));
  }

  const totals = useMemo(() => {
    const sent = broadcastHistory.length;
    const queued = drafts.length;
    const recipients =
      broadcastHistory.reduce((sum, b) => sum + b.audienceCount, 0) +
      drafts.reduce((sum, b) => sum + b.audienceCount, 0);
    return { sent, queued, recipients };
  }, [drafts]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
              <MessageSquare className="mr-1.5 h-3 w-3" />
              Communications · continuity-safe
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Communications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              The local&apos;s broadcast outbox. Every message is attributable, audience-scoped, and
              retained under the same operational memory policy as the rest of the file.
            </p>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button>
                <PlusCircle className="mr-1.5 h-4 w-4" />
                Compose broadcast
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Compose member broadcast</SheetTitle>
                <SheetDescription>
                  Demo-only. The message is queued to your browser session; in production it
                  would be delivered to the selected audience with full attribution.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="br-audience">Audience</Label>
                  <select
                    id="br-audience"
                    value={form.audience}
                    onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {audienceOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt} ({audienceSizes[opt]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="br-channel">Channel</Label>
                  <select
                    id="br-channel"
                    value={form.channel}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        channel: e.target.value as BroadcastMessage["channel"],
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="bulletin-board">Bulletin board</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="br-subject">Subject</Label>
                  <input
                    id="br-subject"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. May labour-management meeting recap"
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="br-body">Message</Label>
                  <Textarea
                    id="br-body"
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Plain-language update — no individual member identifiers."
                    rows={6}
                  />
                </div>
                <div>
                  <Label>Templates</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {broadcastTemplates.map((tpl) => (
                      <Button
                        key={tpl.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(tpl.id)}
                      >
                        {tpl.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  Would deliver to{" "}
                  <strong>{audienceSizes[form.audience] ?? 0} members</strong> in production
                  via {form.channel}.
                </div>
              </div>
              <SheetFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={queueBroadcast}
                  disabled={!form.subject || !form.body}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Queue broadcast
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Sent (rolling 30d)" value={String(totals.sent)} icon={Megaphone} />
          <Stat label="Queued (this session)" value={String(totals.queued)} icon={Send} />
          <Stat label="Member touches" value={String(totals.recipients)} icon={Users} />
        </div>
      </div>

      <RetentionStrip />

      {drafts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Queued (this session)
              <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">
                {drafts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {drafts.map((d) => (
              <BroadcastCard
                key={d.id}
                broadcast={{
                  id: d.id,
                  sent: d.queuedAt,
                  audience: d.audience,
                  audienceCount: d.audienceCount,
                  subject: d.subject,
                  body: d.body,
                  channel: d.channel,
                  sender: "You (demo)",
                  continuityNote: "Demo-only — would be delivered in production",
                }}
                draft
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" />
            Sent broadcasts
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {broadcastHistory.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {broadcastHistory.map((b) => (
            <BroadcastCard key={b.id} broadcast={b} />
          ))}
        </CardContent>
      </Card>

      <p className="text-[11px] leading-5 text-slate-500">
        Demo-only: queued messages persist in this browser session and never leave your machine.
      </p>

      <Cupe4373DoctrineFooter
        reviewerOfRecord="Chief Steward (sender of record); Executive for member-wide broadcasts"
        escalation="Member concerns about broadcast content escalate to the next Executive meeting or Stewards Council"
        context="Aggregations and counts only; no individual targeting, no member behavioural scoring."
      />
    </div>
  );
}

function BroadcastCard({
  broadcast,
  draft = false,
}: {
  broadcast: BroadcastMessage;
  draft?: boolean;
}) {
  const locale = useLocale();
  const Icon = channelIcons[broadcast.channel];
  const noteMatch = broadcast.continuityNote.match(/(DOR|MOT)-\d{4}-\d{3}/);
  return (
    <div
      className={`rounded-md border bg-white p-3 text-sm ${
        draft ? "border-blue-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          <Icon className="mr-1 h-3 w-3" />
          {broadcast.channel}
        </Badge>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
          {broadcast.audience} · {broadcast.audienceCount}
        </Badge>
        {draft && (
          <Badge variant="outline" className="border-blue-300 bg-blue-100 text-blue-900">
            queued
          </Badge>
        )}
        <span className="text-xs text-slate-500">
          {new Date(broadcast.sent).toLocaleString("en-CA")} · {broadcast.id}
        </span>
      </div>
      <p className="mt-1 font-semibold text-slate-950">{broadcast.subject}</p>
      <p className="mt-1 whitespace-pre-line text-slate-700">{broadcast.body}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        From {broadcast.sender} ·{" "}
        {noteMatch ? (
          <>
            {broadcast.continuityNote.split(noteMatch[0])[0]}
            <Link
              href={`/${locale}/dashboard/governance`}
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              {noteMatch[0]}
            </Link>
            {broadcast.continuityNote.split(noteMatch[0])[1]}
          </>
        ) : (
          broadcast.continuityNote
        )}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Mail;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function RetentionStrip() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
      <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
      <div>
        <p className="font-medium text-slate-900">{retentionPolicy.shortLabel}</p>
        <p className="mt-0.5 text-slate-600">
          Member broadcasts retained for {retentionPolicy.windowMonths} months. Aggregations and
          counts only — no individual targeting, no productivity scoring.
        </p>
      </div>
    </div>
  );
}
