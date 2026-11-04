/**
 * Incident Report Form Component
 * 
 * Form for reporting an incident with:
 * - Multi-step validation
 * - Witness information
 * - Severity classification
 * - Location details
 * 
 * The form hands the typed report to its host, which saves it (see incident-payload.ts for how the fields reach the incidents route). It
 * keeps no draft and takes no attachments: nothing restores a draft and no route stores a file.
 * 
 * @module components/health-safety/IncidentReportForm
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Calendar as CalendarIcon, Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const incidentSchema = z.object({
  incidentDate: z.date({
    error: "Incident date is required",
  }),
  incidentTime: z.string().min(1, "Incident time is required"),
  location: z.string().min(1, "Location is required"),
  department: z.string().optional(),
  incidentType: z.string().min(1, "Incident type is required"),
  severity: z.enum(["minor", "major", "critical"], {
    error: "Severity is required",
  }),
  description: z.string().min(50, "Description must be at least 50 characters"),
  immediateCause: z.string().min(20, "Immediate cause must be at least 20 characters"),
  rootCause: z.string().optional(),
  injuriesOccurred: z.boolean().default(false),
  injuryDetails: z.string().optional(),
  witnessesPresent: z.boolean().default(false),
  witnessNames: z.string().optional(),
  witnessContacts: z.string().optional(),
  correctiveActions: z.string().optional(),
  preventiveMeasures: z.string().optional(),
  isAnonymous: z.boolean().default(false),
  reportedBy: z.string().optional(),
  reporterContact: z.string().optional(),
}).refine((data) => {
  if (!data.isAnonymous && (!data.reportedBy || data.reportedBy.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Reporter name is required unless reporting anonymously",
  path: ["reportedBy"],
}).refine((data) => {
  if (!data.isAnonymous && (!data.reporterContact || data.reporterContact.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Reporter contact is required unless reporting anonymously",
  path: ["reporterContact"],
}).refine((data) => {
  if (data.injuriesOccurred && !data.injuryDetails) {
    return false;
  }
  return true;
}, {
  message: "Injury details are required when injuries occurred",
  path: ["injuryDetails"],
}).refine((data) => {
  if (data.witnessesPresent && !data.witnessNames) {
    return false;
  }
  return true;
}, {
  message: "Witness information is required when witnesses are present",
  path: ["witnessNames"],
});

export type IncidentFormData = z.infer<typeof incidentSchema>;

export interface IncidentReportFormProps {
  initialData?: Partial<IncidentFormData>;
  /** Saves the report. It throws when the report is refused, so the form stays open with what was typed and shows the reason. */
  onSubmit: (data: IncidentFormData) => Promise<void>;
  onCancel?: () => void;
}

