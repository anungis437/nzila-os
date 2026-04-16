"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Shield,
  Users,
  Lock,
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

interface GovernedDocument {
  id: string;
  title: string;
  filename: string;
  fileUrl: string;
  documentType: string;
  privacyLabel: string;
  createdAt: string;
}

interface CollaboratorAccess {
  id: string;
  userId: string;
  accessRole: string;
  status: string;
  expiresAt: string | null;
  canComment: boolean;
  canUploadDocuments: boolean;
  canEditCaseNotes: boolean;
  canDraftActions: boolean;
  canViewPrivateDocuments: boolean;
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
  primaryLroId?: string | null;
  employerName: string | null;
  cbaArticle: string | null;
  events: GrievanceEvent[];
  documents: GrievanceDocument[];
  governedDocuments?: GovernedDocument[];
  collaborators?: CollaboratorAccess[];
  effectiveAccess?: {
    isPrimaryOwner: boolean;
    canManageAssignments: boolean;
    canUploadDocuments: boolean;
  };
}

const PRIVACY_LABELS = [
  'public_internal',
  'team_confidential',
  'lro_confidential',
  'privileged',
  'case_restricted',
  'highly_sensitive',
] as const;

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
  const [collabUserId, setCollabUserId] = useState("");
  const [collabRole, setCollabRole] = useState<'secondary_lro' | 'reviewer' | 'read_only'>('reviewer');
  const [collabCanViewPrivate, setCollabCanViewPrivate] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadPayload, setUploadPayload] = useState({
    title: '',
    filename: '',
    fileUrl: '',
    mimeType: 'application/pdf',
    documentType: 'evidence',
    privacyLabel: 'team_confidential',
  });

  const refetchGrievance = useCallback(async () => {
    const refetch = await fetch(`/api/grievances/${id}`);
    const refetchJson = await refetch.json();
    if (refetchJson.data) {
      setGrievance(refetchJson.data);
    }
  }, [id]);

  useEffect(() => {
    async function fetchGrievance() {
      try {
        await refetchGrievance();
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    fetchGrievance();
  }, [refetchGrievance]);

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
        await refetchGrievance();
      }
    } finally {
      setUpdating(false);
    }
  }

  async function grantCollaborator() {
    if (!collabUserId) {
      return;
    }
    setAccessSaving(true);
    try {
      await fetch(`/api/grievances/${id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: collabUserId,
          accessRole: collabRole,
          canComment: true,
          canUploadDocuments: collabRole !== 'read_only',
          canEditCaseNotes: collabRole === 'secondary_lro',
          canDraftActions: collabRole === 'secondary_lro',
          canViewPrivateDocuments: collabCanViewPrivate,
        }),
      });
      setCollabUserId('');
      setCollabRole('reviewer');
      setCollabCanViewPrivate(false);
      await refetchGrievance();
    } finally {
      setAccessSaving(false);
    }
  }

  async function revokeCollaborator(assignmentId: string) {
    setAccessSaving(true);
    try {
      await fetch(`/api/grievances/${id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, status: 'revoked' }),
      });
      await refetchGrievance();
    } finally {
      setAccessSaving(false);
    }
  }

  async function uploadGovernedDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadPayload.privacyLabel || !uploadPayload.fileUrl || !uploadPayload.filename || !uploadPayload.title) {
      return;
    }

    setUploadingDoc(true);
    try {
      await fetch(`/api/grievances/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadPayload,
          fileSize: 0,
          contentHash: `manual:${Date.now()}`,
        }),
      });

      setUploadPayload({
        title: '',
        filename: '',
        fileUrl: '',
        mimeType: 'application/pdf',
        documentType: 'evidence',
        privacyLabel: 'team_confidential',
      });
      await refetchGrievance();
    } finally {
      setUploadingDoc(false);
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
            {grievance.primaryLroId && (
              <p><span className="font-medium">Primary LRO:</span> {grievance.primaryLroId}</p>
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
            <Upload className="h-4 w-4" /> Governed Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(grievance.governedDocuments?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded</p>
          ) : (
            <ul className="space-y-2">
              {grievance.governedDocuments?.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {doc.title || doc.filename || doc.documentType.replace(/_/g, " ")}
                  </a>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Lock className="mr-1 inline h-3 w-3" />
                    {doc.privacyLabel}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-2" onSubmit={uploadGovernedDocument}>
            <input
              value={uploadPayload.title}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Document title"
              className="rounded border px-3 py-2 text-sm"
              required
            />
            <input
              value={uploadPayload.filename}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, filename: e.target.value }))}
              placeholder="Filename"
              className="rounded border px-3 py-2 text-sm"
              required
            />
            <input
              value={uploadPayload.fileUrl}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, fileUrl: e.target.value }))}
              placeholder="File URL"
              className="rounded border px-3 py-2 text-sm md:col-span-2"
              required
            />
            <select
              value={uploadPayload.documentType}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, documentType: e.target.value }))}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="evidence">evidence</option>
              <option value="witness_statement">witness_statement</option>
              <option value="correspondence">correspondence</option>
              <option value="other">other</option>
            </select>
            <select
              value={uploadPayload.privacyLabel}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, privacyLabel: e.target.value }))}
              className="rounded border px-3 py-2 text-sm"
              required
            >
              {PRIVACY_LABELS.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={uploadingDoc}
              className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
            >
              {uploadingDoc ? 'Uploading…' : 'Upload governed document'}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Secondary Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Secondary LRO Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <Shield className="mr-1 inline h-4 w-4" />
            Primary ownership remains with {grievance.primaryLroId ?? grievance.unionRepId ?? 'assigned LRO'}. Collaborators get scoped rights only.
          </div>

          {(grievance.collaborators?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">No secondary access assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {grievance.collaborators?.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm">
                  <span className="font-medium">{assignment.userId}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{assignment.accessRole}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${assignment.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {assignment.status}
                  </span>
                  {assignment.expiresAt && (
                    <span className="text-xs text-gray-500">expires {new Date(assignment.expiresAt).toLocaleDateString()}</span>
                  )}
                  {grievance.effectiveAccess?.canManageAssignments && assignment.status === 'active' && (
                    <button
                      type="button"
                      disabled={accessSaving}
                      onClick={() => revokeCollaborator(assignment.id)}
                      className="ml-auto rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {grievance.effectiveAccess?.canManageAssignments && (
            <div className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-3">
              <input
                value={collabUserId}
                onChange={(e) => setCollabUserId(e.target.value)}
                placeholder="Collaborator user ID"
                className="rounded border px-3 py-2 text-sm"
              />
              <select
                value={collabRole}
                onChange={(e) => setCollabRole(e.target.value as 'secondary_lro' | 'reviewer' | 'read_only')}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="secondary_lro">secondary_lro</option>
                <option value="reviewer">reviewer</option>
                <option value="read_only">read_only</option>
              </select>
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={collabCanViewPrivate}
                  onChange={(e) => setCollabCanViewPrivate(e.target.checked)}
                />
                Can view private docs
              </label>
              <button
                type="button"
                disabled={accessSaving || !collabUserId}
                onClick={grantCollaborator}
                className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 md:col-span-3"
              >
                {accessSaving ? 'Saving…' : 'Grant collaborator access'}
              </button>
            </div>
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
