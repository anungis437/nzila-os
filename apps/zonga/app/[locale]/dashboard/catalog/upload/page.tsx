'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { uploadAudio, uploadCover } from '@/lib/actions/upload-actions'
import { createContentAsset } from '@/lib/actions/catalog-actions'

// ── Genre taxonomy — organised by region ────────────────────────────────────

const GENRE_GROUPS = [
  {
    region: 'Pan-African / Global',
    genres: [
      { label: 'Afrobeats', value: 'AFROBEATS' },
      { label: 'Afropop', value: 'AFROPOP' },
      { label: 'Afro Soul', value: 'AFRO_SOUL' },
      { label: 'Afro R&B', value: 'AFRO_RNB' },
      { label: 'Afro House', value: 'AFRO_HOUSE' },
      { label: 'Afro Jazz', value: 'AFRO_JAZZ' },
      { label: 'Afro Fusion', value: 'AFRO_FUSION' },
      { label: 'Afro Gospel', value: 'AFRO_GOSPEL' },
      { label: 'Afro Hip Hop', value: 'AFRO_HIP_HOP' },
      { label: 'Afro Dancehall', value: 'AFRO_DANCEHALL' },
      { label: 'Afro Trap', value: 'AFRO_TRAP' },
      { label: 'Afro Classical', value: 'AFRO_CLASSICAL' },
    ],
  },
  {
    region: 'West Africa',
    genres: [
      { label: 'Highlife', value: 'HIGHLIFE' },
      { label: 'Jùjú', value: 'JUJU' },
      { label: 'Fuji', value: 'FUJI' },
      { label: 'Apala', value: 'APALA' },
      { label: 'Hiplife', value: 'HIPLIFE' },
      { label: 'Azonto', value: 'AZONTO' },
      { label: 'Palm Wine', value: 'PALM_WINE' },
      { label: 'Mbalax', value: 'MBALAX' },
      { label: 'Wassoulou', value: 'WASSOULOU' },
      { label: 'Griot', value: 'GRIOT' },
      { label: 'Coupé-Décalé', value: 'COUPE_DECALE' },
      { label: 'Zouglou', value: 'ZOUGLOU' },
    ],
  },
  {
    region: 'East Africa',
    genres: [
      { label: 'Bongo Flava', value: 'BONGO_FLAVA' },
      { label: 'Gengetone', value: 'GENGETONE' },
      { label: 'Benga', value: 'BENGA' },
      { label: 'Taarab', value: 'TAARAB' },
      { label: 'Ohangla', value: 'OHANGLA' },
      { label: 'Mugithi', value: 'MUGITHI' },
      { label: 'Kadongo Kamu', value: 'KADONGO_KAMU' },
      { label: 'Ethio Jazz', value: 'ETHIO_JAZZ' },
    ],
  },
  {
    region: 'Central Africa',
    genres: [
      { label: 'Ndombolo', value: 'NDOMBOLO' },
      { label: 'Soukous', value: 'SOUKOUS' },
      { label: 'Rumba Congolaise', value: 'RUMBA_CONGOLAISE' },
      { label: 'Makossa', value: 'MAKOSSA' },
      { label: 'Bikutsi', value: 'BIKUTSI' },
      { label: 'Bend Skin', value: 'BEND_SKIN' },
    ],
  },
  {
    region: 'Southern Africa',
    genres: [
      { label: 'Amapiano', value: 'AMAPIANO' },
      { label: 'Gqom', value: 'GQOM' },
      { label: 'Kwaito', value: 'KWAITO' },
      { label: 'Maskandi', value: 'MASKANDI' },
      { label: 'Marrabenta', value: 'MARRABENTA' },
      { label: 'Chimurenga', value: 'CHIMURENGA' },
      { label: 'Sungura', value: 'SUNGURA' },
      { label: 'Kizomba', value: 'KIZOMBA' },
      { label: 'Semba', value: 'SEMBA' },
      { label: 'Kuduro', value: 'KUDURO' },
    ],
  },
  {
    region: 'North Africa',
    genres: [
      { label: 'Raï', value: 'RAI' },
      { label: 'Gnawa', value: 'GNAWA' },
      { label: 'Chaabi', value: 'CHAABI' },
      { label: 'Mahraganat', value: 'MAHRAGANAT' },
    ],
  },
  {
    region: 'Diaspora / Contemporary',
    genres: [
      { label: 'Alté', value: 'ALTÉ' },
      { label: 'Afro Drill', value: 'DRILL_AFRO' },
      { label: 'Amapiano Tech', value: 'AMAPIANO_TECH' },
      { label: 'Afro Electronic', value: 'AFRO_ELECTRONIC' },
    ],
  },
  {
    region: 'International',
    genres: [
      { label: 'Pop', value: 'POP' },
      { label: 'Hip Hop', value: 'HIP_HOP' },
      { label: 'R&B', value: 'RNB' },
      { label: 'Gospel', value: 'GOSPEL' },
      { label: 'Jazz', value: 'JAZZ' },
      { label: 'Reggae', value: 'REGGAE' },
      { label: 'Dancehall', value: 'DANCEHALL' },
      { label: 'Electronic', value: 'ELECTRONIC' },
      { label: 'Classical', value: 'CLASSICAL' },
      { label: 'Other', value: 'OTHER' },
    ],
  },
]

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'French', value: 'fr' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Spanish', value: 'es' },
  { label: 'Swahili', value: 'sw' },
  { label: 'Yoruba', value: 'yo' },
  { label: 'Igbo', value: 'ig' },
  { label: 'Hausa', value: 'ha' },
  { label: 'Amharic', value: 'am' },
  { label: 'Zulu', value: 'zu' },
  { label: 'Xhosa', value: 'xh' },
  { label: 'Kinyarwanda', value: 'rw' },
  { label: 'Lingala', value: 'ln' },
  { label: 'Wolof', value: 'wo' },
  { label: 'Twi / Akan', value: 'tw' },
  { label: 'Somali', value: 'so' },
  { label: 'Tigrinya', value: 'ti' },
]

