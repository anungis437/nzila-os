/**
 * Organization Permission Management Component
 * 
 * Manage user permissions and roles within organization hierarchy.
 * Features:
 * - View all users with org permissions
 * - Assign roles (admin, manager, member, viewer)
 * - Bulk permission updates
 * - Permission inheritance visualization
 * - Role-based access control
 * - Audit trail of permission changes
 * 
 * @module components/admin/organization-permissions
 */

"use client";

import { useState } from "react";
import { Shield, UserPlus, Users, X, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface Permission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: "admin" | "manager" | "member" | "viewer";
  organizationId: string;
  organizationName: string;
  inherited: boolean;
  grantedAt: string;
  grantedBy: string;
}

interface OrganizationPermissionsProps {
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  member: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

const ROLE_DESCRIPTIONS = {
  admin: "Full access - can manage everything including permissions",
  manager: "Can manage claims, members, and content",
  member: "Can create and manage own claims",
  viewer: "Read-only access to organization data",
};

export function OrganizationPermissions({
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onSuccess,
}: OrganizationPermissionsProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("");

  // Add user state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("member");
  const [addingUser, setAddingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load permissions
  const loadPermissions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/permissions`
      );

      if (!response.ok) {
        throw new Error("Failed to load permissions");
      }

      const data = await response.json();
      setPermissions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  // Add user permission
  const addUserPermission = async () => {
    if (!newUserEmail || !newUserRole) {
      setError("Email and role are required");
      return;
    }

    setAddingUser(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/permissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: newUserEmail,
            role: newUserRole,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add user permission");
      }

      // Reset form and reload
      setNewUserEmail("");
      setNewUserRole("member");
      setShowAddUser(false);
      await loadPermissions();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user permission");
    } finally {
      setAddingUser(false);
    }
  };

  // Update permission role
  const updatePermission = async (permissionId: string, newRole: string) => {
    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/permissions/${permissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update permission");
      }

      await loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update permission");
    }
  };

  // Remove permission
  const removePermission = async (permissionId: string) => {
    if (!confirm("Are you sure you want to remove this permission?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/permissions/${permissionId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove permission");
      }

      await loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove permission");
    }
  };

  // Bulk update permissions
  const bulkUpdatePermissions = async () => {
    if (selectedUsers.size === 0 || !bulkRole) {
      return;
    }

    try {
      const permissionIds = Array.from(selectedUsers);
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/permissions/bulk`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissionIds,
            role: bulkRole,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to bulk update permissions");
      }

      setSelectedUsers(new Set());
      setBulkRole("");
      await loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk update");
    }
  };

  // Filter permissions by search
  const filteredPermissions = permissions.filter(
    (perm) =>
      perm.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      perm.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle user selection
  const toggleUserSelection = (permissionId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(permissionId)) {
      newSelection.delete(permissionId);
    } else {
      newSelection.add(permissionId);
    }
    setSelectedUsers(newSelection);
  };

  // Load permissions when dialog opens
  useState(() => {
    if (open) {
      loadPermissions();
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Permissions - {organizationName}
          </DialogTitle>
          <DialogDescription>
            Control user access and roles within this organization
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Button
              onClick={() => setShowAddUser(!showAddUser)}
              variant={showAddUser ? "outline" : "default"}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          {/* Add User Form */}
          {showAddUser && (
            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newUserEmail">User Email</Label>
                  <Input
                    id="newUserEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserRole">Role</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger id="newUserRole">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Alert>
                <AlertDescription className="text-xs">
                  {ROLE_DESCRIPTIONS[newUserRole as keyof typeof ROLE_DESCRIPTIONS]}
                </AlertDescription>
              </Alert>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUserEmail("");
                    setNewUserRole("member");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={addUserPermission}
                  disabled={addingUser || !newUserEmail}
                >
                  {addingUser ? "Adding..." : "Add Permission"}
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium">
                {selectedUsers.size} user(s) selected
              </span>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Change role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={bulkUpdatePermissions}
                disabled={!bulkRole}
              >
                Update Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedUsers(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Permissions Table */}
          <div className="border rounded-lg">
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.size === filteredPermissions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers(
                              new Set(filteredPermissions.map((p) => p.id))
                            );
                          } else {
                            setSelectedUsers(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading permissions...
                      </TableCell>
                    </TableRow>
                  ) : filteredPermissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No permissions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPermissions.map((perm) => (
                      <TableRow key={perm.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(perm.id)}
                            onCheckedChange={() => toggleUserSelection(perm.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{perm.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {perm.userEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={ROLE_COLORS[perm.role]}
                            variant="secondary"
                          >
                            {perm.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{perm.organizationName}</p>
                            {perm.inherited && (
                              <Badge variant="outline" className="text-xs">
                                Inherited
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">
                            {new Date(perm.grantedAt).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Select
                              value={perm.role}
                              onValueChange={(role) =>
                                updatePermission(perm.id, role)
                              }
                            >
                              <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePermission(perm.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

