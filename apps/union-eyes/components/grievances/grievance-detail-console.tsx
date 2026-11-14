"use client";

/**
 * The detail of one grievance: its status and the changes the server's lifecycle rules allow, its facts, its timeline, its governed
 * documents and who else has access (see grievance-detail-model.ts for what is read and the rules applied before a request is made).
 *
 * Every request is read for what it answered. A load that fails is shown with the reason the server gives and a retry (never as "not
 * found"); a write that fails shows the server's reason and changes nothing on screen; a write that succeeded and a refresh that then
 * failed says so, instead of showing the old data as current. The document form registers a document that is already stored at a web
 * address: it carries no file, so it sends no size and no content hash (the server records the version as unverified), and it says so.
 * Every word comes from the message catalogs (grievanceDetailConsole), in both languages.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, FileText, Lock, Scale, Shield, Upload, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseIntelligencePanel } from "@/components/grievances/case-intelligence-panel";
import { StewardRecommendations } from "@/components/steward-recommendations";
import { ClauseSuggestions } from "@/components/clause-suggestions";
import {
  ACCESS_ROLES,
  DOCUMENT_TYPES,
  GRIEVANCE_STATUSES,
  PRIVACY_LABELS,
  STATUS_COLORS,
  isKnownStatus,
  maySetStatus,
  mimeTypeOf,
  nextStatuses,
  readGrievanceDetail,
  webUrl,
  type GrievanceDetail,
} from "@/components/grievances/grievance-detail-model";
import { readApiError } from "@/lib/client/api-envelope";

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const EMPTY_UPLOAD = { title: "", filename: "", fileUrl: "", documentType: "evidence", privacyLabel: "team_confidential" };

// The tokens the catalog words (grievanceDetailConsole.statuses, .types, .priorities, .privacyLabels, .accessRoles, .accessStatuses); a stored
// value outside them is shown as stored rather than hidden or guessed.
const STATUSES = new Set<string>(GRIEVANCE_STATUSES);
const TYPES = new Set(["individual", "group", "policy", "contract", "harassment", "discrimination", "safety", "seniority", "discipline", "termination", "other"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const PRIVACY = new Set<string>(PRIVACY_LABELS);
const ROLES = new Set<string>(ACCESS_ROLES);
const ACCESS_STATUSES = new Set(["active", "revoked", "expired"]);

export function GrievanceDetailConsole() {
  const t = useTranslations("grievanceDetailConsole");
  const format = useFormatter();
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [grievance, setGrievance] = useState<GrievanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [collabUserId, setCollabUserId] = useState("");
  const [collabRole, setCollabRole] = useState<(typeof ACCESS_ROLES)[number]>("reviewer");
  const [collabCanViewPrivate, setCollabCanViewPrivate] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadPayload, setUploadPayload] = useState(EMPTY_UPLOAD);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  const moment = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
  };
  const day = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format.dateTime(date, { dateStyle: "medium" });
  };
  const labelOf = (group: string, members: ReadonlySet<string>, token: string) => (members.has(token) ? t(`${group}.${token}`) : token);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(`/api/grievances/${id}`, { signal });
      if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
      setGrievance(readGrievanceDetail(await response.json()));
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    const first = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await load(controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(errorText(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    first();
    return () => controller.abort();
  }, [load, reload]);

  // After a change the server accepted, the screen is read again; if that read fails, what is shown is said to be out of date.
  const refresh = useCallback(async () => {
    try {
      await load();
      setRefreshError(null);
    } catch (error) {
      setRefreshError(errorText(error));
    }
  }, [load]);

  async function advanceStatus(next: string) {
    setUpdating(true);
    setStatusError(null);
    try {
      const response = await fetch(`/api/grievances/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, notes: statusNote.trim() || undefined }),
      });
      if (!response.ok) {
        setStatusError(await readApiError(response, t("statusFailed")));
        return;
      }
      setStatusNote("");
      await refresh();
    } catch (error) {
      setStatusError(errorText(error));
    } finally {
      setUpdating(false);
    }
  }

  async function grantCollaborator() {
    if (!collabUserId) return;
    setAccessSaving(true);
    setAccessError(null);
    try {
      const needsExpiry = collabRole !== "secondary_lro" || collabCanViewPrivate;
      const response = await fetch(`/api/grievances/${id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: collabUserId,
          accessRole: collabRole,
          expiresAt: needsExpiry ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
          canComment: true,
          canUploadDocuments: collabRole === "secondary_lro",
          canEditCaseNotes: collabRole === "secondary_lro",
          canDraftActions: collabRole === "secondary_lro",
          canViewPrivateDocuments: collabCanViewPrivate,
        }),
      });
      if (!response.ok) {
        setAccessError(await readApiError(response, t("accessGrantFailed")));
        return;
      }
      setCollabUserId("");
      setCollabRole("reviewer");
      setCollabCanViewPrivate(false);
      await refresh();
    } catch (error) {
      setAccessError(errorText(error));
    } finally {
      setAccessSaving(false);
    }
  }

  async function revokeCollaborator(assignmentId: string) {
    setAccessSaving(true);
    setAccessError(null);
    try {
      const response = await fetch(`/api/grievances/${id}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, status: "revoked" }),
      });
      if (!response.ok) {
        setAccessError(await readApiError(response, t("accessRevokeFailed")));
        return;
      }
      await refresh();
    } catch (error) {
      setAccessError(errorText(error));
    } finally {
      setAccessSaving(false);
    }
  }

  async function uploadGovernedDocument(event: React.FormEvent) {
    event.preventDefault();
    setUploaded(false);
    setUploadError(null);
    const address = webUrl(uploadPayload.fileUrl);
    if (address === null) {
      setUploadError(t("uploadNeedsWebUrl"));
      return;
    }

    setUploadingDoc(true);
    try {
      const response = await fetch(`/api/grievances/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadPayload.title.trim(),
          filename: uploadPayload.filename.trim(),
          fileUrl: address,
          mimeType: mimeTypeOf(uploadPayload.filename),
          documentType: uploadPayload.documentType,
          privacyLabel: uploadPayload.privacyLabel,
        }),
      });
      // A document the server did not accept is neither shown as added nor cleared from the form.
      if (!response.ok) {
        setUploadError(await readApiError(response, t("uploadFailed")));
        return;
      }
      setUploadPayload(EMPTY_UPLOAD);
      setUploaded(true);
      await refresh();
    } catch (error) {
      setUploadError(errorText(error));
    } finally {
      setUploadingDoc(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-label={t("loading")} className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!grievance) {
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-3 py-16 text-center text-gray-700">
        <AlertCircle className="mx-auto h-10 w-10" aria-hidden="true" />
        <p className="font-semibold">{t("loadFailedTitle")}</p>
        <p className="text-sm">{loadError}</p>
        <button
          type="button"
          onClick={() => setReload((count) => count + 1)}
          className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  const statusLabel = (status: string) => labelOf("statuses", STATUSES, status);
  const followingStatuses = nextStatuses(grievance.status, grievance.primaryLroId);
  const internal = grievance.effectiveAccess.canViewInternal;
  const mayChangeStatus = internal && maySetStatus(grievance);
  const owner = grievance.primaryLroId ?? t("assignedRepresentative");

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      {refreshError !== null && (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">{t("refreshFailedTitle")}</p>
            <p>{t("refreshFailedBody")}</p>
            <p className="text-xs">{refreshError}</p>
            <button type="button" onClick={refresh} className="rounded border border-amber-400 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100">
              {t("retry")}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <button type="button" onClick={() => router.back()} aria-label={t("back")} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold">{grievance.title || grievance.grievanceNumber}</h1>
          <p className="text-sm text-gray-500">{grievance.grievanceNumber}</p>
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isKnownStatus(grievance.status) ? STATUS_COLORS[grievance.status] : "bg-gray-100"}`}
        >
          {statusLabel(grievance.status)}
        </span>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4" aria-hidden="true" /> {t("statusTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{t("currentStatus", { status: statusLabel(grievance.status) })}</p>

          {!mayChangeStatus ? (
            <p className="text-sm text-gray-500">{t("statusNoAuthority")}</p>
          ) : followingStatuses.length === 0 ? (
            <p className="text-sm text-gray-500">{t("statusNoNext")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                aria-label={t("transitionNote")}
                placeholder={t("transitionNote")}
                className="min-w-48 flex-1 rounded border px-3 py-1.5 text-sm"
              />
              {followingStatuses.map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={updating}
                  onClick={() => advanceStatus(next)}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t("moveTo", { status: statusLabel(next) })}
                </button>
              ))}
            </div>
          )}

          {statusError !== null && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {statusError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Case Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" aria-hidden="true" /> {t("caseDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {grievance.type !== "" && (
              <p>
                <span className="font-medium">{t("type")}:</span> {labelOf("types", TYPES, grievance.type)}
              </p>
            )}
            {grievance.priority !== "" && (
              <p>
                <span className="font-medium">{t("priority")}:</span> {labelOf("priorities", PRIORITIES, grievance.priority)}
              </p>
            )}
            {grievance.filedDate && (
              <p>
                <span className="font-medium">{t("filed")}:</span> {day(grievance.filedDate)}
              </p>
            )}
            {grievance.employerName && (
              <p>
                <span className="font-medium">{t("employer")}:</span> {grievance.employerName}
              </p>
            )}
            {grievance.cbaArticle && (
              <p>
                <span className="font-medium">{t("cbaArticle")}:</span> {grievance.cbaArticle}
              </p>
            )}
            {grievance.primaryLroId && (
              <p>
                <span className="font-medium">{t("primaryRepresentative")}:</span> {grievance.primaryLroId}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("description")}</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-gray-700">{grievance.description ?? t("noDescription")}</CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" aria-hidden="true" /> {t("timeline")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grievance.events.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noEvents")}</p>
          ) : (
            <ul className="space-y-3">
              {grievance.events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{event.eventType.replace(/_/g, " ")}</p>
                    {event.notes && <p className="text-gray-500">{event.notes}</p>}
                    <p className="text-xs text-gray-500">{moment(event.createdAt)}</p>
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
            <Upload className="h-4 w-4" aria-hidden="true" /> {t("documents")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {grievance.governedDocuments.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noDocuments")}</p>
          ) : (
            <ul className="space-y-2">
              {grievance.governedDocuments.map((doc) => {
                const name = doc.title || doc.filename || doc.documentType.replace(/_/g, " ");
                const href = webUrl(doc.fileUrl);
                return (
                  <li key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {name}
                      </a>
                    ) : (
                      <span>{name}</span>
                    )}
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      {labelOf("privacyLabels", PRIVACY, doc.privacyLabel)}
                    </span>
                    <span className="text-xs text-gray-500">{day(doc.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {internal && grievance.effectiveAccess.canUploadDocuments && <form className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-2" onSubmit={uploadGovernedDocument}>
            <p className="text-xs text-gray-600 md:col-span-2">{t("uploadNote")}</p>
            <input
              value={uploadPayload.title}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, title: e.target.value }))}
              aria-label={t("titlePlaceholder")}
              placeholder={t("titlePlaceholder")}
              className="rounded border px-3 py-2 text-sm"
              required
            />
            <input
              value={uploadPayload.filename}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, filename: e.target.value }))}
              aria-label={t("filenamePlaceholder")}
              placeholder={t("filenamePlaceholder")}
              className="rounded border px-3 py-2 text-sm"
              required
            />
            <input
              type="url"
              value={uploadPayload.fileUrl}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, fileUrl: e.target.value }))}
              aria-label={t("urlPlaceholder")}
              placeholder={t("urlPlaceholder")}
              className="rounded border px-3 py-2 text-sm md:col-span-2"
              required
            />
            <select
              value={uploadPayload.documentType}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, documentType: e.target.value }))}
              aria-label={t("documentType")}
              className="rounded border px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`documentTypes.${type}`)}
                </option>
              ))}
            </select>
            <select
              value={uploadPayload.privacyLabel}
              onChange={(e) => setUploadPayload((prev) => ({ ...prev, privacyLabel: e.target.value }))}
              aria-label={t("privacyLabel")}
              className="rounded border px-3 py-2 text-sm"
              required
            >
              {PRIVACY_LABELS.map((label) => (
                <option key={label} value={label}>
                  {t(`privacyLabels.${label}`)}
                </option>
              ))}
            </select>
            {uploadError !== null && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 md:col-span-2">
                <span className="font-semibold">{t("uploadFailed")}.</span> {uploadError}
              </p>
            )}
            {uploaded && (
              <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800 md:col-span-2">
                {t("uploadSucceeded")}
              </p>
            )}
            <button
              type="submit"
              disabled={uploadingDoc}
              className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
            >
              {uploadingDoc ? t("uploading") : t("upload")}
            </button>
          </form>}
        </CardContent>
      </Card>

      {internal && <>
      {/* Case Intelligence */}
      <CaseIntelligencePanel caseId={id} />

      {/* Secondary Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" aria-hidden="true" /> {t("secondaryAccess")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <Shield className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t("primaryOwnership", { owner })}
          </div>

          {grievance.collaborators.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noAssignments")}</p>
          ) : (
            <div className="space-y-2">
              {grievance.collaborators.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm">
                  <span className="font-medium">{assignment.userId}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {labelOf("accessRoles", ROLES, assignment.accessRole)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${assignment.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                    {labelOf("accessStatuses", ACCESS_STATUSES, assignment.status)}
                  </span>
                  {assignment.expiresAt && <span className="text-xs text-gray-500">{t("expires", { date: day(assignment.expiresAt) })}</span>}
                  {grievance.effectiveAccess.canManageAssignments && assignment.status === "active" && (
                    <button
                      type="button"
                      disabled={accessSaving}
                      onClick={() => revokeCollaborator(assignment.id)}
                      className="ml-auto rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {t("revoke")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {accessError !== null && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {accessError}
            </p>
          )}

          {grievance.effectiveAccess.canManageAssignments && (
            <div className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-3">
              <input
                value={collabUserId}
                onChange={(e) => setCollabUserId(e.target.value)}
                aria-label={t("collaboratorPlaceholder")}
                placeholder={t("collaboratorPlaceholder")}
                className="rounded border px-3 py-2 text-sm"
              />
              <select
                value={collabRole}
                onChange={(e) => setCollabRole(e.target.value as (typeof ACCESS_ROLES)[number])}
                aria-label={t("accessRole")}
                className="rounded border px-3 py-2 text-sm"
              >
                {ACCESS_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`accessRoles.${role}`)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input type="checkbox" checked={collabCanViewPrivate} onChange={(e) => setCollabCanViewPrivate(e.target.checked)} />
                {t("canViewPrivate")}
              </label>
              <p className="text-xs text-gray-600 md:col-span-3">{t("grantExpiryHint")}</p>
              <button
                type="button"
                disabled={accessSaving || !collabUserId}
                onClick={grantCollaborator}
                className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 md:col-span-3"
              >
                {accessSaving ? t("saving") : t("grant")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steward Recommendations */}
      {grievance.effectiveAccess.canManageAssignments && <StewardRecommendations grievanceId={id} onAssign={() => void refresh()} />}

      {/* Contract Clause Intelligence */}
      <ClauseSuggestions grievanceId={id} description={grievance.description ?? ""} />
      </>}
    </div>
  );
}
