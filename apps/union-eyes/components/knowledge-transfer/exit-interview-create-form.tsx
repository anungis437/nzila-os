'use client';

import { FormEvent, useMemo, useState } from 'react';

type FormState = {
  retiringEmployeeName: string;
  roleInUnion: 'member' | 'steward' | 'chief_steward' | 'officer' | 'admin';
  yearsOfService: string;
  retirementReason: 'retirement' | 'career_change' | 'health' | 'relocation' | 'other';
  title: string;
  summary: string;
  keyLessons: string;
  bestPractices: string;
  bargainingAdvice: string;
  mediationAdvice: string;
  incomingOfficerAdvice: string;
  topics: string;
};

const defaultState: FormState = {
  retiringEmployeeName: '',
  roleInUnion: 'steward',
  yearsOfService: '',
  retirementReason: 'retirement',
  title: '',
  summary: '',
  keyLessons: '',
  bestPractices: '',
  bargainingAdvice: '',
  mediationAdvice: '',
  incomingOfficerAdvice: '',
  topics: '',
};

export function ExitInterviewCreateForm() {
  const [state, setState] = useState<FormState>(defaultState);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topics = useMemo(
    () => state.topics.split(',').map((value) => value.trim()).filter(Boolean),
    [state.topics],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/exit-interviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...state,
          yearsOfService: Number(state.yearsOfService),
          topics,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? 'Failed to create interview draft');
      }

      setMessage('Draft created successfully. You can now review and submit it.');
      setState(defaultState);
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : 'Unknown error';
      setError(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-lg border bg-card p-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Exit Interview</h1>
      <p className="text-sm text-muted-foreground">
        Capture strategic knowledge from senior employees before retirement.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Retiring employee name</span>
          <input
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={state.retiringEmployeeName}
            onChange={(event) => setState((prev) => ({ ...prev, retiringEmployeeName: event.target.value }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Years of service</span>
          <input
            required
            type="number"
            min={0}
            max={80}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={state.yearsOfService}
            onChange={(event) => setState((prev) => ({ ...prev, yearsOfService: event.target.value }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Role in union</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={state.roleInUnion}
            onChange={(event) =>
              setState((prev) => ({ ...prev, roleInUnion: event.target.value as FormState['roleInUnion'] }))
            }
          >
            <option value="member">Member</option>
            <option value="steward">Steward</option>
            <option value="chief_steward">Chief Steward</option>
            <option value="officer">Officer</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Retirement reason</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={state.retirementReason}
            onChange={(event) =>
              setState((prev) => ({ ...prev, retirementReason: event.target.value as FormState['retirementReason'] }))
            }
          >
            <option value="retirement">Retirement</option>
            <option value="career_change">Career change</option>
            <option value="health">Health</option>
            <option value="relocation">Relocation</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Interview title</span>
        <input
          required
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={state.title}
          onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Summary</span>
        <textarea
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={state.summary}
          onChange={(event) => setState((prev) => ({ ...prev, summary: event.target.value }))}
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Key lessons</span>
        <textarea
          required
          rows={5}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={state.keyLessons}
          onChange={(event) => setState((prev) => ({ ...prev, keyLessons: event.target.value }))}
        />
      </label>

      <div className="grid gap-4">
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Best practices</span>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.bestPractices}
            onChange={(event) => setState((prev) => ({ ...prev, bestPractices: event.target.value }))}
          />
        </label>

        <label className="space-y-2 block">
          <span className="text-sm font-medium">Bargaining advice</span>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.bargainingAdvice}
            onChange={(event) => setState((prev) => ({ ...prev, bargainingAdvice: event.target.value }))}
          />
        </label>

        <label className="space-y-2 block">
          <span className="text-sm font-medium">Mediation advice</span>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.mediationAdvice}
            onChange={(event) => setState((prev) => ({ ...prev, mediationAdvice: event.target.value }))}
          />
        </label>

        <label className="space-y-2 block">
          <span className="text-sm font-medium">Advice for incoming officers</span>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.incomingOfficerAdvice}
            onChange={(event) => setState((prev) => ({ ...prev, incomingOfficerAdvice: event.target.value }))}
          />
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Topics (comma-separated)</span>
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={state.topics}
          onChange={(event) => setState((prev) => ({ ...prev, topics: event.target.value }))}
          placeholder="bargaining, mediation, grievance triage"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {submitting ? 'Creating draft...' : 'Create Draft'}
      </button>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
