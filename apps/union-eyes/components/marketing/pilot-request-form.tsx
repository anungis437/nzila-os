/**
 * Pilot Request Form Component
 * 
 * Multi-step form for pilot program applications with instant readiness assessment
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { logger } from '@/lib/logger';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Rocket,
  Building2,
  Target,
  Zap
} from 'lucide-react';

interface FormData {
  // Step 1: Organization
  organizationName: string;
  organizationType: 'local' | 'regional' | 'national';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  memberCount: number | '';
  
  // Step 2: Context
  jurisdictions: string[];
  sectors: string[];
  currentSystem: string;
  challenges: string[];
  
  // Step 3: Goals
  goals: string[];
  responses: {
    executiveSponsor?: boolean;
    staffCommitment?: string;
    hasITSupport?: boolean;
    staffTechComfort?: string;
    budgetApproved?: boolean;
  };
}

const JURISDICTIONS = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland & Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
];

const SECTORS = [
  'Healthcare',
  'Education',
  'Construction',
  'Transportation',
  'Public Service',
  'Manufacturing',
  'Service',
  'Other'
];

const CHALLENGES = [
  'Lost or missing documents',
  'Manual tracking processes',
  'No audit trail',
  'Inconsistent case handling',
  'Long resolution times',
  'Poor member communication',
  'Difficult reporting',
  'Limited transparency'
];

const GOALS = [
  'Reduce case resolution time',
  'Improve documentation quality',
  'Better member experience',
  'Increase transparency',
  'Easier reporting for leadership',
  'Stronger audit trail',
  'More consistent processes',
  'Empower organizers'
];

const STEPS = [
  { id: 1, title: 'Organization', icon: Building2 },
  { id: 2, title: 'Context', icon: Zap },
  { id: 3, title: 'Goals', icon: Target },
  { id: 4, title: 'Review', icon: CheckCircle2 },
];

export function PilotRequestForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    organizationName: '',
    organizationType: 'local',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    memberCount: '',
    jurisdictions: [],
    sectors: [],
    currentSystem: '',
    challenges: [],
    goals: [],
    responses: {}
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: 'jurisdictions' | 'sectors' | 'challenges' | 'goals', value: string) => {
    const current = formData[field];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateField(field, updated);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.organizationName && 
               formData.contactName && 
               formData.contactEmail && 
               formData.memberCount;
      case 2:
        return formData.jurisdictions.length > 0 && 
               formData.sectors.length > 0;
      case 3:
        return formData.goals.length >= 1;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/pilot/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsComplete(true);
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (error) {
      logger.error('Submission error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-4">
            Application Received!
          </h2>
          <p className="text-green-700 mb-6 max-w-md mx-auto">
            Thank you for applying to the Union Eyes pilot program. 
            Our team will review your application and get back to you within 2-3 business days.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Return Home
            </Button>
            <Button onClick={() => window.location.href = '/contact'}>
              Contact Us Directly
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isComplete = step > s.id;
              
              return (
                <div key={s.id} className="flex items-center">
                  <div 
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                      isComplete 
                        ? 'bg-green-600 text-white' 
                        : isActive 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div 
                      className={`hidden sm:block w-12 lg:w-24 h-1 mx-2 ${
                        isComplete ? 'bg-green-600' : 'bg-slate-200'
                      }`} 
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-600">
            {STEPS.map(s => (
              <span key={s.id} className={step === s.id ? 'font-medium text-blue-600' : ''}>
                {s.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step 1: Organization */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Tell us about your organization
              </h2>
              <p className="text-slate-600 text-sm">
                We&apos;ll use this to personalize your pilot experience
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="organizationName">Organization Name *</Label>
                <Input
                  id="organizationName"
                  placeholder="e.g., Healthcare Workers Union Local 123"
                  value={formData.organizationName}
                  onChange={(e) => updateField('organizationName', e.target.value)}
                />
              </div>

              <div>
                <Label>Organization Type *</Label>
                <RadioGroup
                  value={formData.organizationType}
                  onValueChange={(value) => updateField('organizationType', value as FormData['organizationType'])}
                  className="flex gap-4 mt-2"
                >
                  {['local', 'regional', 'national'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <RadioGroupItem value={type} id={type} />
                      <Label htmlFor={type} className="capitalize cursor-pointer">
                        {type}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    placeholder="Your name"
                    value={formData.contactName}
                    onChange={(e) => updateField('contactName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="you@union.org"
                    value={formData.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPhone">Phone (Optional)</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="memberCount">Member Count *</Label>
                  <Input
                    id="memberCount"
                    type="number"
                    placeholder="e.g., 1200"
                    value={formData.memberCount}
                    onChange={(e) => updateField('memberCount', e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Context */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Your current context
              </h2>
              <p className="text-slate-600 text-sm">
                Help us understand your operating environment
              </p>
            </div>

            <div>
              <Label>Jurisdictions *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                {JURISDICTIONS.map((jurisdiction) => (
                  <div key={jurisdiction.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={jurisdiction.value}
                      checked={formData.jurisdictions.includes(jurisdiction.value)}
                      onCheckedChange={() => toggleArrayField('jurisdictions', jurisdiction.value)}
                    />
                    <Label htmlFor={jurisdiction.value} className="cursor-pointer text-sm">
                      {jurisdiction.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Sectors *</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {SECTORS.map((sector) => (
                  <div key={sector} className="flex items-center space-x-2">
                    <Checkbox
                      id={sector}
                      checked={formData.sectors.includes(sector)}
                      onCheckedChange={() => toggleArrayField('sectors', sector)}
                    />
                    <Label htmlFor={sector} className="cursor-pointer text-sm">
                      {sector}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="currentSystem">Current System (Optional)</Label>
              <Input
                id="currentSystem"
                placeholder="e.g., Excel, paper files, existing software"
                value={formData.currentSystem}
                onChange={(e) => updateField('currentSystem', e.target.value)}
              />
            </div>

            <div>
              <Label>Current Challenges (Select all that apply)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {CHALLENGES.map((challenge) => (
                  <div key={challenge} className="flex items-center space-x-2">
                    <Checkbox
                      id={challenge}
                      checked={formData.challenges.includes(challenge)}
                      onCheckedChange={() => toggleArrayField('challenges', challenge)}
                    />
                    <Label htmlFor={challenge} className="cursor-pointer text-sm">
                      {challenge}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Goals */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                What are you hoping to achieve?
              </h2>
              <p className="text-slate-600 text-sm">
                Select your primary goals (at least 1)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GOALS.map((goal) => (
                <div 
                  key={goal} 
                  className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.goals.includes(goal)
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => toggleArrayField('goals', goal)}
                >
                  <Checkbox
                    checked={formData.goals.includes(goal)}
                    className="mt-1"
                  />
                  <Label className="cursor-pointer text-sm leading-relaxed">
                    {goal}
                  </Label>
                </div>
              ))}
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-slate-900">Quick Readiness Check</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Executive Sponsor?</Label>
                  <Select
                    value={formData.responses.executiveSponsor?.toString() || ''}
                    onValueChange={(value) => updateField('responses', { 
                      ...formData.responses, 
                      executiveSponsor: value === 'true' 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Staff Commitment</Label>
                  <Select
                    value={formData.responses.staffCommitment || ''}
                    onValueChange={(value) => updateField('responses', { 
                      ...formData.responses, 
                      staffCommitment: value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High - Excited and ready</SelectItem>
                      <SelectItem value="medium">Medium - Cautiously interested</SelectItem>
                      <SelectItem value="low">Low - Skeptical or resistant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>IT Support?</Label>
                  <Select
                    value={formData.responses.hasITSupport?.toString() || ''}
                    onValueChange={(value) => updateField('responses', { 
                      ...formData.responses, 
                      hasITSupport: value === 'true' 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Budget Pre-Approved?</Label>
                  <Select
                    value={formData.responses.budgetApproved?.toString() || ''}
                    onValueChange={(value) => updateField('responses', { 
                      ...formData.responses, 
                      budgetApproved: value === 'true' 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Review your application
              </h2>
              <p className="text-slate-600 text-sm">
                Please verify all information is correct before submitting
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Organization</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-600">Name:</dt>
                  <dd className="text-slate-900">{formData.organizationName}</dd>
                  <dt className="text-slate-600">Type:</dt>
                  <dd className="text-slate-900 capitalize">{formData.organizationType}</dd>
                  <dt className="text-slate-600">Members:</dt>
                  <dd className="text-slate-900">{formData.memberCount?.toLocaleString()}</dd>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Contact</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-600">Name:</dt>
                  <dd className="text-slate-900">{formData.contactName}</dd>
                  <dt className="text-slate-600">Email:</dt>
                  <dd className="text-slate-900">{formData.contactEmail}</dd>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Jurisdictions</h3>
                <p className="text-sm text-slate-900">
                  {formData.jurisdictions.map(j => JURISDICTIONS.find(x => x.value === j)?.label).join(', ')}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Sectors</h3>
                <p className="text-sm text-slate-900">{formData.sectors.join(', ')}</p>
              </div>

              {formData.challenges.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Challenges</h3>
                  <p className="text-sm text-slate-900">{formData.challenges.join(', ')}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Goals</h3>
                <p className="text-sm text-slate-900">{formData.goals.join(', ')}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Rocket className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">What happens next?</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    We&apos;ll review your application and contact you within 2-3 business days 
                    to schedule a discovery call and begin your pilot onboarding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
