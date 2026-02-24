/**
 * Permissions Audit Dashboard
 * 
 * Comprehensive permission audit interface showing role-permission mappings,
 * recent permission changes, and access control violations.
 * Part of Phase 0.2 - Admin Console UI
 */


export const dynamic = 'force-dynamic';

import { Shield, AlertTriangle, CheckCircle, Clock, Users, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PageProps {
  params: { locale: string };
}

// Role-Permission Matrix Data
const ROLE_PERMISSIONS = {
  admin: {
    label: "Admin",
    count: 105,
    permissions: [
      "Access all data",
      "Manage users",
      "Configure system",
      "View audit logs",
      "Manage tenants",
      "Manage roles",
      "Delete data",
      "Export data",
    ],
  },
  officer: {
    label: "Officer",
    count: 68,
    permissions: [
      "View tenant data",
      "Manage claims",
      "Manage members",
      "View reports",
      "Export reports",
      "Manage documents",
      "Approve requests",
    ],
  },
  steward: {
    label: "Steward",
    count: 42,
    permissions: [
      "View member data",
      "Create claims",
      "View documents",
      "Create reports",
      "Manage grievances",
      "View schedules",
    ],
  },
  member: {
    label: "Member",
    count: 18,
    permissions: [
      "View own profile",
      "Submit claims",
      "View own documents",
      "Update profile",
      "View news",
      "View events",
    ],
  },
};

// Recent permission changes
const RECENT_CHANGES = [
  {
    id: 1,
    user: "John Doe",
    action: "Role changed",
    from: "steward",
    to: "officer",
    by: "Admin User",
    timestamp: "2026-02-12T14:30:00Z",
    tenant: "Local 123",
  },
  {
    id: 2,
    user: "Jane Smith",
    action: "Permission granted",
    permission: "manage_documents",
    by: "Admin User",
    timestamp: "2026-02-12T13:15:00Z",
    tenant: "Local 456",
  },
  {
    id: 3,
    user: "Bob Johnson",
    action: "Permission revoked",
    permission: "export_data",
    by: "System",
    timestamp: "2026-02-12T12:00:00Z",
    tenant: "Local 123",
  },
];

// Audit violations
const AUDIT_VIOLATIONS = [
  {
    id: 1,
    type: "suspicious_access",
    severity: "high",
    user: "Unknown User",
    action: "Attempted admin access",
    resource: "/admin/system-config",
    timestamp: "2026-02-12T15:45:00Z",
    status: "blocked",
  },
  {
    id: 2,
    type: "permission_escalation",
    severity: "medium",
    user: "John Doe",
    action: "Attempted elevated permission",
    resource: "/api/users/delete",
    timestamp: "2026-02-12T14:20:00Z",
    status: "blocked",
  },
];

export default async function PermissionsPage({ params: _params }: PageProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            Permission Audit
          </h2>
          <p className="text-gray-600 mt-2">
            Monitor role-permission mappings, access control, and security violations
          </p>
        </div>
        <Button size="lg" variant="outline">
          Export Audit Report
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
            <Lock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">105</div>
            <p className="text-xs text-gray-600 mt-1">Unique permissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-gray-600 mt-1">System roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Changes Today</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-gray-600 mt-1">Permission updates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">2</div>
            <p className="text-xs text-gray-600 mt-1">Access violations</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {AUDIT_VIOLATIONS.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Violations Detected</AlertTitle>
          <AlertDescription>
            {AUDIT_VIOLATIONS.length} access control violations detected in the last 24 hours. 
            Review the violations tab for details.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Role-Permission Matrix</TabsTrigger>
          <TabsTrigger value="changes">Recent Changes</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Role-Permission Matrix */}
        <TabsContent value="matrix">
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(ROLE_PERMISSIONS).map(([key, role]) => (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {role.label}
                      </CardTitle>
                      <CardDescription>
                        {role.count} permissions granted
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{role.count}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {role.permissions.map((permission, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm py-2 border-b last:border-0"
                      >
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-gray-700">{permission}</span>
                      </div>
                    ))}
                    {role.permissions.length < role.count && (
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        View all {role.count} permissions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Recent Changes */}
        <TabsContent value="changes">
          <Card>
            <CardHeader>
              <CardTitle>Recent Permission Changes</CardTitle>
              <CardDescription>
                All permission and role changes in the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_CHANGES.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell className="font-medium">{change.user}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{change.action}</Badge>
                      </TableCell>
                      <TableCell>
                        {"from" in change ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">{change.from}</span>
                            <span>→</span>
                            <span className="font-medium">{change.to}</span>
                          </div>
                        ) : (
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {change.permission}
                          </code>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{change.by}</TableCell>
                      <TableCell className="text-sm text-gray-600">{change.tenant}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(change.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Violations */}
        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Access Control Violations
              </CardTitle>
              <CardDescription>
                Suspicious activity and blocked access attempts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {AUDIT_VIOLATIONS.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell>
                        <Badge
                          variant={violation.severity === "high" ? "destructive" : "default"}
                          className={violation.severity === "medium" ? "bg-orange-100 text-orange-800" : ""}
                        >
                          {violation.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{violation.type}</code>
                      </TableCell>
                      <TableCell className="font-medium">{violation.user}</TableCell>
                      <TableCell className="text-sm">{violation.action}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {violation.resource}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200"
                        >
                          {violation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(violation.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>RBAC Compliance</CardTitle>
                <CardDescription>Role-Based Access Control status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Role definitions</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Permission mappings</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">RLS enforcement</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Audit logging</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Controls</CardTitle>
                <CardDescription>SOC 2 & ISO 27001 compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AC-1: Access Control Policy</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AC-2: Account Management</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AC-3: Access Enforcement</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AC-6: Least Privilege</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
