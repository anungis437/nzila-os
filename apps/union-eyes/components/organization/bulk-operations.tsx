/**
 * Bulk Operations Component for Organizations
 * Archive/activate, status changes, parent reassignment, export
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

interface BulkOperationsProps {
  selectedIds: string[];
  onSuccess: () => void;
  onClearSelection: () => void;
}

export function BulkOperations({ 
  selectedIds, 
  onSuccess,
  onClearSelection 
}: BulkOperationsProps) {
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showParentDialog, setShowParentDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<OrganizationStatus | "">("");
  const [newParentId, setNewParentId] = useState("");
  const [processing, setProcessing] = useState(false);

  const count = selectedIds.length;

  if (count === 0) return null;

  const handleBulkStatusChange = async () => {
    if (!newStatus) return;
    
    setProcessing(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/organizations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
          })
        )
      );
      
      onSuccess();
      setShowStatusDialog(false);
      setNewStatus("");
    } catch (_err) {
alert("Failed to update organization status");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkParentChange = async () => {
    if (!newParentId) return;
    
    setProcessing(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/organizations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parent_id: newParentId })
          })
        )
      );
      
      onSuccess();
      setShowParentDialog(false);
      setNewParentId("");
    } catch (_err) {
alert("Failed to update organization parent");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Archive ${count} organization(s)? This can be reversed later.`)) return;
    
    setProcessing(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/organizations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "archived" })
          })
        )
      );
      
      onSuccess();
    } catch (_err) {
alert("Failed to archive organizations");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkActivate = async () => {
    setProcessing(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/organizations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "active" })
          })
        )
      );
      
      onSuccess();
    } catch (_err) {
alert("Failed to activate organizations");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportSelected = async () => {
    setProcessing(true);
    try {
      // Fetch details for all selected organizations
      const orgsData = await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/organizations/${id}`).then(r => r.json())
        )
      );
      
      const orgs = orgsData.map(d => d.data);
      
      // Create CSV
      const csv = [
        ["ID", "Name", "Type", "Status", "Parent ID", "Slug", "Created"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...orgs.map((org: any) => [
          org.id,
          org.name,
          org.organization_type,
          org.status,
          org.parent_id || "",
          org.slug || "",
          new Date(org.created_at).toISOString()
        ])
      ].map(row => row.join(",")).join("\n");
      
      // Download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `organizations-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_err) {
alert("Failed to export organizations");
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
              onClick={() => setShowParentDialog(true)}
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
              <Label>New Parent Organization ID</Label>
              <Input
                placeholder="Enter parent organization ID or leave empty for root"
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
              />
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

