/**
 * Tenants Management Page
 * 
 * Displays list of all tenants with stats, filtering, and management actions.
 * Part of Phase 0.2 - Admin Console UI
 */


export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import Link from "next/link";
import { Building2, Plus, Search, Users, HardDrive, TrendingUp } from "lucide-react";
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
  TableRow,
} from "@/components/ui/table";
import { getAdminTenants } from "@/actions/admin-actions";

interface PageProps {
  params: { locale: string };
  searchParams: { q?: string };
}

async function TenantsTable({ searchQuery }: { searchQuery?: string }) {
  const tenants = await getAdminTenants(searchQuery);

  if (tenants.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tenants found</h3>
          <p className="text-sm text-gray-600 mb-4">
            {searchQuery ? "Try adjusting your search query" : "Get started by creating your first tenant"}
          </p>
          {!searchQuery && (
            <Link href="tenants/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Tenant
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead className="text-right">Users</TableHead>
            <TableHead className="text-right">Storage</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell>
                <div>
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                  <div className="text-sm text-gray-500">{tenant.slug}</div>
                  {tenant.contactEmail && (
                    <div className="text-xs text-gray-400">{tenant.contactEmail}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={tenant.status === "active" ? "default" : "secondary"}
                  className={
                    tenant.status === "active"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : ""
                  }
                >
                  {tenant.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{tenant.subscriptionTier}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{tenant.activeUsers}</span>
                  <span className="text-gray-400">/ {tenant.totalUsers}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <HardDrive className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{tenant.storageUsed}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`tenants/${tenant.id}`}>
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function TenantsPage({ params, searchParams }: PageProps) {
  const searchQuery = searchParams.q;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Tenant Management
          </h2>
          <p className="text-gray-600 mt-2">
            Manage tenant organizations, subscriptions, and resource allocation
          </p>
        </div>
        <Link href={`/${params.locale}/admin/tenants/new`}>
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<div className="h-20 bg-gray-100 animate-pulse rounded-lg" />}>
        <TenantStats />
      </Suspense>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            Search and manage tenant organizations across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                name="q"
                placeholder="Search by name, slug, or email..."
                defaultValue={searchQuery}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
            {searchQuery && (
              <Link href={`/${params.locale}/admin/tenants`}>
                <Button variant="outline">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Suspense fallback={<TableSkeleton />}>
        <TenantsTable searchQuery={searchQuery} />
      </Suspense>
    </div>
  );
}

async function TenantStats() {
  const tenants = await getAdminTenants();
  
  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === "active").length,
    totalUsers: tenants.reduce((sum, t) => sum + t.totalUsers, 0),
    totalStorage: tenants.reduce((sum, t) => sum + parseFloat(t.storageUsed.replace(/[^0-9.]/g, "")), 0),
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
          <Building2 className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-gray-600 mt-1">
            {stats.active} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
          <p className="text-xs text-gray-600 mt-1">
            Across all tenants
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalStorage.toFixed(2)} GB</div>
          <p className="text-xs text-gray-600 mt-1">
            Allocated storage
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Users/Tenant</CardTitle>
          <TrendingUp className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.total > 0 ? Math.round(stats.totalUsers / stats.total) : 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Average per tenant
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
