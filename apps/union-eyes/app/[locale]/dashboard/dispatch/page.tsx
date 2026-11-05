"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiShapeError, envelopeData, isRecord, readApiError } from "@/lib/client/api-envelope";
import { fetchAllRows } from "@/lib/client/crud-lists";
import { asRecord, optionalString, requiredString } from "@/lib/client/row-fields";
import {
  Truck,
  Users,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DispatchRequest {
  id: string;
  employerId: string;
  jobTitle: string;
  requiredSkills: string[];
  requestedWorkers: number;
  status: string;
  requestedDate: string;
  createdAt: string;
}

interface MemberOption {
  id: string;
  name: string | null;
}

interface EmployerOption {
  id: string;
  name: string;
}

function readMember(raw: unknown): MemberOption {
  const row = asRecord(raw, "member");
  return { id: requiredString(row, "id"), name: optionalString(row, "name") };
}

function readEmployer(raw: unknown): EmployerOption {
  const row = asRecord(raw, "employer");
  return { id: requiredString(row, "id"), name: requiredString(row, "name") };
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  partially_filled: "bg-yellow-100 text-yellow-800",
  filled: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-800",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const t = useTranslations('dispatchPage');
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [employers, setEmployers] = useState<EmployerOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState({
    employerId: "",
    jobTitle: "",
    requiredSkills: "",
    requestedWorkers: 1,
  });

  // What a failed call says: the server's own message, or the screen's when the call never reached the server or the answer was not what the route sends.
  const describe = useCallback((failure: unknown, fallback: string) => (failure instanceof ApiShapeError || failure instanceof TypeError || !(failure instanceof Error) ? fallback : failure.message), []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dispatch/queue");
      if (!res.ok) throw new Error(await readApiError(res, t("queueLoadFailed")));
      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no queue");
      setRequests(body.data as DispatchRequest[]);
      setError(null);
    } catch (failure) {
      setError(describe(failure, t("queueLoadFailed")));
    } finally {
      setLoading(false);
    }
  }, [t, describe]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    let cancelled = false;
    fetchAllRows<unknown>("/api/employers").then(
      (rows) => {
        if (!cancelled) setEmployers(rows.map(readEmployer));
      },
      (failure: unknown) => {
        if (!cancelled) setError(describe(failure, t("employersLoadFailed")));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [t, describe]);

  const loadMembers = useCallback(
    async (search: string) => {
      setMembersLoading(true);
      try {
        const query = new URLSearchParams({ status: "active", limit: "20" });
        if (search) query.set("search", search);
        const res = await fetch(`/api/members?${query.toString()}`);
        if (!res.ok) throw new Error(await readApiError(res, t("membersLoadFailed")));
        const payload = envelopeData(await res.json());
        if (!Array.isArray(payload.members)) throw new ApiShapeError("no members");
        setMembers(payload.members.map(readMember));
        setError(null);
      } catch (failure) {
        setMembers([]);
        setError(describe(failure, t("membersLoadFailed")));
      } finally {
        setMembersLoading(false);
      }
    },
    [t, describe],
  );

  useEffect(() => {
    if (selectedRequest) loadMembers("");
  }, [selectedRequest, loadMembers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dispatch/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requiredSkills: form.requiredSkills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t("createFailed")));
      setShowCreate(false);
      setForm({ employerId: "", jobTitle: "", requiredSkills: "", requestedWorkers: 1 });
      await fetchQueue();
    } catch (failure) {
      setError(describe(failure, t("createFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(requestId: string, memberIds: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, memberIds }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t("assignFailed")));
      setSelectedRequest(null);
      setChosen([]);
      await fetchQueue();
    } catch (failure) {
      setError(describe(failure, t("assignFailed")));
    } finally {
      setSaving(false);
    }
  }

  const toggleMember = (memberId: string) => setChosen((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  const employerName = (employerId: string) => employers.find((employer) => employer.id === employerId)?.name ?? employerId;

  const openCount = requests.filter((r) => r.status === "open").length;
  const partialCount = requests.filter((r) => r.status === "partially_filled").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Truck className="h-8 w-8" />
            {t('pageTitle')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchQueue}
            className="flex items-center gap-1 rounded border px-3 py-2 text-sm hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> {t('refreshButton')}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> {t('newRequestButton')}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="dispatch-error">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('openRequestsLabel')}</p>
              <p className="text-2xl font-bold">{openCount}</p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('partiallyFilledLabel')}</p>
              <p className="text-2xl font-bold text-yellow-600">{partialCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('totalQueueLabel')}</p>
              <p className="text-2xl font-bold">{requests.length}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('newRequestFormTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="dispatch-employer">{t('employerLabel')}</label>
                <select
                  id="dispatch-employer"
                  value={form.employerId}
                  onChange={(e) => setForm({ ...form, employerId: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  required
                >
                  <option value="">{t('employerPlaceholder')}</option>
                  {employers.map((employer) => (
                    <option key={employer.id} value={employer.id}>{employer.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t('jobTitleLabel')}</label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t('requiredSkillsLabel')}
                </label>
                <input
                  type="text"
                  value={form.requiredSkills}
                  onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t('workersNeededLabel')}</label>
                <input
                  type="number"
                  min={1}
                  value={form.requestedWorkers}
                  onChange={(e) =>
                    setForm({ ...form, requestedWorkers: parseInt(e.target.value) || 1 })
                  }
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end gap-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('createButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {t('cancelButton')}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('queueTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : requests.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{t('noRequests')}</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className={`flex items-center justify-between rounded border p-4 ${
                    selectedRequest === req.id ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{req.jobTitle}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status]}`}
                      >
                        {req.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {employerName(req.employerId)} · {t('workersPrefix')}: {req.requestedWorkers} · {t('skillsPrefix')}:{" "}
                      {req.requiredSkills?.join(", ") || t('notApplicable')} · {t('datePrefix')}:{" "}
                      {new Date(req.requestedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(req.status === "open" || req.status === "partially_filled") && (
                      <button
                        onClick={() => {
                          setChosen([]);
                          setMemberSearch("");
                          setSelectedRequest(selectedRequest === req.id ? null : req.id);
                        }}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                      >
                        {selectedRequest === req.id ? t('deselectButton') : t('assignWorkersButton')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* The officer names the members the request is offered to (the dispatch rules are not applied: nothing holds members' skills or availability) */}
      {selectedRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> {t('offerPanelTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadMembers(memberSearch.trim());
              }}
              className="flex gap-2"
            >
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={t('memberSearchPlaceholder')}
                aria-label={t('memberSearchPlaceholder')}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
                {t('searchButton')}
              </button>
            </form>
            {membersLoading ? (
              <div className="flex h-16 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-400">{t('noMembersFound')}</p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 rounded border p-3 text-sm">
                    <input
                      type="checkbox"
                      id={`dispatch-member-${member.id}`}
                      checked={chosen.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                    <label htmlFor={`dispatch-member-${member.id}`} className="font-medium">
                      {member.name ?? t('unnamedMember')}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => handleAssign(selectedRequest, chosen)}
              disabled={chosen.length === 0 || saving}
              className="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t('offerSelectedButton', { count: chosen.length })}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
