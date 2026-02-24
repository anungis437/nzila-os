"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
/**
 * Organization Detail Page
 * View detailed information about a specific organization
 */

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Building2,
  Globe,
  Users,
  MapPin,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Network,
  Settings,
  FileText,
  AlertCircle,
  Loader2,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { OrganizationBreadcrumb } from "@/components/organization/organization-breadcrumb";
import { OrganizationAnalytics } from "@/components/organization/organization-analytics";
import { OrganizationMembers } from "@/components/organization/organization-members";
import type { Organization, OrganizationType, OrganizationStatus } from "@/types/organization";

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Organization type configurations
const typeConfig: Record<OrganizationType, { label: string; icon: React.ReactElement; color: string }> = {
  congress: { label: "Congress", icon: <Globe className="w-4 h-4" />, color: "text-blue-700 bg-blue-100 border-blue-200" },
  federation: { label: "Federation", icon: <Network className="w-4 h-4" />, color: "text-purple-700 bg-purple-100 border-purple-200" },
  union: { label: "Union", icon: <Building2 className="w-4 h-4" />, color: "text-green-700 bg-green-100 border-green-200" },
  local: { label: "Local", icon: <Users className="w-4 h-4" />, color: "text-orange-700 bg-orange-100 border-orange-200" },
  region: { label: "Region", icon: <MapPin className="w-4 h-4" />, color: "text-teal-700 bg-teal-100 border-teal-200" },
  district: { label: "District", icon: <Network className="w-4 h-4" />, color: "text-indigo-700 bg-indigo-100 border-indigo-200" },
  platform: { label: "Platform", icon: <Settings className="w-4 h-4" />, color: "text-purple-700 bg-purple-100 border-purple-200" }
};

