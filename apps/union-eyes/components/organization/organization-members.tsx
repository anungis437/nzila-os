/**
 * Organization Members Management Component
 * Assign members, bulk transfers, cross-org search, and member analytics
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
 
import {
  Users,
  Search,
  ArrowRight,
  Loader2,
  AlertCircle,
  Download,
  Filter as _Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  joinedAt: string;
  organizationId: string;
  organizationName?: string;
}

interface OrganizationMembersProps {
  organizationId: string;
  className?: string;
}

export function OrganizationMembers({ organizationId, className }: OrganizationMembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTargetOrg, setTransferTargetOrg] = useState<string>("");
  const [transferring, setTransferring] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`);
      if (!response.ok) throw new Error("Failed to load members");
      
      const data = await response.json();
      setMembers(data.data || []);
    } catch (_err) {
} finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = members.filter(member => {
    const matchesSearch = !searchQuery || 
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const toggleMemberSelection = (memberId: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const toggleAllMembers = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const handleBulkTransfer = async () => {
    if (!transferTargetOrg || selectedMembers.size === 0) return;
    
    setTransferring(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/bulk-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: Array.from(selectedMembers),
          targetOrganizationId: transferTargetOrg
        })
      });
      
      if (!response.ok) throw new Error("Transfer failed");
      
      await loadMembers();
      setSelectedMembers(new Set());
      setShowTransferDialog(false);
      setTransferTargetOrg("");
    } catch (_err) {
alert("Failed to transfer members");
    } finally {
      setTransferring(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Email", "First Name", "Last Name", "Role", "Status", "Joined Date"],
      ...filteredMembers.map(m => [
        m.email,
        m.firstName || "",
        m.lastName || "",
        m.role,
        m.status,
        new Date(m.joinedAt).toLocaleDateString()
      ])
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${organizationId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Organization Members
            </CardTitle>
            <CardDescription>
              {members.length} total members
              {selectedMembers.size > 0 && ` â€¢ ${selectedMembers.size} selected`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            {selectedMembers.size > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowTransferDialog(true)}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Transfer ({selectedMembers.size})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="steward">Steward</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Members Table */}
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No members found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedMembers.size === filteredMembers.length}
                    onCheckedChange={toggleAllMembers}
                  />
                </TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedMembers.has(member.id)}
                      onCheckedChange={() => toggleMemberSelection(member.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {member.firstName || member.lastName 
                          ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                          : member.email
                        }
                      </div>
                      {(member.firstName || member.lastName) && (
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={cn(
                        member.status === "active" && "border-green-500 text-green-700",
                        member.status === "inactive" && "border-gray-500 text-gray-700"
                      )}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Members</DialogTitle>
            <DialogDescription>
              Transfer {selectedMembers.size} selected member{selectedMembers.size !== 1 ? "s" : ""} to another organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Organization</label>
              <Input
                placeholder="Enter organization ID or search..."
                value={transferTargetOrg}
                onChange={(e) => setTransferTargetOrg(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Members will be transferred to the specified organization
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowTransferDialog(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBulkTransfer}
              disabled={!transferTargetOrg || transferring}
            >
              {transferring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

