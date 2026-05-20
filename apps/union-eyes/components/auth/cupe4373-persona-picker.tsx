'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Persona = {
  role: 'member' | 'steward' | 'officer';
  email: string;
  displayName: string;
  position: string;
  description: string;
};

// Mirrors apps/union-eyes/scripts/seed-cupe4373-demo.ts → seedAuthPersonas()
const DEMO_PASSWORD = 'Demo!2026-Foundation';

const PERSONAS: Persona[] = [
  {
    role: 'member',
    email: 'member@cupe4373.demo',
    displayName: 'Maya Bertrand',
    position: 'Registered Practical Nurse',
    description: 'Member view: file grievances, browse own cases, read CBA.',
  },
  {
    role: 'steward',
    email: 'steward@cupe4373.demo',
    displayName: 'Denise Laurent',
    position: 'Chief Steward — 7 West',
    description: 'Steward view: triage caseload, add notes, escalate.',
  },
  {
    role: 'officer',
    email: 'officer@cupe4373.demo',
    displayName: 'Aubert N.',
    position: 'Local President',
    description: 'Officer view: decisions, broadcasts, governance proofs.',
  },
];

type Props = {
  postLoginPath: string;
};

export function Cupe4373PersonaPicker({ postLoginPath }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(persona: Persona) {
    setPending(persona.role);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: persona.email, password: DEMO_PASSWORD }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body?.error ?? `Sign-in failed (HTTP ${res.status})`);
        setPending(null);
        return;
      }
      router.replace(postLoginPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setPending(null);
    }
  }

  return (
    <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-amber-900 dark:text-amber-200">
          CUPE 4373 Foundation Demo · one-click sign-in
        </div>
        <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-900 dark:bg-amber-800 dark:text-amber-100">
          demo
        </span>
      </div>
      <p className="mb-3 text-amber-800 dark:text-amber-300">
        Pick a persona below — the system will sign you in with the demo
        password <code className="font-mono">{DEMO_PASSWORD}</code> and route
        you into the role-scoped dashboard. Each persona has real Argon2id
        credentials and a real org-scoped role binding.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {PERSONAS.map((p) => {
          const isPending = pending === p.role;
          return (
            <button
              key={p.role}
              type="button"
              disabled={pending !== null}
              onClick={() => signInAs(p)}
              className="rounded-md border border-amber-300 bg-white p-3 text-left transition hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/60"
            >
              <div className="text-xs font-mono uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {p.role}
              </div>
              <div className="mt-0.5 font-semibold text-amber-950 dark:text-amber-100">
                {p.displayName}
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-300">
                {p.position}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-amber-900/80 dark:text-amber-200/80">
                {p.description}
              </div>
              <div className="mt-2 text-[11px] font-mono text-amber-700 dark:text-amber-400">
                {isPending ? 'Signing in…' : `Sign in as ${p.role}`}
              </div>
            </button>
          );
        })}
      </div>
      {error ? (
        <div className="mt-3 rounded bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