const ASSET_TYPES = [
  { label: 'Track', value: 'TRACK', icon: '🎵' },
  { label: 'Album', value: 'ALBUM', icon: '💿' },
  { label: 'Video', value: 'VIDEO', icon: '🎬' },
  { label: 'Podcast', value: 'PODCAST', icon: '🎙️' },
]

type Step = 'meta' | 'upload' | 'done'
const STEPS: { key: Step; label: string }[] = [
  { key: 'meta', label: 'Details' },
  { key: 'upload', label: 'Upload' },
  { key: 'done', label: 'Complete' },
]

// ── Stepper UI ──────────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-2 mb-8" role="progressbar" aria-valuenow={idx + 1} aria-valuemax={STEPS.length}>
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          {i > 0 && (
            <div className={`h-0.5 w-8 rounded-full transition-colors ${i <= idx ? 'bg-electric' : 'bg-muted'}`} />
          )}
          <div className="flex items-center gap-1.5">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i < idx
                ? 'bg-emerald-500 text-white'
                : i === idx
                  ? 'bg-electric text-white'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium ${i <= idx ? 'text-foreground' : 'text-muted-foreground/70'}`}>
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Upload Page ─────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('meta')
  const [assetId, setAssetId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState('TRACK')
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [collabInput, setCollabInput] = useState('')
  const [uploadResult, setUploadResult] = useState<{
    sha256?: string
    blobPath?: string
  } | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'audio' | 'cover' | 'done'>('idle')

  const addCollaborator = useCallback(() => {
    const name = collabInput.trim()
    if (name && !collaborators.includes(name)) {
      setCollaborators((prev) => [...prev, name])
    }
    setCollabInput('')
  }, [collabInput, collaborators])

  const removeCollaborator = useCallback((name: string) => {
    setCollaborators((prev) => prev.filter((c) => c !== name))
  }, [])

  function handleMetaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createContentAsset({
        title: fd.get('title') as string,
        type: fd.get('type') as string,
        genre: fd.get('genre') as string || undefined,
        language: fd.get('language') as string || undefined,
        creatorName: fd.get('creatorName') as string || undefined,
        duration: fd.get('duration') ? Number(fd.get('duration')) : undefined,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
      })

      if (!res.success) {
        setError('Failed to create asset. Check all fields.')
        return
      }
      setAssetId(res.assetId!)
      setStep('upload')
    })
  }

  function handleFileUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!assetId) return
    const fd = new FormData(e.currentTarget)
    fd.set('assetId', assetId)

    startTransition(async () => {
      setUploadProgress('audio')
      const res = await uploadAudio(fd)
      if (!res.ok) {
        setUploadProgress('idle')
        setError(res.error ?? 'Upload failed.')
        return
      }
      setUploadResult({ sha256: res.sha256, blobPath: res.blobPath })

      // Upload cover art if provided
      const coverFile = fd.get('cover') as File | null
      if (coverFile && coverFile.size > 0) {
        setUploadProgress('cover')
        const coverFd = new FormData()
        coverFd.set('file', coverFile)
        coverFd.set('assetId', assetId)
        await uploadCover(coverFd)
      }

      setUploadProgress('done')
      setStep('done')
    })
  }

  // ── Done Screen ───────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="max-w-2xl mx-auto">
        <Stepper current="done" />

        <div className="text-center py-12">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-5xl mb-4">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-foreground">Upload Complete</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Your content is now in the catalog as a draft. Review it and publish when ready.
          </p>
          {uploadResult?.sha256 && (
            <div className="mt-4 max-w-md mx-auto">
              <p className="text-xs text-muted-foreground/70 mb-1">Content Fingerprint (SHA-256)</p>
              <p className="text-xs font-mono text-muted-foreground bg-muted px-3 py-2 rounded-lg break-all">
                {uploadResult.sha256}
              </p>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => router.push('../catalog')}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
            >
              View Catalog
            </button>
            <button
              onClick={() => {
                setStep('meta')
                setAssetId(null)
                setUploadResult(null)
                setCollaborators([])
                setUploadProgress('idle')
                setError(null)
              }}
              className="border border-border text-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/50 transition"
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Form ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      <Stepper current={step} />

      <h1 className="text-2xl font-bold text-navy mb-2">
        {step === 'meta' ? 'New Content' : 'Upload Files'}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {step === 'meta'
          ? 'Fill in the track or content details before uploading your files.'
          : 'Upload your audio file and optional cover art.'}
      </p>

      {/* ── Step: Metadata ─────────────────────────────────────────────── */}
      {step === 'meta' && (
        <Card>
          <form onSubmit={handleMetaSubmit} className="p-6 space-y-5">
            {/* Type Selector (visual chips) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Content Type</label>
              <div className="flex flex-wrap gap-2">
                {ASSET_TYPES.map((t) => (
                  <label key={t.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t.value}
                      checked={selectedType === t.value}
                      onChange={() => setSelectedType(t.value)}
                      className="sr-only"
                    />
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      selectedType === t.value
                        ? 'bg-electric text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted'
                    }`}>
                      {t.icon} {t.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title</label>
              <input
                name="title"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="Track or album title"
              />
            </div>

            {/* Genre + Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Genre</label>
                <select
                  name="genre"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                >
                  <option value="">Select genre</option>
                  {GENRE_GROUPS.map((group) => (
                    <optgroup key={group.region} label={group.region}>
                      {group.genres.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Language</label>
                <select
                  name="language"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Creator + Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Creator / Artist</label>
                <input
                  name="creatorName"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                  placeholder="Artist name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Duration (seconds)</label>
                <input
                  name="duration"
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                  placeholder="e.g. 210"
                />
              </div>
            </div>

            {/* Collaborators / Featuring */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Collaborators / Featuring
              </label>
              <div className="flex gap-2">
                <input
                  value={collabInput}
                  onChange={(e) => setCollabInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCollaborator()
                    }
                  }}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                  placeholder="Add artist name and press Enter"
                />
                <button
                  type="button"
                  onClick={addCollaborator}
                  className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition"
                >
                  Add
                </button>
              </div>
              {collaborators.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {collaborators.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-electric/10 px-3 py-1 text-xs font-medium text-electric"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeCollaborator(name)}
                        className="hover:text-red-500 transition"
                        aria-label={`Remove ${name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
              >
                {isPending ? 'Creating…' : 'Continue to Upload →'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Step: File Upload ──────────────────────────────────────────── */}
      {step === 'upload' && (
        <Card>
          <form onSubmit={handleFileUpload} className="p-6 space-y-6">
            {/* Audio File */}
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-electric transition-colors">
              <div className="text-3xl mb-2">🎵</div>
              <label className="block text-sm font-medium text-foreground mb-2">Audio File</label>
              <input
                name="file"
                type="file"
                required
                accept=".wav,.flac,.mp3,.aac,.ogg"
                className="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-electric file:text-white hover:file:bg-electric/90"
              />
              <p className="mt-2 text-xs text-muted-foreground/70">
                WAV, FLAC, MP3, AAC, or OGG · Max 500 MB · Lossless recommended
              </p>
            </div>

            {/* Cover Art */}
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-gold transition-colors">
              <div className="text-3xl mb-2">🖼️</div>
              <label className="block text-sm font-medium text-foreground mb-2">Cover Art (optional)</label>
              <input
                name="cover"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted"
              />
              <p className="mt-2 text-xs text-muted-foreground/70">
                JPG, PNG, or WebP · Max 10 MB · 3000×3000 recommended
              </p>
            </div>

            {/* Upload progress indicator */}
            {uploadProgress !== 'idle' && (
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3">
                <div className="h-4 w-4 rounded-full border-2 border-electric border-t-transparent animate-spin" />
                <span className="text-sm text-blue-700">
                  {uploadProgress === 'audio' && 'Uploading audio file…'}
                  {uploadProgress === 'cover' && 'Uploading cover art…'}
                </span>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
              >
                {isPending ? 'Uploading…' : 'Upload & Finish'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('meta')
                  setError(null)
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
              >
                ← Back
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
