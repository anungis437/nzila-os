/**
 * Claim Form Wizard Component
 * 
 * Multi-step claim creation wizard with:
 * - Incident details
 * - Evidence upload
 * - Witness information
 * - Review and submit
 * - Validation per step
 * - Draft auto-save
 * - Accessibility
 * 
 * @module components/claims/claim-form-wizard
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar, Upload, AlertCircle } from "lucide-react";
import { WizardStepper, WizardStep } from "@/components/ui/wizard-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
 
 
import { useToast } from "@/components/ui/use-toast";

// Zod schemas for each step
const incidentSchema = z.object({
  claimType: z.string().min(1, "Claim type is required"),
  incidentDate: z.date({
    required_error: "Incident date is required",
  }),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  desiredOutcome: z.string().min(10, "Please describe desired outcome"),
});

const evidenceSchema = z.object({
  attachments: z.array(z.string()).optional(),
  voiceRecordings: z.array(z.string()).optional(),
});

const witnessSchema = z.object({
  witnessesPresent: z.boolean(),
  witnessDetails: z.string().optional(),
  previouslyReported: z.boolean(),
  previousReportDetails: z.string().optional(),
});

const claimSchema = incidentSchema.merge(evidenceSchema).merge(witnessSchema);

type ClaimFormData = z.infer<typeof claimSchema>;

export interface ClaimFormWizardProps {
  onSubmit: (data: ClaimFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<ClaimFormData>;
  memberId: string;
  organizationId: string;
}

export function ClaimFormWizard({
  onSubmit,
  onCancel,
  initialData,
  memberId,
  organizationId: _organizationId,
}: ClaimFormWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [_isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimSchema),
    defaultValues: initialData || {
      claimType: "",
      location: "",
      description: "",
      desiredOutcome: "",
      witnessesPresent: false,
      witnessDetails: "",
      previouslyReported: false,
      previousReportDetails: "",
      attachments: [],
      voiceRecordings: [],
    },
  });

  // Auto-save draft
  React.useEffect(() => {
    const subscription = form.watch(() => {
      const data = form.getValues();
      localStorage.setItem(`claim-draft-${memberId}`, JSON.stringify(data));
    });
    return () => subscription.unsubscribe();
  }, [form, memberId]);

  const validateStep = async (stepIndex: number): Promise<boolean> => {
    switch (stepIndex) {
      case 0: {
        const result = await form.trigger([
          "claimType",
          "incidentDate",
          "location",
          "description",
          "desiredOutcome",
        ]);
        return result;
      }
      case 1: {
        return true; // Evidence is optional
      }
      case 2: {
        const witnessPresent = form.getValues("witnessesPresent");
        if (witnessPresent) {
          return await form.trigger(["witnessDetails"]);
        }
        const previousReport = form.getValues("previouslyReported");
        if (previousReport) {
          return await form.trigger(["previousReportDetails"]);
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const isValid = await form.trigger();
      if (!isValid) {
        throw new Error("Please fill in all required fields");
      }

      const data = form.getValues();
      await onSubmit(data);
      
      // Clear draft
      localStorage.removeItem(`claim-draft-${memberId}`);
      
      toast({
        title: "Claim submitted successfully",
        description: "Your claim has been submitted and will be reviewed shortly.",
      });
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: "incident",
      title: "Incident Details",
      description: "Provide information about the incident",
      component: <IncidentStep form={form} />,
    },
    {
      id: "evidence",
      title: "Evidence",
      description: "Upload supporting documents and recordings",
      optional: true,
      component: <EvidenceStep form={form} />,
    },
    {
      id: "witnesses",
      title: "Witnesses & History",
      description: "Add witness information and prior reports",
      optional: true,
      component: <WitnessStep form={form} />,
    },
    {
      id: "review",
      title: "Review",
      description: "Review your claim before submission",
      component: <ReviewStep form={form} />,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <WizardStepper
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onValidateStep={validateStep}
        onComplete={handleComplete}
      />

      {onCancel && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// Step Components

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IncidentStep({ form }: { form: any }) {
  const [dateOpen, setDateOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Claim Type */}
      <div className="space-y-2">
        <Label htmlFor="claimType">
          Claim Type <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.watch("claimType")}
          onValueChange={(value) => form.setValue("claimType", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select claim type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grievance">Grievance</SelectItem>
            <SelectItem value="harassment">Harassment</SelectItem>
            <SelectItem value="discrimination">Discrimination</SelectItem>
            <SelectItem value="safety">Safety Violation</SelectItem>
            <SelectItem value="wage">Wage Dispute</SelectItem>
            <SelectItem value="hours">Hours/Scheduling</SelectItem>
            <SelectItem value="discipline">Discipline</SelectItem>
            <SelectItem value="termination">Termination</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.claimType && (
          <p className="text-sm text-red-500">
            {form.formState.errors.claimType.message}
          </p>
        )}
      </div>

      {/* Incident Date */}
      <div className="space-y-2">
        <Label>
          Incident Date <span className="text-red-500">*</span>
        </Label>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !form.watch("incidentDate") && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {form.watch("incidentDate") ? (
                format(form.watch("incidentDate"), "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarPicker
              mode="single"
              selected={form.watch("incidentDate")}
              onSelect={(date) => {
                form.setValue("incidentDate", date);
                setDateOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {form.formState.errors.incidentDate && (
          <p className="text-sm text-red-500">
            {form.formState.errors.incidentDate.message}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">
          Location <span className="text-red-500">*</span>
        </Label>
        <Input
          id="location"
          placeholder="e.g., Warehouse Floor 2, Office Building A"
          {...form.register("location")}
        />
        {form.formState.errors.location && (
          <p className="text-sm text-red-500">
            {form.formState.errors.location.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Describe what happened in detail..."
          rows={6}
          {...form.register("description")}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-red-500">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      {/* Desired Outcome */}
      <div className="space-y-2">
        <Label htmlFor="desiredOutcome">
          Desired Outcome <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="desiredOutcome"
          placeholder="What resolution are you seeking?"
          rows={4}
          {...form.register("desiredOutcome")}
        />
        {form.formState.errors.desiredOutcome && (
          <p className="text-sm text-red-500">
            {form.formState.errors.desiredOutcome.message}
          </p>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EvidenceStep({ form: _form }: { form: any }) {
  // File upload will be implemented with actual upload handler
  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supported: PDF, JPG, PNG, MP3, WAV (Max 10MB each)
        </p>
        <Button className="mt-4" variant="outline">
          Browse Files
        </Button>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WitnessStep({ form }: { form: any }) {
  const witnessPresent = form.watch("witnessesPresent");
  const previousReport = form.watch("previouslyReported");

  return (
    <div className="space-y-6">
      {/* Witnesses Present */}
      <div className="flex items-start space-x-3">
        <Checkbox
          id="witnessesPresent"
          checked={witnessPresent}
          onCheckedChange={(checked) =>
            form.setValue("witnessesPresent", checked)
          }
        />
        <div className="space-y-1">
          <Label htmlFor="witnessesPresent" className="cursor-pointer">
            Were there witnesses to this incident?
          </Label>
        </div>
      </div>

      {witnessPresent && (
        <div className="space-y-2">
          <Label htmlFor="witnessDetails">Witness Details</Label>
          <Textarea
            id="witnessDetails"
            placeholder="List witness names and contact information..."
            rows={4}
            {...form.register("witnessDetails")}
          />
        </div>
      )}

      {/* Previously Reported */}
      <div className="flex items-start space-x-3">
        <Checkbox
          id="previouslyReported"
          checked={previousReport}
          onCheckedChange={(checked) =>
            form.setValue("previouslyReported", checked)
          }
        />
        <div className="space-y-1">
          <Label htmlFor="previouslyReported" className="cursor-pointer">
            Has this been reported before?
          </Label>
        </div>
      </div>

      {previousReport && (
        <div className="space-y-2">
          <Label htmlFor="previousReportDetails">Previous Report Details</Label>
          <Textarea
            id="previousReportDetails"
            placeholder="When and to whom was this previously reported?"
            rows={4}
            {...form.register("previousReportDetails")}
          />
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewStep({ form }: { form: any }) {
  const data = form.watch();

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Please review your claim carefully</p>
          <p>
            Once submitted, your claim will be assigned to a steward for review.
            You will be notified of any updates.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Incident Details</h4>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium capitalize">{data.claimType}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Date</dt>
              <dd className="font-medium">
                {data.incidentDate && format(data.incidentDate, "PPP")}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">Location</dt>
              <dd className="font-medium">{data.location}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">Description</dt>
              <dd className="whitespace-pre-wrap">{data.description}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">Desired Outcome</dt>
              <dd className="whitespace-pre-wrap">{data.desiredOutcome}</dd>
            </div>
          </dl>
        </div>

        {data.witnessesPresent && (
          <div>
            <h4 className="font-medium mb-2">Witnesses</h4>
            <p className="text-sm whitespace-pre-wrap">{data.witnessDetails}</p>
          </div>
        )}

        {data.previouslyReported && (
          <div>
            <h4 className="font-medium mb-2">Previous Reports</h4>
            <p className="text-sm whitespace-pre-wrap">
              {data.previousReportDetails}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

