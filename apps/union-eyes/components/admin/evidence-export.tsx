'use client';

/**
 * Evidence Export — Admin Panel
 *
 * Allows admins to export sealed evidence packs for audit and compliance.
 * Used during CAPE-ACEP pilot to demonstrate governance trail integrity.
 *
 * @module components/admin/evidence-export
 */

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceExportProps {
  organizationId: string;
  organizationName: string;
}

type ExportFormat = 'json' | 'csv' | 'pdf';
type DateRange = '7d' | '30d' | '90d' | 'all';

interface ExportStatus {
  state: 'idle' | 'exporting' | 'success' | 'error';
  message?: string;
  downloadUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidenceExport({
  organizationId,
  organizationName,
}: EvidenceExportProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [status, setStatus] = useState<ExportStatus>({ state: 'idle' });
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      setStatus({ state: 'exporting' });

      try {
        const response = await fetch('/api/admin/evidence/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            format,
            dateRange,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Export failed (${response.status})`,
          );
        }

        const data = (await response.json()) as { downloadUrl: string };

        setStatus({
          state: 'success',
          message: 'Evidence pack exported and sealed',
          downloadUrl: data.downloadUrl,
        });
      } catch (err) {
        setStatus({
          state: 'error',
          message:
            err instanceof Error ? err.message : 'Unknown error during export',
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" aria-hidden="true" />
          <CardTitle>Evidence Export</CardTitle>
        </div>
        <CardDescription>
          Export sealed governance evidence packs for{' '}
          <strong>{organizationName}</strong>. All exports preserve evidence
          provenance and chronology-linked trust — watermarked, tamper-proofed,
          and reviewable under operational stewardship.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls row */}
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <label
              htmlFor="evidence-format"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Format
            </label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
            >
              <SelectTrigger id="evidence-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (sealed)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <label
              htmlFor="evidence-range"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Date Range
            </label>
            <Select
              value={dateRange}
              onValueChange={(v) => setDateRange(v as DateRange)}
            >
              <SelectTrigger id="evidence-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action */}
        <Button
          onClick={handleExport}
          disabled={isPending}
          className="gap-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {isPending ? 'Exporting…' : 'Export Evidence Pack'}
        </Button>

        {/* Status feedback */}
        {status.state === 'success' && (
          <div
            className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{status.message}</span>
            {status.downloadUrl && (
              <a
                href={status.downloadUrl}
                download
                className="ml-auto underline"
              >
                Download
              </a>
            )}
          </div>
        )}

        {status.state === 'error' && (
          <div
            className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{status.message}</span>
          </div>
        )}

        {/* Info badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline" className="text-xs">
            Tamper-proof seal
          </Badge>
          <Badge variant="outline" className="text-xs">
            Watermarked
          </Badge>
          <Badge variant="outline" className="text-xs">
            Audit-logged
          </Badge>
          <Badge variant="outline" className="text-xs">
            Evidence provenance
          </Badge>
          <Badge variant="outline" className="text-xs">
            Chronology-linked trust
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
