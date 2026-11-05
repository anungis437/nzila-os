/**
 * Bulk Operations Component for Organizations
 * Archive/activate, status changes, parent reassignment, export
 *
 * Every change is one PATCH /api/organizations/{id} per selected organization, and each answers for itself: a status or parent change is refused (403)
 * unless the caller holds platform governance, a move can be refused (unknown parent, a cycle), a slug can clash. A call that did not succeed is
 * counted and reported with the route's reason; the bar says "updated" only for the organizations the route said it updated.
 * The export reads each organization from GET /api/organizations/{id} (plain { data: organization }) and writes no file unless every one was read.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Archive,
  CheckCircle,
  X,
  Loader2,
  Download,
  FolderTree,
  AlertCircle
} from "lucide-react";
import type { OrganizationStatus } from "@/types/organization";
import { generateCSV, type CSVColumn } from "@/lib/csv-export";
import { isRecord, readApiError } from "@/lib/client/api-envelope";
import { ApiShapeError, asRecord, optionalString, requiredString } from "@/lib/client/row-fields";

interface BulkOperationsProps {
  selectedIds: string[];
  onSuccess: () => void;
  onClearSelection: () => void;
}

interface Outcome {
  error: string | null;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const plural = (count: number) => `${count} organization${count === 1 ? "" : "s"}`;
const reasonOf = (error: unknown) => (error instanceof Error && error.message ? error.message : "The request failed");

/** One change to one organization: null when the route accepted it, else why it did not. */
async function patchOrganization(id: string, body: Record<string, unknown>): Promise<Outcome> {
  try {
    const response = await fetch(`/api/organizations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { error: null };
    return { error: await readApiError(response, `Request failed with status ${response.status}`) };
  } catch (error) {
    return { error: reasonOf(error) };
  }
}

interface OrganizationRow {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  parentId: string | null;
  slug: string | null;
  createdAt: string | null;
}

/** The route answers plain JSON { data: organization } with the column names of the organizations table. */
async function readOrganization(id: string): Promise<OrganizationRow> {
  const response = await fetch(`/api/organizations/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(await readApiError(response, `Request failed with status ${response.status}`));
  const body: unknown = await response.json();
  if (!isRecord(body)) throw new ApiShapeError("no organization");
  const row = asRecord(body.data, "organization");
  const created = optionalString(row, "created_at");
  if (created !== null && Number.isNaN(new Date(created).getTime())) throw new ApiShapeError("created_at is not a date");
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    type: optionalString(row, "organization_type"),
    status: optionalString(row, "status"),
    parentId: optionalString(row, "parent_id"),
    slug: optionalString(row, "slug"),
    createdAt: created === null ? null : new Date(created).toISOString(),
  };
}

const EXPORT_COLUMNS: CSVColumn<OrganizationRow>[] = [
  { header: "ID", accessor: (org) => org.id },
  { header: "Name", accessor: (org) => org.name },
  { header: "Type", accessor: (org) => org.type },
  { header: "Status", accessor: (org) => org.status },
  { header: "Parent ID", accessor: (org) => org.parentId },
  { header: "Slug", accessor: (org) => org.slug },
  { header: "Created", accessor: (org) => org.createdAt },
];

function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function BulkOperations({
  selectedIds,
  onSuccess,
  onClearSelection
}: BulkOperationsProps) {
  const { toast } = useToast();
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showParentDialog, setShowParentDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<OrganizationStatus | "">("");
  const [newParentId, setNewParentId] = useState("");
  const [parentError, setParentError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const count = selectedIds.length;

  if (count === 0) return null;

  /**
   * Applies one change to every selected organization and says how many it was applied to. Returns whether any was changed, so the caller
   * can close its dialog: a change that nobody accepted leaves the dialog open, with the reason in the toast.
   */
  const applyToSelected = async (body: Record<string, unknown>, done: string): Promise<boolean> => {
    setProcessing(true);
    try {
      const outcomes = await Promise.all(selectedIds.map((id) => patchOrganization(id, body)));
      const reasons = Array.from(new Set(outcomes.flatMap((outcome) => (outcome.error === null ? [] : [outcome.error]))));
      const changed = outcomes.length - outcomes.filter((outcome) => outcome.error !== null).length;

      if (reasons.length === 0) {
        toast({ title: `${plural(changed)} ${done}` });
      } else {
        toast({
          title: changed === 0 ? `No organization was ${done}` : `${plural(changed)} ${done}; ${outcomes.length - changed} could not be`,
          description: reasons.join("; "),
          variant: "destructive",
        });
      }
      if (changed > 0) onSuccess();
      return changed > 0;
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (!newStatus) return;
    if (await applyToSelected({ status: newStatus }, `set to ${newStatus}`)) {
      setShowStatusDialog(false);
      setNewStatus("");
    }
  };

  const handleBulkParentChange = async () => {
    const parentId = newParentId.trim();
    if (parentId !== "" && !GUID.test(parentId)) {
      setParentError("A parent organization ID is a UUID, such as 3f2b1c9e-7d4a-4e1b-9c55-0a6b8d2f1e33.");
      return;
    }
    setParentError(null);
    // An empty field is the root level, as the dialog says.
    if (await applyToSelected({ parent_id: parentId === "" ? null : parentId }, parentId === "" ? "moved to the root level" : "moved")) {
      setShowParentDialog(false);
      setNewParentId("");
    }
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Archive ${count} organization(s)? This can be reversed later.`)) return;
    await applyToSelected({ status: "archived" }, "archived");
  };

  const handleBulkActivate = async () => {
    await applyToSelected({ status: "active" }, "activated");
  };

  const handleExportSelected = async () => {
    setProcessing(true);
    try {
      const reads = await Promise.allSettled(selectedIds.map(readOrganization));
      const failures = reads.flatMap((read) => (read.status === "rejected" ? [reasonOf(read.reason)] : []));
      if (failures.length > 0) {
        // A file with some of the organizations missing would pass for the whole selection, so none is written.
        toast({
          title: `${plural(failures.length)} could not be read, so nothing was exported`,
          description: Array.from(new Set(failures)).join("; "),
          variant: "destructive",
        });
        return;
      }
      const orgs = reads.flatMap((read) => (read.status === "fulfilled" ? [read.value] : []));
      downloadCsv(generateCSV(orgs, EXPORT_COLUMNS), `organizations-export-${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: `Exported ${plural(orgs.length)}` });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{count} selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowStatusDialog(true)}
              disabled={processing}
            >
              Change Status
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setParentError(null);
                setShowParentDialog(true);
              }}
              disabled={processing}
            >
              <FolderTree className="w-4 h-4 mr-2" />
              Move
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkActivate}
              disabled={processing}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Activate
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkArchive}
              disabled={processing}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSelected}
              disabled={processing}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Button
              variant="ghost"
              size="sm"
              aria-label="Clear selection"
              onClick={onClearSelection}
              disabled={processing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {processing && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update the status for {count} selected organization{count !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrganizationStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkStatusChange}
              disabled={!newStatus || processing}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parent Change Dialog */}
      <Dialog open={showParentDialog} onOpenChange={setShowParentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Organizations</DialogTitle>
            <DialogDescription>
              Change the parent organization for {count} selected organization{count !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-parent-id">New Parent Organization ID</Label>
              <Input
                id="bulk-parent-id"
                placeholder="Enter parent organization ID or leave empty for root"
                value={newParentId}
                aria-invalid={parentError !== null}
                onChange={(e) => {
                  setNewParentId(e.target.value);
                  setParentError(null);
                }}
              />
              {parentError && (
                <p role="alert" className="text-xs text-destructive">
                  {parentError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty to move organizations to the root level
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowParentDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkParentChange}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : newParentId.trim() === "" ? (
                "Move to Root Level"
              ) : (
                "Move Organizations"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
