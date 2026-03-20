/**
 * Zonga — Create Release wizard (Client Component).
 *
 * Multi-step form: metadata → track selection → distribution → royalty splits.
 * Works with existing server actions (createRelease, listCatalogAssets).
 */
'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { createRelease } from '@/lib/actions/release-actions'
import { listCatalogAssets } from '@/lib/actions/catalog-actions'

const RELEASE_TYPES = [
  { label: 'Single', value: 'single', icon: '🎵', desc: '1–3 tracks' },
  { label: 'EP', value: 'ep', icon: '💿', desc: '4–6 tracks' },
  { label: 'Album', value: 'album', icon: '💿', desc: '7+ tracks' },
  { label: 'Compilation', value: 'compilation', icon: '📀', desc: 'Various artists' },
]

const DSPs = [
  { label: 'Zonga', value: 'zonga', icon: '🎶', default: true },
  { label: 'Spotify', value: 'spotify', icon: '🟢' },
  { label: 'Apple Music', value: 'apple_music', icon: '🍎' },
  { label: 'YouTube Music', value: 'youtube_music', icon: '▶️' },
  { label: 'Deezer', value: 'deezer', icon: '🎧' },
  { label: 'Tidal', value: 'tidal', icon: '🌊' },
  { label: 'Boomplay', value: 'boomplay', icon: '🔊' },
  { label: 'Audiomack', value: 'audiomack', icon: '🎤' },
  { label: 'Mdundo', value: 'mdundo', icon: '🌍' },
]

type Step = 'meta' | 'tracks' | 'distribute' | 'splits' | 'review'
const STEPS: { key: Step; label: string }[] = [
  { key: 'meta', label: 'Details' },
  { key: 'tracks', label: 'Tracks' },
  { key: 'distribute', label: 'Distribution' },
  { key: 'splits', label: 'Splits' },
  { key: 'review', label: 'Review' },
]

interface TrackSelection {
  assetId: string
  title: string
  trackNumber: number
}

