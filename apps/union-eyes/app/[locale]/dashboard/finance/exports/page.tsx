/**
 * Finance Exports Page
 *
 * Download GL journals, master invoices, allocation statements,
 * chargeback reports, and evidence packs.
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('financeExportsPage');
  const [exportType, setExportType] = useState<ExportType>('gl_journal');
  const [periodId, setPeriodId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [allocationRunId, setAllocationRunId] = useState('');
  const [localId, setLocalId] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(false);

  const getExportTypeLabel = (type: ExportType) => {
    switch (type) {
      case 'gl_journal':
        return t('types.glJournal');
      case 'evidence_pack':
        return t('types.evidencePack');
      case 'master_invoice':
        return t('types.masterInvoice');
      case 'allocation_statement':
        return t('types.allocationStatement');
      case 'chargeback_report':
        return t('types.chargebackReport');
      default:
        return type;
    }
  };

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
        const err = await res.json().catch(() => ({ message: t('messages.exportFailed') }));
        job.status = 'error';
        job.message = err.error?.message ?? t('messages.exportFailed');
      } else if (format === 'csv' && exportType === 'gl_journal') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        job.status = 'success';
        job.downloadUrl = url;
        job.message = t('messages.csvReady');
      } else {
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        job.status = 'success';
        job.downloadUrl = url;
        job.message = t('messages.exportedRows', {
          rows: json.data?.meta?.rowCount ?? 0,
          hash: json.data?.meta?.dataHash?.slice(0, 12) ?? t('messages.na'),
        });
      }
    } catch (err) {
      job.status = 'error';
      job.message = err instanceof Error ? err.message : t('messages.error');
    } finally {
      setJobs((prev) => [job, ...prev]);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Download className="h-6 w-6" /> {t('title')}
      </h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">{t('generate.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t('generate.exportType')}</label>
            <Select value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gl_journal">{t('types.glJournal')}</SelectItem>
                <SelectItem value="evidence_pack">{t('types.evidencePack')}</SelectItem>
                <SelectItem value="master_invoice">{t('types.masterInvoice')}</SelectItem>
                <SelectItem value="allocation_statement">{t('types.allocationStatement')}</SelectItem>
                <SelectItem value="chargeback_report">{t('types.chargebackReport')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t('generate.billingPeriodId')}</label>
            <Input
              placeholder={t('generate.uuidPlaceholder')}
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            />
          </div>

          {exportType === 'master_invoice' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t('generate.invoiceId')}</label>
              <Input
                placeholder={t('generate.uuidPlaceholder')}
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
            </div>
          )}

          {exportType === 'allocation_statement' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t('generate.allocationRunId')}</label>
              <Input
                placeholder={t('generate.uuidPlaceholder')}
                value={allocationRunId}
                onChange={(e) => setAllocationRunId(e.target.value)}
              />
            </div>
          )}

          {exportType === 'chargeback_report' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t('generate.localId')}</label>
              <Input
                placeholder={t('generate.uuidPlaceholder')}
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
              />
            </div>
          )}

          {exportType === 'gl_journal' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t('generate.format')}</label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'json' | 'csv')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">{t('generate.formats.json')}</SelectItem>
                  <SelectItem value="csv">{t('generate.formats.csv')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button className="mt-4" onClick={runExport} disabled={loading}>
          {loading ? t('generate.generating') : t('generate.generateButton')}
        </Button>
      </Card>

      {/* Export History */}
      {jobs.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">{t('results.title')}</h2>
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
                  {getExportTypeLabel(job.type)}
                </Badge>
                <span className="flex-1 text-muted-foreground">{job.message}</span>
                {job.downloadUrl && (
                  <a
                    href={job.downloadUrl}
                    download={`${job.type}-export.${format}`}
                    className="text-primary underline text-xs"
                  >
                    {t('results.download')}
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
