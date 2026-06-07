"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Download, GitCompare, FileText, Calendar, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AccessLog {
  id: string;
  resource_type: string;
  resource_id: string;
  access_type: string;
  accessed_at: string;
  ip_address: string;
  user_agent: string;
  user: {
    id: string;
    email: string;
    full_name: string;
  };
  user_org: {
    id: string;
    name: string;
    type: string;
  };
  resource_owner_org: {
    id: string;
    name: string;
    type: string;
  };
}

interface AccessLogViewerProps {
  organizationId: string;
}

export default function AccessLogViewer({ organizationId }: AccessLogViewerProps) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    resourceType: "all",
    accessType: "all",
    fromDate: "",
    toDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccessLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (filters.resourceType !== "all") {
        params.append("resourceType", filters.resourceType);
      }
      if (filters.accessType !== "all") {
        params.append("accessType", filters.accessType);
      }
      if (filters.fromDate) {
        params.append("fromDate", filters.fromDate);
      }
      if (filters.toDate) {
        params.append("toDate", filters.toDate);
      }

      const response = await fetch(
        `/api/organizations/${organizationId}/access-logs?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch access logs");
      }

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, pagination.page, filters]);

  const getAccessTypeIcon = (accessType: string) => {
    switch (accessType) {
      case "view":
        return <Eye className="h-4 w-4" />;
      case "download":
        return <Download className="h-4 w-4" />;
      case "compare":
        return <GitCompare className="h-4 w-4" />;
      case "cite":
        return <FileText className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getAccessTypeBadge = (accessType: string) => {
    const colors: Record<string, string> = {
      view: "bg-blue-100 text-blue-700",
      download: "bg-green-100 text-green-700",
      compare: "bg-purple-100 text-purple-700",
      cite: "bg-orange-100 text-orange-700",
      search: "bg-gray-100 text-gray-700",
    };

    return (
      <Badge variant="secondary" className={colors[accessType] || ""}>
        {accessType}
      </Badge>
    );
  };

  const getResourceTypeBadge = (resourceType: string) => {
    const colors: Record<string, string> = {
      clause: "bg-blue-100 text-blue-700",
      precedent: "bg-purple-100 text-purple-700",
      analytics: "bg-green-100 text-green-700",
      document: "bg-orange-100 text-orange-700",
    };

    return (
      <Badge variant="outline" className={colors[resourceType] || ""}>
        {resourceType}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Accesses</CardDescription>
              <CardTitle className="text-3xl">{stats.totalAccesses}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Unique Organizations</CardDescription>
              <CardTitle className="text-3xl">{stats.uniqueOrganizations}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Most Common Access</CardDescription>
              <CardTitle className="text-xl">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {Object.entries(stats.byAccessType || {}).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || "N/A"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Most Accessed Type</CardDescription>
              <CardTitle className="text-xl">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {Object.entries(stats.byResourceType || {}).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || "N/A"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Access Logs</CardTitle>
          <CardDescription>
            Track all cross-organization access to your shared resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resource Type</label>
              <Select
                value={filters.resourceType}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, resourceType: value }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="clause">Clause</SelectItem>
                  <SelectItem value="precedent">Precedent</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Access Type</label>
              <Select
                value={filters.accessType}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, accessType: value }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="compare">Compare</SelectItem>
                  <SelectItem value="cite">Cite</SelectItem>
                  <SelectItem value="search">Search</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={() => {
              setFilters({ resourceType: "all", accessType: "all", fromDate: "", toDate: "" });
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}>
              Clear Filters
            </Button>
          </div>

          <Separator className="my-4" />

          {/* Access Logs Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading access logs...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No access logs found
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Access Type</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {formatDistanceToNow(new Date(log.accessed_at), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(log.accessed_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{log.user_org?.name}</div>
                            <div className="text-xs text-muted-foreground">{log.user_org?.type}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getResourceTypeBadge(log.resource_type)}
                          <div className="text-xs text-muted-foreground font-mono">
                            {log.resource_id.substring(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAccessTypeIcon(log.access_type)}
                          {getAccessTypeBadge(log.access_type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.user?.full_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{log.user?.email}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Pagination */}
          {!isLoading && logs.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} logs
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

