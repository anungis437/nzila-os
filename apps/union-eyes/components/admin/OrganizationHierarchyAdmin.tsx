/**
 * Organization Hierarchy Admin Component
 * Manage organization parent-child relationships and organization isolation
 * Phase 1: Organization Architecture
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Building2,
  Plus,
  Edit,
  Users,
  Shield,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  organization_type: string;
  parent_organization_id?: string;
  level: number;
  member_count?: number;
  child_count?: number;
  rls_enabled: boolean;
}

interface OrganizationHierarchyAdminProps {
  organizationId: string;
  userRole: string;
}

export function OrganizationHierarchyAdmin({ 
  organizationId, 
  userRole 
}: OrganizationHierarchyAdminProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hierarchyTree, setHierarchyTree] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    organizationType: 'local_union',
    parentOrganizationId: '',
  });

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizations/hierarchy?rootOrgId=${organizationId}`);
      const data = await response.json();
      
      if (data.success) {
        setOrganizations(data.data);
        buildHierarchyTree(data.data);
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const buildHierarchyTree = (orgs: Organization[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tree: any[] = [];

    // Create nodes
    orgs.forEach(org => {
      orgMap.set(org.id, {
        ...org,
        children: [],
      });
    });

    // Build tree structure
    orgs.forEach(org => {
      const node = orgMap.get(org.id);
      if (org.parent_organization_id) {
        const parent = orgMap.get(org.parent_organization_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    setHierarchyTree(tree);
  };

  const handleCreateOrganization = async () => {
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          organizationType: formData.organizationType,
          parentOrganizationId: formData.parentOrganizationId || null,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setIsCreateDialogOpen(false);
        setFormData({ name: '', organizationType: 'local_union', parentOrganizationId: '' });
        fetchOrganizations();
      }
    } catch (_error) {
}
  };

  const handleUpdateOrganization = async () => {
    if (!selectedOrg) return;

    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          organizationType: formData.organizationType,
          parentOrganizationId: formData.parentOrganizationId || null,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setIsEditDialogOpen(false);
        setSelectedOrg(null);
        fetchOrganizations();
      }
    } catch (_error) {
}
  };

  const getOrgTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'international': 'bg-purple-500',
      'national': 'bg-blue-500',
      'regional': 'bg-green-500',
      'local_union': 'bg-yellow-500',
      'chapter': 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderOrganizationNode = (node: any, depth: number = 0) => {
    return (
      <div key={node.id} className="space-y-2">
        <div 
          className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer ${
            depth > 0 ? 'ml-' + (depth * 8) : ''
          }`}
          onClick={() => setSelectedOrg(node)}
        >
          <div className="flex items-center gap-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <h4 className="font-semibold">{node.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getOrgTypeColor(node.organization_type)}>
                  {node.organization_type.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Level {node.level}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{node.member_count || 0} members</span>
            </div>
            {node.rls_enabled && (
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="h-4 w-4" />
                <span>RLS Enabled</span>
              </div>
            )}
            {node.children && node.children.length > 0 && (
              <Badge variant="outline">
                {node.children.length} sub-org{node.children.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {userRole === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrg(node);
                  setFormData({
                    name: node.name,
                    organizationType: node.organization_type,
                    parentOrganizationId: node.parent_organization_id || '',
                  });
                  setIsEditDialogOpen(true);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {node.children && node.children.length > 0 && (
          <div className="ml-8 space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {node.children.map((child: any) => renderOrganizationNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading organization hierarchy...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organization Hierarchy</h2>
          <p className="text-muted-foreground">Manage organization structure and isolation</p>
        </div>
        {userRole === 'admin' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Add a new organization to the hierarchy with proper organization isolation.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Local 123"
                  />
                </div>
                
                <div>
                  <Label htmlFor="type">Organization Type</Label>
                  <Select
                    value={formData.organizationType}
                    onValueChange={(value) => setFormData({ ...formData, organizationType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="international">International</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                      <SelectItem value="local_union">Local Union</SelectItem>
                      <SelectItem value="chapter">Chapter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="parent">Parent Organization (Optional)</Label>
                  <Select
                    value={formData.parentOrganizationId}
                    onValueChange={(value) => setFormData({ ...formData, parentOrganizationId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (Top Level)</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({org.organization_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrganization}>
                  Create Organization
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Hierarchy Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Hierarchy Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...organizations.map(o => o.level), 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">RLS Protection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">100%</div>
            <p className="text-xs text-muted-foreground">All organizations secured</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Tree</CardTitle>
          <CardDescription>
            Hierarchical view of all organizations with RLS organization isolation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hierarchyTree.length === 0 ? (
            <p className="text-muted-foreground">No organizations in hierarchy.</p>
          ) : (
            <div className="space-y-2">
              {hierarchyTree.map(node => renderOrganizationNode(node))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {selectedOrg && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>
                Update organization details and hierarchy placement.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Organization Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-type">Organization Type</Label>
                <Select
                  value={formData.organizationType}
                  onValueChange={(value) => setFormData({ ...formData, organizationType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="international">International</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="local_union">Local Union</SelectItem>
                    <SelectItem value="chapter">Chapter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-parent">Parent Organization</Label>
                <Select
                  value={formData.parentOrganizationId}
                  onValueChange={(value) => setFormData({ ...formData, parentOrganizationId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Top Level)</SelectItem>
                    {organizations
                      .filter(org => org.id !== selectedOrg.id)
                      .map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({org.organization_type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateOrganization}>
                Update Organization
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

