/**
 * Organization Members Component
 * The organization's roster (GET /api/organizations/{id}/members) with search, a role filter and a CSV export of the rows shown.
 * Moving members to another organization is not offered: no authorised route does it.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { generateCSV, type CSVColumn } from "@/lib/csv-export";

/** A roster row exactly as the members route sends it. */
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
  is_primary: boolean | null;
  created_at: string | null;
  joined_at: string | null;
  updated_at: string | null;
}

interface OrganizationMembersProps {
  organizationId: string;
  className?: string;
}

const COPY = {
  en: { loadFailed: "The member list could not be loaded.", retry: "Retry" },
  fr: { loadFailed: "La liste des membres n’a pas pu être chargée.", retry: "Réessayer" },
} as const;

// The route reads a roster one page at a time (at most 200 rows), so the whole roster is the pages up to the first short one.
const PAGE_SIZE = 200;
const MAX_PAGES = 500;

async function fetchRoster(organizationId: string): Promise<Member[]> {
  const roster: Member[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/members?limit=${PAGE_SIZE}&page=${page}`
    );
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    const body: unknown = await response.json();
    const rows = (body as { data?: unknown } | null)?.data;
    if (!Array.isArray(rows)) throw new Error("Unexpected members response");
    roster.push(...(rows as Member[]));
    if (rows.length < PAGE_SIZE) return roster;
  }
  throw new Error("The member list is too long to load");
}

const displayName = (member: Member) => member.name || member.email || member.user_id;
const joinedOn = (member: Member) => member.joined_at ?? member.created_at;

const EXPORT_COLUMNS: CSVColumn<Member>[] = [
  { header: "Name", accessor: (m) => m.name },
  { header: "Email", accessor: (m) => m.email },
  { header: "Role", accessor: (m) => m.role },
  { header: "Status", accessor: (m) => m.status },
  { header: "Department", accessor: (m) => m.department },
  { header: "Membership Number", accessor: (m) => m.membership_number },
  { header: "Joined Date", accessor: (m) => joinedOn(m) },
];

export function OrganizationMembers({ organizationId, className }: OrganizationMembersProps) {
  const copy = useLocale().toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setMembers(await fetchRoster(organizationId));
    } catch (error) {
      logger.error("Failed to load organization members", error);
      setMembers([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = members.filter(member => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      member.email?.toLowerCase().includes(query) ||
      member.name?.toLowerCase().includes(query);
    
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleExport = () => {
    const csv = generateCSV(filteredMembers, EXPORT_COLUMNS);
    
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

  if (loadFailed) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p role="alert" className="text-sm">{copy.loadFailed}</p>
          <Button variant="outline" size="sm" onClick={loadMembers}>
            {copy.retry}
          </Button>
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
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
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
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const joined = joinedOn(member);
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{displayName(member)}</div>
                        {member.name && member.email && (
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
                      {joined ? new Date(joined).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
