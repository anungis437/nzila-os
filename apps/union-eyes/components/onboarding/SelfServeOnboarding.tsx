/**
 * Self-Serve Onboarding Flow
 * 
 * Automated organization setup without manual intervention
 */

'use client';
import Link from 'next/link';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Building2, Users, FileText, CreditCard } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    id: 'org-info',
    title: 'Organization Details',
    description: 'Tell us about your union',
    icon: <Building2 className="h-6 w-6" />,
  },
  {
    id: 'members',
    title: 'Import Members',
    description: 'Upload your member list',
    icon: <Users className="h-6 w-6" />,
  },
  {
    id: 'documents',
    title: 'Upload Documents',
    description: 'Add your collective agreement',
    icon: <FileText className="h-6 w-6" />,
  },
  {
    id: 'billing',
    title: 'Billing Setup',
    description: 'Choose your plan',
    icon: <CreditCard className="h-6 w-6" />,
  },
];

export function SelfServeOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    // Organization info
    orgName: '',
    orgType: '',
    province: '',
    memberCount: '',
    
    // Members
    memberFile: null as File | null,
    
    // Documents
    cbaFile: null as File | null,
    
    // Billing
    plan: '',
    acceptedTerms: false,
  });

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit onboarding
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (_error) {
}
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return formData.orgName && formData.orgType && formData.province;
      case 1:
        return formData.memberFile !== null;
      case 2:
        return formData.cbaFile !== null;
      case 3:
        return formData.plan && formData.acceptedTerms;
      default:
        return false;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Step {currentStep + 1} of {steps.length}</span>
          <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps Indicator */}
      <div className="mb-8 flex justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center ${
              index < steps.length - 1 ? 'flex-1' : ''
            }`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                  index < currentStep
                    ? 'border-green-500 bg-green-500 text-white'
                    : index === currentStep
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  step.icon
                )}
              </div>
              <span className="mt-2 text-xs font-medium">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className="mx-4 h-0.5 flex-1 bg-gray-300" />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 0 && (
            <OrgInfoStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 1 && (
            <MembersStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 2 && (
            <DocumentsStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 3 && (
            <BillingStep formData={formData} setFormData={setFormData} />
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              onClick={handleBack}
              variant="outline"
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
            >
              {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step Components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrgInfoStep({ formData, setFormData }: any) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="orgName">Union Name *</Label>
        <Input
          id="orgName"
          value={formData.orgName}
          onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
          placeholder="United Workers Local 123"
        />
      </div>

      <div>
        <Label htmlFor="orgType">Union Type *</Label>
        <Select
          value={formData.orgType}
          onValueChange={(value) => setFormData({ ...formData, orgType: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local Union</SelectItem>
            <SelectItem value="national">National Union</SelectItem>
            <SelectItem value="federation">Federation</SelectItem>
            <SelectItem value="council">Labour Council</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="province">Province *</Label>
        <Select
          value={formData.province}
          onValueChange={(value) => setFormData({ ...formData, province: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select province" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AB">Alberta</SelectItem>
            <SelectItem value="BC">British Columbia</SelectItem>
            <SelectItem value="MB">Manitoba</SelectItem>
            <SelectItem value="NB">New Brunswick</SelectItem>
            <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
            <SelectItem value="NS">Nova Scotia</SelectItem>
            <SelectItem value="ON">Ontario</SelectItem>
            <SelectItem value="PE">Prince Edward Island</SelectItem>
            <SelectItem value="QC">Quebec</SelectItem>
            <SelectItem value="SK">Saskatchewan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="memberCount">Approximate Member Count *</Label>
        <Input
          id="memberCount"
          type="number"
          value={formData.memberCount}
          onChange={(e) => setFormData({ ...formData, memberCount: e.target.value })}
          placeholder="250"
        />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MembersStep({ formData, setFormData }: any) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a CSV file with your member list. Required columns: first_name, last
_name, email
      </p>

      <div className="rounded-lg border-2 border-dashed p-8 text-center">
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => setFormData({ ...formData, memberFile: e.target.files?.[0] })}
          className="mx-auto max-w-xs"
        />
        {formData.memberFile && (
          <p className="mt-2 text-sm text-green-600">
            âœ“ {formData.memberFile.name}
          </p>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Download template: <Link href="/templates/members.csv" className="text-blue-500 underline">members.csv</Link></p>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DocumentsStep({ formData, setFormData }: any) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload your collective bargaining agreement (CBA)
      </p>

      <div className="rounded-lg border-2 border-dashed p-8 text-center">
        <Input
          type="file"
          accept=".pdf"
          onChange={(e) => setFormData({ ...formData, cbaFile: e.target.files?.[0] })}
          className="mx-auto max-w-xs"
        />
        {formData.cbaFile && (
          <p className="mt-2 text-sm text-green-600">
            âœ“ {formData.cbaFile.name}
          </p>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BillingStep({ formData, setFormData }: any) {
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$99/month',
      features: ['Up to 100 members', 'Basic claims management', 'Email support'],
    },
    {
      id: 'pro',
      name: 'Professional',
      price: '$299/month',
      features: ['Up to 500 members', 'Advanced analytics', 'Priority support'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      features: ['Unlimited members', 'White-label', 'Dedicated support'],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all ${
              formData.plan === plan.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setFormData({ ...formData, plan: plan.id })}
          >
            <CardHeader>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription className="text-2xl font-bold">
                {plan.price}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="terms"
          checked={formData.acceptedTerms}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, acceptedTerms: checked })
          }
        />
        <label
          htmlFor="terms"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          I accept the <Link href="/terms" className="text-blue-500 underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-500 underline">Privacy Policy</Link>
        </label>
      </div>
    </div>
  );
}

