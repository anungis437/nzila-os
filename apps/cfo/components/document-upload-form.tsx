/**
 * CFO — Document Upload Form (Client Component).
 *
 * Supports real file upload via @nzila/blob Azure Blob Storage.
 * Drag-and-drop or click-to-browse, with progress and validation.
 */
'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Upload, X, FileText } from 'lucide-react'
import { uploadDocument, type Document } from '@/lib/actions/misc-actions'

const documentTypes: Document['type'][] = ['invoice', 'receipt', 'contract', 'report', 'statement', 'other']

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.xlsx', '.xls', '.docx', '.txt']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUploadForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum is 25 MB.`
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type "${ext}" not supported. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    return null
  }, [])

  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setError(null)
      setSelectedFile(file)
    },
    [validateFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const type = fd.get('type') as Document['type']

    if (!name.trim()) {
      setError('Document name is required.')
      return
    }

    if (!selectedFile) {
      setError('Please select a file to upload.')
      return
    }

    startTransition(async () => {
      try {
        // 1. Upload file to blob storage via API route
        const uploadFormData = new FormData()
        uploadFormData.append('file', selectedFile)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        })

        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}))
          setError(body.error ?? 'File upload failed.')
          return
        }

        const blob = (await uploadRes.json()) as {
          blobPath: string
          sha256: string
          sizeBytes: number
          url: string
        }

        // 2. Record document metadata in audit log
        const result = await uploadDocument({
          name: name.trim(),
          type: type || 'other',
          size: blob.sizeBytes,
          url: blob.url,
        })

        if (result.success) {
          setSuccess(true)
          setTimeout(() => router.push('../documents'), 1200)
        } else {
          setError('Failed to save document record.')
        }
      } catch {
        setError('Upload failed. Please try again.')
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-12 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
        <p className="font-poppins text-lg font-semibold text-foreground">Document uploaded</p>
        <p className="mt-1 text-sm text-muted-foreground">Redirecting to documents…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Document Name *</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Q3 Bank Statement"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
        />
      </div>

      <div>
        <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-foreground">Document Type</label>
        <select
          id="type"
          name="type"
          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
        >
          {documentTypes.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* File drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center transition-colors ${
          isDragging
            ? 'border-electric bg-electric/5'
            : selectedFile
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-border hover:border-electric/40 hover:bg-muted/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
        />

        {selectedFile ? (
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-emerald-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="ml-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Drag & drop files here, or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, images, CSV, Excel, Word — up to 25 MB
            </p>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending || !selectedFile}
        className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? 'Uploading…' : 'Upload Document'}
      </button>
    </form>
  )
}
