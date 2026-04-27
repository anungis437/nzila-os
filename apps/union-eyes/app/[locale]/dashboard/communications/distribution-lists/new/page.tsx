/**
 * Create Distribution List Page
 *
 * Form for creating a new distribution list
 * Path: /dashboard/communications/distribution-lists/new
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface ListForm {
  name: string;
  description: string;
  listType: string;
  isActive: boolean;
}

export default function NewDistributionListPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('newDistributionListPage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ListForm>({
    name: '',
    description: '',
    listType: 'manual',
    isActive: true,
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.name.trim()) {
        throw new Error(t('errors.nameRequired'));
      }

      const response = await fetch('/api/communications/distribution-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t('errors.createFailed'));
      }

      const json = await response.json();
      const created = json.data ?? json;
      router.push(`/${locale}/dashboard/communications/distribution-lists/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/communications/distribution-lists`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('form.title')}</CardTitle>
          <CardDescription>
            {t('form.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('form.nameLabel')}</Label>
            <Input
              id="name"
              placeholder={t('form.namePlaceholder')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('form.descriptionLabel')}</Label>
            <Textarea
              id="description"
              placeholder={t('form.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listType">{t('form.listTypeLabel')}</Label>
            <Select
              value={formData.listType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, listType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.listTypePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t('form.listTypes.manual')}</SelectItem>
                <SelectItem value="dynamic">{t('form.listTypes.dynamic')}</SelectItem>
                <SelectItem value="imported">{t('form.listTypes.imported')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label>{t('form.activeLabel')}</Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/communications/distribution-lists`)}
          >
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('actions.create')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
