"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck,
  Users,
  Clock,
  CheckCircle,
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

interface Candidate {
  memberId: string;
  name: string;
  score: number;
  skills: string[];
  seniority: number;
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
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [form, setForm] = useState({
    employerId: "",
    jobTitle: "",
    requiredSkills: "",
    requestedWorkers: 1,
  });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dispatch/queue");
      const json = await res.json();
      if (json.data) setRequests(json.data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
      if (res.ok) {
        setShowCreate(false);
        setForm({ employerId: "", jobTitle: "", requiredSkills: "", requestedWorkers: 1 });
        fetchQueue();
      }
    } catch {
      // handle error
    }
  }

  async function handleAssign(requestId: string, memberIds: string[]) {
    try {
      const res = await fetch("/api/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, memberIds }),
      });
      if (res.ok) {
        fetchQueue();
        setSelectedRequest(null);
        setCandidates([]);
      }
    } catch {
      // handle error
    }
  }

  const openCount = requests.filter((r) => r.status === "open").length;
  const partialCount = requests.filter((r) => r.status === "partially_filled").length;
  const filledCount = requests.filter((r) => r.status === "filled").length;

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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
              <p className="text-sm text-muted-foreground">{t('filledLabel')}</p>
              <p className="text-2xl font-bold text-blue-600">{filledCount}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-600" />
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
                <label className="mb-1 block text-sm font-medium">{t('employerIdLabel')}</label>
                <input
                  type="text"
                  value={form.employerId}
                  onChange={(e) => setForm({ ...form, employerId: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  required
                />
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
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
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
                      {t('workersPrefix')}: {req.requestedWorkers} · {t('skillsPrefix')}:{" "}
                      {req.requiredSkills?.join(", ") || t('notApplicable')} · {t('datePrefix')}:{" "}
                      {new Date(req.requestedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {req.status === "open" && (
                      <button
                        onClick={() =>
                          setSelectedRequest(
                            selectedRequest === req.id ? null : req.id,
                          )
                        }
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

      {/* Candidate ranking section (shown when a request is selected) */}
      {selectedRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> {t('rankedCandidatesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-400">
                {t('candidateRankingMessage')}
              </p>
            ) : (
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li
                    key={c.memberId}
                    className="flex items-center justify-between rounded border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {t('scorePrefix')}: {c.score} · {t('seniorityPrefix')}: {c.seniority}yr · {t('skillsPrefix')}:{" "}
                        {c.skills.join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAssign(selectedRequest, [c.memberId])}
                      className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                    >
                      {t('assignButton')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
