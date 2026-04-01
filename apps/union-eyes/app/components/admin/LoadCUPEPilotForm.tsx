/**
 * Admin Form Component: Load CUPE Pilot Dataset
 * 
 * Allows platform administrators to load CUPE Local 123 demo data
 * via the admin console for testing and pilot readiness validation.
 * 
 * v0.1: Manual button-based loading with confirmation
 * v0.2+: Scheduled seeding, multi-org support
 */

'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';

interface LoadPilotDataResponse {
  success: boolean;
  message: string;
  data?: {
    org: string;
    worksites: number;
    members: number;
    cases: number;
  };
  error?: string;
}

export function LoadCUPEPilotForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [response, setResponse] = useState<LoadPilotDataResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function loadPilotData() {
    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/admin/seed-cupe-pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: false }),
      });

      const data: LoadPilotDataResponse = await res.json();
      setResponse(data);
      setShowConfirm(false);
    } catch (error) {
      setResponse({
        success: false,
        message: 'Failed to load pilot data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPilotData() {
    setIsResetting(true);
    setResponse(null);

    try {
      const res = await fetch('/api/admin/seed-cupe-pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });

      const data: LoadPilotDataResponse = await res.json();
      setResponse(data);
    } catch (error) {
      setResponse({
        success: false,
        message: 'Failed to reset pilot data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">CUPE Pilot Data</h3>
        <p className="mt-1 text-sm text-gray-600">
          Load or reset CUPE Local 123 demo fixtures for pilot readiness testing.
        </p>
      </div>

      {response && (
        <div
          className={`flex gap-3 rounded-lg p-4 ${
            response.success
              ? 'border border-green-200 bg-green-50'
              : 'border border-red-200 bg-red-50'
          }`}
        >
          {response.success ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}

          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                response.success ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {response.message}
            </p>
            {response.data && (
              <div className="mt-2 text-xs text-green-800">
                <p>✓ Org: {response.data.org}</p>
                <p>✓ Worksites: {response.data.worksites}</p>
                <p>✓ Members: {response.data.members}</p>
                <p>✓ Cases: {response.data.cases}</p>
              </div>
            )}
            {response.error && (
              <p className="mt-2 text-xs text-red-800">{response.error}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => setShowConfirm(!showConfirm)}
          disabled={isLoading || isResetting}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Load Pilot Data'
          )}
        </button>

        <button
          onClick={resetPilotData}
          disabled={isLoading || isResetting}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isResetting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              Reset Data
            </>
          )}
        </button>
      </div>

      {showConfirm && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-900">
            Load CUPE Local 123 fixtures? This will create:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-yellow-800">
            <li>✓ 1 pilot organization</li>
            <li>✓ 3 worksites</li>
            <li>✓ 7 demo members (6 union + 1 admin)</li>
            <li>✓ 5 demo cases (various statuses)</li>
          </ul>

          <div className="mt-4 flex gap-3">
            <button
              onClick={loadPilotData}
              className="rounded-lg bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700"
            >
              Confirm Load
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-yellow-300 bg-white px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
        <p className="font-medium text-gray-700">Usage:</p>
        <ul className="mt-2 space-y-1">
          <li>
            • Click <strong>Load Pilot Data</strong> to populate demo fixtures
          </li>
          <li>
            • Click <strong>Reset Data</strong> to delete all CUPE Local 123 data
          </li>
          <li>
            • A CLI script is also available:{' '}
            <code className="rounded bg-gray-200 px-2 py-1">
              node scripts/seed-cupe-pilot.mjs --reset
            </code>
          </li>
        </ul>
      </div>
    </div>
  );
}
