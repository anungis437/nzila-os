/**
 * Admin Members Management Console (client component)
 * Rendered by the server-side page wrapper after auth check.
 */
"use client";

import { useState, useEffect } from "react";
import { Users, Download, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import JobClassificationManagement from "@/components/admin/JobClassificationManagement";
import { generateCSV, type CSVColumn } from "@/lib/csv-export";
import { useMembersConsoleData } from "@/lib/hooks/use-members-console-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Organization {
  id: string;
  name: string;
}

interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  membership_number: string | null;
  created_at: string | null;
}

/** Filters members by role (exact match, 'all' = no filter) and a free-text search query. */
export function filterMembers(
  members: Member[],
  { searchQuery, roleFilter }: { searchQuery: string; roleFilter: string },
): Member[] {
  return members.filter((member) => {
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    if (!matchesRole) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(q) ||
      member.email?.toLowerCase().includes(q) ||
      member.role?.toLowerCase().includes(q) ||
      member.membership_number?.toLowerCase().includes(q)
    );
  });
}

/** Builds a CSV string for the given members list (header row + one row per member). Uses the repo's canonical CSV escaping/formula-injection guard (lib/csv-export.ts) — never hand-rolled string joining. */
export function buildMembersExportCsv(members: Member[]): string {
  const columns: CSVColumn<Member>[] = [
    { header: "Name", accessor: (m) => m.name },
    { header: "Email", accessor: (m) => m.email },
    { header: "Role", accessor: (m) => m.role },
    { header: "Status", accessor: (m) => m.status },
    { header: "Department", accessor: (m) => m.department },
    { header: "Membership Number", accessor: (m) => m.membership_number },
  ];
  return generateCSV(members, columns);
}

export default function MembersConsole() {
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteSending, setInviteSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  // Load organizations on mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setIsLoadingOrgs(true);
        setOrgsError(null);
        const response = await fetch('/api/organizations');
        if (!response.ok) {
          throw new Error(`Failed to load organizations (${response.status})`);
        }
        const data = await response.json();
        setOrganizations(data.data || data.organizations || []);
      } catch (error) {
        setOrgsError(error instanceof Error ? error.message : 'Failed to load organizations');
      } finally {
        setIsLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, []);

  const { stats, isLoadingStats, statsError, members, isLoadingMembers, membersError } =
    useMembersConsoleData(selectedOrg, organizations, isLoadingOrgs);

  const currentOrganization = organizations.find((org) => org.id === selectedOrg);

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Enter a valid email to send an invitation.",
        variant: "destructive",
      });
      return;
    }

    try {
      setInviteSending(true);
      const response = await fetch('/api/auth/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: inviteRole,
          organizationName: currentOrganization?.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send invitation');
      }

      toast({
        title: "Invitation sent",
        description: data?.delivery === 'failed'
          ? "Invite created, but email delivery failed. Ask the user to retry later."
          : "User invitation created successfully.",
      });

      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    } catch (error) {
      toast({
        title: "Invitation failed",
        description: error instanceof Error ? error.message : 'Unable to send invitation',
        variant: "destructive",
      });
    } finally {
      setInviteSending(false);
    }
  };

  // Filter members by search query and role
  const filteredMembers = filterMembers(members, { searchQuery, roleFilter });

  // Client-side CSV export of the currently filtered member list — no
  // backend endpoint required (mirrors the proven pattern already used by
  // components/organization/organization-members.tsx's handleExport).
  const handleExportMembers = () => {
    // A partial/failed load (e.g. "All Organizations" with some orgs
    // failing) can still leave a non-empty `members` array — exporting it
    // would produce an incomplete CSV that LOOKS complete. Block export
    // entirely rather than silently ship a partial dataset; the visible
    // error banner above already explains which scope is unavailable.
    if (membersError) {
      toast({
        title: "Export unavailable",
        description: "Member data failed to load for one or more organizations. Export is blocked until the complete dataset loads successfully.",
        variant: "destructive",
      });
      return;
    }

    if (filteredMembers.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No members match the current filters.",
        variant: "destructive",
      });
      return;
    }

    const csv = buildMembersExportCsv(filteredMembers);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `members-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Member Management</h1>
            <p className="text-muted-foreground mt-1">
              Import and manage union members across all organizations
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setInviteOpen(true)}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Invite User
            </Button>
            <Button
              variant="outline"
              onClick={handleExportMembers}
              disabled={!!membersError || isLoadingMembers}
              title={membersError ? "Export unavailable — member data failed to load for one or more organizations." : undefined}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export Members
            </Button>
          </div>
        </div>
      </div>

      {orgsError && (
        <p className="text-sm text-destructive" role="alert">{orgsError}</p>
      )}

      {/* Stats Cards */}
      {statsError && (
        <p className="text-sm text-destructive" role="alert">{statsError}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{isLoadingStats || stats === null ? '…' : stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold text-green-600">{isLoadingStats || stats === null ? '…' : stats.active}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stewards</p>
                <p className="text-2xl font-bold text-purple-600">{isLoadingStats || stats === null ? '…' : stats.stewards}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Officers</p>
                <p className="text-2xl font-bold text-orange-600">{isLoadingStats || stats === null ? '…' : stats.officers}</p>
              </div>
              <Users className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {isLoadingOrgs ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="steward">Steward</SelectItem>
                  <SelectItem value="officer">Officer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member List */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersError && (
            <p className="text-sm text-destructive mb-4" role="alert">{membersError}</p>
          )}
          {isLoadingMembers ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {membersError ? 'Unable to display members due to the error above.' : 'No members found.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Member #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name ?? '—'}</TableCell>
                    <TableCell>{member.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{member.department ?? '—'}</TableCell>
                    <TableCell>{member.membership_number ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vocabulary and Taxonomy</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedOrg === "all" ? (
            <p className="text-sm text-muted-foreground">
              Select a specific organization to manage job classifications and employment taxonomy.
            </p>
          ) : (
            <JobClassificationManagement organizationId={selectedOrg} />
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Send an invitation for the currently active organization context.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@local.org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="steward">Steward</SelectItem>
                  <SelectItem value="officer">Officer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteSending}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite} disabled={inviteSending}>
              {inviteSending ? 'Sending…' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
