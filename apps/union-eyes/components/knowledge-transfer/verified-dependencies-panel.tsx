'use client';

/**
 * Verified Dependencies Panel
 *
 * The reviewer interface for lib/knowledge-transfer/propagation/verified-dependency-store.ts
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE): submit a directional
 * dependency for review, see every record's status, and (national_officer+) verify, reject or revoke a record.
 * The API enforces the reviewer floor and the distinct-submitter rule; this panel surfaces whatever it returns
 * (including a 403/409) rather than guessing who is allowed to act.
 */

import { useCallback, useEffect, useState } from 'react';

interface VerifiedDependencyRecord {
  id: string;
  dependentNodeId: string;
  dependsOnNodeId: string;
  processOrSystem: string;
  responsibleAuthority: string;
  evidenceReference: string;
  evidenceReferenceType: 'document' | 'external_citation';
  evidenceDocumentId: string | null;
  status: 'pending_review' | 'verified' | 'rejected' | 'revoked';
  submittedBy: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<VerifiedDependencyRecord['status'], string> = {
  pending_review: 'bg-amber-50 border-amber-200 text-amber-700',
  verified: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected: 'bg-slate-50 border-slate-200 text-slate-600',
  revoked: 'bg-red-50 border-red-200 text-red-700',
};

const EMPTY_SUBMISSION = {
  dependentNodeId: '', dependsOnNodeId: '', processOrSystem: '', responsibleAuthority: '', evidenceReference: '',
  evidenceReferenceType: 'external_citation' as 'document' | 'external_citation',
  evidenceDocumentId: '',
};

export function VerifiedDependenciesPanel() {
  const [records, setRecords] = useState<VerifiedDependencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState(EMPTY_SUBMISSION);
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/exit-interviews/verified-dependencies');
      const json = (await res.json()) as { data?: VerifiedDependencyRecord[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load verified dependencies');
      setRecords(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verified dependencies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const { evidenceDocumentId, ...rest } = submission;
      const payload = submission.evidenceReferenceType === 'document' ? { ...rest, evidenceDocumentId } : rest;
      const res = await fetch('/api/exit-interviews/verified-dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit dependency evidence');
      setSubmission(EMPTY_SUBMISSION);
      await fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit dependency evidence');
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (id: string, action: 'verify' | 'reject' | 'revoke') => {
    try {
      setActioningId(id);
      setError(null);
      const res = await fetch(`/api/exit-interviews/verified-dependencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed to ${action} this record`);
      await fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} this record`);
    } finally {
      setActioningId(null);
    }
  };

  const canSubmit =
    submission.dependentNodeId.trim().length > 0 &&
    submission.dependsOnNodeId.trim().length > 0 &&
    submission.processOrSystem.trim().length > 0 &&
    submission.responsibleAuthority.trim().length > 0 &&
    submission.evidenceReference.trim().length > 0 &&
    (submission.evidenceReferenceType === 'external_citation' || submission.evidenceDocumentId.trim().length > 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Verified dependency evidence is a separate, reviewed graph from the exploratory propagation map: a directional
        dependency here is only treated as established once a reviewer distinct from the submitter attributes it to a
        named process or system and a named responsible authority, with an evidence reference.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{error}</div>
      )}

      {/* Submission form */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-700">Submit Dependency Evidence</div>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="text-xs border border-slate-300 rounded px-2 py-1.5"
            placeholder="Dependent node id"
            value={submission.dependentNodeId}
            onChange={(e) => setSubmission((prev) => ({ ...prev, dependentNodeId: e.target.value }))}
          />
          <input
            className="text-xs border border-slate-300 rounded px-2 py-1.5"
            placeholder="Depends-on node id"
            value={submission.dependsOnNodeId}
            onChange={(e) => setSubmission((prev) => ({ ...prev, dependsOnNodeId: e.target.value }))}
          />
          <input
            className="text-xs border border-slate-300 rounded px-2 py-1.5"
            placeholder="Process or system"
            value={submission.processOrSystem}
            onChange={(e) => setSubmission((prev) => ({ ...prev, processOrSystem: e.target.value }))}
          />
          <input
            className="text-xs border border-slate-300 rounded px-2 py-1.5"
            placeholder="Responsible authority"
            value={submission.responsibleAuthority}
            onChange={(e) => setSubmission((prev) => ({ ...prev, responsibleAuthority: e.target.value }))}
          />
          <input
            className="text-xs border border-slate-300 rounded px-2 py-1.5 col-span-2"
            placeholder="Evidence reference (document title, SOP, record locator)"
            value={submission.evidenceReference}
            onChange={(e) => setSubmission((prev) => ({ ...prev, evidenceReference: e.target.value }))}
          />
          <select
            className="text-xs border border-slate-300 rounded px-2 py-1.5"
            value={submission.evidenceReferenceType}
            onChange={(e) => setSubmission((prev) => ({ ...prev, evidenceReferenceType: e.target.value as 'document' | 'external_citation' }))}
          >
            <option value="external_citation">External citation (not system-verifiable)</option>
            <option value="document">Stored document (resolved + access-checked)</option>
          </select>
          {submission.evidenceReferenceType === 'document' && (
            <input
              className="text-xs border border-slate-300 rounded px-2 py-1.5"
              placeholder="Document ID (uuid)"
              value={submission.evidenceDocumentId}
              onChange={(e) => setSubmission((prev) => ({ ...prev, evidenceDocumentId: e.target.value }))}
            />
          )}
        </div>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>

      {/* Records list */}
      {loading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : records.length === 0 ? (
        <div className="text-xs text-slate-500">No dependency evidence has been submitted yet.</div>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => (
            <li key={record.id} className={`border rounded-lg p-3 ${STATUS_STYLES[record.status]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs">
                  <div className="font-medium">{record.dependentNodeId} depends on {record.dependsOnNodeId}</div>
                  <div>{record.processOrSystem} — {record.responsibleAuthority}</div>
                  <div className="opacity-70">
                    Evidence: {record.evidenceReference}{' '}
                    <span className={`uppercase text-[9px] rounded px-1 ${record.evidenceReferenceType === 'document' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      {record.evidenceReferenceType === 'document' ? 'resolved document' : 'unverified citation'}
                    </span>
                  </div>
                  <div className="opacity-70 uppercase text-[10px] mt-1">{record.status}</div>
                </div>
                {record.status === 'pending_review' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => act(record.id, 'verify')}
                      disabled={actioningId === record.id}
                      className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-40"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => act(record.id, 'reject')}
                      disabled={actioningId === record.id}
                      className="text-[11px] px-2 py-1 rounded bg-slate-600 text-white disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {record.status === 'verified' && (
                  <button
                    onClick={() => act(record.id, 'revoke')}
                    disabled={actioningId === record.id}
                    className="text-[11px] px-2 py-1 rounded bg-red-600 text-white disabled:opacity-40 shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
