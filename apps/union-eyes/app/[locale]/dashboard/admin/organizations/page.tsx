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
import { useTranslations } from 'next-intl';
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

const fetcher = (url: string) => {
  if (!url.startsWith('/')) throw new Error('Only relative URLs are allowed');
  return fetch(url).then(res => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  });
};

// Organization type configurations
const typeConfig: Record<OrganizationType, { icon: React.ReactElement; color: string }> = {
  platform: { icon: <Layers className="w-4 h-4" />, color: "text-rose-700 bg-rose-100 border-rose-200" },
  congress: { icon: <Globe className="w-4 h-4" />, color: "text-blue-700 bg-blue-100 border-blue-200" },
  federation: { icon: <Network className="w-4 h-4" />, color: "text-purple-700 bg-purple-100 border-purple-200" },
  union: { icon: <Building2 className="w-4 h-4" />, color: "text-green-700 bg-green-100 border-green-200" },
  local: { icon: <Users className="w-4 h-4" />, color: "text-orange-700 bg-orange-100 border-orange-200" },
  region: { icon: <MapPin className="w-4 h-4" />, color: "text-teal-700 bg-teal-100 border-teal-200" },
  district: { icon: <GitBranch className="w-4 h-4" />, color: "text-indigo-700 bg-indigo-100 border-indigo-200" }
};

const statusConfig: Record<OrganizationStatus, { color: string; dotColor: string }> = {
  active: { color: "text-green-700 bg-green-100 border-green-200", dotColor: "bg-green-500" },
  inactive: { color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" },
  suspended: { color: "text-red-700 bg-red-100 border-red-200", dotColor: "bg-red-500" },
  archived: { color: "text-slate-700 bg-slate-100 border-slate-200", dotColor: "bg-slate-500" }
};

interface OrganizationWithStats extends Organization {
  memberCount?: number;
  childCount?: number;
  activeClaims?: number;
  parentName?: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const t = useTranslations('adminOrganizationsPage');
  const { organizationId: _organizationId } = useOrganization();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Admin page: always show all organizations (no parent filter).
  // Non-admin org pages use parent filter for scoped views.
  const { data, error, isLoading, mutate } = useSWR(
    `/api/organizations?include_stats=true`,
    fetcher,
    {
      onErrorRetry: (_err, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 5000 * (retryCount + 1));
      },
    }
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
    if (!confirm(t('confirmArchiveOrganization'))) return;
    
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error(t('failedToArchiveOrganization'));
      
      mutate();
    } catch (_error) {
      alert(t('failedToArchiveOrganization'));
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
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setBulkImportOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('bulkImportButton')}
            </Button>
            <Button 
              onClick={() => router.push("/dashboard/admin/organizations/new")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('addOrganizationButton')}
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
                <p className="text-sm text-muted-foreground">{t('totalOrganizations')}</p>
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
                <p className="text-sm text-muted-foreground">{t('activeOrganizations')}</p>
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
                <p className="text-sm text-muted-foreground">{t('totalMembers')}</p>
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
                <p className="text-sm text-muted-foreground">{t('activeClaims')}</p>
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
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-45">
                <SelectValue placeholder={t('typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                <SelectItem value="congress">{t('type.congress')}</SelectItem>
                <SelectItem value="federation">{t('type.federation')}</SelectItem>
                <SelectItem value="union">{t('type.union')}</SelectItem>
                <SelectItem value="local">{t('type.local')}</SelectItem>
                <SelectItem value="region">{t('type.region')}</SelectItem>
                <SelectItem value="district">{t('type.district')}</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-45">
                <SelectValue placeholder={t('statusPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                <SelectItem value="suspended">{t('status.suspended')}</SelectItem>
                <SelectItem value="archived">{t('status.archived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizations View with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>{t('organizationsCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "tree")}>
            <TabsList className="mb-4">
              <TabsTrigger value="table" className="gap-2">
                <Building2 className="w-4 h-4" />
                {t('tableViewTab')}
              </TabsTrigger>
              <TabsTrigger value="tree" className="gap-2">
                <Network className="w-4 h-4" />
                {t('hierarchyTreeTab')}
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
                  <p>{t('failedToLoadOrganizations')}</p>
                </div>
              ) : filteredOrganizations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Building className="w-12 h-12 mb-4" />
                  <p>{t('noOrganizationsFound')}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => router.push("/dashboard/admin/organizations/new")}
                  >
                    {t('createFirstOrganizationButton')}
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
                        <TableHead>{t('columnName')}</TableHead>
                        <TableHead>{t('columnType')}</TableHead>
                        <TableHead>{t('columnStatus')}</TableHead>
                        <TableHead>{t('columnParent')}</TableHead>
                        <TableHead className="text-right">{t('columnMembers')}</TableHead>
                        <TableHead className="text-right">{t('columnChildren')}</TableHead>
                        <TableHead className="text-right">{t('columnClaims')}</TableHead>
                        <TableHead className="text-right">{t('columnActions')}</TableHead>
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
                                {t(`type.${org.organization_type}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusInfo.color}>
                                <span className={`w-2 h-2 rounded-full mr-1.5 ${statusInfo.dotColor}`} />
                                {t(`status.${org.status}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {org.parentName ? (
                                <span className="text-sm text-muted-foreground">{org.parentName}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">{t('rootLabel')}</span>
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
                                    {t('viewDetailsAction')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/organizations/${org.id}/edit`)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    {t('editAction')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/organizations/new?parent=${org.id}`)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('addChildAction')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(org.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {t('archiveAction')}
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