const statusConfig: Record<OrganizationStatus, { label: string; color: string; dotColor: string }> = {
  active: { label: "Active", color: "text-green-700 bg-green-100 border-green-200", dotColor: "bg-green-500" },
  inactive: { label: "Inactive", color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" },
  suspended: { label: "Suspended", color: "text-red-700 bg-red-100 border-red-200", dotColor: "bg-red-500" },
  archived: { label: "Archived", color: "text-slate-700 bg-slate-100 border-slate-200", dotColor: "bg-slate-500" }
};

interface OrganizationWithDetails extends Organization {
  description?: string;
  memberCount?: number;
  childCount?: number;
  activeClaims?: number;
  totalClaims?: number;
  monthlyRevenue?: number;
  parentName?: string;
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

  // Fetch organization details
  const { data: orgData, error: orgError, isLoading: orgLoading } = useSWR(
    organizationId ? `/api/organizations/${organizationId}` : null,
    fetcher
  );

  // Fetch organization children
  const { data: childrenData, isLoading: childrenLoading } = useSWR(
    organizationId ? `/api/organizations/${organizationId}/children` : null,
    fetcher
  );

  // Fetch organization members
  const { data: membersData, isLoading: _membersLoading } = useSWR(
    organizationId ? `/api/organizations/${organizationId}/members` : null,
    fetcher
  );

  // Fetch organization ancestors (breadcrumb path)
  const { data: ancestorsData } = useSWR(
    organizationId ? `/api/organizations/${organizationId}/ancestors` : null,
    fetcher
  );

  const organization: OrganizationWithDetails | null = orgData?.data || null;
  const children = childrenData?.data || [];
  const members = membersData?.data || [];
  const ancestors = ancestorsData?.data || [];

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to archive this organization? This action can be reversed later.")) return;
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to archive organization");
      
      router.push("/dashboard/admin/organizations");
    } catch (_error) {
alert("Failed to archive organization");
    }
  };

  if (orgLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (orgError || !organization) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p>Organization not found</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => router.push("/dashboard/admin/organizations")}
          >
            Back to Organizations
          </Button>
        </div>
      </div>
    );
  }

  const typeInfo = typeConfig[organization.organization_type as OrganizationType];
  const statusInfo = statusConfig[organization.status as OrganizationStatus];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <OrganizationBreadcrumb />
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/admin/organizations")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded border ${typeInfo.color}`}>
                  {typeInfo.icon}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={typeInfo.color}>
                  {typeInfo.label}
                </Badge>
                <Badge variant="outline" className={statusInfo.color}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${statusInfo.dotColor}`} />
                  {statusInfo.label}
                </Badge>
                {organization.slug && (
                  <span className="text-sm text-muted-foreground">@{organization.slug}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/admin/organizations/${organizationId}/edit`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/admin/organizations/new?parent=${organizationId}`)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Child
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
                <p className="text-2xl font-bold">{organization.memberCount || 0}</p>
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
                <p className="text-2xl font-bold text-orange-600">{organization.activeClaims || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sub-organizations</p>
                <p className="text-2xl font-bold text-green-600">{organization.childCount || 0}</p>
              </div>
              <Network className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold">{organization.totalClaims || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy ({children.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {organization.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm text-muted-foreground">{organization.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Organization ID</h3>
                  <p className="text-sm font-mono">{organization.id}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Slug</h3>
                  <p className="text-sm">{organization.slug || "â€”"}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Created</h3>
                  <p className="text-sm">
                    {organization.created_at 
                      ? new Date(organization.created_at).toLocaleDateString()
                      : "â€”"}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h3>
                  <p className="text-sm">
                    {organization.updated_at 
                      ? new Date(organization.updated_at).toLocaleDateString()
                      : "â€”"}
                  </p>
                </div>
              </div>

              {organization.settings && Object.keys(organization.settings).length > 0 && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {organization.settings.headquarters && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Headquarters</h3>
                        <p className="text-sm">{organization.settings.headquarters}</p>
                      </div>
                    )}

                    {organization.settings.industry && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Industry</h3>
                        <p className="text-sm">{organization.settings.industry}</p>
                      </div>
                    )}

                    {typeof organization.settings.founded === "number" && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Founded</h3>
                        <p className="text-sm">{organization.settings.founded}</p>
                      </div>
                    )}

                    {typeof organization.settings.locals_count === "number" && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Locals Count</h3>
                        <p className="text-sm">{organization.settings.locals_count}</p>
                      </div>
                    )}

                    {organization.settings.primary_language && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Primary Language</h3>
                        <p className="text-sm">{organization.settings.primary_language.toUpperCase()}</p>
                      </div>
                    )}

                    {organization.settings.secondary_language && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Secondary Language</h3>
                        <p className="text-sm">{organization.settings.secondary_language.toUpperCase()}</p>
                      </div>
                    )}

                    {typeof organization.settings.bilingual === "boolean" && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Bilingual</h3>
                        <p className="text-sm">{organization.settings.bilingual ? "Yes" : "No"}</p>
                      </div>
                    )}

                    {organization.settings.international_affiliate && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">International Affiliate</h3>
                        <p className="text-sm">{organization.settings.international_affiliate}</p>
                      </div>
                    )}

                    {Array.isArray(organization.settings.major_employers) && organization.settings.major_employers.length > 0 && (
                      <div className="col-span-2">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Major Employers</h3>
                        <p className="text-sm">{organization.settings.major_employers.join(", ")}</p>
                      </div>
                    )}

                    {Array.isArray(organization.settings.formed_by_merger) && organization.settings.formed_by_merger.length > 0 && (
                      <div className="col-span-2">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Formed By Merger</h3>
                        <p className="text-sm">{organization.settings.formed_by_merger.join(", ")}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Display core organization fields */}
              {(organization.jurisdiction || organization.charter_number) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {organization.jurisdiction && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Jurisdiction</h3>
                        <p className="text-sm">{organization.jurisdiction}</p>
                      </div>
                    )}
                    
                    {organization.charter_number && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Charter Number</h3>
                        <p className="text-sm">{organization.charter_number}</p>
                      </div>
                    )}
                    
                    {organization.affiliation_date && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Affiliation Date</h3>
                        <p className="text-sm">
                          {new Date(organization.affiliation_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Hierarchy Path */}
          {ancestors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Hierarchy Path</CardTitle>
                <CardDescription>Position in the organizational structure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {ancestors.map((ancestor: any, index: number) => (
                    <div key={ancestor.id} className="flex items-center gap-2">
                      {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/admin/organizations/${ancestor.id}`)}
                        className="gap-2"
                      >
                        {typeConfig[ancestor.type as OrganizationType]?.icon}
                        {ancestor.name}
                      </Button>
                    </div>
                  ))}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className={typeInfo.color}>
                    {organization.name}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <OrganizationAnalytics organizationId={organizationId} />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <OrganizationMembers organizationId={organizationId} />
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Child Organizations</CardTitle>
              <CardDescription>Organizations that report to this one</CardDescription>
            </CardHeader>
            <CardContent>
              {childrenLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : children.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No child organizations</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => router.push(`/dashboard/admin/organizations/new?parent=${organizationId}`)}
                  >
                    Add Child Organization
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {children.map((child: any) => {
                    const childTypeInfo = typeConfig[child.type as OrganizationType];
                    const childStatusInfo = statusConfig[child.status as OrganizationStatus];
                    
                    return (
                      <Card key={child.id} className="p-4 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/admin/organizations/${child.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded border ${childTypeInfo.color}`}>
                              {childTypeInfo.icon}
                            </div>
                            <div>
                              <div className="font-medium">{child.name}</div>
                              <div className="text-xs text-muted-foreground">{child.slug}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-sm">
                              <div className="font-medium">{child.memberCount || 0}</div>
                              <div className="text-muted-foreground">members</div>
                            </div>
                            <Badge variant="outline" className={childStatusInfo.color}>
                              <span className={`w-2 h-2 rounded-full mr-1.5 ${childStatusInfo.dotColor}`} />
                              {childStatusInfo.label}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Configuration and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Current Status</h3>
                <Badge variant="outline" className={statusInfo.color}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${statusInfo.dotColor}`} />
                  {statusInfo.label}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Irreversible and destructive actions
                </p>
                <Button 
                  variant="destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Archive Organization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
