"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Scale,
  FileText,
  Clock,
  Upload,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { StewardRecommendations } from "@/components/steward-recommendations";
import { ClauseSuggestions } from "@/components/clause-suggestions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GrievanceEvent {
  id: string;
  eventType: string;
  actorUserId: string;
  notes: string | null;
  createdAt: string;
}

interface GrievanceDocument {
  id: string;
  fileUrl: string;
  documentType: string;
  uploadedBy: string;
  createdAt: string;
}

interface GrievanceDetail {
  id: string;
  grievanceNumber: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  filedDate: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  unionRepId: string | null;
  employerName: string | null;
  cbaArticle: string | null;
  events: GrievanceEvent[];
  documents: GrievanceDocument[];
}

const STATUS_PIPELINE = [
  "new",
  "triage",
  "investigation",
  "negotiation",
  "arbitration",
  "resolved",
  "closed",
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  triage: "bg-yellow-100 text-yellow-800",
  investigation: "bg-orange-100 text-orange-800",
  negotiation: "bg-purple-100 text-purple-800",
  arbitration: "bg-red-100 text-red-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function GrievanceDetailConsole() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [grievance, setGrievance] = useState<GrievanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusNote, setStatusNote] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function fetchGrievance() {
      try {
        const res = await fetch(`/api/grievances/${id}`);
        const json = await res.json();
        if (json.data) setGrievance(json.data);
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    fetchGrievance();
  }, [id]);

  async function advanceStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/grievances/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: statusNote }),
      });
      const json = await res.json();
      if (json.data) {
        setGrievance((prev) =>
          prev ? { ...prev, status: json.data.status, events: [...prev.events] } : prev,
        );
        setStatusNote("");
        // Refetch to get updated events
        const refetch = await fetch(`/api/grievances/${id}`);
        const refetchJson = await refetch.json();
        if (refetchJson.data) setGrievance(refetchJson.data);
      }
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!grievance) {
    return (
      <div className="text-center py-16 text-gray-500">
        <AlertCircle className="mx-auto h-10 w-10 mb-2" />
        Grievance not found
      </div>
    );
  }

  const currentIdx = STATUS_PIPELINE.indexOf(grievance.status);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{grievance.title}</h1>
          <p className="text-sm text-gray-500">{grievance.grievanceNumber}</p>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[grievance.status] ?? "bg-gray-100"}`}
        >
          {grievance.status.toUpperCase()}
        </span>
      </div>

      {/* Status Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4" /> Lifecycle Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {STATUS_PIPELINE.map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    i <= currentIdx
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {s}
                </div>
                {i < STATUS_PIPELINE.length - 1 && (
                  <div
                    className={`mx-1 h-0.5 w-6 ${
                      i < currentIdx ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Advance controls */}
          {grievance.status !== "closed" && (
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Transition note…"
                className="flex-1 rounded border px-3 py-1.5 text-sm"
              />
              {STATUS_PIPELINE.slice(currentIdx + 1, currentIdx + 3).map(
                (next) => (
                  <button
                    key={next}
                    disabled={updating}
                    onClick={() => advanceStatus(next)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    → {next}
                  </button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" /> Case Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Type:</span> {grievance.type}</p>
            <p><span className="font-medium">Priority:</span> {grievance.priority}</p>
            <p><span className="font-medium">Filed:</span> {grievance.filedDate ?? "—"}</p>
            {grievance.employerName && (
              <p><span className="font-medium">Employer:</span> {grievance.employerName}</p>
            )}
            {grievance.cbaArticle && (
              <p><span className="font-medium">CBA Article:</span> {grievance.cbaArticle}</p>
            )}
            {grievance.unionRepId && (
              <p><span className="font-medium">Assigned Steward:</span> {grievance.unionRepId}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700">
            {grievance.description}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" /> Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grievance.events.length === 0 ? (
            <p className="text-sm text-gray-400">No events yet</p>
          ) : (
            <ul className="space-y-3">
              {grievance.events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 text-sm">
                  <CheckCircle className="mt-0.5 h-4 w-4 text-green-500 shrink-0" />
                  <div>
                    <p className="font-medium">{ev.eventType.replace(/_/g, " ")}</p>
                    {ev.notes && <p className="text-gray-500">{ev.notes}</p>}
                    <p className="text-xs text-gray-400">
                      {new Date(ev.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" /> Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grievance.documents.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded</p>
          ) : (
            <ul className="space-y-2">
              {grievance.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {doc.documentType.replace(/_/g, " ")}
                  </a>
                  <span className="text-xs text-gray-400">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Steward Recommendations */}
      <StewardRecommendations
        grievanceId={id}
        onAssign={() => {
          // Refetch grievance to update assigned steward
          fetch(`/api/grievances/${id}`)
            .then((r) => r.json())
            .then((j) => { if (j.data) setGrievance(j.data); });
        }}
      />

      {/* Contract Clause Intelligence */}
      <ClauseSuggestions
        grievanceId={id}
        description={grievance.description}
      />
    </div>
  );
}
