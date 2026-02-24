"use client";


export const dynamic = 'force-dynamic';
/**
 * Organizations List Page
 * View and manage the organizational hierarchy
 */

import React from 'react';
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  Building2,
  Globe,
  Users,
  MapPin,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Network,
  Loader2,
  AlertCircle,
  GitBranch,
  Building,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { OrganizationBreadcrumb } from "@/components/organization/organization-breadcrumb";
import { OrganizationTree } from "@/components/organization/organization-tree";
import { BulkOperations } from "@/components/organization/bulk-operations";
import { BulkImportOrganizations } from "@/components/admin/bulk-import-organizations";
 
import type { Organization, OrganizationType, OrganizationStatus } from "@/types/organization";

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Organization type configurations
const typeConfig: Record<OrganizationType, { label: string; icon: React.ReactElement; color: string }> = {
  platform: { label: "Platform", icon: <Layers className="w-4 h-4" />, color: "text-rose-700 bg-rose-100 border-rose-200" },
  congress: { label: "Congress", icon: <Globe className="w-4 h-4" />, color: "text-blue-700 bg-blue-100 border-blue-200" },
  federation: { label: "Federation", icon: <Network className="w-4 h-4" />, color: "text-purple-700 bg-purple-100 border-purple-200" },
  union: { label: "Union", icon: <Building2 className="w-4 h-4" />, color: "text-green-700 bg-green-100 border-green-200" },
  local: { label: "Local", icon: <Users className="w-4 h-4" />, color: "text-orange-700 bg-orange-100 border-orange-200" },
  region: { label: "Region", icon: <MapPin className="w-4 h-4" />, color: "text-teal-700 bg-teal-100 border-teal-200" },
  district: { label: "District", icon: <GitBranch className="w-4 h-4" />, color: "text-indigo-700 bg-indigo-100 border-indigo-200" }
};

const statusConfig: Record<OrganizationStatus, { label: string; color: string; dotColor: string }> = {
  active: { label: "Active", color: "text-green-700 bg-green-100 border-green-200", dotColor: "bg-green-500" },
  inactive: { label: "Inactive", color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" },
  suspended: { label: "Suspended", color: "text-red-700 bg-red-100 border-red-200", dotColor: "bg-red-500" },
  archived: { label: "Archived", color: "text-slate-700 bg-slate-100 border-slate-200", dotColor: "bg-slate-500" }
};

interface OrganizationWithStats extends Organization {
  memberCount?: number;
  childCount?: number;
  activeClaims?: number;
  parentName?: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { organizationId, organization: _organization } = useOrganization();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Fetch organizations - show children of current organization by default
  const { data, error, isLoading, mutate } = useSWR(
    organizationId ? `/api/organizations?parent=${organizationId}&include_stats=true` : null,
    fetcher
  );

  const organizations: OrganizationWithStats[] = data?.data || [];

  // Filter organizations based on search and filters
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = !searchQuery || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === "all" || org.organization_type === typeFilter;
    const matchesStatus = statusFilter === "all" || org.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDelete = async (orgId: string) => {
    if (!confirm("Are you sure you want to archive this organization?")) return;
    
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to archive organization");
      
      mutate();
    } catch (_error) {
alert("Failed to archive organization");
    }
  };

  const toggleOrgSelection = (orgId: string) => {
    const newSelection = new Set(selectedOrgs);
    if (newSelection.has(orgId)) {
      newSelection.delete(orgId);
    } else {
      newSelection.add(orgId);
    }
    setSelectedOrgs(newSelection);
  };

  const toggleAllOrgs = () => {
    if (selectedOrgs.size === filteredOrganizations.length) {
      setSelectedOrgs(new Set());
    } else {
      setSelectedOrgs(new Set(filteredOrganizations.map(o => o.id)));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <OrganizationBreadcrumb />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organizational hierarchy
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setBulkImportOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Bulk Import
            </Button>
            <Button 
              onClick={() => router.push("/dashboard/admin/organizations/new")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Organization
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
                <p className="text-sm text-muted-foreground">Total Organizations</p>
                <p className="text-2xl font-bold">{organizations.length}</p>
              </div>
              <Building className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {organizations.filter(o => o.status === 'active').length}
                </p>
              </div>
              <Building2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">
                  {organizations.reduce((sum, o) => sum + (o.memberCount || 0), 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Claims</p>
                <p className="text-2xl font-bold text-orange-600">
                  {organizations.reduce((sum, o) => sum + (o.activeClaims || 0), 0)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-45">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="congress">Congress</SelectItem>
                <SelectItem value="federation">Federation</SelectItem>
                <SelectItem value="union">Union</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="region">Region</SelectItem>
                <SelectItem value="district">District</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-45">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizations View with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "tree")}>
            <TabsList className="mb-4">
              <TabsTrigger value="table" className="gap-2">
                <Building2 className="w-4 h-4" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="tree" className="gap-2">
                <Network className="w-4 h-4" />
                Hierarchy Tree
              </TabsTrigger>
            </TabsList>

            {/* Table View */}
            <TabsContent value="table">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mb-4" />
                  <p>Failed to load organizations</p>
                </div>
              ) : filteredOrganizations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Building className="w-12 h-12 mb-4" />
                  <p>No organizations found</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => router.push("/dashboard/admin/organizations/new")}
                  >
                    Create your first organization
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedOrgs.size === filteredOrganizations.length}
                            onCheckedChange={toggleAllOrgs}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="text-right">Children</TableHead>
                        <TableHead className="text-right">Claims</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrganizations.map((org) => {
                        const typeInfo = typeConfig[org.organization_type as OrganizationType] || typeConfig.local;
                        const statusInfo = statusConfig[org.status as OrganizationStatus] || statusConfig.active;
                        
                        return (
                          <TableRow key={org.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrgs.has(org.id)}
                                onCheckedChange={() => toggleOrgSelection(org.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded border ${typeInfo.color}`}>
                                  {typeInfo.icon}
                                </div>
                                <div>
                                  <div className="font-medium">{org.name}</div>
                                  {org.slug && (
                                    <div className="text-xs text-muted-foreground">{org.slug}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={typeInfo.color}>
                                {typeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusInfo.color}>
                                <span className={`w-2 h-2 rounded-full mr-1.5 ${statusInfo.dotColor}`} />
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {org.parentName ? (
                                <span className="text-sm text-muted-foreground">{org.parentName}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Root</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {org.memberCount || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {org.childCount || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={org.activeClaims ? "text-orange-600 font-medium" : ""}>
                                {org.activeClaims || 0}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/organizations/${org.id}`)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/organizations/${org.id}/edit`)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/organizations/new?parent=${org.id}`)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Child
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(org.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tree View */}
            <TabsContent value="tree">
              <OrganizationTree
                onSelect={(org) => router.push(`/dashboard/admin/organizations/${org.id}`)}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bulk Operations Bar */}
      <BulkOperations
        selectedIds={Array.from(selectedOrgs)}
        onSuccess={() => {
          mutate();
          setSelectedOrgs(new Set());
        }}
        onClearSelection={() => setSelectedOrgs(new Set())}
      />

      {/* Bulk Import Dialog */}
      <BulkImportOrganizations
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={() => {
          mutate();
          setBulkImportOpen(false);
        }}
      />
    </div>
  );
}
