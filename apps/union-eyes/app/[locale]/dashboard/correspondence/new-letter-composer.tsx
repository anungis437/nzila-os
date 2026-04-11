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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Plus,
} from "lucide-react";
import { toast } from "sonner";

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

const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    id: "grievance_notification",
    type: "letter",
    label: "Grievance Notification",
    description: "Formal notice to the employer that a grievance has been filed under the collective agreement.",
    icon: <Scale className="h-5 w-5" />,
    defaultPriority: "high",
    subject: "Formal Grievance Notice — [Grievance Number]",
    body: `Dear [Recipient Name],

This letter serves as formal notification that a grievance has been filed under the provisions of the collective agreement.

Grievance Title: [Grievance Title]
Grievant: [Grievant Name]
Employer: [Employer Name]
Date Filed: [Date]

We request a meeting at the earliest mutually convenient time to discuss this matter in accordance with the grievance procedure outlined in our collective agreement.

Please acknowledge receipt of this notice within five (5) business days.

Respectfully,
[Your Name]
[Union Local]`,
  },
  {
    id: "demand_letter",
    type: "demand",
    label: "Demand Letter",
    description: "Formal demand for action, remedy, or compliance with the collective agreement.",
    icon: <Megaphone className="h-5 w-5" />,
    defaultPriority: "urgent",
    subject: "Formal Demand — [Subject Matter]",
    body: `Dear [Recipient Name],

This letter constitutes a formal demand regarding [describe the issue] in relation to the obligations set forth in the collective agreement.

Specifically, we demand that the employer:

1. [Action Required]
2. [Action Required]
3. [Timeline for Compliance]

Failure to comply within [X] business days may result in further action under the grievance and arbitration procedure.

This demand is made without prejudice to any other rights or remedies available under the collective agreement or applicable legislation.

Respectfully,
[Your Name]
[Union Local]`,
  },
  {
    id: "documentation_request",
    type: "letter",
    label: "Documentation Request",
    description: "Request for employer records, documents, or information relevant to a case.",
    icon: <ClipboardList className="h-5 w-5" />,
    defaultPriority: "normal",
    subject: "Request for Documentation — [Reference]",
    body: `Dear [Recipient Name],

In relation to [grievance/case reference], we are requesting the following documentation to support the review process:

1. [Specify document type]
2. [Specify document type]
3. [Specify document type]

Under the collective agreement, the employer is obligated to provide relevant documentation within [X] business days of this request.

Please forward the requested documents to the undersigned at your earliest convenience.

Thank you for your cooperation.

Respectfully,
[Your Name]
[Union Local]`,
  },
  {
    id: "meeting_request",
    type: "memo",
    label: "Meeting Request",
    description: "Request to schedule a step meeting, mediation, or discussion with the employer.",
    icon: <BookOpen className="h-5 w-5" />,
    defaultPriority: "normal",
    subject: "Meeting Request — [Subject]",
    body: `Dear [Recipient Name],

We are writing to request a meeting regarding [subject matter / grievance number].

We propose the following options:
- Date/Time Option 1: [Insert date and time]
- Date/Time Option 2: [Insert date and time]
- Date/Time Option 3: [Insert date and time]

Location: [Insert preferred location or virtual meeting link]

Attendees from the union side will include:
- [Grievant Name] (Grievant)
- [Steward Name] (Steward/Representative)

Please confirm a suitable date and time within three (3) business days.

Respectfully,
[Your Name]
[Union Local]`,
  },
  {
    id: "response_letter",
    type: "response",
    label: "Response to Employer",
    description: "Formal response to an employer communication, proposal, or decision.",
    icon: <MessageSquareReply className="h-5 w-5" />,
    defaultPriority: "normal",
    subject: "Re: [Original Subject]",
    body: `Dear [Recipient Name],

Thank you for your communication dated [date] regarding [subject matter].

After careful review, we wish to respond as follows:

[Your response and position]

[If applicable: We request further discussion / We accept the proposed terms / We reject the proposal for the following reasons:]

We remain committed to resolving this matter through the established grievance procedure and constructive dialogue.

Respectfully,
[Your Name]
[Union Local]`,
  },
  {
    id: "resolution_proposal",
    type: "proposal",
    label: "Resolution Proposal",
    description: "Proposed settlement terms or resolution framework for an active grievance.",
    icon: <Handshake className="h-5 w-5" />,
    defaultPriority: "high",
    subject: "Proposed Resolution — [Reference]",
    body: `Dear [Recipient Name],

Following our discussions regarding [grievance/case reference], we would like to propose the following resolution:

Proposed Terms:
1. [Insert proposed action / remedy]
2. [Insert timeline for implementation]
3. [Insert conditions, if any]

This proposal is made on a without-prejudice basis and is subject to ratification by the grievant and the union.

We believe this resolution addresses the concerns raised and would welcome a meeting to discuss these terms further.

Please provide your response within [X] business days.

Respectfully,
[Your Name]
[Union Local]`,
  },
  {
    id: "official_notice",
    type: "notice",
    label: "Official Notice",
    description: "Statutory or contractual notice to members, the employer, or third parties.",
    icon: <ScrollText className="h-5 w-5" />,
    defaultPriority: "high",
    subject: "Notice — [Subject]",
    body: `To Whom It May Concern,

Please be advised of the following:

[Describe the subject of the notice]

Effective Date: [Date]

This notice is issued pursuant to [cite the relevant article, bylaw, or regulation].

[Additional details or required actions]

For questions or further information, please contact the undersigned.

Respectfully,
[Your Name]
[Title / Union Local]`,
  },
  {
    id: "investigation_report",
    type: "report",
    label: "Investigation Report",
    description: "Formal report summarizing findings from a workplace investigation or review.",
    icon: <FileText className="h-5 w-5" />,
    defaultPriority: "normal",
    subject: "Investigation Report — [Subject]",
    body: `INVESTIGATION REPORT

Reference: [Case/File Number]
Date: [Date]
Investigator: [Your Name]

1. BACKGROUND
[Describe the circumstances that led to this investigation]

2. METHODOLOGY
[Describe the investigation process: interviews conducted, documents reviewed, timelines]

3. FINDINGS
[Present factual findings organized by issue]

4. ANALYSIS
[Analysis of findings against the collective agreement, policies, or legislation]

5. CONCLUSIONS
[Summary of conclusions]

6. RECOMMENDATIONS
[List recommended actions or remedies]

Submitted by:
[Your Name]
[Title / Union Local]`,
  },
];

