/**
 * Distribution List Detail Page
 *
 * View and edit a single distribution list with subscriber management
 * Path: /dashboard/communications/distribution-lists/[id]
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ApiShapeError, envelopeData, envelopeRow, isRecord, readApiError } from '@/lib/client/api-envelope';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  RefreshCw,
} from 'lucide-react';

interface DistributionList {
  id: string;
  name: string;
  description: string | null;
  listType: string;
  subscriberCount: number;
  isActive: boolean;
}

interface Subscriber {
  id: string;
  email: string;
  status: string;
  subscribedAt: string | null;
}

/** A list from the item route; a body that is not a list is an error, and a column the table leaves null reads as the table's own default. */
function listFrom(row: Record<string, unknown>): DistributionList {
  if (typeof row.id !== 'string' || typeof row.name !== 'string') throw new ApiShapeError('not a distribution list');
  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === 'string' ? row.description : null,
    listType: typeof row.listType === 'string' ? row.listType : 'manual',
    subscriberCount: typeof row.subscriberCount === 'number' ? row.subscriberCount : 0,
    isActive: row.isActive !== false,
  };
}

function subscriberFrom(row: unknown): Subscriber {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.email !== 'string' || typeof row.status !== 'string') {
    throw new ApiShapeError('not a subscriber');
  }
  return { id: row.id, email: row.email, status: row.status, subscribedAt: typeof row.subscribedAt === 'string' ? row.subscribedAt : null };
}

// The message catalogues are shared, so the copy for a failed subscriber read is kept here.
const SUBSCRIBERS_UNAVAILABLE = {
  en: 'The subscribers could not be loaded. Use the refresh button to try again.',
  fr: 'Les abonnés n’ont pas pu être chargés. Utilisez le bouton d’actualisation pour réessayer.',
} as const;

export default function DistributionListDetailPage() {
  const t = useTranslations('distributionListDetailPage');
  const router = useRouter();
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<DistributionList | null>(null);
  // null until the subscribers have been read; an empty array only when the list really has none.
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [subscribersError, setSubscribersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<DistributionList>>({});

  useEffect(() => {
    if (id) {
      fetchList();
      fetchSubscribers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/communications/distribution-lists/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error(t('notFound'));
        throw new Error(t('failedToFetch'));
      }
      const data = listFrom(envelopeRow(await response.json()));
      setList(data);
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('failedToFetch'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      setSubscribersError(null);
      const response = await fetch(`/api/communications/distribution-lists/${id}/subscribers`);
      if (!response.ok) throw new Error(`The subscribers route answered ${response.status}`);
      const { subscribers: rows } = envelopeData(await response.json());
      if (!Array.isArray(rows)) throw new ApiShapeError('no subscribers');
      setSubscribers(rows.map(subscriberFrom));
    } catch (err) {
      logger.error('Failed to load distribution list subscribers', err, { listId: id });
      setSubscribers(null);
      setSubscribersError(SUBSCRIBERS_UNAVAILABLE[locale.toLowerCase().startsWith('fr') ? 'fr' : 'en']);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/communications/distribution-lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response, t('failedToSave')));

      const updated = listFrom(envelopeRow(await response.json()));
      setList(updated);
      setFormData(updated);
      setSuccessMessage(t('successMessage'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      const response = await fetch(`/api/communications/distribution-lists/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await readApiError(response, t('failedToDelete')));
      router.push(`/${locale}/dashboard/communications/distribution-lists`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToDelete'));
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !list) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/dashboard/communications/distribution-lists`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('backButton')}
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/dashboard/communications/distribution-lists`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{list?.name}</h1>
            <p className="text-muted-foreground">
              {t('subscriberCount', { count: list?.subscriberCount ?? 0 })} &middot; {list?.listType ?? 'manual'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> {t('deleteButton')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('saveButton')}
          </Button>
        </div>
      </div>

      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('listDetailsTitle')}</CardTitle>
          <CardDescription>{t('listDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('nameLabel')}</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isActive ?? true}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label>{t('activeLabel')}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('subscribersTitle')}
              </CardTitle>
              <CardDescription>
                {subscribers && t('subscribersDescription', { count: subscribers.length })}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSubscribers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {subscribersError ? (
            <p role="alert" className="text-center text-destructive py-8">
              {subscribersError}
            </p>
          ) : subscribers === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subscribers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('noSubscribers')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('emailHeader')}</TableHead>
                  <TableHead>{t('statusHeader')}</TableHead>
                  <TableHead>{t('subscribedHeader')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.email}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'subscribed' ? 'default' : 'secondary'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{sub.subscribedAt ? formatDate(sub.subscribedAt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { name: list?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
