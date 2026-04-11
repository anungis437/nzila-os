/**
 * Consent Form Component
 * 
 * Allows organizations to opt in to data sharing with granular controls.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ConsentFormProps {
  organizationId: string;
}

export default function ConsentForm({ organizationId }: ConsentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [preferences, setPreferences] = useState({
    shareImpactMetrics: false,
    shareCaseResolutionTimes: false,
    shareDemographicData: false,
    shareIndustryInsights: false,
    shareLegislativeData: false,
  });

  const [purpose, setPurpose] = useState('');

  const handleCheckboxChange = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate at least one preference selected
    const hasAnyPreference = Object.values(preferences).some((v) => v === true);
    if (!hasAnyPreference) {
      setError('Please select at least one data type to share');
      setLoading(false);
      return;
    }

    // Validate purpose statement
    if (purpose.trim().length < 10) {
      setError('Please provide a purpose statement (at least 10 characters)');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          preferences,
          purpose: purpose.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to grant consent');
      }

      setSuccess(true);
      
      // Refresh the page after 2 seconds to show new consent status
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <strong>Consent granted successfully!</strong> Your organization is now contributing to
          movement insights. Thank you for your solidarity.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Data Type Preferences */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            Select Data to Share
          </Label>
          <p className="text-sm text-muted-foreground">
            Choose which types of anonymized data to contribute
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 rounded-lg border">
            <Checkbox
              id="shareImpactMetrics"
              checked={preferences.shareImpactMetrics}
              onCheckedChange={() => handleCheckboxChange('shareImpactMetrics')}
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="shareImpactMetrics"
                className="font-medium cursor-pointer"
              >
                Impact Metrics
              </Label>
              <p className="text-sm text-muted-foreground">
                Win rates, resolution outcomes, member satisfaction scores
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> Minimum 10 cases required for aggregation
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border">
            <Checkbox
              id="shareCaseResolutionTimes"
              checked={preferences.shareCaseResolutionTimes}
              onCheckedChange={() => handleCheckboxChange('shareCaseResolutionTimes')}
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="shareCaseResolutionTimes"
                className="font-medium cursor-pointer"
              >
                Case Resolution Times
              </Label>
              <p className="text-sm text-muted-foreground">
                How long grievances take to resolve at each stage
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> Minimum 10 cases required for aggregation
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border">
            <Checkbox
              id="shareDemographicData"
              checked={preferences.shareDemographicData}
              onCheckedChange={() => handleCheckboxChange('shareDemographicData')}
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="shareDemographicData"
                className="font-medium cursor-pointer"
              >
                Demographic Data
              </Label>
              <p className="text-sm text-muted-foreground">
                Age ranges, employment sectors, seniority brackets (heavily anonymized)
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> Minimum 25 cases required for aggregation (higher
                threshold for sensitive data)
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border">
            <Checkbox
              id="shareIndustryInsights"
              checked={preferences.shareIndustryInsights}
              onCheckedChange={() => handleCheckboxChange('shareIndustryInsights')}
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="shareIndustryInsights"
                className="font-medium cursor-pointer"
              >
                Industry Insights
              </Label>
              <p className="text-sm text-muted-foreground">
                Industry-specific patterns (healthcare, education, construction, etc.)
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> Minimum 15 cases required for aggregation
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border">
            <Checkbox
              id="shareLegislativeData"
              checked={preferences.shareLegislativeData}
              onCheckedChange={() => handleCheckboxChange('shareLegislativeData')}
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="shareLegislativeData"
                className="font-medium cursor-pointer"
              >
                Legislative Data
              </Label>
              <p className="text-sm text-muted-foreground">
                Collective agreement patterns, arbitration outcomes, legal precedents
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> Minimum 10 cases required for aggregation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose Statement */}
      <div className="space-y-2">
        <Label htmlFor="purpose" className="text-base font-semibold">
          Purpose Statement
        </Label>
        <p className="text-sm text-muted-foreground">
          Why is your organization choosing to participate? (This helps with internal auditing and
          consent renewal.)
        </p>
        <Textarea
          id="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Example: To support CLC advocacy work and learn from other unions' experiences with workplace disputes."
          rows={3}
          required
        />
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Granting Consent...
          </>
        ) : (
          'Grant Consent'
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By granting consent, you authorize UnionEyes to aggregate anonymized data from your
        organization. You can revoke consent at any time.
      </p>
    </form>
  );
}
