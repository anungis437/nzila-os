/**
 * AI Usage Admin Page
 *
 * Displays all AI invocation audit log entries so administrators can review
 * every AI call made within the platform — who triggered it, which model,
 * what data class, and the corresponding audit reference ID.
 *
 * Part of: NZILAOS AI UX + Audit Completion — Part 6
 */

"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Bot,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface AIUsageEntry {
  id: string;
  userId: string | null;
  organizationId: string | null;
  origin: string | null;
  timestamp: string;
  model: string | null;
  dataClass: string | null;
  auditRefId: string | null;
}

const DATA_CLASS_COLORS: Record<string, string> = {
  internal: 'bg-blue-100 text-blue-800',
  confidential: 'bg-orange-100 text-orange-800',
  public: 'bg-green-100 text-green-800',
  restricted: 'bg-red-100 text-red-800',
};

export default function AIUsagePage() {
  const [entries, setEntries] = useState<AIUsageEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 50;

  const fetchEntries = useCallback(async (p: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/ai-usage?page=${p}&limit=${LIMIT}`);
      if (!res.ok) throw new Error('Failed to fetch AI usage data');
      const json = await res.json();
      setEntries(json.data?.entries ?? []);
      setTotal(json.data?.total ?? 0);
    } catch {
      toast.error('Failed to load AI usage log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(page);
  }, [page, fetchEntries]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Origin', 'Model', 'DataClass', 'UserId', 'OrganizationId', 'AuditRefId'];
    const rows = entries.map((e) => [
      e.timestamp,
      e.origin ?? '',
      e.model ?? '',
      e.dataClass ?? '',
      e.userId ?? '',
      e.organizationId ?? '',
      e.auditRefId ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Usage Log</h1>
            <p className="text-sm text-gray-500">
              All AI invocations — {total.toLocaleString()} total entries
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntries(page)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-1">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={entries.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Policy notice */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          AI-generated outputs on this platform are <strong>non-authoritative</strong>. All entries
          below are subject to human review before any decision is acted upon.
        </span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Bot className="w-10 h-10 mb-2 opacity-30" />
            <p>No AI invocations recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Origin</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Data Class</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Org ID</th>
                  <th className="px-4 py-3">Audit Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, i) => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.01 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 max-w-[220px] truncate" title={entry.origin ?? ''}>
                      {entry.origin ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.model ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {entry.dataClass ? (
                        <Badge
                          className={`text-xs ${DATA_CLASS_COLORS[entry.dataClass] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {entry.dataClass}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[120px] truncate" title={entry.userId ?? ''}>
                      {entry.userId ?? <span className="text-gray-400">anonymous</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[120px] truncate" title={entry.organizationId ?? ''}>
                      {entry.organizationId ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[160px] truncate" title={entry.auditRefId ?? ''}>
                      {entry.auditRefId ?? <span className="text-gray-300">—</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} entries
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
