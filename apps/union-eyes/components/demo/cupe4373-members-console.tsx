"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  Star,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import Link from "next/link";
import { demoCases } from "@/lib/demo/cupe4373-demo";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  department: string | null;
  position: string | null;
  location: string | null;
  seniority: number | null;
  membershipNumber: string | null;
  hireDate: string | null;
  unionJoinDate: string | null;
  preferredContactMethod: string | null;
  memberCategory: string | null;
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  president:         { label: "President",         color: "border-red-200 bg-red-50 text-red-800",         icon: <Star className="w-3 h-3" /> },
  executive:         { label: "Executive",         color: "border-red-200 bg-red-50 text-red-800",         icon: <Star className="w-3 h-3" /> },
  officer:           { label: "Officer",           color: "border-orange-200 bg-orange-50 text-orange-800", icon: <Award className="w-3 h-3" /> },
  steward:           { label: "Steward",           color: "border-purple-200 bg-purple-50 text-purple-800", icon: <Shield className="w-3 h-3" /> },
  grievance_officer: { label: "Grievance Officer", color: "border-amber-200 bg-amber-50 text-amber-800",   icon: <Briefcase className="w-3 h-3" /> },
  member:            { label: "Member",            color: "border-slate-200 bg-slate-50 text-slate-700",   icon: <Users className="w-3 h-3" /> },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  active:    { dot: "bg-green-500",  label: "Active",   badge: "border-green-200 bg-green-50 text-green-800" },
  "on-leave":{ dot: "bg-yellow-400", label: "On leave", badge: "border-yellow-200 bg-yellow-50 text-yellow-800" },
  inactive:  { dot: "bg-gray-400",   label: "Inactive", badge: "border-gray-200 bg-gray-50 text-gray-600" },
};

const PAGE_SIZE = 50;

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return "—";
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[64px] rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xl font-bold text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">{value || "—"}</p>
      </div>
    </div>
  );
}

function MemberSheet({ member, open, onClose, locale }: {
  member: MemberRow | null;
  open: boolean;
  onClose: () => void;
  locale: string;
}) {
  if (!member) return null;
  const roleInfo   = ROLE_CONFIG[member.role]   ?? ROLE_CONFIG.member;
  const statusInfo = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.inactive;
  const caseMatches = memberCaseMatches(member.name);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <SheetHeader className="mb-0 space-y-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-semibold text-slate-950 leading-tight">
                  {member.name}
                </SheetTitle>
                <p className="mt-0.5 text-sm text-slate-500">{member.position ?? member.role}</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${roleInfo.color}`}>
                {roleInfo.icon}{roleInfo.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusInfo.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>
              {member.memberCategory && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                  {member.memberCategory}
                </span>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Contact */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contact
            </h3>
            <div className="space-y-3">
              <DetailRow icon={<Mail className="h-4 w-4" />}  label="Email"              value={member.email} />
              <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone"              value={member.phone ?? "—"} />
              <DetailRow icon={<Clock className="h-4 w-4" />} label="Preferred contact"  value={member.preferredContactMethod ?? "—"} />
            </div>
          </section>

          <Separator />

          {/* Employment */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Employment
            </h3>
            <div className="space-y-3">
              <DetailRow icon={<Building2 className="h-4 w-4" />} label="Department"  value={member.department ?? "—"} />
              <DetailRow icon={<Briefcase className="h-4 w-4" />} label="Position"    value={member.position ?? "—"} />
              <DetailRow icon={<MapPin className="h-4 w-4" />}    label="Location"    value={member.location ?? "—"} />
              <DetailRow icon={<Calendar className="h-4 w-4" />}  label="Hire date"   value={fmt(member.hireDate)} />
              <DetailRow icon={<Clock className="h-4 w-4" />}     label="Seniority"   value={member.seniority != null ? `${member.seniority} years` : "—"} />
            </div>
          </section>

          <Separator />

          {/* Union membership */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Union membership
            </h3>
            <div className="space-y-3">
              <DetailRow icon={<Shield className="h-4 w-4" />}   label="Membership #"     value={member.membershipNumber ?? "—"} />
              <DetailRow icon={<Calendar className="h-4 w-4" />} label="Union join date"  value={fmt(member.unionJoinDate)} />
            </div>
          </section>

          {caseMatches.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Possible demo cases
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Best-effort first-name match against anonymized demo casework. Verify before acting.
                </p>
                <ul className="space-y-2">
                  {caseMatches.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/${locale}/dashboard/cases/${c.id}`}
                        className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{c.id}</p>
                          <p className="truncate text-slate-600">{c.title}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                          {c.urgency}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function memberCaseMatches(memberName: string) {
  const first = memberName.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first || first.length < 2) return [] as typeof demoCases;
  return demoCases.filter((c) => {
    const workerFirst = c.worker.split(/\s+/)[0]?.toLowerCase() ?? "";
    return workerFirst === first;
  });
}

