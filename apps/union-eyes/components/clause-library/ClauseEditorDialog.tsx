"use client";

/**
 * The clause editor: one dialog for adding a clause to the library and for changing one the organization owns.
 *
 * It sends exactly what the library routes accept (POST /api/clause-library, PATCH /api/clause-library/{id}); the server decides who may do either and says why when it
 * refuses, and that message is shown here. A new clause is private to the organization until the sharing controls say otherwise.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CLAUSE_TYPES } from "@/components/clause-library/clause-types";
import { readApiError } from "@/lib/client/api-envelope";

export interface EditableClause {
  id: string;
  clauseNumber?: string | null;
  clauseTitle?: string;
  clauseText?: string;
  clauseType?: string;
}

interface ClauseEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The clause being changed; absent when a clause is being added. */
  clause?: EditableClause | null;
  /** Called after the server accepted the clause, with the id of the clause that was created or changed. */
  onSaved: (clauseId: string | null) => void;
}

export function ClauseEditorDialog({ open, onOpenChange, clause, onSaved }: ClauseEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState<string>("other");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The form starts from the clause being changed, or empty for a new one, each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle(clause?.clauseTitle ?? "");
    setText(clause?.clauseText ?? "");
    setType(clause?.clauseType ?? "other");
    setNumber(clause?.clauseNumber ?? "");
    setError(null);
  }, [open, clause]);

  const valid = title.trim() !== "" && text.trim() !== "";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(clause ? `/api/clause-library/${encodeURIComponent(clause.id)}` : "/api/clause-library", {
        method: clause ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauseTitle: title.trim(), clauseText: text.trim(), clauseType: type, clauseNumber: number.trim() || null }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "The clause could not be saved."));
      const body: unknown = await response.json().catch(() => null);
      const saved = (body as { data?: { clause?: { id?: unknown } } } | null)?.data?.clause?.id;
      onSaved(typeof saved === "string" ? saved : (clause?.id ?? null));
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof TypeError ? "The clause could not be saved. Check the connection and try again." : failure instanceof Error ? failure.message : "The clause could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{clause ? "Edit clause" : "Add clause"}</DialogTitle>
            <DialogDescription>
              {clause ? "Changing a clause records the earlier wording as a version." : "A new clause is private to your organization until you share it."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="clause-title">Title</Label>
            <Input id="clause-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clause-type">Type</Label>
              <select
                id="clause-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CLAUSE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clause-number">Clause number (optional)</Label>
              <Input id="clause-number" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={50} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clause-text">Clause text</Label>
            <Textarea id="clause-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} maxLength={100000} required />
          </div>

          {error && (
            <Alert variant="destructive" data-testid="clause-editor-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? "Saving..." : clause ? "Save changes" : "Add clause"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
