/**
 * Steward Intake Review Panel
 *
 * Steward+ dashboard panel for reviewing, converting, or closing member intakes.
 * Actions: Review → Convert to Case, Request More Info, Close Without Case
 *
 * @module components/grievances/intake-review-panel
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { AlertTriangle, XCircle, FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export interface IntakeItem {
  id: string;
  grievanceNumber: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  createdAt: string;
  createdBy: string;
}

export interface IntakeReviewPanelProps {
  intake: IntakeItem;
  onConvert?: (intakeId: string, priority: string, notes: string) => Promise<void>;
  onClose?: (intakeId: string, notes: string) => Promise<void>;
  onRequestInfo?: (intakeId: string, notes: string) => Promise<void>;
}

const TYPE_KEYS = [
  "individual", "group", "policy", "contract", "harassment", "discrimination", "safety", "seniority", "discipline", "termination", "other",
] as const;

export function IntakeReviewPanel({ intake, onConvert, onClose, onRequestInfo }: IntakeReviewPanelProps) {
  const t = useTranslations("intakeReview");
  const { toast } = useToast();
  const [action, setAction] = React.useState<"convert" | "close" | "request_info" | null>(null);
  const [notes, setNotes] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!action) return;
    setSubmitting(true);

    try {
      switch (action) {
        case "convert":
          await onConvert?.(intake.id, priority, notes);
          toast({ title: t("toast.converted") });
          break;
        case "close":
          await onClose?.(intake.id, notes);
          toast({ title: t("toast.closed") });
          break;
        case "request_info":
          await onRequestInfo?.(intake.id, notes);
          toast({ title: t("toast.requested") });
          break;
      }
      setAction(null);
      setNotes("");
    } catch {
      toast({ title: t("toast.failed"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            <FileText className="mr-2 inline-block h-4 w-4" />
            {intake.grievanceNumber}
          </CardTitle>
          <Badge variant="outline">{(TYPE_KEYS as readonly string[]).includes(intake.type) ? t(`types.${intake.type}` as 'types.other') : intake.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{intake.title}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm">{intake.description}</p>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{t("submittedLabel", { date: format(new Date(intake.createdAt), "MMM d, yyyy") })}</span>
          <span>{t("statusLabel", { status: intake.status })}</span>
        </div>

        {/* Action selection */}
        {!action && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => setAction("convert")}>
              <ArrowRight className="mr-1 h-3 w-3" />
              {t("actions.convert")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAction("request_info")}>
              <AlertTriangle className="mr-1 h-3 w-3" />
              {t("actions.requestInfo")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setAction("close")}>
              <XCircle className="mr-1 h-3 w-3" />
              {t("actions.close")}
            </Button>
          </div>
        )}

        {/* Action form */}
        {action && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">
              {action === "convert" && t("headings.convert")}
              {action === "close" && t("headings.close")}
              {action === "request_info" && t("headings.request_info")}
            </p>

            {action === "convert" && (
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("priorityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("priorities.low")}</SelectItem>
                  <SelectItem value="medium">{t("priorities.medium")}</SelectItem>
                  <SelectItem value="high">{t("priorities.high")}</SelectItem>
                  <SelectItem value="urgent">{t("priorities.urgent")}</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Textarea
              placeholder={
                action === "convert" ? t("notesPlaceholder.convert") :
                action === "close" ? t("notesPlaceholder.close") :
                t("notesPlaceholder.request_info")
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </CardContent>

      {action && (
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAction(null); setNotes(""); }}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t("processing") : (
              action === "convert" ? t("confirm.convert") :
              action === "close" ? t("confirm.close") :
              t("confirm.request_info")
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
