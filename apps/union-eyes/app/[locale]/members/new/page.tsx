/**
 * New Member Form
 * 
 * Multi-step form for adding a new member
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { logger } from '@/lib/logger';

type FormStep = 'basic' | 'employment' | 'contact' | 'review';

interface MemberFormData {
  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  // Employment
  localId: string;
  classification: string;
  jobTitle: string;
  employerId: string;
  hireDate: string;
  seniority: string;
  // Contact
  address: string;
  city: string;
  province: string;
  postalCode: string;
  preferredLanguage: string;
}

export default function NewMemberPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<FormStep>('basic');
  const [formData, setFormData] = useState<MemberFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    localId: '',
    classification: 'full_time',
    jobTitle: '',
    employerId: '',
    hireDate: '',
    seniority: '',
    address: '',
    city: '',
    province: 'ON',
    postalCode: '',
    preferredLanguage: 'en',
  });

  const steps: { id: FormStep; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'employment', label: 'Employment' },
    { id: 'contact', label: 'Contact' },
    { id: 'review', label: 'Review' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const updateField = (field: keyof MemberFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    try {
      await api.members.create(formData);
      alert('Member created successfully!');
      router.push('/members');
    } catch (error) {
      logger.error('Error creating member:', error);
      alert('Error creating member. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Member</h1>
          <p className="text-muted-foreground">
            Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].label}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`text-sm ${
                index <= currentStepIndex ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </div>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      {/* Form Steps */}
      <Card className="p-6">
        {currentStep === 'basic' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="John"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="john.smith@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStep === 'employment' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Employment Details</h2>

            <div className="space-y-2">
              <Label htmlFor="localId">Local *</Label>
              <Select value={formData.localId} onValueChange={(v) => updateField('localId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select local" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local-123">Local 123</SelectItem>
                  <SelectItem value="local-456">Local 456</SelectItem>
                  <SelectItem value="local-789">Local 789</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="classification">Classification *</Label>
              <Select
                value={formData.classification}
                onValueChange={(v) => updateField('classification', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title *</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
                placeholder="Senior Technician"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employerId">Employer</Label>
              <Select value={formData.employerId} onValueChange={(v) => updateField('employerId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emp-1">ABC Manufacturing</SelectItem>
                  <SelectItem value="emp-2">XYZ Industries</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hireDate">Hire Date *</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => updateField('hireDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seniority">Seniority (years)</Label>
                <Input
                  id="seniority"
                  type="number"
                  value={formData.seniority}
                  onChange={(e) => updateField('seniority', e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'contact' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Toronto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Select value={formData.province} onValueChange={(v) => updateField('province', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ON">Ontario</SelectItem>
                    <SelectItem value="QC">Quebec</SelectItem>
                    <SelectItem value="BC">British Columbia</SelectItem>
                    <SelectItem value="AB">Alberta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => updateField('postalCode', e.target.value)}
                placeholder="M1A 1A1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Preferred Language</Label>
              <Select
                value={formData.preferredLanguage}
                onValueChange={(v) => updateField('preferredLanguage', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Review & Confirm</h2>

            <div>
              <h3 className="font-medium mb-2">Basic Information</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Name:</dt>
                <dd>{formData.firstName} {formData.lastName}</dd>
                <dt className="text-muted-foreground">Email:</dt>
                <dd>{formData.email}</dd>
                <dt className="text-muted-foreground">Phone:</dt>
                <dd>{formData.phone}</dd>
              </dl>
            </div>

            <div>
              <h3 className="font-medium mb-2">Employment</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Job Title:</dt>
                <dd>{formData.jobTitle}</dd>
                <dt className="text-muted-foreground">Classification:</dt>
                <dd className="capitalize">{formData.classification.replace('_', ' ')}</dd>
                <dt className="text-muted-foreground">Hire Date:</dt>
                <dd>{formData.hireDate}</dd>
              </dl>
            </div>

            <div>
              <h3 className="font-medium mb-2">Contact</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Address:</dt>
                <dd>{formData.address || '-'}</dd>
                <dt className="text-muted-foreground">City:</dt>
                <dd>{formData.city || '-'}</dd>
                <dt className="text-muted-foreground">Province:</dt>
                <dd>{formData.province}</dd>
              </dl>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {currentStepIndex === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep === 'review' ? (
          <Button onClick={handleSubmit}>
            <Check className="mr-2 h-4 w-4" />
            Create Member
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
