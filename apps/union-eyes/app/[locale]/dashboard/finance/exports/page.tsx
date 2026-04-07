/**
 * Finance Exports Page
 *
 * Download GL journals, master invoices, allocation statements,
 * chargeback reports, and evidence packs.
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';

type ExportType =
  | 'gl_journal'
  | 'evidence_pack'
  | 'master_invoice'
  | 'allocation_statement'
  | 'chargeback_report';

interface ExportJob {
  type: ExportType;
  status: 'pending' | 'success' | 'error';
  message?: string;
  downloadUrl?: string;
}

export default function ExportsPage() {
  const [exportType, setExportType] = useState<ExportType>('gl_journal');
  const [periodId, setPeriodId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [allocationRunId, setAllocationRunId] = useState('');
  const [localId, setLocalId] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(false);

  const runExport = async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: exportType });
    if (periodId) params.set('periodId', periodId);
    if (invoiceId && exportType === 'master_invoice') params.set('invoiceId', invoiceId);
    if (allocationRunId && exportType === 'allocation_statement') params.set('allocationRunId', allocationRunId);
    if (localId && exportType === 'chargeback_report') params.set('localId', localId);
    if (exportType === 'gl_journal') params.set('format', format);

    const job: ExportJob = { type: exportType, status: 'pending' };

    try {
      const res = await fetch(`/api/finance/exports?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Export failed' }));
        job.status = 'error';
        job.message = err.error?.message ?? 'Export failed';
      } else if (format === 'csv' && exportType === 'gl_journal') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        job.status = 'success';
        job.downloadUrl = url;
        job.message = 'CSV ready for download';
      } else {
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        job.status = 'success';
        job.downloadUrl = url;
        job.message = `Exported ${json.data?.meta?.rowCount ?? 0} rows (hash: ${json.data?.meta?.dataHash?.slice(0, 12) ?? 'n/a'})`;
      }
    } catch (err) {
      job.status = 'error';
      job.message = err instanceof Error ? err.message : 'Error';
    } finally {
      setJobs((prev) => [job, ...prev]);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Download className="h-6 w-6" /> Finance Exports
      </h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Generate Export</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Export Type</label>
            <Select value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gl_journal">GL Journal</SelectItem>
                <SelectItem value="evidence_pack">Evidence Pack</SelectItem>
                <SelectItem value="master_invoice">Master Invoice</SelectItem>
                <SelectItem value="allocation_statement">Allocation Statement</SelectItem>
                <SelectItem value="chargeback_report">Chargeback Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Billing Period ID</label>
            <Input
              placeholder="UUID"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            />
          </div>

          {exportType === 'master_invoice' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Invoice ID</label>
              <Input
                placeholder="UUID"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
            </div>
          )}

          {exportType === 'allocation_statement' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Allocation Run ID</label>
              <Input
                placeholder="UUID"
                value={allocationRunId}
                onChange={(e) => setAllocationRunId(e.target.value)}
              />
            </div>
          )}

          {exportType === 'chargeback_report' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Local ID</label>
              <Input
                placeholder="UUID"
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
              />
            </div>
          )}

          {exportType === 'gl_journal' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Format</label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'json' | 'csv')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button className="mt-4" onClick={runExport} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Export'}
        </Button>
      </Card>

      {/* Export History */}
      {jobs.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">Export Results</h2>
          <div className="space-y-2">
            {jobs.map((job, i) => (
              <div key={i} className="flex items-center gap-3 text-sm border rounded-md p-3">
                {job.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : job.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <Badge variant="outline" className="capitalize">
                  {job.type.replace(/_/g, ' ')}
                </Badge>
                <span className="flex-1 text-muted-foreground">{job.message}</span>
                {job.downloadUrl && (
                  <a
                    href={job.downloadUrl}
                    download={`${job.type}-export.${format}`}
                    className="text-primary underline text-xs"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