export function IncidentReportForm({
  initialData,
  onSubmit,
  onCancel
}: IncidentReportFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<IncidentFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(incidentSchema) as any,
    defaultValues: initialData || {
      incidentTime: "",
      location: "",
      department: "",
      incidentType: "",
      description: "",
      immediateCause: "",
      rootCause: "",
      injuriesOccurred: false,
      injuryDetails: "",
      witnessesPresent: false,
      witnessNames: "",
      witnessContacts: "",
      correctiveActions: "",
      preventiveMeasures: "",
      isAnonymous: false,
      reportedBy: "",
      reporterContact: "",
    },
  });

  async function handleSubmit(data: IncidentFormData) {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error && error.message !== "" ? error.message : "Failed to submit incident report",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const injuriesOccurred = form.watch("injuriesOccurred");
  const witnessesPresent = form.watch("witnessesPresent");
  const isAnonymous = form.watch("isAnonymous");

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
          <CardDescription>
            Provide basic information about the incident
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Incident Date */}
            <div className="space-y-2">
              <Label htmlFor="incidentDate">Incident Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("incidentDate") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("incidentDate") 
                      ? format(form.watch("incidentDate"), "PPP")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("incidentDate")}
                    onSelect={(date) => form.setValue("incidentDate", date as Date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.incidentDate && (
                <p className="text-sm text-red-600">{form.formState.errors.incidentDate.message}</p>
              )}
            </div>

            {/* Incident Time */}
            <div className="space-y-2">
              <Label htmlFor="incidentTime">Incident Time *</Label>
              <Input
                id="incidentTime"
                type="time"
                {...form.register("incidentTime")}
              />
              {form.formState.errors.incidentTime && (
                <p className="text-sm text-red-600">{form.formState.errors.incidentTime.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Production Floor A, Section 3"
                {...form.register("location")}
              />
              {form.formState.errors.location && (
                <p className="text-sm text-red-600">{form.formState.errors.location.message}</p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="e.g., Manufacturing"
                {...form.register("department")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Incident Type */}
            <div className="space-y-2">
              <Label htmlFor="incidentType">Incident Type *</Label>
              <Select onValueChange={(value) => form.setValue("incidentType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="injury">Injury</SelectItem>
                  <SelectItem value="near_miss">Near Miss</SelectItem>
                  <SelectItem value="property_damage">Property Damage</SelectItem>
                  <SelectItem value="equipment_failure">Equipment Failure</SelectItem>
                  <SelectItem value="chemical_spill">Chemical Spill</SelectItem>
                  <SelectItem value="fire">Fire</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.incidentType && (
                <p className="text-sm text-red-600">{form.formState.errors.incidentType.message}</p>
              )}
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label htmlFor="severity">Severity *</Label>
              <Select onValueChange={(value) => form.setValue("severity", value as "minor" | "major" | "critical")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.severity && (
                <p className="text-sm text-red-600">{form.formState.errors.severity.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide a detailed description of what happened..."
              rows={4}
              {...form.register("description")}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 50 characters
            </p>
            {form.formState.errors.description && (
              <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* Immediate Cause */}
          <div className="space-y-2">
            <Label htmlFor="immediateCause">Immediate Cause *</Label>
            <Textarea
              id="immediateCause"
              placeholder="What directly caused the incident?"
              rows={3}
              {...form.register("immediateCause")}
            />
            {form.formState.errors.immediateCause && (
              <p className="text-sm text-red-600">{form.formState.errors.immediateCause.message}</p>
            )}
          </div>

          {/* Root Cause */}
          <div className="space-y-2">
            <Label htmlFor="rootCause">Root Cause (Optional)</Label>
            <Textarea
              id="rootCause"
              placeholder="What underlying factors contributed to the incident?"
              rows={3}
              {...form.register("rootCause")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Injuries & Witnesses */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Injuries */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="injuriesOccurred"
                checked={injuriesOccurred}
                onCheckedChange={(checked) => form.setValue("injuriesOccurred", checked as boolean)}
              />
              <Label htmlFor="injuriesOccurred" className="cursor-pointer">
                Injuries occurred
              </Label>
            </div>

            {injuriesOccurred && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="injuryDetails">Injury Details *</Label>
                <Textarea
                  id="injuryDetails"
                  placeholder="Describe the injuries sustained..."
                  rows={3}
                  {...form.register("injuryDetails")}
                />
                {form.formState.errors.injuryDetails && (
                  <p className="text-sm text-red-600">{form.formState.errors.injuryDetails.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Witnesses */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="witnessesPresent"
                checked={witnessesPresent}
                onCheckedChange={(checked) => form.setValue("witnessesPresent", checked as boolean)}
              />
              <Label htmlFor="witnessesPresent" className="cursor-pointer">
                Witnesses present
              </Label>
            </div>

            {witnessesPresent && (
              <div className="space-y-4 ml-6">
                <div className="space-y-2">
                  <Label htmlFor="witnessNames">Witness Names *</Label>
                  <Textarea
                    id="witnessNames"
                    placeholder="List witness names (one per line)"
                    rows={2}
                    {...form.register("witnessNames")}
                  />
                  {form.formState.errors.witnessNames && (
                    <p className="text-sm text-red-600">{form.formState.errors.witnessNames.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="witnessContacts">Witness Contacts</Label>
                  <Textarea
                    id="witnessContacts"
                    placeholder="Contact information for witnesses"
                    rows={2}
                    {...form.register("witnessContacts")}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions & Prevention */}
      <Card>
        <CardHeader>
          <CardTitle>Corrective & Preventive Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correctiveActions">Immediate Actions Taken</Label>
            <Textarea
              id="correctiveActions"
              placeholder="What actions were taken immediately after the incident?"
              rows={3}
              {...form.register("correctiveActions")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preventiveMeasures">Preventive Measures Recommended</Label>
            <Textarea
              id="preventiveMeasures"
              placeholder="What can be done to prevent similar incidents?"
              rows={3}
              {...form.register("preventiveMeasures")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reporter Information */}
      <Card>
        <CardHeader>
          <CardTitle>Reporter Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Anonymous Reporting Toggle */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAnonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => {
                  form.setValue("isAnonymous", checked as boolean);
                  if (checked) {
                    form.setValue("reportedBy", "");
                    form.setValue("reporterContact", "");
                  }
                }}
              />
              <Label htmlFor="isAnonymous" className="cursor-pointer">
                Report anonymously
              </Label>
            </div>
            {isAnonymous && (
              <p className="text-sm text-muted-foreground ml-6">
                Your identity will not be recorded. You can still be contacted if you provide optional contact info below.
              </p>
            )}
          </div>

          {!isAnonymous && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reportedBy">Your Name *</Label>
                <Input
                  id="reportedBy"
                  placeholder="Full name"
                  {...form.register("reportedBy")}
                />
                {form.formState.errors.reportedBy && (
                  <p className="text-sm text-red-600">{form.formState.errors.reportedBy.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reporterContact">Your Contact *</Label>
                <Input
                  id="reporterContact"
                  placeholder="Email or phone"
                  {...form.register("reporterContact")}
                />
                {form.formState.errors.reporterContact && (
                  <p className="text-sm text-red-600">{form.formState.errors.reporterContact.message}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex flex-wrap gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
