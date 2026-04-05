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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { logger } from '@/lib/logger';

interface NegotiationFormData {
  title: string;
  description: string;
  unionName: string;
  unionLocal: string;
  employerName: string;
  bargainingUnitSize: string;
  status: string;
  noticeGivenDate: string;
  firstSessionDate: string;
  targetCompletionDate: string;
  estimatedCost: string;
  confidentialityLevel: string;
}

export default function NewNegotiationPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('bargaining');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<NegotiationFormData>({
    title: '',
    description: '',
    unionName: '',
    unionLocal: '',
    employerName: '',
    bargainingUnitSize: '',
    status: 'scheduled',
    noticeGivenDate: '',
    firstSessionDate: '',
    targetCompletionDate: '',
    estimatedCost: '',
    confidentialityLevel: 'restricted',
  });

  const updateField = (field: keyof NegotiationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || null,
        unionName: formData.unionName,
        unionLocal: formData.unionLocal || null,
        employerName: formData.employerName,
        bargainingUnitSize: formData.bargainingUnitSize ? parseInt(formData.bargainingUnitSize, 10) : null,
        status: formData.status,
        noticeGivenDate: formData.noticeGivenDate ? new Date(formData.noticeGivenDate).toISOString() : null,
        firstSessionDate: formData.firstSessionDate ? new Date(formData.firstSessionDate).toISOString() : null,
        targetCompletionDate: formData.targetCompletionDate ? new Date(formData.targetCompletionDate).toISOString() : null,
        estimatedCost: formData.estimatedCost || null,
        confidentialityLevel: formData.confidentialityLevel,
      };

      const response = await fetch('/api/bargaining/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create negotiation (${response.status})`);
      }

      const data = await response.json();
      router.push(`/${locale}/dashboard/bargaining/negotiations/${data.id || data.data?.id || ''}`);
    } catch (error) {
      logger.error('Error creating negotiation', error);
      alert(error instanceof Error ? error.message : 'Error creating negotiation. Please try again.');
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

          {/* Status & Confidentiality */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t('negotiations.status')}</Label>
                <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="impasse">Impasse</SelectItem>
                    <SelectItem value="conciliation">Conciliation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confidentialityLevel">Confidentiality Level</Label>
                <Select value={formData.confidentialityLevel} onValueChange={(v) => updateField('confidentialityLevel', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

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

          {/* Cost */}
          <div className="border-t pt-6">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="estimatedCost">Estimated Cost ($)</Label>
              <Input
                id="estimatedCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(e) => updateField('estimatedCost', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Submit */}
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
