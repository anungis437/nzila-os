import Link from "next/link";
import { FileText, FolderOpen, Lock, ShieldCheck, Users, FileCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const byCategory = {
    agreements: demoDocuments.filter((d) => d.category === 'collective-agreement'),
    evidence: demoDocuments.filter((d) => d.category === 'grievance-evidence'),
    minutes: demoDocuments.filter((d) => d.category === 'minutes'),
    other: demoDocuments.filter(
      (d) => d.category === 'policy' || d.category === 'correspondence',
    ),
  };

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
              stored with governed access labels. Each file's privacy tier is shown clearly so
              stewards know what can be shared and with whom.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Total files" value={String(demoDocuments.length)} />
            <Metric label="CBA docs" value={String(byCategory.agreements.length)} />
            <Metric label="Evidence" value={String(byCategory.evidence.length)} />
          </div>
        </div>
      </section>

      {/* Collective Agreements */}
      <DocumentSection
        title="Collective Agreements & MOUs"
        icon={FileCheck}
        docs={byCategory.agreements}
        locale={locale}
      />

      {/* Grievance Evidence */}
      <DocumentSection
        title="Grievance Evidence Packages"
        icon={FileText}
        docs={byCategory.evidence}
        locale={locale}
      />

      {/* Meeting Minutes */}
      <DocumentSection
        title="Meeting Minutes"
        icon={Users}
        docs={byCategory.minutes}
        locale={locale}
      />

      {/* Policy & Correspondence */}
      <DocumentSection
        title="Policy & Correspondence"
        icon={FolderOpen}
        docs={byCategory.other}
        locale={locale}
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
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DocumentSection({
  title,
  icon: SectionIcon,
  docs,
  locale,
}: {
  title: string;
  icon: LucideIcon;
  docs: DemoDocument[];
  locale: string;
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
          <DocumentCard key={doc.id} doc={doc} locale={locale} />
        ))}
      </div>
    </div>
  );
}

function DocumentCard({ doc, locale }: { doc: DemoDocument; locale: string }) {
  const cat = categoryMeta[doc.category];
  const privacy = privacyMeta[doc.privacyLabel];
  const CatIcon = cat.icon;

  // Evidence packages link to the associated case if available
  const href =
    doc.linkedCaseId
      ? `/${locale}/dashboard/cases/${doc.linkedCaseId}`
      : `/${locale}/dashboard/documents`;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
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
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" title="Privileged" />
        )}
        {doc.privacyLabel === 'case_restricted' && (
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" title="Case Restricted" />
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
    </Link>
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
