'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { bulkUploadAudio } from '@/lib/actions/upload-actions'

interface FileCheck {
  fileName: string
  status: 'ok' | 'warn' | 'fail'
  message: string
}

const ACCEPTED_AUDIO = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/webm'])

function buildChecks(files: File[]): FileCheck[] {
  const seen = new Set<string>()
  const checks: FileCheck[] = []

  for (const file of files) {
    if (seen.has(file.name.toLowerCase())) {
      checks.push({ fileName: file.name, status: 'warn', message: 'Possible duplicate filename in this batch.' })
      continue
    }
    seen.add(file.name.toLowerCase())

    if (!ACCEPTED_AUDIO.has(file.type)) {
      checks.push({ fileName: file.name, status: 'fail', message: `Unsupported file type (${file.type || 'unknown'}).` })
      continue
    }

    if (file.size > 500 * 1024 * 1024) {
      checks.push({ fileName: file.name, status: 'fail', message: 'File exceeds 500 MB limit.' })
      continue
    }

    if (file.size < 512 * 1024) {
      checks.push({ fileName: file.name, status: 'warn', message: 'File is unusually small; quality review recommended.' })
      continue
    }

    checks.push({ fileName: file.name, status: 'ok', message: 'Ready for ingest.' })
  }

  return checks
}

export default function LabelUploadConsolePage() {
  const [isPending, startTransition] = useTransition()
  const [creatorId, setCreatorId] = useState('')
  const [trackTitle, setTrackTitle] = useState('')
  const [artistName, setArtistName] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [featuredArtists, setFeaturedArtists] = useState('')
  const [genre, setGenre] = useState('')
  const [language, setLanguage] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [isrcPlaceholder, setIsrcPlaceholder] = useState('')
  const [explicit, setExplicit] = useState(false)
  const [regions, setRegions] = useState('Global')
  const [rightsDeclaration, setRightsDeclaration] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<{ uploaded: number; failed: number; details: string[] } | null>(null)

  const checks = useMemo(() => buildChecks(files), [files])

  const requiredMissing = useMemo(() => {
    const missing: string[] = []
    if (!trackTitle.trim()) missing.push('Title')
    if (!artistName.trim()) missing.push('Artist')
    if (!albumName.trim()) missing.push('Album')
    if (!genre.trim()) missing.push('Genre')
    if (!language.trim()) missing.push('Language')
    if (!releaseDate.trim()) missing.push('Release date')
    if (!regions.trim()) missing.push('Region availability')
    if (!rightsDeclaration) missing.push('Ownership declaration')
    return missing
  }, [trackTitle, artistName, albumName, genre, language, releaseDate, regions, rightsDeclaration])

  function saveDraft() {
    if (typeof window === 'undefined') return
    const payload = {
      trackTitle,
      artistName,
      albumName,
      featuredArtists,
      genre,
      language,
      releaseDate,
      isrcPlaceholder,
      explicit,
      regions,
      rightsDeclaration,
    }
    window.localStorage.setItem('zonga.labelUploadDraft.v1', JSON.stringify(payload))
    setDraftSavedAt(new Date().toISOString())
  }

  function loadDraft() {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('zonga.labelUploadDraft.v1')
    if (!raw) return
    const draft = JSON.parse(raw) as Record<string, unknown>
    setTrackTitle(String(draft.trackTitle ?? ''))
    setArtistName(String(draft.artistName ?? ''))
    setAlbumName(String(draft.albumName ?? ''))
    setFeaturedArtists(String(draft.featuredArtists ?? ''))
    setGenre(String(draft.genre ?? ''))
    setLanguage(String(draft.language ?? ''))
    setReleaseDate(String(draft.releaseDate ?? ''))
    setIsrcPlaceholder(String(draft.isrcPlaceholder ?? ''))
    setExplicit(Boolean(draft.explicit))
    setRegions(String(draft.regions ?? 'Global'))
    setRightsDeclaration(Boolean(draft.rightsDeclaration))
  }

  function runBulkUpload() {
    if (!creatorId.trim()) {
      setResult({ uploaded: 0, failed: files.length, details: ['Creator ID is required for bulk ingest.'] })
      return
    }

    startTransition(async () => {
      const form = new FormData()
      form.set('creatorId', creatorId.trim())
      for (const file of files) form.append('files', file)

      const response = await bulkUploadAudio(form)
      setResult({
        uploaded: response.uploaded.length,
        failed: response.failed.length,
        details: response.failed.map((f) => `${f.fileName}: ${f.error}`),
      })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zonga Label Upload Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            White-glove ingest for label pilots: metadata quality, rights declaration, and bulk upload controls.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadDraft} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">Load Draft</button>
          <button onClick={saveDraft} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">Save Draft</button>
          <Link href="../upload" className="rounded-lg bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90">Open Upload Flow</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Metadata Intake</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Title" />
              <input value={artistName} onChange={(e) => setArtistName(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Artist" />
              <input value={albumName} onChange={(e) => setAlbumName(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Album" />
              <input value={featuredArtists} onChange={(e) => setFeaturedArtists(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Featured artists (comma-separated)" />
              <input value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Genre" />
              <input value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Language" />
              <input value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} type="date" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <input value={isrcPlaceholder} onChange={(e) => setIsrcPlaceholder(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="ISRC placeholder" />
              <input value={regions} onChange={(e) => setRegions(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2" placeholder="Region availability (e.g. Canada, France, DRC)" />
              <input value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2" placeholder="Creator ID (required for batch ingest)" />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <input id="explicit" type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} />
              <label htmlFor="explicit">Explicit content</label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input id="rights" type="checkbox" checked={rightsDeclaration} onChange={(e) => setRightsDeclaration(e.target.checked)} />
              <label htmlFor="rights">Ownership rights declaration accepted</label>
            </div>

            {requiredMissing.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Missing required fields: {requiredMissing.join(', ')}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Metadata completeness check passed.
              </div>
            )}

            {draftSavedAt && <p className="text-xs text-muted-foreground">Draft saved at {new Date(draftSavedAt).toLocaleString()}</p>}
          </div>
        </Card>

        <Card>
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Batch Upload + Quality Checks</h2>
            <label className="block rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Drag and drop tracks or click to select
              <input
                type="file"
                multiple
                accept=".mp3,.wav,.flac,.aac,.ogg,.m4a"
                className="mt-2 block w-full text-xs"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>

            <div className="space-y-2">
              {checks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files selected yet.</p>
              ) : (
                checks.map((check) => (
                  <div key={`${check.fileName}-${check.message}`} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    <span className={check.status === 'fail' ? 'text-red-600' : check.status === 'warn' ? 'text-amber-600' : 'text-emerald-600'}>
                      [{check.status.toUpperCase()}]
                    </span>{' '}
                    <span className="font-medium text-foreground">{check.fileName}</span> — {check.message}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={runBulkUpload}
              disabled={isPending || files.length === 0}
              className="rounded-lg bg-electric px-4 py-2 text-sm font-semibold text-white hover:bg-electric/90 disabled:opacity-50"
            >
              {isPending ? 'Uploading batch…' : 'Run 20-track Batch Ingest'}
            </button>

            {result && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                Uploaded: {result.uploaded} · Failed: {result.failed}
                {result.details.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {result.details.slice(0, 8).map((line) => <li key={line} className="text-red-600">{line}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Admin Correction and Review</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link href="../" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">Manual metadata correction</Link>
            <Link href="../?status=draft" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">Missing-field draft review</Link>
            <Link href="../../moderation" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">Rights dispute and abuse queues</Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
