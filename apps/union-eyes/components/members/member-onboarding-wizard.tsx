/**
 * Member Onboarding Wizard Component
 * 
 * Multi-step onboarding flow for new members:
 * - Step 1: Personal Information
 * - Step 2: Employment Details
 * - Step 3: Union Preferences
 * - Step 4: Document Upload
 * - Step 5: Review & Submit
 * 
 * @module components/members/member-onboarding-wizard
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { WizardStepper } from "@/components/ui/wizard-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Upload, CheckCircle2 } from "lucide-react";
 
import { format } from "date-fns";

// Step 1: Personal Information
const personalInfoSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Invalid phone number"),
  dateOfBirth: z.date(),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "Invalid zip code"),
});

// Step 2: Employment Details
const employmentSchema = z.object({
  employer: z.string().min(2, "Employer is required"),
  department: z.string().optional(),
  jobTitle: z.string().min(2, "Job title is required"),
  employeeId: z.string().optional(),
  hireDate: z.date(),
  workLocation: z.string().min(2, "Work location is required"),
  shift: z.enum(["day", "evening", "night", "rotating"]),
});

// Step 3: Union Preferences
const preferencesSchema = z.object({
  chapter: z.string().min(1, "Please select a chapter"),
  membershipType: z.enum(["regular", "honorary", "retiree"]),
  communicationPreference: z.enum(["email", "sms", "both"]),
  volunteerInterest: z.array(z.string()),
  newsletter: z.boolean(),
});

// Step 4: Documents
const documentsSchema = z.object({
  photoId: z.string().optional(),
  proofOfEmployment: z.string().optional(),
  additionalDocuments: z.array(z.string()).optional(),
});

// Complete form data
const completeSchema = personalInfoSchema
  .merge(employmentSchema)
  .merge(preferencesSchema)
  .merge(documentsSchema);

type OnboardingFormData = z.infer<typeof completeSchema>;

export interface MemberOnboardingWizardProps {
  onComplete: (data: OnboardingFormData) => Promise<void>;
  onCancel?: () => void;
}

export function MemberOnboardingWizard({
  onComplete,
  onCancel,
}: MemberOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(completeSchema),
    mode: "onBlur",
    defaultValues: {
      volunteerInterest: [],
      newsletter: true,
    },
  });

  const steps = [
    {
      id: "personal",
      title: "Personal Information",
      description: "Basic contact details",
      component: null,
    },
    {
      id: "employment",
      title: "Employment",
      description: "Work information",
      component: null,
    },
    {
      id: "preferences",
      title: "Preferences",
      description: "Union settings",
      component: null,
    },
    {
      id: "documents",
      title: "Documents",
      description: "Upload required files",
      component: null,
    },
    {
      id: "review",
      title: "Review",
      description: "Confirm and submit",
      component: null,
    },
  ];

  const handleStepValidation = async (step: number): Promise<boolean> => {
    const stepFields: Record<number, (keyof OnboardingFormData)[]> = {
      0: ["firstName", "lastName", "email", "phone", "dateOfBirth", "address", "city", "state", "zipCode"],
      1: ["employer", "jobTitle", "hireDate", "workLocation", "shift"],
      2: ["chapter", "membershipType", "communicationPreference"],
      3: [], // Documents are optional
    };

    const fields = stepFields[step];
    if (!fields) return true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await form.trigger(fields as any);
    return result;
  };

  const handleComplete = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      await onComplete(form.getValues());
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <WizardStepper
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onValidateStep={handleStepValidation}
        onComplete={handleComplete}
      />

      <div className="mt-8 bg-white rounded-lg border p-6">
        {currentStep === 0 && <PersonalInfoStep form={form} />}
        {currentStep === 1 && <EmploymentStep form={form} />}
        {currentStep === 2 && <PreferencesStep form={form} />}
        {currentStep === 3 && <DocumentsStep form={form} />}
        {currentStep === 4 && <ReviewStep form={form} />}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button
              type="button"
              onClick={async () => {
                const isValid = await handleStepValidation(currentStep);
                if (isValid) {
                  setCurrentStep(currentStep + 1);
                }
              }}
            >
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleComplete}>
              Complete Onboarding
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PersonalInfoStep({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Personal Information</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" {...form.register("firstName")} />
          {form.formState.errors.firstName && (
            <p className="text-sm text-red-500">
              {form.formState.errors.firstName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" {...form.register("lastName")} />
          {form.formState.errors.lastName && (
            <p className="text-sm text-red-500">
              {form.formState.errors.lastName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-sm text-red-500">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input id="phone" type="tel" {...form.register("phone")} />
          {form.formState.errors.phone && (
            <p className="text-sm text-red-500">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Date of Birth *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left",
                  !form.watch("dateOfBirth") && "text-gray-500"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("dateOfBirth") ? (
                  format(form.watch("dateOfBirth"), "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("dateOfBirth")}
                onSelect={(date) => form.setValue("dateOfBirth", date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="address">Address *</Label>
          <Input id="address" {...form.register("address")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input id="city" {...form.register("city")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State *</Label>
          <Input id="state" {...form.register("state")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zipCode">Zip Code *</Label>
          <Input id="zipCode" {...form.register("zipCode")} />
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EmploymentStep({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Employment Details</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="employer">Employer *</Label>
          <Input id="employer" {...form.register("employer")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input id="department" {...form.register("department")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job Title *</Label>
          <Input id="jobTitle" {...form.register("jobTitle")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeId">Employee ID</Label>
          <Input id="employeeId" {...form.register("employeeId")} />
        </div>
        <div className="space-y-2">
          <Label>Hire Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("hireDate") ? format(form.watch("hireDate"), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("hireDate")}
                onSelect={(date) => form.setValue("hireDate", date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workLocation">Work Location *</Label>
          <Input id="workLocation" {...form.register("workLocation")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shift">Shift *</Label>
          <Select
            value={form.watch("shift")}
            onValueChange={(value) => form.setValue("shift", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
              <SelectItem value="rotating">Rotating</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PreferencesStep({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Union Preferences</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chapter">Chapter *</Label>
          <Select
            value={form.watch("chapter")}
            onValueChange={(value) => form.setValue("chapter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select chapter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chapter-1">Chapter 1 - Manufacturing</SelectItem>
              <SelectItem value="chapter-2">Chapter 2 - Services</SelectItem>
              <SelectItem value="chapter-3">Chapter 3 - Healthcare</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Membership Type *</Label>
          <Select
            value={form.watch("membershipType")}
            onValueChange={(value) => form.setValue("membershipType", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="honorary">Honorary</SelectItem>
              <SelectItem value="retiree">Retiree</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Communication Preference *</Label>
          <Select
            value={form.watch("communicationPreference")}
            onValueChange={(value) => form.setValue("communicationPreference", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select preference" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email Only</SelectItem>
              <SelectItem value="sms">SMS Only</SelectItem>
              <SelectItem value="both">Both Email and SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DocumentsStep({ form: _form }: { form: any }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Upload Documents</h3>
      <div className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 mb-3">
            Upload Photo ID and Proof of Employment
          </p>
          <Button type="button" variant="outline">
            Choose Files
          </Button>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewStep({ form }: { form: any }) {
  const data = form.watch();
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <CheckCircle2 className="h-6 w-6 text-green-600" />
        Review Your Information
      </h3>
      <div className="space-y-6">
        <div>
          <h4 className="font-medium mb-2">Personal Information</h4>
          <div className="bg-gray-50 rounded p-4 text-sm space-y-1">
            <p><strong>Name:</strong> {data.firstName} {data.lastName}</p>
            <p><strong>Email:</strong> {data.email}</p>
            <p><strong>Phone:</strong> {data.phone}</p>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Employment</h4>
          <div className="bg-gray-50 rounded p-4 text-sm space-y-1">
            <p><strong>Employer:</strong> {data.employer}</p>
            <p><strong>Job Title:</strong> {data.jobTitle}</p>
            <p><strong>Location:</strong> {data.workLocation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