const BLANK_TEMPLATE: LetterTemplate = {
  id: "blank",
  type: "letter",
  label: "Blank Letter",
  description: "Start with a clean slate — compose your letter from scratch.",
  icon: <PenLine className="h-5 w-5" />,
  defaultPriority: "normal",
  subject: "",
  body: "",
};

// ── Props ──────────────────────────────────────────────────────────────────

interface NewLetterComposerProps {
  onCreated: () => void;
  onCancel: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function NewLetterComposer({ onCreated, onCancel }: NewLetterComposerProps) {
  const [step, setStep] = useState<"pick" | "compose">("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("letter");
  const [priority, setPriority] = useState("normal");

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
  };

  // ── AI Draft Assist ──────────────────────────────────────────────────────

  const handleAiAssist = async () => {
    if (!subject.trim()) {
      toast.error("Enter a subject first so the AI knows what to draft.");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "draft_response",
          query: `Draft a professional union correspondence letter with the following subject: "${subject}". Type: ${type}. ${body ? `Use this as a starting template and improve it:\n\n${body}` : "Write a complete letter body."}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? "AI service unavailable");
      }

      const json = await res.json();
      const draft = json.data?.response ?? json.data?.content ?? json.data;
      if (typeof draft === "string" && draft.length > 0) {
        setBody(draft);
        toast.success("Draft generated — review and personalize before sending.");
      } else {
        toast.info("AI returned no content. Try adding more detail to your subject.");
      }
    } catch {
      toast.error("Draft assistance is unavailable right now. You can compose manually.");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/correspondence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, type, priority }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? "Failed to create letter");
      }
      toast.success("Letter created as draft.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create letter");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 1: Template Picker ──────────────────────────────────────────────

  if (step === "pick") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Choose a Starting Point</h3>
          <p className="text-sm text-muted-foreground">
            Select a template for your context, or start from a blank letter.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
          {LETTER_TEMPLATES.map((tpl) => (
            <Card
              key={tpl.id}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-sm group"
              onClick={() => handlePickTemplate(tpl)}
            >
              <CardHeader className="pb-2 flex flex-row items-start gap-3">
                <div className="rounded-md bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {tpl.icon}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-medium leading-tight">
                    {tpl.label}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 line-clamp-2">
                    {tpl.description}
                  </CardDescription>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
            </Card>
          ))}

          {/* Blank / From Scratch */}
          <Card
            className="cursor-pointer transition-all hover:border-primary hover:shadow-sm border-dashed group"
            onClick={() => handlePickTemplate(BLANK_TEMPLATE)}
          >
            <CardHeader className="pb-2 flex flex-row items-start gap-3">
              <div className="rounded-md bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-medium leading-tight">
                  Blank Letter
                </CardTitle>
                <CardDescription className="text-xs mt-1 line-clamp-2">
                  Start from scratch — compose freely without a template.
                </CardDescription>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
          </Card>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
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
        <Button variant="ghost" size="icon" onClick={handleBackToTemplates} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">Compose Letter</h3>
          {selectedTemplate && selectedTemplate.id !== "blank" && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">Template:</span>
              <Badge variant="secondary" className="text-xs font-normal">
                {selectedTemplate.label}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="nl-subject">Subject *</Label>
        <Input
          id="nl-subject"
          placeholder="Enter subject line..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      {/* Type & Priority row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nl-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="nl-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letter">Letter</SelectItem>
              <SelectItem value="notice">Notice</SelectItem>
              <SelectItem value="memo">Memo</SelectItem>
              <SelectItem value="demand">Demand</SelectItem>
              <SelectItem value="response">Response</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="agreement">Agreement</SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nl-priority">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="nl-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body with AI assist */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="nl-body">Body *</Label>
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
            {aiLoading ? "Drafting..." : "AI Draft Assist"}
          </Button>
        </div>
        <Textarea
          id="nl-body"
          placeholder="Write your letter content..."
          rows={12}
          className="font-mono text-sm leading-relaxed"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Replace bracketed placeholders (e.g. [Recipient Name]) with actual values before submitting.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          Letter will be saved as a <strong>draft</strong>. You can edit and submit for review later.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || !subject.trim() || !body.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Draft"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
