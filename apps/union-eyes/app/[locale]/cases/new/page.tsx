/**
 * New Case Form
 * 
 * Create a new grievance or case
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useTranslations } from "next-intl";

interface CaseFormData {
  memberId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  incidentDate: string;
  location: string;
  witnesses: string;
  desiredOutcome: string;
}

export default function NewCasePage() {
  const router = useRouter();
  const t = useTranslations("cases.new");
  const [formData, setFormData] = useState<CaseFormData>({
    memberId: '',
    type: 'disciplinary',
    priority: 'medium',
    title: '',
    description: '',
    incidentDate: '',
    location: '',
    witnesses: '',
    desiredOutcome: '',
  });

  const updateField = (field: keyof CaseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.cases.create(formData);
      alert('Case created successfully!');
      router.push('/cases');
    } catch (error) {
      logger.error('Error creating case', error);
      alert('Error creating case. Please try again.');
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
          <h1 className="text-3xl font-bold">{t("heading")}</h1>
          <p className="text-muted-foreground">
            {t("subheading")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {/* Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="memberId">{t("memberLabel")} *</Label>
            <Select value={formData.memberId} onValueChange={(v) => updateField('memberId', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("memberPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mem-1">{t("memberOption1")}</SelectItem>
                <SelectItem value="mem-2">{t("memberOption2")}</SelectItem>
                <SelectItem value="mem-3">{t("memberOption3")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Case Type & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t("typeLabel")} *</Label>
              <Select value={formData.type} onValueChange={(v) => updateField('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disciplinary">{t("typeDisciplinary")}</SelectItem>
                  <SelectItem value="workplace_safety">{t("typeWorkplaceSafety")}</SelectItem>
                  <SelectItem value="harassment">{t("typeHarassment")}</SelectItem>
                  <SelectItem value="termination">{t("typeTermination")}</SelectItem>
                  <SelectItem value="wages">{t("typeWages")}</SelectItem>
                  <SelectItem value="discrimination">{t("typeDiscrimination")}</SelectItem>
                  <SelectItem value="other">{t("typeOther")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">{t("priorityLabel")} *</Label>
              <Select value={formData.priority} onValueChange={(v) => updateField('priority', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("priorityLow")}</SelectItem>
                  <SelectItem value="medium">{t("priorityMedium")}</SelectItem>
                  <SelectItem value="high">{t("priorityHigh")}</SelectItem>
                  <SelectItem value="urgent">{t("priorityUrgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t("titleLabel")} *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t("titlePlaceholder")}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("descriptionLabel")} *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={6}
              required
            />
          </div>

          {/* Incident Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="incidentDate">{t("incidentDateLabel")} *</Label>
              <Input
                id="incidentDate"
                type="date"
                value={formData.incidentDate}
                onChange={(e) => updateField('incidentDate', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t("locationLabel")}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder={t("locationPlaceholder")}
              />
            </div>
          </div>

          {/* Witnesses */}
          <div className="space-y-2">
            <Label htmlFor="witnesses">{t("witnessesLabel")}</Label>
            <Textarea
              id="witnesses"
              value={formData.witnesses}
              onChange={(e) => updateField('witnesses', e.target.value)}
              placeholder={t("witnessesPlaceholder")}
              rows={3}
            />
          </div>

          {/* Desired Outcome */}
          <div className="space-y-2">
            <Label htmlFor="desiredOutcome">{t("desiredOutcomeLabel")}</Label>
            <Textarea
              id="desiredOutcome"
              value={formData.desiredOutcome}
              onChange={(e) => updateField('desiredOutcome', e.target.value)}
              placeholder={t("desiredOutcomePlaceholder")}
              rows={4}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancelButton")}
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            {t("createButton")}
          </Button>
        </div>
      </form>
    </div>
  );
}
