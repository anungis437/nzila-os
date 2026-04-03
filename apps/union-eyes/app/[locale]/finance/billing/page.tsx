/**
 * Billing Account Page
 *
 * Manage billing account: view and edit contact details, address, tax ID, net terms.
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CreditCard, CheckCircle, Pencil, X } from 'lucide-react';

interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface BillingAccount {
  id: string;
  displayName: string;
  billingEmail: string;
  billingContactName: string | null;
  billingPhone: string | null;
  billingAddress: BillingAddress | null;
  taxId: string | null;
  currency: string;
  status: string;
  netTermsDays: number;
  createdAt: string;
}

interface EditForm {
  displayName: string;
  billingEmail: string;
  billingContactName: string;
  billingPhone: string;
  taxId: string;
  netTermsDays: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export default function BillingPage() {
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [createForm, setCreateForm] = useState({ displayName: '', billingEmail: '' });
  const [editForm, setEditForm] = useState<EditForm>({
    displayName: '', billingEmail: '', billingContactName: '',
    billingPhone: '', taxId: '', netTermsDays: '30',
    line1: '', line2: '', city: '', province: '', postalCode: '', country: 'CA',
  });
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const openEdit = () => {
    if (!account) return;
    setEditForm({
      displayName: account.displayName,
      billingEmail: account.billingEmail,
      billingContactName: account.billingContactName ?? '',
      billingPhone: account.billingPhone ?? '',
      taxId: account.taxId ?? '',
      netTermsDays: String(account.netTermsDays),
      line1: account.billingAddress?.line1 ?? '',
      line2: account.billingAddress?.line2 ?? '',
      city: account.billingAddress?.city ?? '',
      province: account.billingAddress?.province ?? '',
      postalCode: account.billingAddress?.postalCode ?? '',
      country: account.billingAddress?.country ?? 'CA',
    });
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        displayName: editForm.displayName,
        billingEmail: editForm.billingEmail,
        billingContactName: editForm.billingContactName || undefined,
        billingPhone: editForm.billingPhone || undefined,
        taxId: editForm.taxId || undefined,
        netTermsDays: editForm.netTermsDays ? Number(editForm.netTermsDays) : undefined,
      };
      if (editForm.line1) {
        body.billingAddress = {
          line1: editForm.line1,
          line2: editForm.line2 || undefined,
          city: editForm.city,
          province: editForm.province,
          postalCode: editForm.postalCode,
          country: editForm.country,
        };
      }
      const res = await fetch('/api/finance/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Failed to save');
      }
      const json = await res.json();
      setAccount(json.data);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.displayName || !createForm.billingEmail) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
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
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
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
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{account.displayName}</h2>
              <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                {account.status}
              </Badge>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={openEdit} className="gap-1">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          {!editing ? (
            /* ── Read-only view ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Detail label="Billing Email" value={account.billingEmail} />
              <Detail label="Contact Name" value={account.billingContactName} />
              <Detail label="Phone" value={account.billingPhone} />
              <Detail label="Tax ID" value={account.taxId} />
              <Detail label="Currency" value={account.currency} />
              <Detail label="Net Terms" value={`Net ${account.netTermsDays}`} />
              {account.billingAddress && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground font-medium">Billing Address</p>
                  <p>{account.billingAddress.line1}</p>
                  {account.billingAddress.line2 && <p>{account.billingAddress.line2}</p>}
                  <p>{account.billingAddress.city}, {account.billingAddress.province} {account.billingAddress.postalCode}</p>
                  <p>{account.billingAddress.country}</p>
                </div>
              )}
              <div className="sm:col-span-2 pt-2 border-t flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Account created {new Date(account.createdAt).toLocaleDateString('en-CA')}
              </div>
            </div>
          ) : (
            /* ── Edit form ── */
            <div className="space-y-4">
              {saveError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {saveError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Display Name" required>
                  <Input value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} />
                </Field>
                <Field label="Billing Email" required>
                  <Input type="email" value={editForm.billingEmail} onChange={(e) => setEditForm((f) => ({ ...f, billingEmail: e.target.value }))} />
                </Field>
                <Field label="Contact Name">
                  <Input value={editForm.billingContactName} onChange={(e) => setEditForm((f) => ({ ...f, billingContactName: e.target.value }))} />
                </Field>
                <Field label="Phone">
                  <Input value={editForm.billingPhone} onChange={(e) => setEditForm((f) => ({ ...f, billingPhone: e.target.value }))} />
                </Field>
                <Field label="Tax ID / BN">
                  <Input value={editForm.taxId} placeholder="e.g. 123456789 RT0001" onChange={(e) => setEditForm((f) => ({ ...f, taxId: e.target.value }))} />
                </Field>
                <Field label="Net Terms (days)">
                  <Input type="number" min={1} max={120} value={editForm.netTermsDays} onChange={(e) => setEditForm((f) => ({ ...f, netTermsDays: e.target.value }))} />
                </Field>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Billing Address</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Street Line 1" className="sm:col-span-2">
                    <Input value={editForm.line1} onChange={(e) => setEditForm((f) => ({ ...f, line1: e.target.value }))} />
                  </Field>
                  <Field label="Street Line 2" className="sm:col-span-2">
                    <Input value={editForm.line2} onChange={(e) => setEditForm((f) => ({ ...f, line2: e.target.value }))} />
                  </Field>
                  <Field label="City">
                    <Input value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                  </Field>
                  <Field label="Province">
                    <Input value={editForm.province} placeholder="e.g. ON" onChange={(e) => setEditForm((f) => ({ ...f, province: e.target.value }))} />
                  </Field>
                  <Field label="Postal Code">
                    <Input value={editForm.postalCode} placeholder="e.g. K1A 0A6" onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))} />
                  </Field>
                  <Field label="Country">
                    <Input value={editForm.country} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} />
                  </Field>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving} className="gap-1">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 max-w-md">
          <h2 className="text-lg font-semibold mb-2">Set Up Billing Account</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create a billing account to enable platform invoicing and cost allocation.
            All billing is processed in Canadian Dollars (CAD).
          </p>
          <div className="space-y-3">
            <Input
              placeholder="Organization display name"
              value={createForm.displayName}
              onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Billing email"
              value={createForm.billingEmail}
              onChange={(e) => setCreateForm((f) => ({ ...f, billingEmail: e.target.value }))}
            />
            <Button onClick={handleCreate} disabled={creating || !createForm.displayName || !createForm.billingEmail}>
              {creating ? 'Creating...' : 'Create Billing Account'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
    </div>
  );
}

function Field({ label, required, children, className }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium mb-1 block">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}


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
