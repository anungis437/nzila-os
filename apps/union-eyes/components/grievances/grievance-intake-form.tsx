/**
 * Grievance Intake Form
 *
 * Full multi-step grievance intake wizard with:
 * - 6 steps: Member → Employer → Issue → Description → Documents → Review
 * - Zod validation per step
 * - Draft auto-save & recovery via sessionStorage
 * - Smart defaults (pre-fill member/employer context)
 * - Plain-language help text and examples
 * - Accessible, keyboard navigable
 *
 * @module components/grievances/grievance-intake-form
 */

"use client";

import * as React from "react";
import { useForm, type UseFormReturn, type FieldValues as _FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  Calendar,
  Upload,
  AlertCircle,
  Shield,
  HelpCircle,
  User,
  Building2,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  GrievanceIntakeStepper,
  IntakeStep,
} from "@/components/grievances/grievance-intake-stepper";
import { GrievanceIntakeReview } from "@/components/grievances/grievance-intake-review";
import { ResumeDraftModal } from "@/components/grievances/resume-draft-modal";

// ─── Zod Schemas per Step ─────────────────────────────────────

const memberSchema = z.object({
  memberName: z.string().min(1, "Full name is required"),
  memberEmail: z.string().email("Valid email is required"),
  memberPhone: z.string().optional().default(""),
  memberNumber: z.string().optional().default(""),
  localChapter: z.string().optional().default(""),
});

const employerSchema = z.object({
  employerName: z.string().min(1, "Employer name is required"),
  workplaceName: z.string().optional().default(""),
  department: z.string().optional().default(""),
  branch: z.string().optional().default(""),
  supervisorName: z.string().optional().default(""),
});

const issueSchema = z.object({
  grievanceType: z.string().min(1, "Grievance type is required"),
  issueDate: z.date({ required_error: "Issue date is required" }),
  urgency: z.string().min(1, "Urgency level is required"),
  cbaArticle: z.string().optional().default(""),
  cbaSection: z.string().optional().default(""),
  workplaceSafetyFlag: z.boolean().default(false),
  harassmentFlag: z.boolean().default(false),
  discriminationFlag: z.boolean().default(false),
  accommodationFlag: z.boolean().default(false),
});

const descriptionSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(30, "Description must be at least 30 characters"),
  location: z.string().min(1, "Location is required"),
  desiredResolution: z.string().optional().default(""),
});

const documentsSchema = z.object({
  attachments: z.array(z.string()).default([]),
});

const fullSchema = memberSchema
  .merge(employerSchema)
  .merge(issueSchema)
  .merge(descriptionSchema)
  .merge(documentsSchema);

export type GrievanceFormData = z.infer<typeof fullSchema>;

// ─── Constants ────────────────────────────────────────────────

const DRAFT_KEY = "grievance-intake-draft";

const INTAKE_STEPS: IntakeStep[] = [
  { id: "member", title: "Member" },
  { id: "employer", title: "Employer" },
  { id: "issue", title: "Issue Type" },
  { id: "description", title: "Description" },
  { id: "documents", title: "Documents", optional: true },
  { id: "review", title: "Review" },
];

const STEP_FIELDS: string[][] = [
  ["memberName", "memberEmail", "memberPhone", "memberNumber", "localChapter"],
  ["employerName", "workplaceName", "department", "branch", "supervisorName"],
  ["grievanceType", "issueDate", "urgency", "cbaArticle", "cbaSection", "workplaceSafetyFlag", "harassmentFlag", "discriminationFlag", "accommodationFlag"],
  ["title", "description", "location", "desiredResolution"],
  ["attachments"],
  [], // review step — no validation
];

// ─── Props ────────────────────────────────────────────────────

export interface GrievanceIntakeFormProps {
  onSubmit: (data: GrievanceFormData) => Promise<{ grievanceNumber: string; status: string }>;
  onCancel?: () => void;
  prefill?: Partial<GrievanceFormData>;
}

// ─── Main Component ───────────────────────────────────────────

