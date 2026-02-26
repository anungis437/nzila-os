/**
 * Admin Panel Page
 * 
 * Comprehensive administration interface integrating:
 * - User management
 * - System configuration
 * - Analytics overview
 * - Compliance monitoring
 * - Audit logs
 * 
 * @page app/[locale]/admin/page.tsx
 */


"use client";

export const dynamic = 'force-dynamic';

import * as React from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Settings,
  BarChart3,
  Shield,
  FileText,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Building2,
  ArrowRight,
  Activity,
  Bell,
} from "lucide-react";
import { AuditLogViewer } from "@/components/compliance/audit-log-viewer";

interface AdminPageProps {
  params: { locale: string };
}

export default function AdminPage({ params }: AdminPageProps) {
  // Stats fetched from API — default to zeros until loaded
  const [stats, setStats] = React.useState({
    totalMembers: 0,
    activeMembers: 0,
    pendingApprovals: 0,
    systemHealth: "healthy" as const,
    openClaims: 0,
    activeElections: 0,
  });

  React.useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/v2/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(prev => ({ ...prev, ...data }));
        }
      } catch { /* API not available */ }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            System overview and quick access to admin functions
          </p>
        </div>
        <Badge
          variant={stats.systemHealth === "healthy" ? "default" : "destructive"}
        >
          System: {stats.systemHealth}
        </Badge>
      </div>

      {/* Quick Access Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href={`/${params.locale}/admin/orgs`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span>Organizations</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Manage organizations, subscriptions, and resources
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${params.locale}/admin/users`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <span>Users</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                User management and role assignment across all orgs
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${params.locale}/admin/permissions`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  <span>Permissions</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Permission audit and role-permission mappings
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${params.locale}/admin/audit`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600" />
                  <span>Audit Logs</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                System activity logs and compliance audit trail
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${params.locale}/admin/alerts`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-red-600" />
                  <span>Alerts</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Alert rules, incidents, and notification health
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${params.locale}/admin/settings`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  <span>Settings</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                System configuration and global settings
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="bg-linear-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <FileText className="h-5 w-5" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 mb-3">
              Admin console guides and API docs
            </p>
            <Button variant="outline" size="sm" className="w-full">
              View Docs
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-gray-600 mt-1">
              {stats.activeMembers} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approvals
            </CardTitle>
            <UserCheck className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-gray-600 mt-1">Requires review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Claims</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openClaims}</div>
            <p className="text-xs text-gray-600 mt-1">Pending resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Elections
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeElections}</div>
            <p className="text-xs text-gray-600 mt-1">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  System Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Claims Submitted Today</span>
                    <Badge>12</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">New Members This Week</span>
                    <Badge>8</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Elections</span>
                    <Badge>2</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Documents Uploaded Today</span>
                    <Badge>34</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  System Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium">
                      Scheduled Maintenance: Saturday 2-4 AM
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium">
                      23 pending member approvals require review
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium">
                      Backup completed successfully
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Manage user accounts, roles, and permissions.
              </p>
              <Button>View All Users</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Configure system-wide settings and preferences.
              </p>
              <div className="space-y-4">
                <Button variant="outline">Organization Settings</Button>
                <Button variant="outline">Email Configuration</Button>
                <Button variant="outline">Security Settings</Button>
                <Button variant="outline">Integration Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Monitor compliance with data protection regulations.
              </p>
              <div className="space-y-4">
                <Button variant="outline">Data Protection Settings</Button>
                <Button variant="outline">Privacy Policy Manager</Button>
                <Button variant="outline">Consent Management</Button>
                <Button variant="outline">Data Retention Policies</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer
            logs={[]}
            filters={{}}
            availableUsers={[]}
            totalCount={0}
            page={1}
            pageSize={50}
            onFiltersChange={(_filters) => undefined}
            onPageChange={(_page) => undefined}
            onExport={() => undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