interface SplitEntry {
  creatorName: string
  sharePercent: number
}

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-1.5 mb-8 flex-wrap" role="progressbar" aria-valuenow={idx + 1} aria-valuemax={STEPS.length}>
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          {i > 0 && (
            <div className={`h-0.5 w-6 rounded-full transition-colors ${i <= idx ? 'bg-electric' : 'bg-gray-200'}`} />
          )}
          <div className="flex items-center gap-1">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
              i < idx
                ? 'bg-emerald-500 text-white'
                : i === idx
                  ? 'bg-electric text-white'
                  : 'bg-gray-200 text-gray-500'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= idx ? 'text-navy' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CreateReleasePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('meta')

  // Form state
  const [title, setTitle] = useState('')
  const [releaseType, setReleaseType] = useState<'single' | 'ep' | 'album' | 'compilation'>('single')
  const [releaseDate, setReleaseDate] = useState('')
  const [description, setDescription] = useState('')
  const [upc, setUpc] = useState('')

  // Track selection
  const [availableTracks, setAvailableTracks] = useState<Array<{ id: string; title: string | null }>>([])
  const [selectedTracks, setSelectedTracks] = useState<TrackSelection[]>([])
  const [tracksLoaded, setTracksLoaded] = useState(false)

  // Distribution
  const [distributionTargets, setDistributionTargets] = useState<string[]>(['zonga'])

  // Splits
  const [splits, setSplits] = useState<SplitEntry[]>([{ creatorName: '', sharePercent: 100 }])

  const loadTracks = useCallback(async () => {
    if (tracksLoaded) return
    const result = await listCatalogAssets({ status: 'published', type: 'track', pageSize: 200 })
    setAvailableTracks(
      (result.assets ?? []).map((a: { id: string; title: string | null }) => ({
        id: a.id,
        title: a.title,
      })),
    )
    setTracksLoaded(true)
  }, [tracksLoaded])

  const addTrack = useCallback((assetId: string, title: string) => {
    if (selectedTracks.some((t) => t.assetId === assetId)) return
    setSelectedTracks((prev) => [
      ...prev,
      { assetId, title, trackNumber: prev.length + 1 },
    ])
  }, [selectedTracks])

  const removeTrack = useCallback((assetId: string) => {
    setSelectedTracks((prev) =>
      prev
        .filter((t) => t.assetId !== assetId)
        .map((t, i) => ({ ...t, trackNumber: i + 1 })),
    )
  }, [])

  const toggleDsp = useCallback((value: string) => {
    setDistributionTargets((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    )
  }, [])

  const addSplit = useCallback(() => {
    setSplits((prev) => [...prev, { creatorName: '', sharePercent: 0 }])
  }, [])

  const removeSplit = useCallback((idx: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const updateSplit = useCallback((idx: number, field: keyof SplitEntry, value: string | number) => {
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    )
  }, [])

  const totalSplitPercent = splits.reduce((s, x) => s + Number(x.sharePercent), 0)

  function handleSubmit() {
    setError(null)
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (selectedTracks.length === 0) {
      setError('Select at least one track.')
      return
    }
    if (Math.abs(totalSplitPercent - 100) > 0.01) {
      setError(`Royalty splits must total 100% (currently ${totalSplitPercent}%).`)
      return
    }

    startTransition(async () => {
      const res = await createRelease({
        title: title.trim(),
        releaseType,
        releaseDate: releaseDate || undefined,
        description: description || undefined,
        tracks: selectedTracks.map((t) => ({
          assetId: t.assetId,
          trackNumber: t.trackNumber,
        })),
        distributionTargets,
        upc: upc || undefined,
        splits: splits
          .filter((s) => s.creatorName.trim())
          .map((s) => ({
            creatorName: s.creatorName.trim(),
            sharePercent: Number(s.sharePercent),
          })),
      })

      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to create release.')
        return
      }

      router.push('../releases')
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Stepper current={step} />

      <h1 className="text-2xl font-bold text-navy mb-2">Create Release</h1>
      <p className="text-gray-500 text-sm mb-6">
        Bundle tracks, set distribution targets, and configure royalty splits.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* ── Step 1: Metadata ─────────────────────────────────────────── */}
      {step === 'meta' && (
        <Card>
          <div className="p-6 space-y-5">
            {/* Release Type Chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Release Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RELEASE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setReleaseType(t.value as 'single' | 'ep' | 'album' | 'compilation')}
                    className={`rounded-lg px-3 py-3 text-center transition-all border ${
                      releaseType === t.value
                        ? 'border-electric bg-electric/5 text-navy'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xl mb-1">{t.icon}</div>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-[10px] text-gray-400">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="Release title"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UPC (optional)</label>
                <input
                  value={upc}
                  onChange={(e) => setUpc(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                  placeholder="e.g. 123456789012"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent resize-none"
                placeholder="Album notes, credits…"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) {
                    setError('Title is required.')
                    return
                  }
                  setError(null)
                  loadTracks()
                  setStep('tracks')
                }}
                className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
              >
                Next: Select Tracks →
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Step 2: Track Selection ──────────────────────────────────── */}
      {step === 'tracks' && (
        <div className="space-y-4">
          {/* Selected tracks */}
          <Card>
            <div className="p-6">
              <h2 className="text-sm font-semibold text-navy mb-3">
                Selected Tracks ({selectedTracks.length})
              </h2>
              {selectedTracks.length === 0 ? (
                <p className="text-xs text-gray-400">No tracks selected. Pick from the catalog below.</p>
              ) : (
                <div className="space-y-2">
                  {selectedTracks.map((t) => (
                    <div
                      key={t.assetId}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400 w-5 text-center">
                          {t.trackNumber}
                        </span>
                        <span className="text-sm font-medium text-navy">{t.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTrack(t.assetId)}
                        className="text-xs text-red-500 hover:text-red-700 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Available tracks */}
          <Card>
            <div className="p-6">
              <h2 className="text-sm font-semibold text-navy mb-3">Available Tracks</h2>
              {availableTracks.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No published tracks found. Upload and publish tracks first.
                </p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {availableTracks
                    .filter((a) => !selectedTracks.some((t) => t.assetId === a.id))
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => addTrack(a.id, a.title ?? 'Untitled')}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left hover:bg-gray-50 transition"
                      >
                        <span className="text-navy">{a.title ?? 'Untitled'}</span>
                        <span className="text-electric text-xs font-medium">+ Add</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep('meta')}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedTracks.length === 0) {
                  setError('Select at least one track.')
                  return
                }
                setError(null)
                setStep('distribute')
              }}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
            >
              Next: Distribution →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Distribution ─────────────────────────────────────── */}
      {step === 'distribute' && (
        <Card>
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-navy mb-1">Distribution Targets</h2>
              <p className="text-xs text-gray-400 mb-4">
                Choose where this release will be distributed. Zonga is always included.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DSPs.map((dsp) => (
                  <button
                    key={dsp.value}
                    type="button"
                    disabled={dsp.default}
                    onClick={() => !dsp.default && toggleDsp(dsp.value)}
                    className={`rounded-lg px-3 py-3 text-center transition-all border ${
                      distributionTargets.includes(dsp.value)
                        ? 'border-electric bg-electric/5 text-navy'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    } ${dsp.default ? 'opacity-70 cursor-default' : ''}`}
                  >
                    <div className="text-lg mb-0.5">{dsp.icon}</div>
                    <div className="text-xs font-medium">{dsp.label}</div>
                    {dsp.default && (
                      <div className="text-[10px] text-emerald-500 font-medium">Always</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('tracks')}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep('splits')
                }}
                className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
              >
                Next: Royalty Splits →
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Step 4: Royalty Splits ────────────────────────────────────── */}
      {step === 'splits' && (
        <Card>
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-navy mb-1">Royalty Splits</h2>
              <p className="text-xs text-gray-400 mb-4">
                Define how revenue is split among creators. Must total 100%.
              </p>

              <div className="space-y-3">
                {splits.map((split, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      value={split.creatorName}
                      onChange={(e) => updateSplit(idx, 'creatorName', e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                      placeholder="Creator name"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={split.sharePercent}
                        onChange={(e) => updateSplit(idx, 'sharePercent', Number(e.target.value))}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-sm text-right focus:ring-2 focus:ring-electric focus:border-transparent"
                      />
                      <span className="text-sm text-gray-400">%</span>
                    </div>
                    {splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplit(idx)}
                        className="text-xs text-red-500 hover:text-red-700 transition"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={addSplit}
                  className="text-xs text-electric hover:text-electric/80 font-medium transition"
                >
                  + Add Creator
                </button>
                <span className={`text-xs font-medium ${
                  Math.abs(totalSplitPercent - 100) < 0.01
                    ? 'text-emerald-600'
                    : 'text-red-500'
                }`}>
                  Total: {totalSplitPercent}%
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('distribute')}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep('review')
                }}
                className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
              >
                Next: Review →
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Step 5: Review & Submit ──────────────────────────────────── */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <div className="p-6 space-y-4">
              <h2 className="text-sm font-semibold text-navy">Release Summary</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Title</p>
                  <p className="font-medium text-navy">{title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Type</p>
                  <p className="font-medium text-navy capitalize">{releaseType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Release Date</p>
                  <p className="font-medium text-navy">{releaseDate || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">UPC</p>
                  <p className="font-medium text-navy font-mono">{upc || '—'}</p>
                </div>
              </div>

              {/* Tracks */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Tracks ({selectedTracks.length})</p>
                <div className="space-y-1">
                  {selectedTracks.map((t) => (
                    <div key={t.assetId} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-mono text-gray-400 w-4">{t.trackNumber}.</span>
                      <span className="text-navy">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distribution */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Distribution</p>
                <div className="flex flex-wrap gap-1.5">
                  {distributionTargets.map((d) => {
                    const dsp = DSPs.find((x) => x.value === d)
                    return (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-full bg-electric/10 px-2.5 py-0.5 text-xs font-medium text-electric"
                      >
                        {dsp?.icon} {dsp?.label ?? d}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Splits */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Royalty Splits</p>
                <div className="space-y-1">
                  {splits.filter((s) => s.creatorName.trim()).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-navy">{s.creatorName}</span>
                      <span className="font-medium text-navy">{s.sharePercent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep('splits')}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
            >
              {isPending ? 'Creating…' : '🚀 Create Release'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
