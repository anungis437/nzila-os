/**
 * Edit Case Page
 * 
 * Edit existing grievance/case information
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useTranslations } from "next-intl";
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/index';

interface CaseFormData {
  memberId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  status: string;
  incidentDate: string;
  location: string;
  witnesses: string;
  desiredOutcome: string;
  assignedTo: string;
}

export default function EditCasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations("cases.edit");
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<CaseFormData>({
    memberId: '',
    type: '',
    priority: '',
    title: '',
    description: '',
    status: '',
    incidentDate: '',
    location: '',
    witnesses: '',
    desiredOutcome: '',
    assignedTo: '',
  });

  useEffect(() => {
    fetchCase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchCase = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await api.cases.get(params.id) as Record<string, any>;
      
      // Populate form from API response
      setFormData({
        memberId: data.memberId ?? data.member_id ?? '',
        type: data.type ?? '',
        priority: data.priority ?? 'medium',
        title: data.title ?? '',
        description: data.description ?? '',
        status: data.status ?? 'filed',
        incidentDate: data.incidentDate ?? data.incident_date ?? '',
        location: data.location ?? '',
        witnesses: data.witnesses ?? '',
        desiredOutcome: data.desiredOutcome ?? data.desired_outcome ?? '',
        assignedTo: data.assignedTo ?? data.assigned_to ?? '',
      });
    } catch (error) {
      logger.error('Error fetching case', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof CaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.cases.update(params.id, formData);
      alert('Case updated successfully!');
      router.push(`/dashboard/cases/${params.id}`);
    } catch (error) {
      logger.error('Error updating case', error);
      alert('Error updating case. Please try again.');
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">{t("loading")}</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t("heading")}</h1>
          <p className="text-muted-foreground">{t("subheading")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t("basicInfoSection")}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">{t("typeLabel")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => updateField('type', value)}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disciplinary">{t("typeDisciplinary")}</SelectItem>
                    <SelectItem value="safety">{t("typeWorkplaceSafety")}</SelectItem>
                    <SelectItem value="harassment">{t("typeHarassment")}</SelectItem>
                    <SelectItem value="termination">{t("typeTermination")}</SelectItem>
                    <SelectItem value="wages">{t("typeWages")}</SelectItem>
                    <SelectItem value="discrimination">{t("typeDiscrimination")}</SelectItem>
                    <SelectItem value="other">{t("typeOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">{t("priorityLabel")}</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => updateField('priority', value)}
                >
                  <SelectTrigger id="priority">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t("statusLabel")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateField('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intake">{t("statusIntake")}</SelectItem>
                    <SelectItem value="investigation">{t("statusInvestigation")}</SelectItem>
                    <SelectItem value="arbitration">{t("statusArbitration")}</SelectItem>
                    <SelectItem value="mediation">{t("statusMediation")}</SelectItem>
                    <SelectItem value="resolved">{t("statusResolved")}</SelectItem>
                    <SelectItem value="withdrawn">{t("statusWithdrawn")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">{t("assignedToLabel")}</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => updateField('assignedTo', value)}
                >
                  <SelectTrigger id="assignedTo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steward-1">{t("assignedToOption1")}</SelectItem>
                    <SelectItem value="steward-2">{t("assignedToOption2")}</SelectItem>
                    <SelectItem value="steward-3">{t("assignedToOption3")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder={t("titlePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionLabel")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={6}
                required
              />
            </div>
          </div>
        </Card>

        {/* Incident Details */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t("incidentDetailsSection")}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentDate">{t("incidentDateLabel")}</Label>
                <Input
                  id="incidentDate"
                  type="date"
                  value={formData.incidentDate}
                  onChange={(e) => updateField('incidentDate', e.target.value)}
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
          </div>
        </Card>

        {/* Resolution */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t("resolutionSection")}</h2>
          <div className="space-y-4">
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
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancelButton")}
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            {t("saveButton")}
          </Button>
        </div>
      </form>
    </div>
  );
}
