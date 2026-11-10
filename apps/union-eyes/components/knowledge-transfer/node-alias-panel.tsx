'use client';

/**
 * Node Alias Panel
 *
 * The alias-management interface for app/api/exit-interviews/node-aliases (graph-identity.ts, node-alias-store.ts):
 * see every identity decision (active and superseded), whether each active alias's target resolves to exactly one
 * current node right now, and (national_officer+) record a new alias - how a semantic rename is carried, or how a
 * collision between two labels is resolved. Recording an alias changes which node verified evidence resolves to, so
 * affected verified dependencies will require re-verification. The API enforces the author floor; this panel shows
 * whatever it returns (including a 400/403).
 */

import { useCallback, useEffect, useState } from 'react';
import { envelopeRow, envelopeRows, failureText, readApiError } from '@/lib/client/api-envelope';

type TargetResolution =
  | { status: 'resolved'; nodeId: string; via: 'direct' | 'alias' }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: string[] }
  | null;

interface NodeAliasRow {
  id: string;
  aliasLabel: string;
  canonicalConceptLabel: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  supersededBy: string | null;
  supersededAt: string | null;
  targetResolution: TargetResolution;
}

const EMPTY = { aliasLabel: '', canonicalConceptLabel: '', reason: '' };

function describeResolution(resolution: TargetResolution): { text: string; tone: string } {
  if (resolution === null) return { text: 'superseded', tone: 'text-slate-500' };
  if (resolution.status === 'resolved') return { text: `resolves to ${resolution.nodeId}`, tone: 'text-emerald-700' };
  if (resolution.status === 'ambiguous') return { text: `ambiguous: matches ${resolution.candidates.join(', ')}`, tone: 'text-amber-700' };
  return { text: 'target is not a current node', tone: 'text-red-700' };
}

export function NodeAliasPanel() {
  const [aliases, setAliases] = useState<NodeAliasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchAliases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/exit-interviews/node-aliases');
      if (!res.ok) throw new Error(await readApiError(res, 'Failed to load node aliases'));
      setAliases(envelopeRows(await res.json()) as NodeAliasRow[]);
    } catch (err) {
      setError(failureText(err, 'Failed to load node aliases'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAliases();
  }, [fetchAliases]);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/exit-interviews/node-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Failed to record alias'));
      // The route answers with the record it wrote; a different shape is a failure, not a silent success.
      envelopeRow(await res.json());
      setDraft(EMPTY);
      await fetchAliases();
    } catch (err) {
      setError(failureText(err, 'Failed to record alias'));
    } finally {
      setSaving(false);
    }
  };

  const canSave = draft.aliasLabel.trim() && draft.canonicalConceptLabel.trim() && draft.reason.trim();

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4" aria-label="Node identity aliases">
      <div className="text-xs font-semibold text-slate-700">Node Identity Aliases</div>
      <p className="text-xs text-slate-600">
        An alias records that a label names the same organizational concept as a current node - for a rename, or to
        resolve two labels that collide. Aliases are never inferred. Recording one supersedes any earlier alias for the
        same label (kept in history), and any verified dependency whose node changes as a result must be re-verified.
      </p>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{error}</div>}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 gap-3">
        <input
          className="text-xs border border-slate-300 rounded px-2 py-1.5"
          placeholder="Label (old or colliding name)"
          aria-label="Alias label"
          value={draft.aliasLabel}
          onChange={(e) => setDraft((prev) => ({ ...prev, aliasLabel: e.target.value }))}
        />
        <input
          className="text-xs border border-slate-300 rounded px-2 py-1.5"
          placeholder="Current node label it refers to"
          aria-label="Canonical concept label"
          value={draft.canonicalConceptLabel}
          onChange={(e) => setDraft((prev) => ({ ...prev, canonicalConceptLabel: e.target.value }))}
        />
        <input
          className="text-xs border border-slate-300 rounded px-2 py-1.5 col-span-2"
          placeholder="Reason (why these name the same concept)"
          aria-label="Reason"
          value={draft.reason}
          onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))}
        />
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-40 w-fit"
        >
          {saving ? 'Recording…' : 'Record alias'}
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : aliases.length === 0 ? (
        <div className="text-xs text-slate-500">No aliases have been recorded.</div>
      ) : (
        <ul className="space-y-1.5">
          {aliases.map((alias) => {
            const resolution = describeResolution(alias.targetResolution);
            return (
              <li key={alias.id} className={`border rounded-lg p-2.5 text-xs ${alias.supersededAt ? 'opacity-60 border-slate-200' : 'border-slate-300'}`}>
                <div className="font-medium">
                  {alias.aliasLabel} → {alias.canonicalConceptLabel}
                </div>
                <div className="opacity-70">{alias.reason} — {alias.createdBy}, {new Date(alias.createdAt).toLocaleDateString()}</div>
                <div className={resolution.tone}>{resolution.text}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
