/**
 * Billing Admin Page
 *
 * Manage billing account, subscription plans, and billing periods.
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CreditCard, CheckCircle } from 'lucide-react';

interface BillingAccount {
  id: string;
  displayName: string;
  billingEmail: string;
  status: string;
  currency: string;
  netTermsDays: number;
  createdAt: string;
}

export default function BillingPage() {
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ displayName: '', billingEmail: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/billing');
      if (res.ok) {
        const json = await res.json();
        setAccount(json.data);
      } else if (res.status === 404) {
        setAccount(null);
      }
    } catch {
      setError('Failed to load billing account');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleCreate = async () => {
    if (!form.displayName || !form.billingEmail) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create billing account');
      const json = await res.json();
      setAccount(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <Card className="p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-48" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {error && (
        <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </Card>
      )}

      {account ? (
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{account.displayName}</h2>
                <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                  {account.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{account.billingEmail}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Currency: <span className="font-semibold">{account.currency}</span></p>
              <p>Net Terms: {account.netTermsDays} days</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Account created {new Date(account.createdAt).toLocaleDateString()}
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Set Up Billing Account</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create a billing account to enable platform invoicing and cost allocation.
            All billing is processed in Canadian Dollars (CAD).
          </p>
          <div className="space-y-3 max-w-md">
            <Input
              placeholder="Organization display name"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Billing email"
              value={form.billingEmail}
              onChange={(e) => setForm((f) => ({ ...f, billingEmail: e.target.value }))}
            />
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Billing Account'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
