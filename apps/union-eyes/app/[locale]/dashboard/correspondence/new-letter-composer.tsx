"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Megaphone,
  BookOpen,
  Scale,
  MessageSquareReply,
  Handshake,
  ScrollText,
  ClipboardList,
  PenLine,
  Sparkles,
  ArrowLeft,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { readApiError } from "@/lib/client/api-envelope";

// ── Template Definitions ───────────────────────────────────────────────────

interface LetterTemplate {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultPriority: string;
  subject: string;
  body: string;
}

const LETTER_TEMPLATES: Omit<LetterTemplate, "label" | "description" | "subject" | "body">[] = [
  { id: "grievance_notification", type: "letter", icon: <Scale className="h-5 w-5" />, defaultPriority: "high" },
  { id: "demand_letter", type: "demand", icon: <Megaphone className="h-5 w-5" />, defaultPriority: "urgent" },
  { id: "documentation_request", type: "letter", icon: <ClipboardList className="h-5 w-5" />, defaultPriority: "normal" },
  { id: "meeting_request", type: "memo", icon: <BookOpen className="h-5 w-5" />, defaultPriority: "normal" },
  { id: "response_letter", type: "response", icon: <MessageSquareReply className="h-5 w-5" />, defaultPriority: "normal" },
  { id: "resolution_proposal", type: "proposal", icon: <Handshake className="h-5 w-5" />, defaultPriority: "high" },
  { id: "official_notice", type: "notice", icon: <ScrollText className="h-5 w-5" />, defaultPriority: "high" },
  { id: "investigation_report", type: "report", icon: <FileText className="h-5 w-5" />, defaultPriority: "normal" },
  { id: "blank", type: "letter", icon: <PenLine className="h-5 w-5" />, defaultPriority: "normal" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface NewLetterComposerProps {
  onCreated: () => void;
  onCancel: () => void;
  /** The person writing the letter; with `canSign` it lets them name themselves as the signer. */
  userId?: string;
  /** At least an officer: the level that may sign a letter. */
  canSign?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function NewLetterComposer({ onCreated, onCancel, userId, canSign = false }: NewLetterComposerProps) {
  const t = useTranslations("correspondencePage");
  const locale = useLocale();
  const templates: LetterTemplate[] = LETTER_TEMPLATES.map((template) => ({
    ...template,
    label: t(`composer.templates.${template.id}.label`),
    description: t(`composer.templates.${template.id}.description`),
    subject: template.id === "blank" ? "" : t(`composer.templates.${template.id}.subject`),
    body: template.id === "blank" ? "" : t(`composer.templates.${template.id}.body`),
  }));
  const [step, setStep] = useState<"pick" | "compose">("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("letter");
  const [priority, setPriority] = useState("normal");
  const [recipientName, setRecipientName] = useState("");
  const [recipientOrganization, setRecipientOrganization] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [signMyself, setSignMyself] = useState(false);

  // ── Template Selection ───────────────────────────────────────────────────

  const handlePickTemplate = (tpl: LetterTemplate) => {
    setSelectedTemplate(tpl);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setType(tpl.type);
    setPriority(tpl.defaultPriority);
    setStep("compose");
  };

  const handleBackToTemplates = () => {
    setStep("pick");
    setSelectedTemplate(null);
    setSubject("");
    setBody("");
    setType("letter");
    setPriority("normal");
    setRecipientName("");
    setRecipientOrganization("");
    setRecipientEmail("");
    setSignMyself(false);
  };

  // ── AI Draft Assist ──────────────────────────────────────────────────────

  const handleAiAssist = async () => {
    if (!subject.trim()) {
      toast.error(t("composer.aiSubjectRequired"));
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "draft_response",
          query: `Write in ${locale.startsWith("fr") ? "French" : "English"}. Draft a professional union correspondence letter with the following subject: "${subject}". Type: ${type}. ${body ? `Use this as a starting template and improve it:\n\n${body}` : "Write a complete letter body."}`,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, t("composer.aiUnavailable")));
      }

      const json = await res.json();
      const draft = json.data?.response ?? json.data?.content ?? json.data;
      if (typeof draft === "string" && draft.length > 0) {
        setBody(draft);
        toast.success(t("composer.aiGenerated"));
      } else {
        toast.info(t("composer.aiEmpty"));
      }
    } catch {
      toast.error(t("composer.aiUnavailable"));
    } finally {
      setAiLoading(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const recipients = recipientName.trim()
        ? [
            {
              name: recipientName.trim(),
              ...(recipientOrganization.trim() ? { organization: recipientOrganization.trim() } : {}),
              ...(recipientEmail.trim() ? { email: recipientEmail.trim() } : {}),
              recipientType: "to" as const,
            },
          ]
        : undefined;
      const res = await fetch("/api/correspondence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body,
          type,
          priority,
          ...(recipients ? { recipients } : {}),
          ...(signMyself && canSign && userId ? { assignedSignerId: userId } : {}),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t("composer.createFailed")));
      toast.success(t("composer.created"));
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("composer.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 1: Template Picker ──────────────────────────────────────────────

  if (step === "pick") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{t("composer.chooseTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("composer.chooseHint")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className={`group rounded-lg border bg-card p-4 text-left text-card-foreground shadow-sm transition-all hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${tpl.id === "blank" ? "border-dashed" : ""}`}
              onClick={() => handlePickTemplate(tpl)}
            >
              <span className="flex items-start gap-3">
                <span aria-hidden="true" className="rounded-md bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {tpl.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{tpl.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{tpl.description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("composer.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Compose ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header with back button & template badge */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBackToTemplates} className="shrink-0" aria-label={t("composer.back")}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">{t("composer.composeTitle")}</h3>
          {selectedTemplate && selectedTemplate.id !== "blank" && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">{t("composer.template")}</span>
              <Badge variant="secondary" className="text-xs font-normal">
                {selectedTemplate.label}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="nl-subject">{t("composer.subject")}</Label>
        <Input
          id="nl-subject"
          required
          placeholder={t("composer.subjectPlaceholder")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      {/* Type & Priority row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nl-type">{t("composer.type")}</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="nl-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letter">{t("composer.types.letter")}</SelectItem>
              <SelectItem value="notice">{t("composer.types.notice")}</SelectItem>
              <SelectItem value="memo">{t("composer.types.memo")}</SelectItem>
              <SelectItem value="demand">{t("composer.types.demand")}</SelectItem>
              <SelectItem value="response">{t("composer.types.response")}</SelectItem>
              <SelectItem value="proposal">{t("composer.types.proposal")}</SelectItem>
              <SelectItem value="agreement">{t("composer.types.agreement")}</SelectItem>
              <SelectItem value="report">{t("composer.types.report")}</SelectItem>
              <SelectItem value="other">{t("composer.types.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nl-priority">{t("composer.priority")}</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="nl-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t("composer.priorities.low")}</SelectItem>
              <SelectItem value="normal">{t("composer.priorities.normal")}</SelectItem>
              <SelectItem value="high">{t("composer.priorities.high")}</SelectItem>
              <SelectItem value="urgent">{t("composer.priorities.urgent")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recipient */}
      <div className="space-y-1.5">
        <Label htmlFor="nl-recipient-name">{t("composer.recipientName")}</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input id="nl-recipient-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={255} />
          <Input
            aria-label={t("composer.recipientOrganization")}
            placeholder={t("composer.recipientOrganization")}
            value={recipientOrganization}
            onChange={(e) => setRecipientOrganization(e.target.value)}
            maxLength={255}
          />
          <Input
            type="email"
            aria-label={t("composer.recipientEmail")}
            placeholder={t("composer.recipientEmail")}
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            maxLength={320}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("composer.recipientHint")}</p>
      </div>

      {/* Body with AI assist */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="nl-body">{t("composer.body")}</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleAiAssist}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading ? t("composer.aiLoading") : t("composer.aiAssist")}
          </Button>
        </div>
        <Textarea
          id="nl-body"
          required
          placeholder={t("composer.bodyPlaceholder")}
          rows={12}
          className="font-mono text-sm leading-relaxed"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("composer.placeholderHint")}
        </p>
      </div>

      {/* Signer */}
      {canSign && userId && (
        <div className="flex items-start gap-2">
          <input id="nl-sign-myself" type="checkbox" className="mt-1 h-4 w-4" checked={signMyself} onChange={(e) => setSignMyself(e.target.checked)} />
          <div>
            <Label htmlFor="nl-sign-myself">{t("composer.signMyself")}</Label>
            <p className="text-xs text-muted-foreground">{t("composer.signMyselfHint")}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t("composer.draftHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("composer.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || !subject.trim() || !body.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("composer.creating")}
              </>
            ) : (
              t("composer.create")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
