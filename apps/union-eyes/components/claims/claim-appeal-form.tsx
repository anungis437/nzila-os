/**
 * Claim Appeal Form Component
 * 
 * Form for filing appeals on claim decisions with:
 * - Appeal reason selection
 * - Detailed justification
 * - Supporting evidence upload
 * - Timeline display
 * - Validation
 * 
 * @module components/claims/claim-appeal-form
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertTriangle, Info, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
 
import { format } from "date-fns";

const appealSchema = z.object({
  reason: z.string().min(1, "Please select a reason for appeal"),
  justification: z.string().min(50, "Please provide a detailed justification (minimum 50 characters)"),
  additionalEvidence: z.array(z.string()).optional(),
});

type AppealFormData = z.infer<typeof appealSchema>;

export interface ClaimAppealFormProps {
  claimId: string;
  claimNumber: string;
  currentDecision: string;
  decisionDate: Date;
  decisionMaker: string;
  onSubmit: (data: AppealFormData) => Promise<void>;
  onCancel?: () => void;
}

const appealReasons = [
  { value: "procedural-error", label: "Procedural Error" },
  { value: "new-evidence", label: "New Evidence Available" },
  { value: "incorrect-interpretation", label: "Incorrect Interpretation of Rules" },
  { value: "inadequate-investigation", label: "Inadequate Investigation" },
  { value: "bias-concern", label: "Concern About Bias" },
  { value: "excessive-penalty", label: "Excessive Penalty" },
  { value: "mitigating-circumstances", label: "Mitigating Circumstances Not Considered" },
  { value: "other", label: "Other" },
];

export function ClaimAppealForm({
  claimId: _claimId,
  claimNumber,
  currentDecision,
  decisionDate,
  decisionMaker,
  onSubmit,
  onCancel,
}: ClaimAppealFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<AppealFormData>({
    resolver: zodResolver(appealSchema),
    defaultValues: {
      reason: "",
      justification: "",
      additionalEvidence: [],
    },
  });

  const handleSubmit = async (data: AppealFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      toast({
        title: "Appeal submitted successfully",
        description: "Your appeal has been submitted and will be reviewed.",
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Original Decision Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Original Decision - Claim #{claimNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Decision</div>
              <Badge variant="destructive" className="text-sm">
                {currentDecision}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Decision Date</div>
              <div className="font-medium">
                {format(decisionDate, "PPP")}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-sm text-gray-500 mb-1">Decision Maker</div>
              <div className="font-medium">{decisionMaker}</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="text-sm text-yellow-900">
              <p className="font-medium mb-1">Important Notice</p>
              <p>
                Appeals must be filed within 30 days of the decision date. Ensure 
                you provide detailed justification and any supporting evidence.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appeal Form */}
      <Card>
        <CardHeader>
          <CardTitle>File an Appeal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Appeal <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.watch("reason")}
                onValueChange={(value) => form.setValue("reason", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {appealReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.reason && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            {/* Justification */}
            <div className="space-y-2">
              <Label htmlFor="justification">
                Detailed Justification <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="justification"
                placeholder="Provide a detailed explanation of why you are appealing this decision. Include specific facts, dates, and circumstances..."
                rows={8}
                {...form.register("justification")}
              />
              <div className="flex items-center justify-between text-xs">
                {form.formState.errors.justification && (
                  <p className="text-red-500">
                    {form.formState.errors.justification.message}
                  </p>
                )}
                <p className="text-gray-500 ml-auto">
                  {form.watch("justification").length} characters (minimum 50)
                </p>
              </div>
            </div>

            {/* Additional Evidence */}
            <div className="space-y-2">
              <Label>Additional Evidence (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Upload any new evidence to support your appeal
                </p>
                <Button type="button" variant="outline" size="sm">
                  Browse Files
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">What happens next?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Your appeal will be reviewed by a senior steward</li>
                  <li>You will be notified of the review schedule within 5 business days</li>
                  <li>You may be asked to provide additional information</li>
                  <li>A final decision will be made within 30 days</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Appeal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Appeal Process Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { step: 1, title: "Appeal Filed", duration: "Today" },
              { step: 2, title: "Review Assignment", duration: "1-5 business days" },
              { step: 3, title: "Evidence Review", duration: "5-14 business days" },
              { step: 4, title: "Hearing (if required)", duration: "15-20 business days" },
              { step: 5, title: "Final Decision", duration: "20-30 business days" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                  {item.step}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-600">{item.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

