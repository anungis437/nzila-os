"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Calendar, Mail, Badge as BadgeIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Committee {
  id: string;
  name: string;
  committeeType: string;
  status: string;
  isOrganizationWide: boolean;
  unitName?: string | null;
  worksiteName?: string | null;
  currentMemberCount: number;
  maxMembers: number | null;
  meetingFrequency: string | null;
  contactEmail: string | null;
}

const typeLabels: Record<string, string> = {
  bargaining: "Bargaining",
  grievance: "Grievance",
  health_safety: "Health & Safety",
  education: "Education",
  political_action: "Political Action",
  social: "Social & Recreation",
  communications: "Communications",
  finance: "Finance",
  bylaws: "Bylaws",
  membership: "Membership",
  pension_benefits: "Pension & Benefits",
  other: "Other",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  forming: "bg-blue-500",
  dissolved: "bg-red-500",
};

export function MyCommittees({ organizationId }: { organizationId: string }) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCommittees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/committees?organizationId=${organizationId}`
      );
      if (!res.ok) throw new Error("Failed to load committees");
      const json = await res.json();
      const items = json?.data?.data ?? json?.data ?? json ?? [];
      setCommittees(Array.isArray(items) ? items : []);
    } catch {
      setError("Unable to load committees.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchCommittees();
  }, [fetchCommittees]);

  const filtered = committees.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.committeeType.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Committees
        </CardTitle>
        <CardDescription>
          Committees you belong to and their current status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search committees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Users className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "No committees match your search"
                : "No committees found"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Committee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Meetings
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Contact
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    <BadgeIcon className="h-3 w-3" /> Status
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((committee) => (
                <TableRow key={committee.id}>
                  <TableCell className="font-medium">
                    {committee.name}
                  </TableCell>
                  <TableCell>
                    {typeLabels[committee.committeeType] ??
                      committee.committeeType}
                  </TableCell>
                  <TableCell>
                    {committee.isOrganizationWide
                      ? "Organization-wide"
                      : committee.unitName ||
                        committee.worksiteName ||
                        "—"}
                  </TableCell>
                  <TableCell>
                    {committee.currentMemberCount}
                    {committee.maxMembers
                      ? ` / ${committee.maxMembers}`
                      : ""}
                  </TableCell>
                  <TableCell>
                    {committee.meetingFrequency || "—"}
                  </TableCell>
                  <TableCell>{committee.contactEmail || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${statusColors[committee.status] ?? "bg-gray-400"} text-white`}
                    >
                      {committee.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
