'use client';

/**
 * MemoryHoldersClient \u2014 inline-editable carrier cards with live cartography.
 *
 * Posture:
 *  - Editorial: no spinners, no toasts. Saves happen on blur.
 *  - Anti-surveillance: displayName, responsibility, and notes never leave
 *    the workbook record; only deterministic aggregates inform the density
 *    preview and the eventual CRM sync.
 */

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import {
  runStewardshipCartography,
  type CartographyResult,
} from '@/lib/workbook/engines/stewardshipCartography';
import type { Locale } from '@/lib/workbook/copy';

type TenureBand = '0_3y' | '3_7y' | '7_15y' | '15y_plus';
type Criticality = 'routine' | 'important' | 'load_bearing' | 'institution_critical';

interface Holder {
  id: string;
  role: string;
  displayName: string | null;
  responsibility: string;
  tenureBand: TenureBand | null;
  criticality: Criticality | null;
  successorIdentified: boolean;
  notes: string | null;
}

type Cartography = CartographyResult;

interface Props {
  workbookId: string;
  locale: Locale;
  initialHolders: Holder[];
  initialCartography: Cartography;
  hubHref: string;
}

const TENURE_LABELS: Record<TenureBand, { 'en-CA': string; 'fr-CA': string }> = {
  '0_3y': { 'en-CA': 'Under 3 years', 'fr-CA': 'Moins de 3 ans' },
  '3_7y': { 'en-CA': '3 to 7 years', 'fr-CA': '3 \u00e0 7 ans' },
  '7_15y': { 'en-CA': '7 to 15 years', 'fr-CA': '7 \u00e0 15 ans' },
  '15y_plus': { 'en-CA': '15+ years', 'fr-CA': '15 ans et plus' },
};

const CRIT_LABELS: Record<Criticality, { 'en-CA': string; 'fr-CA': string }> = {
  routine: { 'en-CA': 'Routine', 'fr-CA': 'Courante' },
  important: { 'en-CA': 'Important', 'fr-CA': 'Importante' },
  load_bearing: { 'en-CA': 'Load-bearing', 'fr-CA': 'Porteuse' },
  institution_critical: { 'en-CA': 'Institution-critical', 'fr-CA': 'Critique pour l\u2019institution' },
};

function copy(locale: Locale) {
  const fr = locale === 'fr-CA';
  return {
    eyebrow: fr ? 'Module 1' : 'Module 1',
    title: fr ? 'Porteurs de m\u00e9moire institutionnelle' : 'Institutional Memory Holders',
    intro: fr
      ? 'Cartographiez chaque personne qui transporte une m\u00e9moire op\u00e9rationnelle, r\u00e9glementaire ou relationnelle indispensable. La densit\u00e9 de gestion est calcul\u00e9e en direct.'
      : 'Map every person carrying operational, regulatory, or relational memory that the institution depends on. Stewardship density is calculated live.',
    back: fr ? 'Retour au cahier' : 'Back to workbook',
    add: fr ? 'Ajouter un porteur' : 'Add a holder',
    role: fr ? 'R\u00f4le' : 'Role',
    displayName: fr ? 'Nom (facultatif)' : 'Name (optional)',
    responsibility: fr ? 'Responsabilit\u00e9 port\u00e9e' : 'Responsibility carried',
    tenure: fr ? 'Anciennet\u00e9' : 'Tenure',
    criticality: fr ? 'Criticit\u00e9' : 'Criticality',
    successor: fr ? 'Successeur identifi\u00e9' : 'Successor identified',
    notes: fr ? 'Notes (priv\u00e9es)' : 'Notes (private)',
    remove: fr ? 'Retirer' : 'Remove',
    none: fr ? 'Aucun porteur enregistr\u00e9.' : 'No holders recorded yet.',
    densityLabel: fr ? 'Densit\u00e9 de gestion' : 'Stewardship density',
    densityDescription: fr
      ? 'Indice synth\u00e9tique de concentration. Plus l\u2019indice est \u00e9lev\u00e9, plus la perte d\u2019un seul porteur fragilise la continuit\u00e9.'
      : 'Composite concentration index. The higher the index, the more fragile continuity becomes if a single holder is lost.',
    signals: fr ? 'Signaux de cartographie' : 'Cartography signals',
    select: fr ? 'S\u00e9lectionner' : 'Select',
    privacy: fr
      ? 'Aucun nom, responsabilit\u00e9 ou note ne quitte ce cahier. Seules les agr\u00e9gations d\u00e9terministes sont utilis\u00e9es ailleurs.'
      : 'No names, responsibilities, or notes leave this workbook. Only deterministic aggregates are used elsewhere.',
  };
}

