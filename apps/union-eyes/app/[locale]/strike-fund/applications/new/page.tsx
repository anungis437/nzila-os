/**
 * Strike Fund Application Form
 * 
 * Apply for strike fund assistance
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api/index';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ApplicationData {
  memberId: string;
  dependents: number;
  hasOtherIncome: boolean;
  otherIncomeDetails: string;
  financialHardship: string;
  bankName: string;
  accountNumber: string;
  transitNumber: string;
  institutionNumber: string;
  certifyTruth: boolean;
}

export default function NewStrikeFundApplicationPage() {
  const router = useRouter();
  const t = useTranslations('strikeFund.application');
  const [formData, setFormData] = useState<ApplicationData>({
    memberId: '',
    dependents: 0,
    hasOtherIncome: false,
    otherIncomeDetails: '',
    financialHardship: '',
    bankName: '',
    accountNumber: '',
    transitNumber: '',
    institutionNumber: '',
    certifyTruth: false,
  });

  const updateField = <K extends keyof ApplicationData>(field: K, value: ApplicationData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateWeeklyAmount = () => {
    // Base amount + dependent allowance
    const baseAmount = 200;
    const dependentAllowance = 25;
    return baseAmount + (formData.dependents * dependentAllowance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.certifyTruth) {
      alert('You must certify that the information provided is true and accurate.');
      return;
    }

    try {
      await api.strikeFund.applications.create(formData);
      alert('Application submitted successfully!');
      router.push('/strike-fund');
    } catch (error) {
      logger.error('Error submitting application', error);
      alert('Error submitting application. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Eligibility Notice */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>{t("eligibility")}:</strong> {t("eligibilityDescription")}
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Member Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t("memberInformation")}</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberId">{t("memberIdLabel")} *</Label>
                <Input
                  id="memberId"
                  value={formData.memberId}
                  onChange={(e) => updateField('memberId', e.target.value)}
                  placeholder={t("memberIdPlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dependents">{t("dependentsLabel")} *</Label>
                <Input
                  id="dependents"
                  type="number"
                  min="0"
                  value={formData.dependents}
                  onChange={(e) => updateField('dependents', parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t("dependentsHint")}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">{t("estimatedWeeklyBenefit")}</p>
                <p className="text-2xl font-bold text-green-600">
                  ${calculateWeeklyAmount()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("benefitCalculation")}
                </p>
              </div>
            </div>
          </Card>

          {/* Financial Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t("financialInformation")}</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasOtherIncome"
                  checked={formData.hasOtherIncome}
                  onCheckedChange={(checked) => updateField('hasOtherIncome', checked as boolean)}
                />
                <Label htmlFor="hasOtherIncome" className="font-normal cursor-pointer">
                  {t("hasOtherIncomeLabel")}
                </Label>
              </div>

              {formData.hasOtherIncome && (
                <div className="space-y-2">
                  <Label htmlFor="otherIncomeDetails">{t("otherIncomeDetailsLabel")} *</Label>
                  <Textarea
                    id="otherIncomeDetails"
                    value={formData.otherIncomeDetails}
                    onChange={(e) => updateField('otherIncomeDetails', e.target.value)}
                    placeholder={t("otherIncomeDetailsPlaceholder")}
                    rows={3}
                    required={formData.hasOtherIncome}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="financialHardship">{t("financialHardshipLabel")}</Label>
                <Textarea
                  id="financialHardship"
                  value={formData.financialHardship}
                  onChange={(e) => updateField('financialHardship', e.target.value)}
                  placeholder={t("financialHardshipPlaceholder")}
                  rows={4}
                />
              </div>
            </div>
          </Card>

          {/* Banking Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t("directDepositInfo")}</h2>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("directDepositNotice")}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">{t("bankNameLabel")} *</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => updateField('bankName', e.target.value)}
                  placeholder={t("bankNamePlaceholder")}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="institutionNumber">{t("institutionNumberLabel")} *</Label>
                  <Input
                    id="institutionNumber"
                    value={formData.institutionNumber}
                    onChange={(e) => updateField('institutionNumber', e.target.value)}
                    placeholder={t("institutionNumberPlaceholder")}
                    maxLength={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transitNumber">{t("transitNumberLabel")} *</Label>
                  <Input
                    id="transitNumber"
                    value={formData.transitNumber}
                    onChange={(e) => updateField('transitNumber', e.target.value)}
                    placeholder={t("transitNumberPlaceholder")}
                    maxLength={5}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">{t("accountNumberLabel")} *</Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    placeholder={t("accountNumberPlaceholder")}
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("bankInfoHint")}
              </p>
            </div>
          </Card>

          {/* Certification */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t("certification")}</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="certifyTruth"
                  checked={formData.certifyTruth}
                  onCheckedChange={(checked) => updateField('certifyTruth', checked as boolean)}
                  required
                />
                <Label htmlFor="certifyTruth" className="font-normal cursor-pointer leading-relaxed">
                  {t("certificationText")}
                </Label>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancelButton")}
          </Button>
          <Button type="submit" disabled={!formData.certifyTruth}>
            <Save className="mr-2 h-4 w-4" />
            {t("submitButton")}
          </Button>
        </div>
      </form>
    </div>
  );
}
