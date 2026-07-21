"use client";

/**
 * Cupe 4373 Inbox — Foundation-tier "unified organizational intake" surface.
 *
 * Combines case intakes, member messages, federation signals, and
 * operational alerts into a single governance-safe stream. Mirrors the
 * marketing-site Foundation claim: "Unified intake across cases and
 * member messages." Linkage to existing cases is preserved.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ClipboardList,
  Inbox as InboxIcon,
  Mail,
  Network,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Button } from "@nzila/union-eyes-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nzila/union-eyes-ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373NewCaseButton } from "@/components/demo/cupe4373-new-case-button";
import { Cupe4373DoctrineFooter } from "@/components/demo/cupe4373-doctrine-footer";
import {
  inboxItems,
  retentionPolicy,
  type InboxItem,
} from "@/lib/demo/cupe4373-demo";

const channelMeta = {
  case: {
    label: "Case intake",
    icon: ClipboardList,
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  "member-message": {
    label: "Member message",
    icon: Mail,
    className: "border-violet-200 bg-violet-50 text-violet-800",
  },
  federation: {
    label: "Federation signal",
    icon: Network,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  "operational-alert": {
    label: "Operational alert",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
} as const;

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

const statusStyles = {
  new: "border-blue-300 bg-blue-50 text-blue-900",
  triaged: "border-amber-300 bg-amber-50 text-amber-900",
  linked: "border-emerald-300 bg-emerald-50 text-emerald-900",
} as const;

type ChannelFilter = "all" | InboxItem["channel"];

const channelTabs: Array<{ id: ChannelFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "case", label: "Case intake" },
  { id: "member-message", label: "Member messages" },
  { id: "federation", label: "Federation" },
  { id: "operational-alert", label: "Operational alerts" },
];

export function Cupe4373InboxPage() {
  const locale = useLocale();
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(inboxItems[0]?.id ?? "");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inboxItems.filter((item) => {
      if (channel !== "all" && item.channel !== channel) return false;
      if (!q) return true;
      return (
        item.subject.toLowerCase().includes(q) ||
        item.from.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q)
      );
    });
  }, [channel, query]);

  const counts = useMemo(() => {
    return {
      all: inboxItems.length,
      case: inboxItems.filter((i) => i.channel === "case").length,
      "member-message": inboxItems.filter((i) => i.channel === "member-message").length,
      federation: inboxItems.filter((i) => i.channel === "federation").length,
      "operational-alert": inboxItems.filter((i) => i.channel === "operational-alert").length,
    } satisfies Record<ChannelFilter, number>;
  }, []);

  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
              <InboxIcon className="mr-1.5 h-3 w-3" />
              Inbox · unified intake
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Inbox</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              One governance-safe stream for case intakes, member messages, federation signals,
              and operational alerts. Nothing falls through the cracks; everything is
              attributable, retainable, and continuity-safe.
            </p>
          </div>
          <Cupe4373NewCaseButton />
        </div>
      </div>

      <RetentionBanner />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="grid gap-2 sm:grid-cols-5">
            {channelTabs.map((tab) => {
              const active = channel === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChannel(tab.id)}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {counts[tab.id]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox by subject, sender, or content"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{items.length} item(s)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const meta = channelMeta[item.channel];
                const Icon = meta.icon;
                const isActive = active?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors ${
                        isActive ? "bg-blue-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={meta.className}>
                          <Icon className="mr-1 h-3 w-3" />
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className={urgencyStyles[item.urgency]}>
                          {item.urgency}
                        </Badge>
                        <Badge variant="outline" className={statusStyles[item.status]}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-slate-950">{item.subject}</p>
                      <p className="text-xs text-slate-600">
                        {item.from} · {new Date(item.received).toLocaleString("en-CA")}
                      </p>
                    </button>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="p-8 text-center text-sm text-slate-500">
                  No inbox items match this view.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {active && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={channelMeta[active.channel].className}>
                  {channelMeta[active.channel].label}
                </Badge>
                <Badge variant="outline" className={urgencyStyles[active.urgency]}>
                  {active.urgency}
                </Badge>
                <Badge variant="outline" className={statusStyles[active.status]}>
                  {active.status}
                </Badge>
              </div>
              <CardTitle className="mt-2 text-lg">{active.subject}</CardTitle>
              <p className="text-sm text-slate-600">
                {active.from} · <span className="text-slate-500">{active.fromContext}</span>
              </p>
              <p className="text-xs text-slate-500">
                Received {new Date(active.received).toLocaleString("en-CA")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                {active.body}
              </p>

              {active.linkedCaseId && (
                <Link
                  href={`/${locale}/dashboard/cases/${active.linkedCaseId}`}
                  className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 hover:bg-emerald-100"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Linked to case {active.linkedCaseId}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wide text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Retention
                </p>
                <p>
                  Retained until {new Date(active.retentionExpires).toLocaleDateString("en-CA")} per{" "}
                  {retentionPolicy.shortLabel}. Demo-only: messages persist for this browser session.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled>
                  Triage to steward
                </Button>
                {!active.linkedCaseId && (
                  <Button variant="outline" size="sm" disabled>
                    Open as case
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled>
                  Reply to member
                </Button>
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                Demo-only actions: triage/open/reply are routed through governance approvals
                in production with full audit attribution.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Cupe4373DoctrineFooter
        reviewerOfRecord="Chief Steward (Denise Laurent) for triage decisions; assigned steward for case linkage"
        escalation="Triage to assigned steward → Chief Steward → Executive if no movement within 48 hours"
        context="Channel and urgency labels are interpretive surface hints, not authoritative status."
      />
    </div>
  );
}

function RetentionBanner() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
      <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
      <div>
        <p className="font-medium text-slate-900">{retentionPolicy.shortLabel}</p>
        <p className="mt-0.5 text-slate-600">{retentionPolicy.fullLabel}</p>
        <p className="mt-1 text-[11px] text-slate-500">Basis: {retentionPolicy.basis}</p>
      </div>
    </div>
  );
}
