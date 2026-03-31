/**
 * Zonga — Royalty Splits Editor (Client Component).
 *
 * Interactive editor for managing per-release royalty splits.
 * Validates that splits total exactly 100%, supports adding/removing
 * collaborators, and persists via saveSplits server action.
 */
'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { listCreators } from '@/lib/actions/creator-actions'
import {
  listSplitsForRelease,
  saveSplits,
  type SplitInput,
  type RoyaltySplit,
} from '@/lib/actions/rights-actions'

const SPLIT_ROLES = [
  'Primary Artist',
  'Featured Artist',
  'Producer',
  'Songwriter',
  'Composer',
  'Arranger',
  'Lyricist',
  'Performer',
  'Label',
  'Publisher',
  'Manager',
  'Other',
]

interface CreatorOption {
  id: string
  name?: string
}

export default function SplitsEditorPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [releaseId, setReleaseId] = useState('')
  const [splits, setSplits] = useState<SplitInput[]>([])
  const [creators, setCreators] = useState<CreatorOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const total = splits.reduce((sum, s) => sum + s.sharePercent, 0)
  const isValid = Math.abs(total - 100) < 0.01 && splits.length > 0

  useEffect(() => {
    async function load() {
      const { id } = await params
      setReleaseId(id)

      const [existingSplits, creatorResult] = await Promise.all([
        listSplitsForRelease(id),
        listCreators({ pageSize: 500 }),
      ])

      setCreators(creatorResult.creators as unknown as CreatorOption[])

      if (existingSplits.length > 0) {
        setSplits(
          existingSplits.map((s: RoyaltySplit) => ({
            creatorId: s.creatorId,
            creatorName: s.creatorName,
            role: s.role,
            sharePercent: s.sharePercent,
          })),
        )
      } else {
        // Default: 100% to primary creator placeholder
        setSplits([
          { creatorId: '', creatorName: '', role: 'Primary Artist', sharePercent: 100 },
        ])
      }
    }
    load()
  }, [params])

  function addSplit() {
    setSplits([
      ...splits,
      { creatorId: '', creatorName: '', role: 'Featured Artist', sharePercent: 0 },
    ])
  }

  function removeSplit(idx: number) {
    if (splits.length <= 1) return
    setSplits(splits.filter((_, i) => i !== idx))
  }

  function updateSplit(idx: number, field: keyof SplitInput, value: string | number) {
    const next = [...splits]
    if (field === 'sharePercent') {
      next[idx] = { ...next[idx], sharePercent: Number(value) }
    } else if (field === 'creatorId') {
      const creator = creators.find((c) => c.id === value)
      next[idx] = {
        ...next[idx],
        creatorId: String(value),
        creatorName: creator?.name ?? '',
      }
    } else {
      next[idx] = { ...next[idx], [field]: value }
    }
    setSplits(next)
  }

  function distributeEvenly() {
    const share = Math.floor((10000 / splits.length)) / 100
    const remainder = 100 - share * splits.length
    setSplits(
      splits.map((s, i) => ({
        ...s,
        sharePercent: i === 0 ? share + Math.round(remainder * 100) / 100 : share,
      })),
    )
  }

  function handleSave() {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await saveSplits(releaseId, splits)
      if (!result.success) {
        setError(result.error ?? 'Failed to save')
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`../`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Release
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Royalty Splits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how revenue is distributed among collaborators.
          Splits must total exactly 100%. Each collaborator receives their share after platform and processing fees are deducted.
        </p>
      </div>

      {/* Splits Table */}
      <Card>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Split Configuration</h2>
            <button
              type="button"
              onClick={distributeEvenly}
              className="text-xs text-electric hover:underline"
            >
              Distribute evenly
            </button>
          </div>

          <div className="space-y-3">
            {splits.map((split, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-3 items-end rounded-lg bg-muted p-3"
              >
                {/* Creator */}
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Creator
                  </label>
                  <select
                    value={split.creatorId}
                    onChange={(e) => updateSplit(idx, 'creatorId', e.target.value)}
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                  >
                    <option value="">Select creator…</option>
                    {creators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name ?? c.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role */}
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Role
                  </label>
                  <select
                    value={split.role}
                    onChange={(e) => updateSplit(idx, 'role', e.target.value)}
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                  >
                    {SPLIT_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Percent */}
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Share %
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={split.sharePercent}
                      onChange={(e) =>
                        updateSplit(idx, 'sharePercent', e.target.value)
                      }
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-sm text-right font-mono focus:ring-2 focus:ring-electric focus:border-transparent"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Remove */}
                <div className="col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeSplit(idx)}
                    disabled={splits.length <= 1}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 transition disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addSplit}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-electric hover:text-electric transition"
          >
            + Add Collaborator
          </button>
        </div>
      </Card>

      {/* Total Indicator */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Total</span>
            <div className="flex items-center gap-3">
              <div className="h-3 w-48 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    isValid
                      ? 'bg-emerald-500'
                      : total > 100
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(total, 100)}%` }}
                />
              </div>
              <span
                className={`text-sm font-bold ${
                  isValid ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {total.toFixed(2)}%
              </span>
            </div>
          </div>
          {!isValid && total > 0 && (
            <p className="mt-2 text-xs text-red-500">
              {total > 100
                ? `Over-allocated by ${(total - 100).toFixed(2)}%`
                : `Under-allocated by ${(100 - total).toFixed(2)}%. All revenue shares must total 100%.`}
            </p>
          )}
        </div>
      </Card>

      {/* Visual Preview */}
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Preview</h2>
          <div className="flex h-8 overflow-hidden rounded-full bg-muted">
            {splits
              .filter((s) => s.sharePercent > 0)
              .map((s, i) => {
                const colors = [
                  'bg-electric',
                  'bg-gold',
                  'bg-emerald-500',
                  'bg-violet-500',
                  'bg-coral',
                  'bg-cyan-500',
                  'bg-rose-400',
                  'bg-indigo-400',
                ]
                return (
                  <div
                    key={i}
                    className={`${colors[i % colors.length]} flex items-center justify-center text-[10px] font-bold text-white`}
                    style={{ width: `${s.sharePercent}%` }}
                    title={`${s.creatorName || 'Unassigned'} — ${s.role} — ${s.sharePercent}%`}
                  >
                    {s.sharePercent >= 8 ? `${s.sharePercent}%` : ''}
                  </div>
                )
              })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {splits
              .filter((s) => s.sharePercent > 0)
              .map((s, i) => {
                const colors = [
                  'bg-electric',
                  'bg-gold',
                  'bg-emerald-500',
                  'bg-violet-500',
                  'bg-coral',
                  'bg-cyan-500',
                  'bg-rose-400',
                  'bg-indigo-400',
                ]
                return (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[i % colors.length]}`} />
                    {s.creatorName || 'Unassigned'} ({s.role}) — {s.sharePercent}%
                  </div>
                )
              })}
          </div>
        </div>
      </Card>

      {/* Error / Success */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {saved && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Splits saved successfully
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending || !isValid}
          onClick={handleSave}
          className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Splits'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