export default function MemoryHoldersClient({
  workbookId,
  locale,
  initialHolders,
  initialCartography,
  hubHref,
}: Props) {
  const t = copy(locale);
  const [holders, setHolders] = useState<Holder[]>(initialHolders);
  const [cartography, setCartography] = useState<Cartography>(initialCartography);
  const [, startTransition] = useTransition();

  const recompute = (next: Holder[]) => {
    const c = runStewardshipCartography(
      next.map((h) => ({
        id: h.id,
        role: h.role,
        criticality: h.criticality,
        tenureBand: h.tenureBand,
        successorIdentified: h.successorIdentified,
      })),
    );
    setCartography(c);
  };

  const persist = (id: string, patch: Partial<Holder>) => {
    startTransition(async () => {
      await fetch(`/api/workbook/${workbookId}/memory-holders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => undefined);
    });
  };

  const addHolder = async () => {
    const draft = {
      role: locale === 'fr-CA' ? 'Nouveau r\u00f4le' : 'New role',
      responsibility: locale === 'fr-CA' ? '\u00c0 d\u00e9crire' : 'To describe',
      successorIdentified: false,
    };
    const res = await fetch(`/api/workbook/${workbookId}/memory-holders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { id: string; cartography: Cartography };
    const next: Holder = {
      id: data.id,
      role: draft.role,
      displayName: null,
      responsibility: draft.responsibility,
      tenureBand: null,
      criticality: null,
      successorIdentified: false,
      notes: null,
    };
    const updated = [...holders, next];
    setHolders(updated);
    if (data.cartography) setCartography(data.cartography);
    else recompute(updated);
  };

  const removeHolder = async (id: string) => {
    const updated = holders.filter((h) => h.id !== id);
    setHolders(updated);
    recompute(updated);
    await fetch(`/api/workbook/${workbookId}/memory-holders/${id}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  };

  const updateHolder = (id: string, patch: Partial<Holder>) => {
    const updated = holders.map((h) => (h.id === id ? { ...h, ...patch } : h));
    setHolders(updated);
    recompute(updated);
    persist(id, patch);
  };

  const bandTone = useMemo(() => {
    const band = cartography.density.band.id;
    if (band === 'fragile' || band === 'critical') return 'text-rose-700';
    if (band === 'concentrated') return 'text-amber-700';
    if (band === 'distributed' || band === 'observed') return 'text-emerald-700';
    return 'text-stone-700';
  }, [cartography.density.band]);

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <Link href={hubHref} className="text-sm text-stone-500 hover:text-stone-900">
          {`\u2190 ${t.back}`}
        </Link>

        <header className="mt-6 max-w-3xl">
          <p className="text-[0.78rem] uppercase tracking-[0.32em] text-stone-500">
            {t.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-stone-600">{t.intro}</p>
          <p className="mt-3 text-xs italic text-stone-500">{t.privacy}</p>
        </header>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
          <section>
            {holders.length === 0 ? (
              <p className="rounded border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
                {t.none}
              </p>
            ) : (
              <ul className="space-y-5">
                {holders.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t.role}>
                        <input
                          type="text"
                          defaultValue={h.role}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== h.role) updateHolder(h.id, { role: v });
                          }}
                          className="w-full border-b border-stone-300 bg-transparent py-1 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
                        />
                      </Field>
                      <Field label={t.displayName}>
                        <input
                          type="text"
                          defaultValue={h.displayName ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const next = v.length === 0 ? null : v;
                            if (next !== (h.displayName ?? null)) {
                              updateHolder(h.id, { displayName: next });
                            }
                          }}
                          className="w-full border-b border-stone-300 bg-transparent py-1 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
                        />
                      </Field>
                    </div>

                    <div className="mt-5">
                      <Field label={t.responsibility}>
                        <textarea
                          rows={2}
                          defaultValue={h.responsibility}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== h.responsibility) {
                              updateHolder(h.id, { responsibility: v });
                            }
                          }}
                          className="w-full resize-none border-b border-stone-300 bg-transparent py-1 text-sm leading-relaxed text-stone-900 focus:border-stone-900 focus:outline-none"
                        />
                      </Field>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Field label={t.tenure}>
                        <select
                          defaultValue={h.tenureBand ?? ''}
                          onChange={(e) => {
                            const v = (e.target.value || null) as TenureBand | null;
                            updateHolder(h.id, { tenureBand: v });
                          }}
                          className="w-full border-b border-stone-300 bg-transparent py-1 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
                        >
                          <option value="">{t.select}</option>
                          {(Object.keys(TENURE_LABELS) as TenureBand[]).map((b) => (
                            <option key={b} value={b}>
                              {TENURE_LABELS[b][locale]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t.criticality}>
                        <select
                          defaultValue={h.criticality ?? ''}
                          onChange={(e) => {
                            const v = (e.target.value || null) as Criticality | null;
                            updateHolder(h.id, { criticality: v });
                          }}
                          className="w-full border-b border-stone-300 bg-transparent py-1 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
                        >
                          <option value="">{t.select}</option>
                          {(Object.keys(CRIT_LABELS) as Criticality[]).map((b) => (
                            <option key={b} value={b}>
                              {CRIT_LABELS[b][locale]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t.successor}>
                        <label className="inline-flex cursor-pointer items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            defaultChecked={h.successorIdentified}
                            onChange={(e) =>
                              updateHolder(h.id, { successorIdentified: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-stone-400 text-stone-900 focus:ring-stone-700"
                          />
                          <span className="text-sm text-stone-700">
                            {h.successorIdentified
                              ? locale === 'fr-CA'
                                ? 'Oui'
                                : 'Yes'
                              : locale === 'fr-CA'
                                ? 'Non'
                                : 'No'}
                          </span>
                        </label>
                      </Field>
                    </div>

                    <div className="mt-5">
                      <Field label={t.notes}>
                        <textarea
                          rows={2}
                          defaultValue={h.notes ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const next = v.trim().length === 0 ? null : v;
                            if (next !== (h.notes ?? null)) {
                              updateHolder(h.id, { notes: next });
                            }
                          }}
                          className="w-full resize-none border-b border-stone-300 bg-transparent py-1 text-sm leading-relaxed text-stone-700 focus:border-stone-900 focus:outline-none"
                        />
                      </Field>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeHolder(h.id)}
                        className="text-xs uppercase tracking-wider text-stone-500 hover:text-rose-700"
                      >
                        {t.remove}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={addHolder}
              className="mt-8 inline-flex items-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
            >
              {t.add}
            </button>
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <p className="text-[0.7rem] uppercase tracking-[0.28em] text-stone-500">
                {t.densityLabel}
              </p>
              <p className={`mt-3 text-4xl font-light ${bandTone}`}>
                {cartography.density.index.toFixed(2)}
              </p>
              <p className="mt-1 text-sm capitalize text-stone-600">
                {cartography.density.band.label}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-stone-500">{t.densityDescription}</p>

              <dl className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone-500">
                    {locale === 'fr-CA' ? 'Porteurs (total)' : 'Holders (total)'}
                  </dt>
                  <dd className="text-stone-900">{holders.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">
                    {locale === 'fr-CA' ? 'Critiques pour l\u2019institution' : 'Institution-critical'}
                  </dt>
                  <dd className="text-stone-900">{cartography.density.institutionCriticalCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">
                    {locale === 'fr-CA' ? 'Porteurs sans successeur' : 'Without successor'}
                  </dt>
                  <dd className="text-stone-900">{cartography.density.unsuccessedLoadBearingCount}</dd>
                </div>
              </dl>
            </div>

            {cartography.signals.length > 0 ? (
              <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
                <p className="text-[0.7rem] uppercase tracking-[0.28em] text-stone-500">
                  {t.signals}
                </p>
                <ul className="mt-4 space-y-3">
                  {cartography.signals.map((s) => (
                    <li
                      key={s.signalId}
                      className="border-l-2 border-stone-300 pl-3 text-sm leading-relaxed text-stone-700"
                    >
                      {s.statement}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
