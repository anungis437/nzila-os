"use client";

/**
 * One letter of the correspondence pipeline: its details, its recipients, its history, and the next step the person may take.
 *
 * The pipeline is draft → pending review → approved → signed → dispatched. What is offered here mirrors the routes' own rules (actionsFor); the server
 * still decides, and when it refuses, its reason is shown as it states it. Nothing is assumed to have happened until the route accepted it: the letter
 * is read again afterwards, and what the dialog then shows is what the server holds.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiShapeError, readApiError } from "@/lib/client/api-envelope";
import { renderTypedSignature } from "@/lib/correspondence/typed-signature";
import {
  DISPATCH_METHODS,
  actionsFor,
  readCorrespondenceDetail,
  readSignatures,
  type CorrespondenceDetail,
  type DispatchMethod,
  type SavedSignature,
  type Viewer,
} from "./correspondence-readers";

const TYPES = ["letter", "notice", "memo", "demand", "response", "proposal", "agreement", "report", "other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const FIELD = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

type LoadState =
  | { status: "loading" }
  | { status: "failed"; reason: "server"; message: string }
  | { status: "failed"; reason: "unexpected" | "generic" }
  | { status: "ready"; letter: CorrespondenceDetail };

type Done = "saved" | "claimed" | "submitted" | "approved" | "revisionRequested" | "cancelled" | "reopened" | "signed" | "dispatched" | "signatureSaved";
type ReasonFor = "revision" | "cancel" | "reopen";

interface Props {
  /** The letter to show; null keeps the dialog closed. */
  letterId: string | null;
  viewer: Viewer;
  onClose: () => void;
  /** Called after the server accepted a change, so the list behind the dialog is read again. */
  onChanged: () => void;
}

