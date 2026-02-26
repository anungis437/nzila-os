/**
 * Users Management Page
 * 
 * Comprehensive user management with role assignment, filtering, and bulk actions.
 * Part of Phase 0.2 - Admin Console UI
 */


export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import Link from "next/link";
import { Users, Plus, Search, Shield, Ban, CheckCircle, UserCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { getAdminOrgs } from "@/actions/admin-actions";
import { UserRoleSelect } from "@/components/admin/user-role-select";

interface PageProps {
  params: { locale: string };
  searchParams: { q?: string; org?: string; role?: string };
}

async function UsersTable({ 
  searchQuery, 
  organizationId, 
  role 
}: { 
  searchQuery?: string; 
  organizationId?: string; 
  role?: "member" | "steward" | "officer" | "admin";
}) {
  // Fetch users from API
  let users: { id: string; name: string; email: string; role: "member" | "steward" | "officer" | "admin"; organizationId: string; orgName: string; status: string; lastLogin: string; joinedAt: string; }[] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (organizationId) params.set('organizationId', organizationId);
    if (role) params.set('role', role);
    const res = await fetch(`${baseUrl}/api/v2/admin/users?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      users = Array.isArray(json) ? json : json?.users ?? json?.data ?? [];
    }
  } catch {
    // API not available — empty state
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
          <p className="text-sm text-gray-600 mb-4">
            {searchQuery || organizationId || role 
              ? "Try adjusting your filters" 
              : "No users match the criteria"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium">{user.orgName}</span>
              </TableCell>
              <TableCell>
                <UserRoleSelect
                  userId={user.id}
                  organizationId={user.organizationId}
                  currentRole={user.role}
                />
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.status === "active" ? "default" : "secondary"}
                  className={
                    user.status === "active"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                  }
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {user.lastLogin 
                    ? new Date(user.lastLogin).toLocaleDateString() 
                    : "Never"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {new Date(user.joinedAt || "").toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm">
                    <UserCog className="h-4 w-4" />
                  </Button>
                  {user.status === "active" ? (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Ban className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function UsersPage({ params, searchParams }: PageProps) {
  const searchQuery = searchParams.q;
  const selectedOrg = searchParams.org;
  const selectedRole = searchParams.role as "member" | "steward" | "officer" | "admin" | undefined;

  const orgs = await getAdminOrgs();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            User Management
          </h2>
          <p className="text-gray-600 mt-2">
            Manage users, assign roles, and control access across all orgs
          </p>
        </div>
        <Button size="lg" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<div className="h-20 bg-gray-100 animate-pulse rounded-lg" />}>
        <UserStats />
      </Suspense>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Search, filter, and manage user accounts across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  name="q"
                  placeholder="Search by name or email..."
                  defaultValue={searchQuery}
                  className="pl-10"
                />
              </div>
              <Button type="submit">Search</Button>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Select name="org" defaultValue={selectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by org" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <Select name="role" defaultValue={selectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
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

              {(searchQuery || selectedOrg || selectedRole) && (
                <Link href={`/${params.locale}/admin/users`}>
                  <Button variant="outline">Clear Filters</Button>
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Suspense fallback={<TableSkeleton />}>
        <UsersTable 
          searchQuery={searchQuery} 
          organizationId={selectedOrg} 
          role={selectedRole} 
        />
      </Suspense>
    </div>
  );
}

async function UserStats() {
  // Fetch user stats from API
  let stats = { total: 0, active: 0, admins: 0, officers: 0, stewards: 0, members: 0 };
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const res = await fetch(`${baseUrl}/api/v2/admin/users/stats`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      stats = { ...stats, ...data };
    }
  } catch { /* API not available */ }

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-gray-600" />
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
          <CardTitle className="text-sm font-medium">Admins</CardTitle>
          <Shield className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.admins}</div>
          <p className="text-xs text-gray-600 mt-1">
            Full access
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Officers</CardTitle>
          <Shield className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.officers}</div>
          <p className="text-xs text-gray-600 mt-1">
            Management level
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stewards</CardTitle>
          <Shield className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.stewards}</div>
          <p className="text-xs text-gray-600 mt-1">
            Representative level
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Members</CardTitle>
          <Users className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.members}</div>
          <p className="text-xs text-gray-600 mt-1">
            Standard access
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
