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
          <h1 className="text-3xl font-bold">Strike Fund Application</h1>
          <p className="text-muted-foreground">
            Apply for financial assistance during strike action
          </p>
        </div>
      </div>

      {/* Eligibility Notice */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Eligibility:</strong> Members must be in good standing and actively participating in authorized strike action to receive benefits.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Member Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Member Information</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberId">Member ID *</Label>
                <Input
                  id="memberId"
                  value={formData.memberId}
                  onChange={(e) => updateField('memberId', e.target.value)}
                  placeholder="MEM-12345"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dependents">Number of Dependents *</Label>
                <Input
                  id="dependents"
                  type="number"
                  min="0"
                  value={formData.dependents}
                  onChange={(e) => updateField('dependents', parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Dependents under 18 or full-time students under 25
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Estimated Weekly Benefit</p>
                <p className="text-2xl font-bold text-green-600">
                  ${calculateWeeklyAmount()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base: $200 + ${formData.dependents * 25} dependent allowance
                </p>
              </div>
            </div>
          </Card>

          {/* Financial Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Financial Information</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasOtherIncome"
                  checked={formData.hasOtherIncome}
                  onCheckedChange={(checked) => updateField('hasOtherIncome', checked as boolean)}
                />
                <Label htmlFor="hasOtherIncome" className="font-normal cursor-pointer">
                  I have other sources of income during the strike
                </Label>
              </div>

              {formData.hasOtherIncome && (
                <div className="space-y-2">
                  <Label htmlFor="otherIncomeDetails">Other Income Details *</Label>
                  <Textarea
                    id="otherIncomeDetails"
                    value={formData.otherIncomeDetails}
                    onChange={(e) => updateField('otherIncomeDetails', e.target.value)}
                    placeholder="Describe other income sources and amounts..."
                    rows={3}
                    required={formData.hasOtherIncome}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="financialHardship">Financial Hardship Statement</Label>
                <Textarea
                  id="financialHardship"
                  value={formData.financialHardship}
                  onChange={(e) => updateField('financialHardship', e.target.value)}
                  placeholder="Briefly describe your financial situation and why you need strike fund assistance..."
                  rows={4}
                />
              </div>
            </div>
          </Card>

          {/* Banking Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Direct Deposit Information</h2>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Strike fund payments will be deposited directly to your bank account
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => updateField('bankName', e.target.value)}
                  placeholder="Royal Bank"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="institutionNumber">Institution # *</Label>
                  <Input
                    id="institutionNumber"
                    value={formData.institutionNumber}
                    onChange={(e) => updateField('institutionNumber', e.target.value)}
                    placeholder="001"
                    maxLength={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transitNumber">Transit # *</Label>
                  <Input
                    id="transitNumber"
                    value={formData.transitNumber}
                    onChange={(e) => updateField('transitNumber', e.target.value)}
                    placeholder="12345"
                    maxLength={5}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account # *</Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    placeholder="1234567"
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You can find these numbers at the bottom of your cheque or in your online banking
              </p>
            </div>
          </Card>

          {/* Certification */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Certification</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="certifyTruth"
                  checked={formData.certifyTruth}
                  onCheckedChange={(checked) => updateField('certifyTruth', checked as boolean)}
                  required
                />
                <Label htmlFor="certifyTruth" className="font-normal cursor-pointer leading-relaxed">
                  I certify that the information provided in this application is true and accurate. 
                  I understand that providing false information may result in denial of benefits and 
                  disciplinary action. I agree to participate in authorized strike activities and 
                  picket duty as required by the union.
                </Label>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!formData.certifyTruth}>
            <Save className="mr-2 h-4 w-4" />
            Submit Application
          </Button>
        </div>
      </form>
    </div>
  );
}
