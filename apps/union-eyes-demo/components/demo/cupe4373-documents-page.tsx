"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, FolderOpen, Lock, Search, ShieldCheck, Users, FileCheck, FileDown, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { demoDocuments, type DemoDocument } from "@/lib/demo/cupe4373-demo";

type Props = {
  locale: string;
};

const categoryMeta: Record<
  DemoDocument['category'],
  { label: string; icon: LucideIcon; badgeClass: string }
> = {
  'collective-agreement': {
    label: 'Collective Agreement',
    icon: FileCheck,
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  'grievance-evidence': {
    label: 'Grievance Evidence',
    icon: FileText,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  minutes: {
    label: 'Meeting Minutes',
    icon: Users,
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  policy: {
    label: 'Employer Policy',
    icon: FileText,
    badgeClass: 'border-purple-200 bg-purple-50 text-purple-800',
  },
  correspondence: {
    label: 'Correspondence',
    icon: FolderOpen,
    badgeClass: 'border-teal-200 bg-teal-50 text-teal-800',
  },
};

const privacyMeta: Record<
  DemoDocument['privacyLabel'],
  { label: string; class: string }
> = {
  public_internal: { label: 'Public — Internal', class: 'border-green-200 bg-green-50 text-green-800' },
  team_confidential: { label: 'Team Confidential', class: 'border-slate-200 bg-slate-100 text-slate-700' },
  case_restricted: { label: 'Case Restricted', class: 'border-orange-200 bg-orange-50 text-orange-800' },
  privileged: { label: 'Privileged', class: 'border-red-200 bg-red-50 text-red-800' },
};

export function Cupe4373DocumentsPage({ locale }: Props) {
  const [preview, setPreview] = useState<DemoDocument | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | DemoDocument["category"]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return demoDocuments.filter((d) => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (!q) return true;
      return [d.title, d.description, d.id, d.linkedCaseId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, categoryFilter]);

  const byCategory = useMemo(
    () => ({
      agreements: filtered.filter((d) => d.category === "collective-agreement"),
      evidence: filtered.filter((d) => d.category === "grievance-evidence"),
      minutes: filtered.filter((d) => d.category === "minutes"),
      other: filtered.filter(
        (d) => d.category === "policy" || d.category === "correspondence",
      ),
    }),
    [filtered],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      {/* Header */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-teal-200 bg-teal-50 text-teal-800">
          Secure document library
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Documents</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Evidence packages, collective agreements, meeting minutes, and formal correspondence are
              stored with governed access labels. Each file&apos;s privacy tier is shown clearly so
              stewards know what can be shared and with whom.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Total files" value={String(demoDocuments.length)} />
            <Metric
              label="CBA docs"
              value={String(demoDocuments.filter((d) => d.category === "collective-agreement").length)}
            />
            <Metric
              label="Evidence"
              value={String(demoDocuments.filter((d) => d.category === "grievance-evidence").length)}
            />
          </div>
        </div>
      </section>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents by title, description, or case ID..."
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              aria-label="Category filter"
            >
              <option value="all">All categories</option>
              <option value="collective-agreement">Collective Agreement</option>
              <option value="grievance-evidence">Grievance Evidence</option>
              <option value="minutes">Meeting Minutes</option>
              <option value="policy">Employer Policy</option>
              <option value="correspondence">Correspondence</option>
            </select>
            <div className="text-xs text-slate-500">
              {filtered.length} of {demoDocuments.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 text-center text-sm text-slate-500">
            No documents match the current filters.
          </CardContent>
        </Card>
      )}

      <DocumentSection
        title="Collective Agreements & MOUs"
        icon={FileCheck}
        docs={byCategory.agreements}
        locale={locale}
        onPreview={setPreview}
      />
      <DocumentSection
        title="Grievance Evidence Packages"
        icon={FileText}
        docs={byCategory.evidence}
        locale={locale}
        onPreview={setPreview}
      />
      <DocumentSection
        title="Meeting Minutes"
        icon={Users}
        docs={byCategory.minutes}
        locale={locale}
        onPreview={setPreview}
      />
      <DocumentSection
        title="Policy & Correspondence"
        icon={FolderOpen}
        docs={byCategory.other}
        locale={locale}
        onPreview={setPreview}
      />

      {/* Demo boundary */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-slate-500" />
            Demo boundary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            "Privacy labels control who can access each file — stewards, officers, or LRO only.",
            "Evidence packages are case-linked and versioned for chronology integrity.",
            "Privileged documents (LRO briefs) are access-limited and not visible to general members.",
          ].map((item) => (
            <div key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>

      <DocumentPreviewSheet
        doc={preview}
        locale={locale}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DocumentSection({
  title,
  icon: SectionIcon,
  docs,
  locale,
  onPreview,
}: {
  title: string;
  icon: LucideIcon;
  docs: DemoDocument[];
  locale: string;
  onPreview: (doc: DemoDocument) => void;
}) {
  if (docs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <SectionIcon className="h-4 w-4" />
        {title}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {docs.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} locale={locale} onPreview={onPreview} />
        ))}
      </div>
    </div>
  );
}

function DocumentCard({
  doc,
  locale,
  onPreview,
}: {
  doc: DemoDocument;
  locale: string;
  onPreview: (doc: DemoDocument) => void;
}) {
  void locale;
  const cat = categoryMeta[doc.category];
  const privacy = privacyMeta[doc.privacyLabel];
  const CatIcon = cat.icon;

  return (
    <button
      type="button"
      onClick={() => onPreview(doc)}
      className="group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
            <CatIcon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-slate-950 group-hover:text-slate-800">
              {doc.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{doc.fileType} · Updated {new Date(doc.lastUpdated).toLocaleDateString('en-CA')}</p>
          </div>
        </div>
        {doc.privacyLabel === 'privileged' && (
          <span title="Privileged">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          </span>
        )}
        {doc.privacyLabel === 'case_restricted' && (
          <span title="Case Restricted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
          </span>
        )}
      </div>

      <p className="text-xs leading-5 text-slate-600">{doc.description}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] ${cat.badgeClass}`}>
          {cat.label}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${privacy.class}`}>
          {privacy.label}
        </Badge>
        {doc.linkedCaseId && (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
            → {doc.linkedCaseId}
          </Badge>
        )}
      </div>
    </button>
  );
}

function buildDocPreview(doc: DemoDocument): string {
  const header = `${doc.title}\n${"=".repeat(doc.title.length)}\n\nFile: ${doc.id} · ${doc.fileType}\nLast updated: ${doc.lastUpdated}\nPrivacy: ${doc.privacyLabel}\n${doc.linkedCaseId ? `Linked case: ${doc.linkedCaseId}\n` : ""}\n`;
  const body = `Description\n-----------\n${doc.description}\n\n`;

  switch (doc.category) {
    case "collective-agreement":
      return (
        header +
        body +
        `Sample Excerpt\n--------------\nArticle 18 — Overtime\n  18.1 The Employer recognizes that overtime is to be the exception rather than the rule.\n  18.2 Overtime shall be voluntary except in emergency situations as defined in 18.4.\n  18.3 Overtime shall be paid at time-and-one-half (1½) the regular rate for all hours\n       worked in excess of the regularly scheduled shift.\n\nArticle 14 — Scheduling\n  14.1 Schedules shall be posted at least four (4) weeks in advance.\n  14.2 Changes to posted schedules require seventy-two (72) hours written notice except in\n       cases of bona fide emergency.\n\n[Full PDF would be served from secure document store in production.]`
      );
    case "grievance-evidence":
      return (
        header +
        body +
        `Contents\n--------\n• Incident chronology compiled from steward intake\n• Member statement (signed)\n• Schedule extracts and payroll variance\n• Employer correspondence (email and letter)\n• Article references and CBA annotations\n\nAccess Control\n--------------\nThis file is case-restricted. Only the assigned steward, Chief Steward, and authorized\nLRO can view its contents. All access is logged for chronology integrity.\n\n[Full evidence package would render with redaction tooling in production.]`
      );
    case "minutes":
      return (
        header +
        body +
        `Agenda Items\n------------\n1. Casework updates (open files, urgency review, handoff coverage)\n2. New member intake summary\n3. Scheduling audit findings (acute care services)\n4. Upcoming labour-management dates\n5. Steward training refresher (chronology integrity)\n\nDecisions\n---------\n• Marc to cover UE-4373-026 if Denise unavailable May 23\n• Chief Steward to send formal letter on recurring staffing pattern concerns\n• Next meeting: same time, two weeks out`
      );
    case "policy":
      return (
        header +
        body +
        `Policy Summary\n--------------\nAttendance program defines absence thresholds, documentation requirements, and\nprogressive review steps. Steward team has annotated against CBA Article 16\n(Sick Leave & Disability) to surface conflicts and confirm member rights.\n\nWatch Items\n-----------\n• Documentation thresholds may conflict with WSIB notes practice\n• Disclosure of medical detail must remain limited per Article 16.4`
      );
    case "correspondence":
      return (
        header +
        body +
        `Letter Excerpt\n--------------\nTo: Operations Leadership\nFrom: CUPE Local 4373 Steward Team\nDate: ${doc.lastUpdated}\n\nThis letter formalizes our concern regarding recurring understaffing on overnight\nshifts. The chronology of incidents from the prior six weeks has been compiled and\nis attached. We request a written response within ten (10) business days outlining\nthe staffing review plan, continuity coverage, and any interim relief measures.\n\nRespectfully,\nCUPE Local 4373 Steward Team`
      );
    default:
      return header + body;
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function DocumentPreviewSheet({
  doc,
  locale,
  onClose,
}: {
  doc: DemoDocument | null;
  locale: string;
  onClose: () => void;
}) {
  const cat = doc ? categoryMeta[doc.category] : null;
  const privacy = doc ? privacyMeta[doc.privacyLabel] : null;
  return (
    <Sheet open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {doc && cat && privacy && (
          <>
            <SheetHeader>
              <SheetTitle>{doc.title}</SheetTitle>
              <SheetDescription>
                {doc.fileType} · Updated {new Date(doc.lastUpdated).toLocaleDateString("en-CA")}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`text-[10px] ${cat.badgeClass}`}>
                {cat.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${privacy.class}`}>
                {privacy.label}
              </Badge>
              {doc.linkedCaseId && (
                <Link
                  href={`/${locale}/dashboard/cases/${doc.linkedCaseId}`}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800 hover:bg-blue-100"
                >
                  → Open case {doc.linkedCaseId}
                </Link>
              )}
            </div>
            <pre className="mt-5 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700">
              {buildDocPreview(doc)}
            </pre>
            <SheetFooter className="mt-6 gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() =>
                  downloadText(`${doc.id}-${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`, buildDocPreview(doc))
                }
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download preview
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
