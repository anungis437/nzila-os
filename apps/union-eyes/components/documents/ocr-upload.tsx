'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  OCR_MIME_TYPES,
  OCR_PRIVACY_LABELS,
  assessUpload,
  interpretOcr,
  ocrCopy,
  readCanonicalIntake,
  readCreatedDocument,
  repositoryIntakePayload,
  transcriptSaveUnavailable,
  type OcrPrivacyLabel,
} from '@/lib/documents/ocr-intake';

type IntakeStatus =
  | 'pending'
  | 'uploading'
  | 'saved'
  | 'processing'
  | 'review'
  | 'unavailable'
  | 'error'
  | 'cancelled';

interface OCRFile {
  id: string;
  file: File;
  status: IntakeStatus;
  progress: number;
  documentId?: string;
  extractedText?: string;
  correction?: string;
  notice?: string;
  privacyLabel?: string;
}

interface OCRUploadProps {
  onUploadComplete?: (files: OCRFile[]) => void;
  organizationId: string;
  folderId?: string;
  maxFiles?: number;
  acceptedFormats?: string[];
  autoProcessOCR?: boolean;
}

export function OCRUpload({
  onUploadComplete,
  organizationId,
  folderId,
  maxFiles = 10,
  acceptedFormats,
  autoProcessOCR = true,
}: OCRUploadProps) {
  const locale = useLocale();
  const copy = useMemo(() => ocrCopy(locale), [locale]);
  const [label, setLabel] = useState<OcrPrivacyLabel | ''>('');
  const [files, setFiles] = useState<OCRFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const accept = (acceptedFormats ?? [...OCR_MIME_TYPES]).join(',');

  const update = (id: string, patch: Partial<OCRFile>) => {
    setFiles((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const requestOcr = async (entry: OCRFile, documentId: string, signal: AbortSignal) => {
    update(entry.id, { status: 'processing', progress: 85, notice: copy.processing, documentId });
    const ocrResponse = await fetch(`/api/documents/${documentId}/ocr`, { method: 'POST', signal });
    const ocrBody = await ocrResponse.json().catch(() => null);
    const extraction = interpretOcr(ocrResponse.status, ocrBody);
    if (extraction.kind === 'review') {
      update(entry.id, {
        status: 'review',
        progress: 100,
        documentId,
        extractedText: extraction.text,
        correction: extraction.text,
        notice: extraction.text ? copy.review : copy.noText,
      });
      return;
    }
    if (extraction.kind === 'unavailable') {
      update(entry.id, { status: 'unavailable', documentId, notice: copy.unavailable });
      return;
    }
    update(entry.id, {
      status: 'error',
      documentId,
      notice: extraction.kind === 'denied' ? copy.denied : copy.failed,
    });
  };

  const run = async (entry: OCRFile, privacyLabel: OcrPrivacyLabel) => {
    const key = `${entry.file.name}:${entry.file.size}`;
    if (inFlight.current.has(key)) {
      update(entry.id, { status: 'error', notice: copy.duplicate });
      return;
    }
    const assessment = assessUpload(entry.file);
    if (!assessment.ok) {
      const reason = assessment.reason === 'oversize' ? copy.oversize : assessment.reason === 'empty' ? copy.empty : copy.unsupported;
      update(entry.id, { status: 'error', notice: reason });
      return;
    }

    inFlight.current.add(key);
    const controller = new AbortController();
    controllers.current.set(entry.id, controller);
    try {
      update(entry.id, { status: 'uploading', progress: 20, notice: copy.uploading, privacyLabel });
      const form = new FormData();
      form.set('file', entry.file);
      form.set('organizationId', organizationId);
      form.set('canonicalIntake', '1');
      const uploadResponse = await fetch('/api/documents/upload', { method: 'POST', body: form, signal: controller.signal });
      const uploadBody = await uploadResponse.json().catch(() => null);
      const intake = readCanonicalIntake(uploadBody);
      if (!uploadResponse.ok || !intake) {
        update(entry.id, { status: 'error', notice: copy.failed });
        return;
      }

      const createResponse = await fetch('/api/documents/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(repositoryIntakePayload(intake, privacyLabel)),
        signal: controller.signal,
      });
      const createBody = await createResponse.json().catch(() => null);
      const created = readCreatedDocument(createBody);
      if (!createResponse.ok || !created) {
        const discard = new FormData();
        discard.set('organizationId', organizationId);
        discard.set('discardBlobPath', intake.blobPath);
        await fetch('/api/documents/upload', { method: 'POST', body: discard, signal: controller.signal }).catch(() => undefined);
        update(entry.id, { status: 'error', notice: copy.failed });
        return;
      }

      const saved: OCRFile = {
        ...entry,
        status: 'saved',
        progress: 70,
        documentId: created.id,
        privacyLabel: created.privacyLabel ?? privacyLabel,
        notice: copy.saved,
      };
      update(entry.id, saved);
      onUploadComplete?.([{ ...saved }]);

      if (!autoProcessOCR) return;
      await requestOcr(entry, created.id, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        update(entry.id, { status: 'cancelled', notice: copy.cancelled });
        return;
      }
      update(entry.id, { status: 'error', notice: copy.failed });
    } finally {
      inFlight.current.delete(key);
      controllers.current.delete(entry.id);
    }
  };

  const acceptFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    if (!label) {
      setNotice(copy.chooseClassification);
      return;
    }
    const selected = Array.from(list);
    if (files.length + selected.length > maxFiles) {
      setNotice(copy.unsupported);
      return;
    }
    const privacyLabel = label;
    const additions = selected.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles((current) => [...current, ...additions]);
    setNotice(null);
    for (const entry of additions) void run(entry, privacyLabel);
  };

  return (
    <section className="flex flex-col gap-3" data-testid="ocr-upload">
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{copy.limitation}</p>
      {folderId ? <p className="text-sm">{copy.folder}</p> : null}
      {notice ? <p role="alert" data-testid="ocr-notice">{notice}</p> : null}
      <label className="flex flex-col gap-1 text-sm">
        {copy.classification}
        <select
          aria-label={copy.classification}
          value={label}
          onChange={(event) => setLabel(event.target.value as OcrPrivacyLabel | '')}
          className="rounded border px-3 py-2"
        >
          <option value="">{copy.chooseClassification}</option>
          {OCR_PRIVACY_LABELS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <div
        className="rounded border border-dashed p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          acceptFiles(event.dataTransfer.files);
        }}
      >
        <input
          aria-label={copy.choose}
          type="file"
          accept={accept}
          capture="environment"
          multiple
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {files.map((entry) => (
        <article key={entry.id} className="rounded border p-3">
          <h3 className="font-medium">{entry.file.name}</h3>
          <p className="text-sm">{entry.privacyLabel ?? '-'}</p>
          {entry.documentId ? <p className="text-sm">{copy.saved}</p> : null}
          <p className="text-sm" data-testid={`ocr-status-${entry.file.name}`}>{entry.notice ?? entry.status}</p>
          {entry.status === 'review' && (
            <>
              <p className="text-sm">{entry.extractedText ? copy.review : copy.noText}</p>
              <Textarea
                aria-label={copy.save}
                value={entry.correction ?? ''}
                onChange={(event) => update(entry.id, { correction: event.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  transcriptSaveUnavailable();
                  update(entry.id, { notice: copy.transcript });
                }}
              >
                {copy.save}
              </Button>
            </>
          )}
          {(entry.status === 'uploading' || entry.status === 'processing') && (
            <Button type="button" variant="outline" onClick={() => controllers.current.get(entry.id)?.abort()}>
              {copy.cancel}
            </Button>
          )}
          {entry.documentId && entry.status !== 'processing' && entry.status !== 'uploading' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!label) return;
                if (!entry.documentId) {
                  void run(entry, label);
                  return;
                }
                const controller = new AbortController();
                controllers.current.set(entry.id, controller);
                void requestOcr(entry, entry.documentId, controller.signal)
                  .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === 'AbortError') {
                      update(entry.id, { status: 'cancelled', documentId: entry.documentId, notice: copy.cancelled });
                      return;
                    }
                    update(entry.id, { status: 'error', documentId: entry.documentId, notice: copy.failed });
                  })
                  .finally(() => controllers.current.delete(entry.id));
              }}
            >
              {copy.retry}
            </Button>
          )}
        </article>
      ))}
    </section>
  );
}
