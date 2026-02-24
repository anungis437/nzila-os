/**
 * Affiliate List Table Component
 * 
 * Displays member unions in a paginated table with:
 * - Filtering by status, sector
 * - Sorting by name, members, compliance
 * - Search functionality
 * - Status badges
 * - Quick actions (view, edit, contact)
 * - Remittance compliance indicators
 * 
 * @module components/federation/AffiliateListTable
 */

"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit,
  Mail,
  Phone,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown
} from "lucide-react";
import { format } from "date-fns";

export interface Affiliate {
  id: string;
  name: string;
  shortName: string;
  affiliateNumber: string;
  sector: string;
  memberCount: number;
  status: "active" | "pending" | "suspended" | "inactive";
  complianceStatus: "compliant" | "at-risk" | "overdue";
  lastRemittanceDate?: Date;
  contactEmail: string;
  contactPhone?: string;
  joinedDate: Date;
}

export interface AffiliateListTableProps {
  federationId: string;
  onViewDetails?: (affiliateId: string) => void;
  onEdit?: (affiliateId: string) => void;
}

export function AffiliateListTable({
  federationId,
  onViewDetails,
  onEdit
}: AffiliateListTableProps) {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = React.useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [complianceFilter, setComplianceFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"name" | "members" | "compliance">("name");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const itemsPerPage = 10;

  React.useEffect(() => {
    loadAffiliates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId, statusFilter, complianceFilter, currentPage, searchQuery, sortBy, sortOrder]);

  async function loadAffiliates() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        federationId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(complianceFilter !== "all" && { compliance: complianceFilter }),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/federation/affiliates?${params}`);

      if (!response.ok) {
        throw new Error("Failed to load affiliates");
      }

      const data = await response.json();
      if (data.success) {
        setAffiliates(data.affiliates);
        setTotalPages(Math.ceil(data.total / itemsPerPage));
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load affiliate unions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleViewDetails(affiliateId: string) {
    if (onViewDetails) {
      onViewDetails(affiliateId);
    } else {
      window.location.href = `/federation/affiliates/${affiliateId}`;
    }
  }

  function handleEdit(affiliateId: string) {
    if (onEdit) {
      onEdit(affiliateId);
    } else {
      window.location.href = `/federation/affiliates/${affiliateId}/edit`;
    }
  }

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  const getStatusBadge = (status: Affiliate["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      case "inactive":
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getComplianceBadge = (status: Affiliate["complianceStatus"]) => {
    switch (status) {
      case "compliant":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Compliant
          </Badge>
        );
      case "at-risk":
        return (
          <Badge variant="warning" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            At Risk
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Overdue
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Affiliate Unions
        </CardTitle>
        <CardDescription>
          Member unions affiliated with this federation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or affiliate number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={complianceFilter} onValueChange={setComplianceFilter}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="All Compliance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Compliance</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : affiliates.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No affiliates found</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("name")}
                        className="-ml-3"
                      >
                        Affiliate
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("members")}
                      >
                        Members
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("compliance")}
                      >
                        Compliance
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Last Remittance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{affiliate.shortName}</div>
                          <div className="text-sm text-muted-foreground">
                            #{affiliate.affiliateNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{affiliate.sector}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {affiliate.memberCount.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                      <TableCell>{getComplianceBadge(affiliate.complianceStatus)}</TableCell>
                      <TableCell>
                        {affiliate.lastRemittanceDate ? (
                          <span className="text-sm">
                            {format(new Date(affiliate.lastRemittanceDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(affiliate.id)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(affiliate.id)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Send email"
                          >
                            <a href={`mailto:${affiliate.contactEmail}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                          {affiliate.contactPhone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              title="Call"
                            >
                              <a href={`tel:${affiliate.contactPhone}`}>
                                <Phone className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
