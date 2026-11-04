'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { logger } from '@/lib/logger';
import { readApiError } from '@/lib/client/api-envelope';

/**
 * Only what the negotiations route takes (lib/bargaining/negotiation-route-rules): the status, the mandate, the costing and the confidentiality label come from
 * their own records, so a new negotiation starts as Scheduled and Restricted and none of them is typed here.
 */
interface NegotiationFormData {
  title: string;
  description: string;
  unionName: string;
  unionLocal: string;
  employerName: string;
  bargainingUnitSize: string;
  noticeGivenDate: string;
  firstSessionDate: string;
  targetCompletionDate: string;
}

export default function NewNegotiationPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('bargaining');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<NegotiationFormData>({
    title: '',
    description: '',
    unionName: '',
    unionLocal: '',
    employerName: '',
    bargainingUnitSize: '',
    noticeGivenDate: '',
    firstSessionDate: '',
    targetCompletionDate: '',
  });

  const updateField = (field: keyof NegotiationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || null,
        unionName: formData.unionName,
        unionLocal: formData.unionLocal || null,
        employerName: formData.employerName,
        bargainingUnitSize: formData.bargainingUnitSize ? parseInt(formData.bargainingUnitSize, 10) : null,
        noticeGivenDate: formData.noticeGivenDate ? new Date(formData.noticeGivenDate).toISOString() : null,
        firstSessionDate: formData.firstSessionDate ? new Date(formData.firstSessionDate).toISOString() : null,
        targetCompletionDate: formData.targetCompletionDate ? new Date(formData.targetCompletionDate).toISOString() : null,
      };

      const response = await fetch('/api/bargaining/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, `Failed to create negotiation (${response.status})`));
      }

      // The route answers { success, data: { data: <the new negotiation> } }: the framework's envelope around the generic writer's own { data }.
      const created = (await response.json()) as { data?: { data?: { id?: string } } };
      const id = created.data?.data?.id;
      if (!id) throw new Error('The negotiation was created, but the server did not say which one. Open it from the bargaining dashboard.');
      router.push(`/${locale}/dashboard/bargaining/negotiations/${id}`);
    } catch (error) {
      logger.error('Error creating negotiation', error);
      setError(error instanceof Error ? error.message : 'Error creating negotiation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t('negotiations.new')}</h1>
          <p className="text-muted-foreground">
            Create a new bargaining negotiation round
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Negotiation Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. 2026 Collective Agreement Renewal"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Brief overview of the negotiation scope and objectives"
              rows={4}
            />
          </div>

          {/* Parties */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Parties</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unionName">Union Name *</Label>
                <Input
                  id="unionName"
                  value={formData.unionName}
                  onChange={(e) => updateField('unionName', e.target.value)}
                  placeholder="e.g. CUPE"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unionLocal">Local</Label>
                <Input
                  id="unionLocal"
                  value={formData.unionLocal}
                  onChange={(e) => updateField('unionLocal', e.target.value)}
                  placeholder="e.g. Local 301"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employerName">{t('negotiations.employer')} *</Label>
                <Input
                  id="employerName"
                  value={formData.employerName}
                  onChange={(e) => updateField('employerName', e.target.value)}
                  placeholder="e.g. City of Ottawa"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bargainingUnitSize">{t('negotiations.bargainingUnit')} Size</Label>
                <Input
                  id="bargainingUnitSize"
                  type="number"
                  min="1"
                  value={formData.bargainingUnitSize}
                  onChange={(e) => updateField('bargainingUnitSize', e.target.value)}
                  placeholder="Number of members in the unit"
                />
              </div>
            </div>
          </div>

          <p className="border-t pt-6 text-sm text-muted-foreground">
            A new negotiation starts as Scheduled and Restricted. Its status, strike vote, mandate and costing cannot be typed in here.
          </p>

          {/* Key Dates */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Key Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="noticeGivenDate">Notice Given Date</Label>
                <Input
                  id="noticeGivenDate"
                  type="date"
                  value={formData.noticeGivenDate}
                  onChange={(e) => updateField('noticeGivenDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstSessionDate">First Session Date</Label>
                <Input
                  id="firstSessionDate"
                  type="date"
                  value={formData.firstSessionDate}
                  onChange={(e) => updateField('firstSessionDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetCompletionDate">Target Completion</Label>
                <Input
                  id="targetCompletionDate"
                  type="date"
                  value={formData.targetCompletionDate}
                  onChange={(e) => updateField('targetCompletionDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          {error && (
            <p role="alert" className="border-t pt-6 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="border-t pt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <Save className="mr-2 h-4 w-4" />
              {submitting ? 'Creating...' : 'Create Negotiation'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
