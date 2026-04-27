/**
 * Admin Members Management Console (client component)
 * Rendered by the server-side page wrapper after auth check.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Upload, Download, Plus, Search, Filter } from "lucide-react";
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
import { BulkImportMembers } from "@/components/admin/bulk-import-members";
import JobClassificationManagement from "@/components/admin/JobClassificationManagement";
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
import { useToast } from "@/components/ui/use-toast";

interface Organization {
  id: string;
  name: string;
}

interface MemberStats {
  total: number;
  active: number;
  stewards: number;
  officers: number;
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

export default function MembersConsole() {
  const { toast } = useToast();
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteSending, setInviteSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [stats, setStats] = useState<MemberStats>({ total: 0, active: 0, stewards: 0, officers: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [_refreshKey, setRefreshKey] = useState(0);

  // Load organizations on mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setIsLoadingOrgs(true);
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.data || data.organizations || []);
        }
      } catch (error) {
        void error;
      } finally {
        setIsLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, []);

  // Fetch stats (all or filtered by org)
  const fetchStats = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const url = selectedOrg === "all"
        ? '/api/admin/members/stats'
        : `/api/admin/members/stats?organizationId=${selectedOrg}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      void error;
    } finally {
      setIsLoadingStats(false);
    }
  }, [selectedOrg]);

  // Fetch members list
  const fetchMembers = useCallback(async () => {
    if (selectedOrg === "all") {
      // Fetch from all orgs
      try {
        setIsLoadingMembers(true);
        const allMembers: Member[] = [];
        for (const org of organizations) {
          const response = await fetch(`/api/organizations/${org.id}/members`);
          if (response.ok) {
            const data = await response.json();
            allMembers.push(...(data.data || []));
          }
        }
        setMembers(allMembers);
      } catch (error) {
        void error;
      } finally {
        setIsLoadingMembers(false);
      }
    } else {
      try {
        setIsLoadingMembers(true);
        const response = await fetch(`/api/organizations/${selectedOrg}/members`);
        if (response.ok) {
          const data = await response.json();
          setMembers(data.data || []);
        }
      } catch (error) {
        void error;
      } finally {
        setIsLoadingMembers(false);
      }
    }
  }, [selectedOrg, organizations]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!isLoadingOrgs) {
      fetchMembers();
    }
  }, [fetchMembers, isLoadingOrgs]);

  // Function to trigger member list refresh
  const refreshMemberList = () => {
    setRefreshKey(prev => prev + 1);
    fetchStats();
    fetchMembers();
  };

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

  // Filter members by search query
  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(q) ||
      member.email?.toLowerCase().includes(q) ||
      member.role?.toLowerCase().includes(q) ||
      member.membership_number?.toLowerCase().includes(q)
    );
  });

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
              onClick={() => setBulkImportOpen(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Bulk Import Members
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Member
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{isLoadingStats ? '…' : stats.total}</p>
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
                <p className="text-2xl font-bold text-green-600">{isLoadingStats ? '…' : stats.active}</p>
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
                <p className="text-2xl font-bold text-purple-600">{isLoadingStats ? '…' : stats.stewards}</p>
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
                <p className="text-2xl font-bold text-orange-600">{isLoadingStats ? '…' : stats.officers}</p>
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
              <Select defaultValue="all">
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="justify-start gap-2 h-auto py-4"
              onClick={() => setBulkImportOpen(true)}
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="font-semibold">Bulk Import</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Import members from CSV/Excel file
                </span>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start gap-2 h-auto py-4"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span className="font-semibold">Export Members</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Download member list as CSV
                </span>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start gap-2 h-auto py-4"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Member Reports</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  View membership analytics
                </span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Member List */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members found.
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

      {/* Bulk Import Dialog */}
      <BulkImportMembers
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={() => {
          setBulkImportOpen(false);
          refreshMemberList();
        }}
      />

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
