/**
 * Hazard Report Form Component
 * 
 * Form for reporting workplace hazards with:
 * - Hazard type and classification
 * - Priority level
 * - Location and description
 * - Risk assessment
 * - Photo upload
 * - Anonymous reporting option
 * 
 * @module components/health-safety/HazardReportForm
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Send, Camera } from "lucide-react";

const hazardSchema = z.object({
  hazardType: z.string().min(1, "Hazard type is required"),
  priority: z.enum(["low", "medium", "high", "critical"], {
    required_error: "Priority is required",
  }),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(30, "Description must be at least 30 characters"),
  potentialConsequences: z.string().min(20, "Please describe potential consequences"),
  recommendedAction: z.string().optional(),
  reporterName: z.string().optional(),
  reporterContact: z.string().optional(),
  isAnonymous: z.boolean().default(false),
}).refine((data) => {
  if (!data.isAnonymous && (!data.reporterName || !data.reporterContact)) {
    return false;
  }
  return true;
}, {
  message: "Reporter information is required unless reporting anonymously",
  path: ["reporterName"],
});

type HazardFormData = z.infer<typeof hazardSchema>;

export interface HazardReportFormProps {
  organizationId: string;
  onSubmit?: (data: HazardFormData) => Promise<void>;
  onCancel?: () => void;
}

export function HazardReportForm({
  organizationId,
  onSubmit,
  onCancel
}: HazardReportFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [photos, setPhotos] = React.useState<File[]>([]);

  const form = useForm<HazardFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(hazardSchema) as any,
    defaultValues: {
      hazardType: "",
      location: "",
      description: "",
      potentialConsequences: "",
      recommendedAction: "",
      reporterName: "",
      reporterContact: "",
      isAnonymous: false,
    },
  });

  async function handleSubmit(data: HazardFormData) {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Default API call
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
          }
        });

        photos.forEach((photo) => {
          formData.append('photos', photo);
        });

        formData.append('organizationId', organizationId);

        const response = await fetch('/api/health-safety/hazards', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to submit hazard report");
        }

        const result = await response.json();

        toast({
          title: "Success",
          description: "Hazard report submitted successfully"
        });

        // Redirect to hazard list or detail
        if (result.hazardId) {
          window.location.href = `/health-safety/hazards/${result.hazardId}`;
        } else {
          window.location.href = `/health-safety/hazards`;
        }
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to submit hazard report",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  }

  const isAnonymous = form.watch("isAnonymous");
  const priority = form.watch("priority");

  const _getPriorityColor = (p: string) => {
    switch (p) {
      case "critical":
        return "text-red-600";
      case "high":
        return "text-orange-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Priority Alert */}
      {priority === "critical" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-900 dark:text-red-100 font-medium">
                Critical hazard reports require immediate attention and will trigger urgent notifications.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hazard Details */}
      <Card>
        <CardHeader>
          <CardTitle>Hazard Information</CardTitle>
          <CardDescription>
            Provide details about the workplace hazard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Hazard Type */}
            <div className="space-y-2">
              <Label htmlFor="hazardType">Hazard Type *</Label>
              <Select onValueChange={(value) => form.setValue("hazardType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hazard type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slip_trip_fall">Slip, Trip, or Fall</SelectItem>
                  <SelectItem value="electrical">Electrical Hazard</SelectItem>
                  <SelectItem value="chemical">Chemical Exposure</SelectItem>
                  <SelectItem value="fire">Fire Hazard</SelectItem>
                  <SelectItem value="equipment">Equipment/Machinery</SelectItem>
                  <SelectItem value="ergonomic">Ergonomic Issue</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="security">Security Concern</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.hazardType && (
                <p className="text-sm text-red-600">{form.formState.errors.hazardType.message}</p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level *</Label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select onValueChange={(value) => form.setValue("priority", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-600" />
                      Low - Minor concern
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-600" />
                      Medium - Moderate risk
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-600" />
                      High - Significant risk
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      Critical - Immediate danger
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.priority && (
                <p className="text-sm text-red-600">{form.formState.errors.priority.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              placeholder="e.g., Building A, Production Floor 2, Near Loading Dock"
              {...form.register("location")}
            />
            {form.formState.errors.location && (
              <p className="text-sm text-red-600">{form.formState.errors.location.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the hazard in detail..."
              rows={4}
              {...form.register("description")}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 30 characters
            </p>
            {form.formState.errors.description && (
              <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* Potential Consequences */}
          <div className="space-y-2">
            <Label htmlFor="potentialConsequences">Potential Consequences *</Label>
            <Textarea
              id="potentialConsequences"
              placeholder="What could happen if this hazard is not addressed?"
              rows={3}
              {...form.register("potentialConsequences")}
            />
            {form.formState.errors.potentialConsequences && (
              <p className="text-sm text-red-600">{form.formState.errors.potentialConsequences.message}</p>
            )}
          </div>

          {/* Recommended Action */}
          <div className="space-y-2">
            <Label htmlFor="recommendedAction">Recommended Action (Optional)</Label>
            <Textarea
              id="recommendedAction"
              placeholder="Suggest how this hazard could be eliminated or controlled..."
              rows={3}
              {...form.register("recommendedAction")}
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label htmlFor="photos">Photos</Label>
            <div className="flex items-center gap-2">
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoChange}
                className="cursor-pointer"
              />
              <Camera className="h-4 w-4 text-muted-foreground" />
            </div>
            {photos.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reporter Information */}
      <Card>
        <CardHeader>
          <CardTitle>Reporter Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Anonymous Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isAnonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => form.setValue("isAnonymous", checked as boolean)}
            />
            <Label htmlFor="isAnonymous" className="cursor-pointer">
              Report anonymously
            </Label>
          </div>

          {!isAnonymous && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reporterName">Your Name *</Label>
                <Input
                  id="reporterName"
                  placeholder="Full name"
                  {...form.register("reporterName")}
                />
                {form.formState.errors.reporterName && (
                  <p className="text-sm text-red-600">{form.formState.errors.reporterName.message}</p>
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

          <p className="text-xs text-muted-foreground">
            {isAnonymous
              ? "Your identity will be kept confidential. We encourage all hazards to be reported regardless of who reports them."
              : "Your information will be kept confidential and used only for follow-up if needed."}
          </p>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? "Submitting..." : "Submit Hazard Report"}
        </Button>
      </div>
    </form>
  );
}