export function GrievanceIntakeForm({
  onSubmit,
  onCancel,
  prefill,
}: GrievanceIntakeFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitResult, setSubmitResult] = React.useState<{
    grievanceNumber: string;
    status: string;
  } | null>(null);

  // Recover draft from sessionStorage
  const savedDraft = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Rehydrate date
      if (parsed.issueDate) parsed.issueDate = new Date(parsed.issueDate);
      return parsed as Partial<GrievanceFormData> & { _savedAt?: string };
    } catch {
      return null;
    }
  }, []);

  // Draft recovery modal state
  const [showDraftModal, setShowDraftModal] = React.useState(() => !!savedDraft);
  const [draftDecision, setDraftDecision] = React.useState<"resume" | "discard" | null>(
    savedDraft ? null : "discard"
  );

  const handleResumeDraft = () => {
    setDraftDecision("resume");
    setShowDraftModal(false);
  };

  const handleDiscardDraft = () => {
    setDraftDecision("discard");
    setShowDraftModal(false);
    sessionStorage.removeItem(DRAFT_KEY);
  };

  const resolvedDraft = draftDecision === "resume" ? savedDraft : null;

  const defaults: GrievanceFormData = {
    memberName: "",
    memberEmail: "",
    memberPhone: "",
    memberNumber: "",
    localChapter: "",
    employerName: "",
    workplaceName: "",
    department: "",
    branch: "",
    supervisorName: "",
    grievanceType: "",
    issueDate: undefined as unknown as Date,
    urgency: "medium",
    cbaArticle: "",
    cbaSection: "",
    workplaceSafetyFlag: false,
    harassmentFlag: false,
    discriminationFlag: false,
    accommodationFlag: false,
    title: "",
    description: "",
    location: "",
    desiredResolution: "",
    attachments: [],
    ...prefill,
    ...resolvedDraft,
  };

  const form = useForm<GrievanceFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(fullSchema) as any,
    defaultValues: defaults,
    mode: "onTouched",
  });

  // Auto-save draft
  React.useEffect(() => {
    const sub = form.watch((values) => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ ...values, _savedAt: new Date().toISOString() }),
        );
      } catch { /* quota exceeded — ignore */ }
    });
    return () => sub.unsubscribe();
  }, [form]);

  // ─── Step Validation ──────────────────────────────────────

  const validateCurrentStep = async (): Promise<boolean> => {
    const fields = STEP_FIELDS[currentStep];
    if (!fields || fields.length === 0) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return form.trigger(fields as any);
  };

  const handleNext = async () => {
    const valid = await validateCurrentStep();
    if (!valid) return;

    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    if (currentStep < INTAKE_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleStepClick = (index: number) => {
    if (completedSteps.has(index) || index <= currentStep) {
      setCurrentStep(index);
    }
  };

  // ─── Submit ───────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const valid = await form.trigger();
      if (!valid) {
        toast({
          title: "Incomplete information",
          description: "Please review and complete all required fields.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const data = form.getValues();
      const result = await onSubmit(data);
      setSubmitResult(result);

      // Clear draft
      sessionStorage.removeItem(DRAFT_KEY);

      toast({
        title: "Intake submitted successfully",
        description: `Intake ${result.grievanceNumber} has been submitted for review.`,
      });
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Outcome Screen ──────────────────────────────────────

  if (submitResult) {
    return <SubmissionOutcome result={submitResult} />;
  }

  // ─── Render ───────────────────────────────────────────────

  const isLastStep = currentStep === INTAKE_STEPS.length - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Draft recovery modal */}
      <ResumeDraftModal
        open={showDraftModal}
        draftSavedAt={savedDraft?._savedAt
          ? new Date(savedDraft._savedAt).toLocaleString()
          : undefined}
        onResume={handleResumeDraft}
        onDiscard={handleDiscardDraft}
      />

      <GrievanceIntakeStepper
        steps={INTAKE_STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      <Card className="p-6">
        {currentStep === 0 && <MemberStep form={form} />}
        {currentStep === 1 && <EmployerStep form={form} />}
        {currentStep === 2 && <IssueStep form={form} />}
        {currentStep === 3 && <DescriptionStep form={form} />}
        {currentStep === 4 && <DocumentStep form={form} />}
        {currentStep === 5 && (
          <GrievanceIntakeReview
            data={form.getValues()}
            onEdit={(step) => setCurrentStep(step)}
          />
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <Button type="button" variant="outline" onClick={handleBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          {onCancel && currentStep === 0 && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Step {currentStep + 1} of {INTAKE_STEPS.length}
          </span>
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit Intake"}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Member Details ──────────────────────────────────

function MemberStep({ form }: { form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData> }) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={User}
        title="Member Details"
        description="Identify the member. If you are collecting information on behalf of a member, enter their details below."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField form={form} name="memberName" label="Full Name" required placeholder="e.g., Jane Doe" />
        <FormField form={form} name="memberNumber" label="Membership Number" placeholder="e.g., CAPE-12345" />
        <FormField form={form} name="memberEmail" label="Email" required placeholder="jane.doe@example.ca" type="email" />
        <FormField form={form} name="memberPhone" label="Phone" placeholder="(613) 555-0123" />
        <FormField form={form} name="localChapter" label="Local / Chapter" placeholder="e.g., Local 900" className="sm:col-span-2" />
      </div>
    </div>
  );
}

// ─── Step 2: Employer / Workplace ────────────────────────────

function EmployerStep({ form }: { form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData> }) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Building2}
        title="Employer & Workplace"
        description="Select the employer and workplace where the issue occurred."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField form={form} name="employerName" label="Employer Name" required placeholder="e.g., Treasury Board of Canada" />
        <FormField form={form} name="workplaceName" label="Workplace / Location" placeholder="e.g., Place du Portage, Phase III" />
        <FormField form={form} name="department" label="Department" placeholder="e.g., Translation Bureau" />
        <FormField form={form} name="branch" label="Branch / Division" placeholder="e.g., Parliamentary Translation" />
        <FormField form={form} name="supervisorName" label="Supervisor Name" placeholder="(optional)" className="sm:col-span-2" />
      </div>
    </div>
  );
}

// ─── Step 3: Issue Type ──────────────────────────────────────

function IssueStep({ form }: { form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData> }) {
  const [dateOpen, setDateOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <StepHeader
        icon={AlertCircle}
        title="Issue Classification"
        description="Select the type and urgency of this grievance. Flag any sensitive circumstances."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Grievance Type */}
        <div className="space-y-2">
          <Label>
            Grievance Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.watch("grievanceType")}
            onValueChange={(v) => form.setValue("grievanceType", v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual Grievance</SelectItem>
              <SelectItem value="group">Group Grievance</SelectItem>
              <SelectItem value="policy">Policy Grievance</SelectItem>
              <SelectItem value="contract">Contract Violation</SelectItem>
              <SelectItem value="harassment">Harassment</SelectItem>
              <SelectItem value="discrimination">Discrimination</SelectItem>
              <SelectItem value="safety">Workplace Safety</SelectItem>
              <SelectItem value="seniority">Seniority Dispute</SelectItem>
              <SelectItem value="discipline">Discipline</SelectItem>
              <SelectItem value="termination">Termination</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <FieldError form={form} name="grievanceType" />
        </div>

        {/* Issue Date */}
        <div className="space-y-2">
          <Label>
            Date of Issue <span className="text-red-500">*</span>
          </Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch("issueDate") && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {form.watch("issueDate")
                  ? format(form.watch("issueDate"), "PPP")
                  : "Select date…"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarPicker
                mode="single"
                selected={form.watch("issueDate")}
                onSelect={(d) => {
                  form.setValue("issueDate", d!, { shouldValidate: true });
                  setDateOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <FieldError form={form} name="issueDate" />
        </div>

        {/* Urgency */}
        <div className="space-y-2 sm:col-span-2">
          <Label>
            Urgency <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.watch("urgency")}
            onValueChange={(v) => form.setValue("urgency", v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select urgency…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low — No immediate impact</SelectItem>
              <SelectItem value="medium">Medium — Ongoing concern</SelectItem>
              <SelectItem value="high">High — Significant impact</SelectItem>
              <SelectItem value="urgent">Urgent — Immediate attention required</SelectItem>
            </SelectContent>
          </Select>
          <FieldError form={form} name="urgency" />
        </div>
      </div>

      {/* CBA Article / Section */}
      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Collective Agreement Reference (if known)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField form={form} name="cbaArticle" label="CBA Article" placeholder="e.g., Article 14 — Telework" />
          <FormField form={form} name="cbaSection" label="Section / Clause" placeholder="e.g., 14.3(b)" />
        </div>
        <HelpTip>
          Citing the specific collective agreement article strengthens the grievance.
          If you&apos;re unsure, your steward can help identify the relevant provision.
        </HelpTip>
      </div>

      {/* Flags */}
      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-4 w-4" />
          Sensitive circumstances (check all that apply)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FlagCheckbox form={form} name="workplaceSafetyFlag" label="Workplace safety concern" />
          <FlagCheckbox form={form} name="harassmentFlag" label="Harassment involved" />
          <FlagCheckbox form={form} name="discriminationFlag" label="Discrimination involved" />
          <FlagCheckbox form={form} name="accommodationFlag" label="Accommodation-related" />
        </div>
      </div>

      <HelpTip>
        Flagging sensitive circumstances helps ensure your case is routed to the
        appropriate specialist and handled with the necessary urgency and
        confidentiality.
      </HelpTip>
    </div>
  );
}

// ─── Step 4: Description ─────────────────────────────────────

function DescriptionStep({ form }: { form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData> }) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={FileText}
        title="Incident Description"
        description="Describe what happened. Be as specific as possible — include dates, people involved, and what policy or contract provision you believe was violated."
      />

      <FormField form={form} name="title" label="Grievance Title" required placeholder="e.g., Denial of telework arrangement" />

      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          rows={8}
          placeholder="Describe the incident in detail. Include what happened, when, where, and who was involved…"
          {...form.register("description")}
        />
        <FieldError form={form} name="description" />
        <HelpTip>
          <strong>Example:</strong> &quot;On February 12, 2026, my manager denied my request for a
          telework arrangement without providing a written rationale, contrary to
          Article 14.3 of the collective agreement…&quot;
        </HelpTip>
      </div>

      <FormField form={form} name="location" label="Location of Incident" required placeholder="e.g., 4th Floor, 240 Sparks Street" />

      <div className="space-y-2">
        <Label htmlFor="desiredResolution">
          Desired Resolution <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="desiredResolution"
          rows={3}
          placeholder="What outcome are you seeking? e.g., Approval of telework, written apology, policy review…"
          {...form.register("desiredResolution")}
        />
      </div>
    </div>
  );
}

// ─── Step 5: Documents ───────────────────────────────────────

function DocumentStep({ form: _form }: { form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData> }) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Upload}
        title="Supporting Documents"
        description="Attach any supporting evidence — emails, letters, photos, or other records. You can also add documents after submitting the intake."
      />

      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          PDF, JPG, PNG, DOCX — max 10 MB each
        </p>
        <Button className="mt-4" variant="outline" type="button">
          Browse Files
        </Button>
      </div>

      <HelpTip>
        This step is optional. You can always add documents to your case later.
        Helpful evidence includes emails, denial letters, pay stubs, schedules,
        photos, or witness statements.
      </HelpTip>
    </div>
  );
}

// ─── Submission Outcome Screen ───────────────────────────────

function SubmissionOutcome({
  result,
}: {
  result: { grievanceNumber: string; status: string };
}) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6 py-8">
      <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">Intake Submitted Successfully</h2>
        <p className="text-muted-foreground mt-2">
          Your intake has been submitted. A steward will review it and create a formal case shortly.
        </p>
      </div>

      <Card className="p-6 text-left max-w-md mx-auto space-y-4">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Case Number</span>
          <Badge variant="secondary" className="font-mono text-sm">
            {result.grievanceNumber}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge className="capitalize">{result.status}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Next Step</span>
          <span className="text-sm font-medium">Steward assignment & triage</span>
        </div>
      </Card>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md mx-auto text-left">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          What happens next?
        </h3>
        <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
          <li>A steward is assigned to your case</li>
          <li>Your steward reviews the details and may contact you</li>
          <li>The employer is formally notified</li>
          <li>You&apos;ll receive updates as the case progresses</li>
        </ol>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          Questions? Contact your steward or reach out at{" "}
          <span className="font-medium text-foreground">grievances@cape-acep.ca</span>
        </p>
      </div>
    </div>
  );
}

// ─── Shared Helpers ──────────────────────────────────────────

function StepHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b mb-4">
      <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FormField({
  form,
  name,
  label,
  required,
  placeholder,
  type = "text",
  className,
}: {
  form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData>;
  name: keyof GrievanceFormData;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        {...form.register(name)}
      />
      <FieldError form={form} name={name} />
    </div>
  );
}

function FieldError({ form, name }: { form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData>; name: string }) {
  const error = form.formState.errors[name as keyof GrievanceFormData];
  if (!error?.message) return null;
  return (
    <p className="text-xs text-red-500" role="alert">
      {error.message as string}
    </p>
  );
}

function FlagCheckbox({
  form,
  name,
  label,
}: {
  form: UseFormReturn<GrievanceFormData, undefined, GrievanceFormData>;
  name: keyof GrievanceFormData;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={name}
        checked={!!form.watch(name)}
        onCheckedChange={(checked) =>
          form.setValue(name, !!checked, { shouldValidate: true })
        }
      />
      <Label htmlFor={name} className="text-sm cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}

function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-muted/40 rounded-md p-3 text-xs text-muted-foreground">
      <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
