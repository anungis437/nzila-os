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
import { useTranslations } from "next-intl";

type AppealFormData = {
  reason: string;
  justification: string;
  additionalEvidence?: string[];
};

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
  "procedural-error",
  "new-evidence",
  "incorrect-interpretation",
  "inadequate-investigation",
  "bias-concern",
  "excessive-penalty",
  "mitigating-circumstances",
  "other",
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
  const t = useTranslations("claimAppealForm");
  const appealSchema = React.useMemo(
    () =>
      z.object({
        reason: z.string().min(1, t("validation.reasonRequired")),
        justification: z.string().min(50, t("validation.justificationMin")),
        additionalEvidence: z.array(z.string()).optional(),
      }),
    [t]
  );

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
        title: t("successTitle"),
        description: t("successMessage"),
      });
    } catch (error) {
      toast({
        title: t("errorTitle"),
        description: error instanceof Error ? error.message : t("genericError"),
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
            {t("originalDecisionTitle", { claimNumber })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">{t("decision")}</div>
              <Badge variant="destructive" className="text-sm">
                {currentDecision}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">{t("decisionDate")}</div>
              <div className="font-medium">
                {format(decisionDate, "PPP")}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-sm text-gray-500 mb-1">{t("decisionMaker")}</div>
              <div className="font-medium">{decisionMaker}</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="text-sm text-yellow-900">
              <p className="font-medium mb-1">{t("importantNoticeTitle")}</p>
              <p>{t("importantNoticeBody")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appeal Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("fileAppealTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                {t("reasonForAppeal")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.watch("reason")}
                onValueChange={(value) => form.setValue("reason", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectReason")} />
                </SelectTrigger>
                <SelectContent>
                  {appealReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {t(`reasons.${reason}`)}
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
                {t("detailedJustification")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="justification"
                placeholder={t("justificationPlaceholder")}
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
                  {t("characterCount", { count: form.watch("justification").length })}
                </p>
              </div>
            </div>

            {/* Additional Evidence */}
            <div className="space-y-2">
              <Label>{t("additionalEvidence")}</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  {t("uploadEvidencePrompt")}
                </p>
                <Button type="button" variant="outline" size="sm">
                  {t("browseFiles")}
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">{t("whatHappensNext")}</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>{t("nextSteps.reviewed")}</li>
                  <li>{t("nextSteps.notified")}</li>
                  <li>{t("nextSteps.additionalInfo")}</li>
                  <li>{t("nextSteps.finalDecision")}</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t("cancel")}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("submitting") : t("submitAppeal")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t("timeline.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { step: 1, title: t("timeline.steps.filed.title"), duration: t("timeline.steps.filed.duration") },
              { step: 2, title: t("timeline.steps.assignment.title"), duration: t("timeline.steps.assignment.duration") },
              { step: 3, title: t("timeline.steps.evidence.title"), duration: t("timeline.steps.evidence.duration") },
              { step: 4, title: t("timeline.steps.hearing.title"), duration: t("timeline.steps.hearing.duration") },
              { step: 5, title: t("timeline.steps.decision.title"), duration: t("timeline.steps.decision.duration") },
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