export function CorrespondenceDetailDialog({ letterId, viewer, onClose, onChanged }: Props) {
  return (
    <Dialog open={letterId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {letterId !== null && <LetterView key={letterId} letterId={letterId} viewer={viewer} onChanged={onChanged} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function LetterView({ letterId, viewer, onChanged, onClose }: { letterId: string; viewer: Viewer; onChanged: () => void; onClose: () => void }) {
  const t = useTranslations("correspondencePage");
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const when = (value: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/correspondence/${encodeURIComponent(letterId)}`, { cache: "no-store" });
      if (!response.ok) {
        const message = await readApiError(response, "");
        setState(message ? { status: "failed", reason: "server", message } : { status: "failed", reason: "generic" });
        return;
      }
      setState({ status: "ready", letter: readCorrespondenceDetail(await response.json()) });
    } catch (failure) {
      setState({ status: "failed", reason: failure instanceof ApiShapeError ? "unexpected" : "generic" });
    }
  }, [letterId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Sends one change to the server; true when it was accepted and the letter was read again. */
  const send = async (outcome: Done, path: string, method: "POST" | "PATCH", payload?: unknown): Promise<boolean> => {
    setWorking(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch(`/api/correspondence/${encodeURIComponent(letterId)}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await readApiError(response, t("actions.failed")));
        return false;
      }
      setDone(outcome);
      await load();
      onChanged();
      return true;
    } catch {
      setError(t("actions.unreachable"));
      return false;
    } finally {
      setWorking(false);
    }
  };

  if (state.status === "loading") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("detail.title")}</DialogTitle>
          <DialogDescription>{t("detail.loading")}</DialogDescription>
        </DialogHeader>
      </>
    );
  }

  if (state.status === "failed") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("detail.title")}</DialogTitle>
          <DialogDescription>{t("detail.description")}</DialogDescription>
        </DialogHeader>
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {state.reason === "server" ? state.message : state.reason === "unexpected" ? t("detail.unexpected") : t("detail.loadFailed")}
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("detail.close")}
          </Button>
        </div>
      </>
    );
  }

  const { letter } = state;
  const actions = actionsFor(letter, viewer);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{letter.subject}</DialogTitle>
        <DialogDescription>{letter.referenceNumber ?? t("detail.description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={letter.status === "cancelled" || letter.status === "returned" ? "destructive" : "default"}>{t(`status.${letter.status}`)}</Badge>
        <Badge variant="outline">{t(`priority.${letter.priority}`)}</Badge>
        <Badge variant="outline">{t(`type.${letter.type}`)}</Badge>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Fact label={t("detail.created")} value={when(letter.createdAt)} />
        <Fact label={t("detail.updated")} value={when(letter.updatedAt)} />
        <Fact
          label={t("detail.signer")}
          value={letter.assignedSignerId === null ? t("detail.signerNone") : letter.assignedSignerId === viewer.userId ? t("detail.signerYou") : t("detail.signerAssigned")}
        />
        {letter.approvedAt && <Fact label={t("detail.approvedOn")} value={when(letter.approvedAt)} />}
        {letter.signedAt && <Fact label={t("detail.signedOn")} value={when(letter.signedAt)} />}
        {letter.dispatchedAt && (
          <Fact
            label={t("detail.dispatchedOn")}
            value={`${when(letter.dispatchedAt)}${letter.dispatchMethod ? ` (${methodLabel(t, letter.dispatchMethod)})` : ""}`}
          />
        )}
      </dl>

      <section aria-labelledby="letter-body-heading" className="space-y-2">
        <h3 id="letter-body-heading" className="text-sm font-semibold">
          {t("detail.bodyTitle")}
        </h3>
        <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{letter.body}</div>
      </section>

      {letter.internalNotes && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">{t("detail.internalNotes")}</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{letter.internalNotes}</p>
        </section>
      )}

      <section aria-labelledby="letter-recipients-heading" className="space-y-2">
        <h3 id="letter-recipients-heading" className="text-sm font-semibold">
          {t("detail.recipientsTitle")}
        </h3>
        {letter.recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noRecipients")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {letter.recipients.map((recipient) => (
              <li key={recipient.id}>
                <span className="text-muted-foreground">{recipientKind(t, recipient.kind)}</span> {recipient.name}
                {recipient.organization ? `, ${recipient.organization}` : ""}
                {recipient.email ? ` <${recipient.email}>` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="letter-history-heading" className="space-y-2">
        <h3 id="letter-history-heading" className="text-sm font-semibold">
          {t("detail.historyTitle")}
        </h3>
        {letter.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noHistory")}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {letter.history.map((entry) => (
              <li key={entry.id}>
                <span className="text-muted-foreground">{when(entry.at)}</span> {eventLabel(t, entry.event)}
                {entry.actorName ? ` — ${entry.actorName}${entry.actorRole ? ` (${entry.actorRole})` : ""}` : ""}
                {reasonOf(entry) ? `: ${reasonOf(entry)}` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="letter-actions-heading" className="space-y-3 border-t pt-4">
        <h3 id="letter-actions-heading" className="text-sm font-semibold">
          {t("actions.heading")}
        </h3>
        {error && (
          <Alert variant="destructive" role="alert" data-testid="correspondence-action-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {done && (
          <p role="status" className="text-sm text-green-700">
            {t(`actions.done.${done}`)}
          </p>
        )}
        <NextStep letter={letter} actions={actions} viewer={viewer} working={working} send={send} onSignatureSaved={() => setDone("signatureSaved")} />
      </section>
    </>
  );
}

type Translate = ReturnType<typeof useTranslations>;

const KNOWN_EVENTS = new Set([
  "created", "edited", "submitted_for_review", "review_requested", "approved", "revision_requested", "signed", "signature_affixed", "dispatched",
  "delivered", "returned", "cancelled", "recipient_added", "recipient_removed", "attachment_added", "attachment_removed", "template_applied", "reassigned", "viewed",
]);

const eventLabel = (t: Translate, event: string): string => (KNOWN_EVENTS.has(event) ? t(`detail.event.${event}`) : event.replace(/_/g, " "));

/** The reason a person gave when they sent a letter back or cancelled it: the trail records it after the event's own wording ("Cancelled: <reason>"). */
function reasonOf(entry: { event: string; description: string | null }): string | null {
  if ((entry.event !== "revision_requested" && entry.event !== "cancelled") || !entry.description) return null;
  const at = entry.description.indexOf(": ");
  return at === -1 ? null : entry.description.slice(at + 2);
}
const recipientKind = (t: Translate, kind: string): string => (kind === "to" || kind === "cc" || kind === "bcc" ? t(`detail.recipientKind.${kind}`) : kind);
const methodLabel = (t: Translate, method: string): string =>
  (DISPATCH_METHODS as readonly string[]).includes(method) ? t(`actions.dispatchMethods.${method as DispatchMethod}`) : method.replace(/_/g, " ");

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

interface NextStepProps {
  letter: CorrespondenceDetail;
  actions: ReturnType<typeof actionsFor>;
  viewer: Viewer;
  working: boolean;
  send: (outcome: Done, path: string, method: "POST" | "PATCH", payload?: unknown) => Promise<boolean>;
  onSignatureSaved: () => void;
}

function NextStep({ letter, actions, viewer, working, send, onSignatureSaved }: NextStepProps) {
  const t = useTranslations("correspondencePage");
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(letter.subject);
  const [body, setBody] = useState(letter.body);
  const [type, setType] = useState(letter.type);
  const [priority, setPriority] = useState(letter.priority);
  const [reasonFor, setReasonFor] = useState<ReasonFor | null>(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<DispatchMethod>("email");

  const reasonValid = reason.trim().length >= 3;
  const reasonRoute: Record<ReasonFor, { path: string; outcome: Done }> = {
    revision: { path: "/revision", outcome: "revisionRequested" },
    cancel: { path: "/cancel", outcome: "cancelled" },
    reopen: { path: "/revision", outcome: "reopened" },
  };

  const sendReason = async () => {
    if (!reasonFor || !reasonValid) return;
    const route = reasonRoute[reasonFor];
    if (await send(route.outcome, route.path, "POST", { reason: reason.trim() })) {
      setReasonFor(null);
      setReason("");
    }
  };

  const saveEdit = async () => {
    if (await send("saved", "", "PATCH", { subject: subject.trim(), body, type, priority })) setEditing(false);
  };

  const nothingToDo = !Object.values(actions).some(Boolean);

  const startEdit = () => {
    setSubject(letter.subject);
    setBody(letter.body);
    setType(letter.type);
    setPriority(letter.priority);
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="letter-subject">{t("actions.subject")}</Label>
          <Input id="letter-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="letter-type">{t("detail.typeLabel")}</Label>
            <select id="letter-type" value={type} onChange={(e) => setType(e.target.value)} className={FIELD}>
              {TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`type.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="letter-priority">{t("detail.priorityLabel")}</Label>
            <select id="letter-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={FIELD}>
              {PRIORITIES.map((option) => (
                <option key={option} value={option}>
                  {t(`priority.${option}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="letter-body">{t("actions.body")}</Label>
          <Textarea id="letter-body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={saveEdit} disabled={working || subject.trim().length < 3 || body.trim() === ""}>
            {working ? t("actions.working") : t("actions.saveEdit")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={working}>
            {t("actions.cancelEdit")}
          </Button>
        </div>
      </div>
    );
  }

  if (reasonFor) {
    return (
      <div className="space-y-3">
        <Label htmlFor="letter-reason">{t("actions.reasonLabel")}</Label>
        <Textarea id="letter-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} />
        <p className="text-xs text-muted-foreground">{t("actions.reasonHint")}</p>
        <div className="flex gap-2">
          <Button type="button" variant={reasonFor === "cancel" ? "destructive" : "default"} onClick={sendReason} disabled={working || !reasonValid}>
            {working ? t("actions.working") : t("actions.confirm")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setReasonFor(null)} disabled={working}>
            {t("actions.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {nothingToDo && <p className="text-sm text-muted-foreground">{t("actions.none")}</p>}

      {letter.status === "draft" && letter.assignedSignerId === null && (
        <p className="text-sm text-muted-foreground">{viewer.canSign ? t("actions.signerNeeded") : t("actions.signerNeededAskOfficer")}</p>
      )}

      {letter.status === "approved" && !actions.sign && <p className="text-sm text-muted-foreground">{t("actions.waitingForSigner")}</p>}

      {actions.sign && <SignStep letterWorking={working} send={send} onSignatureSaved={onSignatureSaved} />}

      {actions.dispatch && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="letter-dispatch-method">{t("actions.dispatchMethod")}</Label>
            <select id="letter-dispatch-method" value={method} onChange={(e) => setMethod(e.target.value as DispatchMethod)} className={FIELD}>
              {DISPATCH_METHODS.map((option) => (
                <option key={option} value={option}>
                  {t(`actions.dispatchMethods.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={() => send("dispatched", "/dispatch", "POST", { dispatchMethod: method })} disabled={working}>
            {working ? t("actions.working") : t("actions.dispatch")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.submit && (
          <Button type="button" onClick={() => send("submitted", "/submit", "POST")} disabled={working}>
            {t("actions.submit")}
          </Button>
        )}
        {actions.claimSigner && (
          <Button type="button" variant="outline" onClick={() => send("claimed", "", "PATCH", { assignedSignerId: viewer.userId })} disabled={working}>
            {t("actions.claimSigner")}
          </Button>
        )}
        {actions.approve && (
          <Button type="button" onClick={() => send("approved", "/approve", "POST")} disabled={working}>
            {t("actions.approve")}
          </Button>
        )}
        {actions.edit && (
          <Button type="button" variant="outline" onClick={startEdit} disabled={working}>
            {t("actions.edit")}
          </Button>
        )}
        {actions.requestRevision && (
          <Button type="button" variant="outline" onClick={() => setReasonFor("revision")} disabled={working}>
            {t("actions.requestRevision")}
          </Button>
        )}
        {actions.reopen && (
          <Button type="button" variant="outline" onClick={() => setReasonFor("reopen")} disabled={working}>
            {t("actions.reopen")}
          </Button>
        )}
        {actions.cancel && (
          <Button type="button" variant="outline" onClick={() => setReasonFor("cancel")} disabled={working}>
            {t("actions.cancelLetter")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The signer's step: sign with a saved signature, or make one from a typed name first. */
function SignStep({ letterWorking, send, onSignatureSaved }: { letterWorking: boolean; send: NextStepProps["send"]; onSignatureSaved: () => void }) {
  const t = useTranslations("correspondencePage");
  const [signatures, setSignatures] = useState<SavedSignature[] | null>(null);
  const [failure, setFailure] = useState<{ reason: "server"; message: string } | { reason: "unexpected" | "generic" } | null>(null);
  const [chosen, setChosen] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSignatures = useCallback(async () => {
    setFailure(null);
    try {
      const response = await fetch("/api/correspondence/signatures", { cache: "no-store" });
      if (!response.ok) {
        const message = await readApiError(response, "");
        setFailure(message ? { reason: "server", message } : { reason: "generic" });
        return;
      }
      const list = readSignatures(await response.json());
      setSignatures(list);
      setChosen((current) => (list.some((item) => item.id === current) ? current : (list.find((item) => item.isDefault) ?? list[0])?.id ?? ""));
    } catch (error) {
      setFailure({ reason: error instanceof ApiShapeError ? "unexpected" : "generic" });
    }
  }, []);

  useEffect(() => {
    void loadSignatures();
  }, [loadSignatures]);

  const saveSignature = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const image = await renderTypedSignature(name);
      const response = await fetch("/api/correspondence/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), displayTitle: title.trim() || undefined, source: "typed", ...image }),
      });
      if (!response.ok) {
        const message = await readApiError(response, "");
        setFailure(message ? { reason: "server", message } : { reason: "generic" });
        return;
      }
      setName("");
      setTitle("");
      onSignatureSaved();
      await loadSignatures();
    } catch {
      setFailure({ reason: "generic" });
    } finally {
      setSaving(false);
    }
  };

  if (failure) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>
          {failure.reason === "server" ? failure.message : failure.reason === "unexpected" ? t("detail.unexpected") : t("actions.unreachable")}
        </AlertDescription>
      </Alert>
    );
  }
  if (signatures === null) return <p className="text-sm text-muted-foreground">{t("actions.loadingSignatures")}</p>;

  if (signatures.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("actions.noSignature")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="signature-name">{t("actions.signatureName")}</Label>
            <Input id="signature-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="signature-title">{t("actions.signatureTitle")}</Label>
            <Input id="signature-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
          </div>
        </div>
        <Button type="button" onClick={saveSignature} disabled={saving || name.trim() === ""}>
          {saving ? t("actions.working") : t("actions.saveSignature")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="letter-signature">{t("actions.chooseSignature")}</Label>
        <select id="letter-signature" value={chosen} onChange={(e) => setChosen(e.target.value)} className={FIELD}>
          {signatures.map((signature) => (
            <option key={signature.id} value={signature.id}>
              {signature.displayTitle ? `${signature.displayName} — ${signature.displayTitle}` : signature.displayName}
            </option>
          ))}
        </select>
      </div>
      <Button type="button" onClick={() => send("signed", "/sign", "POST", { signatureId: chosen })} disabled={letterWorking || chosen === ""}>
        {letterWorking ? t("actions.working") : t("actions.sign")}
      </Button>
    </div>
  );
}
