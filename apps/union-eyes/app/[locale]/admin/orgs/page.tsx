/**
 * Orgs Management Page
 * 
 * Displays list of all orgs with stats, filtering, and management actions.
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
import { getAdminOrgs } from "@/actions/admin-actions";

interface PageProps {
  params: { locale: string };
  searchParams: { q?: string };
}

async function OrgsTable({ searchQuery }: { searchQuery?: string }) {
  const orgs = await getAdminOrgs(searchQuery);

  if (orgs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No organizations found</h3>
          <p className="text-sm text-gray-600 mb-4">
            {searchQuery ? "Try adjusting your search query" : "Get started by creating your first organization"}
          </p>
          {!searchQuery && (
            <Link href="orgs/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
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
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <div>
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="text-sm text-gray-500">{org.slug}</div>
                  {org.contactEmail && (
                    <div className="text-xs text-gray-400">{org.contactEmail}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={org.status === "active" ? "default" : "secondary"}
                  className={
                    org.status === "active"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : ""
                  }
                >
                  {org.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{org.subscriptionTier}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{org.activeUsers}</span>
                  <span className="text-gray-400">/ {org.totalUsers}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <HardDrive className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{org.storageUsed}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {new Date(org.createdAt).toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`orgs/${org.id}`}>
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

export default async function OrgsPage({ params, searchParams }: PageProps) {
  const searchQuery = searchParams.q;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Org Management
          </h2>
          <p className="text-gray-600 mt-2">
            Manage organizations, subscriptions, and resource allocation
          </p>
        </div>
        <Link href={`/${params.locale}/admin/orgs/new`}>
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<div className="h-20 bg-gray-100 animate-pulse rounded-lg" />}>
        <OrgStats />
      </Suspense>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>
            Search and manage organizations across the platform
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
              <Link href={`/${params.locale}/admin/orgs`}>
                <Button variant="outline">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Orgs Table */}
      <Suspense fallback={<TableSkeleton />}>
        <OrgsTable searchQuery={searchQuery} />
      </Suspense>
    </div>
  );
}

async function OrgStats() {
  const orgs = await getAdminOrgs();
  
  const stats = {
    total: orgs.length,
    active: orgs.filter(t => t.status === "active").length,
    totalUsers: orgs.reduce((sum, t) => sum + t.totalUsers, 0),
    totalStorage: orgs.reduce((sum, t) => sum + parseFloat(t.storageUsed.replace(/[^0-9.]/g, "")), 0),
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
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
            Across all orgs
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
          <CardTitle className="text-sm font-medium">Avg Users/Org</CardTitle>
          <TrendingUp className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.total > 0 ? Math.round(stats.totalUsers / stats.total) : 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Average per org
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