export function Cupe4373MembersConsole({ members = [], locale = "en" }: { members?: MemberRow[]; locale?: string }) {
  const [query, setQuery]               = useState("");
  const [roleFilter, setRoleFilter]     = useState("all");
  const [deptFilter, setDeptFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage]                 = useState(0);
  const [pageJump, setPageJump]         = useState("");
  const [selected, setSelected]         = useState<MemberRow | null>(null);

  const departments = useMemo(
    () => [...new Set(members.map((m) => m.department).filter(Boolean))].sort() as string[],
    [members],
  );

  const roles = useMemo(
    () => [...new Set(members.map((m) => m.role))].sort(),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (
        q &&
        !m.name.toLowerCase().includes(q) &&
        !m.email.toLowerCase().includes(q) &&
        !(m.membershipNumber ?? "").toLowerCase().includes(q) &&
        !(m.department ?? "").toLowerCase().includes(q) &&
        !(m.position ?? "").toLowerCase().includes(q)
      )
        return false;
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (deptFilter !== "all" && m.department !== deptFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      return true;
    });
  }, [members, query, roleFilter, deptFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const resetPage =
    <T,>(fn: React.Dispatch<React.SetStateAction<T>>) =>
    (v: T) => { fn(v); setPage(0); };

  const stats = {
    total:    members.length,
    active:   members.filter((m) => m.status === "active").length,
    onLeave:  members.filter((m) => m.status === "on-leave").length,
    stewards: members.filter((m) => m.role === "steward").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      {/* Header */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
          Member directory
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Members</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              CUPE Local 4373 membership roster across all departments and classifications.
              Click any member card to view full contact and employment details.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Metric label="Total"    value={stats.total.toLocaleString()} />
            <Metric label="Active"   value={stats.active.toLocaleString()} />
            <Metric label="On leave" value={stats.onLeave.toLocaleString()} />
            <Metric label="Stewards" value={stats.stewards.toLocaleString()} />
          </div>
        </div>
      </section>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => resetPage(setQuery)(e.target.value)}
                placeholder="Search name, email, membership #, department…"
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => resetPage(setStatusFilter)(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="on-leave">On leave</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => resetPage(setRoleFilter)(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="all">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_CONFIG[r]?.label ?? r}
                </option>
              ))}
            </select>
            <select
              value={deptFilter}
              onChange={(e) => resetPage(setDeptFilter)(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Count + top pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {filtered.length === members.length
            ? `${members.length.toLocaleString()} members`
            : `${filtered.length.toLocaleString()} of ${members.length.toLocaleString()} members`}
          {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Member grid */}
      {pageItems.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No members match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((m) => {
            const roleInfo   = ROLE_CONFIG[m.role]   ?? ROLE_CONFIG.member;
            const statusInfo = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.inactive;
            const caseMatches = memberCaseMatches(m.name);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-left transition-all hover:border-slate-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusInfo.dot}`} />
                      <span className="truncate text-sm font-semibold text-slate-950">{m.name}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{m.position ?? m.role}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${roleInfo.color}`}
                  >
                    {roleInfo.icon}
                    {roleInfo.label}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5 truncate">
                    <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                    {m.department ?? "—"}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-slate-400">
                    <Shield className="h-3 w-3 shrink-0" />
                    {m.membershipNumber} · {m.seniority ?? 0} yr seniority
                  </p>
                  {caseMatches.length > 0 && (
                    <p className="flex items-center gap-1.5 text-orange-700">
                      <Briefcase className="h-3 w-3 shrink-0" />
                      {caseMatches.length} possible demo case{caseMatches.length === 1 ? "" : "s"} (first-name match)
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pb-6">
          <button
            disabled={page === 0}
            onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="flex items-center px-4 text-sm text-slate-600">
            Page {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(pageJump, 10);
              if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
                setPage(n - 1);
                window.scrollTo(0, 0);
              }
              setPageJump("");
            }}
            className="flex items-center gap-1"
          >
            <label htmlFor="jump-to-page" className="text-xs text-slate-500">Go to</label>
            <input
              id="jump-to-page"
              type="number"
              min={1}
              max={totalPages}
              value={pageJump}
              onChange={(e) => setPageJump(e.target.value)}
              placeholder={`1–${totalPages}`}
              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Go
            </button>
          </form>
        </div>
      )}

      {/* Member detail sheet */}
      <MemberSheet
        member={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        locale={locale}
      />
    </div>
  );
}
