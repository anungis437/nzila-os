"use client";

/**
 * Organization Tree Visualization Component
 * 
 * Interactive tree view for hierarchical organizations (CLC → Federation → Union → Local).
 * Features:
 * - Collapsible/expandable nodes with animated transitions
 * - Search/filter functionality
 * - Drag-and-drop reordering (planned)
 * - Inline quick actions (edit, add child, delete)
 * - Type badges and member count display
 * - Real-time updates on organization changes
 * 
 * @module components/admin/organization-tree
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, ChevronDown, Building2, Users, Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// =====================================================
// TYPES
// =====================================================

interface Organization {
  id: string;
  name: string;
  slug: string;
  displayName?: string | null;
  shortName?: string | null;
  organizationType: 'congress' | 'federation' | 'union' | 'local' | 'region' | 'district';
  parentId?: string | null;
  hierarchyPath: string[];
  hierarchyLevel: number;
  memberCount?: number;
  activeMemberCount?: number;
  status?: string;
  clcAffiliated?: boolean;
  jurisdiction?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface TreeNode extends Organization {
  children: TreeNode[];
  isExpanded: boolean;
  isVisible: boolean;
  matchesFilter: boolean;
}

interface OrganizationTreeProps {
  organizations: Organization[];
  onSelectOrganization?: (org: Organization) => void;
  onEditOrganization?: (org: Organization) => void;
  onAddChild?: (parentOrg: Organization) => void;
  onDeleteOrganization?: (org: Organization) => void;
  selectedOrgId?: string | null;
  className?: string;
  showActions?: boolean;
  expandLevel?: number; // Auto-expand to this level (0 = collapse all, -1 = expand all)
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Build hierarchical tree structure from flat organization list
 */
function buildTree(organizations: Organization[]): TreeNode[] {
  const orgMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // Initialize all nodes
  organizations.forEach((org) => {
    orgMap.set(org.id, {
      ...org,
      children: [],
      isExpanded: false,
      isVisible: true,
      matchesFilter: true,
    });
  });

  // Build parent-child relationships
  organizations.forEach((org) => {
    const node = orgMap.get(org.id);
    if (!node) return;

    if (org.parentId) {
      const parent = orgMap.get(org.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  });

  // Sort children by name
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortChildren);
  };

  rootNodes.forEach(sortChildren);
  return rootNodes;
}

/**
 * Get organization type badge color
 */
function getOrgTypeColor(type: Organization['organizationType']): string {
  const colors = {
    congress: 'bg-purple-100 text-purple-800 border-purple-300',
    federation: 'bg-blue-100 text-blue-800 border-blue-300',
    union: 'bg-green-100 text-green-800 border-green-300',
    local: 'bg-orange-100 text-orange-800 border-orange-300',
    region: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    district: 'bg-pink-100 text-pink-800 border-pink-300',
  };
  return colors[type] || 'bg-gray-100 text-gray-800 border-gray-300';
}

/**
 * Get organization type display name
 */
function getOrgTypeLabel(type: Organization['organizationType']): string {
  const labels = {
    congress: 'Congress',
    federation: 'Federation',
    union: 'Union',
    local: 'Local',
    region: 'Region',
    district: 'District',
  };
  return labels[type] || type;
}

/**
 * Format member count for display
 */
function formatMemberCount(count?: number): string {
  if (!count || count === 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Check if organization matches search filter
 */
function matchesSearch(org: Organization, searchTerm: string): boolean {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  return (
    org.name.toLowerCase().includes(term) ||
    org.slug.toLowerCase().includes(term) ||
    org.displayName?.toLowerCase().includes(term) ||
    org.shortName?.toLowerCase().includes(term) ||
    false
  );
}

/**
 * Recursively mark nodes as matching/not matching filter
 * A node matches if it or any descendant matches
 */
function applyFilter(
  nodes: TreeNode[],
  searchTerm: string,
  typeFilter: string | null
): void {
  nodes.forEach((node) => {
    // First, check children recursively
    if (node.children.length > 0) {
      applyFilter(node.children, searchTerm, typeFilter);
    }

    // Check if this node matches
    const matchesSearchTerm = matchesSearch(node, searchTerm);
    const matchesType = !typeFilter || node.organizationType === typeFilter;
    const childMatches = node.children.some((child) => child.matchesFilter);

    node.matchesFilter = (matchesSearchTerm && matchesType) || childMatches;

    // Auto-expand if children match
    if (childMatches && searchTerm) {
      node.isExpanded = true;
    }
  });
}

// =====================================================
// TREE NODE COMPONENT
// =====================================================

interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  onToggle: (nodeId: string) => void;
  onSelect?: (org: Organization) => void;
  onEdit?: (org: Organization) => void;
  onAddChild?: (org: Organization) => void;
  onDelete?: (org: Organization) => void;
  selectedOrgId?: string | null;
  showActions?: boolean;
}

function TreeNodeComponent({
  node,
  level,
  onToggle,
  onSelect,
  onEdit,
  onAddChild,
  onDelete,
  selectedOrgId,
  showActions = true,
}: TreeNodeComponentProps) {
  if (!node.matchesFilter) return null;

  const hasChildren = node.children.length > 0;
  const isSelected = selectedOrgId === node.id;
  const indent = level * 24; // 24px per level

  return (
    <div className="select-none">
      {/* Node Row */}
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-lg transition-colors hover:bg-muted/50",
          isSelected && "bg-primary/10 hover:bg-primary/15"
        )}
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors",
            !hasChildren && "invisible"
          )}
          aria-label={node.isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren && (
            node.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </button>

        {/* Organization Icon */}
        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />

        {/* Organization Info */}
        <button
          onClick={() => onSelect?.(node)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <span className="font-medium truncate">{node.name}</span>
          <Badge variant="outline" className={cn("text-xs shrink-0", getOrgTypeColor(node.organizationType))}>
            {getOrgTypeLabel(node.organizationType)}
          </Badge>
          {node.clcAffiliated && (
            <Badge variant="outline" className="text-xs shrink-0 bg-blue-50 text-blue-700 border-blue-300">
              CLC
            </Badge>
          )}
          {node.memberCount && node.memberCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Users className="w-3 h-3" />
              <span>{formatMemberCount(node.memberCount)}</span>
            </div>
          )}
        </button>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {onAddChild && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node);
                }}
                className="h-7 w-7 p-0"
                title="Add child organization"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node);
                }}
                className="h-7 w-7 p-0"
                title="Edit organization"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node);
                }}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                title="Delete organization"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && node.isExpanded && (
        <div className="mt-1">
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onSelect={onSelect}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              selectedOrgId={selectedOrgId}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function OrganizationTree({
  organizations,
  onSelectOrganization,
  onEditOrganization,
  onAddChild,
  onDeleteOrganization,
  selectedOrgId,
  className,
  showActions = true,
  expandLevel = 1,
}: OrganizationTreeProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Build initial tree
  useEffect(() => {
    const tree = buildTree(organizations);
    setTreeData(tree);
  }, [organizations]);

  // Auto-expand to specified level
  useEffect(() => {
    if (expandLevel === undefined) return;

    setTreeData((prevTree) => {
      const expandToLevel = (nodes: TreeNode[], currentLevel: number): TreeNode[] => {
        return nodes.map((node) => ({
          ...node,
          isExpanded:
            expandLevel === -1
              ? true // Expand all
              : currentLevel < expandLevel,
          children:
            node.children.length > 0
              ? expandToLevel(node.children, currentLevel + 1)
              : node.children,
        }));
      };

      return expandToLevel(prevTree, 0);
    });
  }, [expandLevel]);

  // Apply filters whenever search or type filter changes
  useEffect(() => {
    setTreeData((prevTree) => {
      const clonedTree = JSON.parse(JSON.stringify(prevTree)) as TreeNode[];
      applyFilter(clonedTree, searchTerm, typeFilter);
      return clonedTree;
    });
  }, [searchTerm, typeFilter]);

  // Toggle expand/collapse
  const handleToggle = useCallback((nodeId: string) => {
    setTreeData((prevTree) => {
      const toggleNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children.length > 0) {
            return { ...node, children: toggleNode(node.children) };
          }
          return node;
        });
      };

      return toggleNode(prevTree);
    });
  }, []);

  // Expand all
  const handleExpandAll = useCallback(() => {
    setTreeData((prevTree) => {
      const expandAll = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => ({
          ...node,
          isExpanded: true,
          children: node.children.length > 0 ? expandAll(node.children) : node.children,
        }));
      };

      return expandAll(prevTree);
    });
  }, []);

  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setTreeData((prevTree) => {
      const collapseAll = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => ({
          ...node,
          isExpanded: false,
          children: node.children.length > 0 ? collapseAll(node.children) : node.children,
        }));
      };

      return collapseAll(prevTree);
    });
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    let total = 0;
    let visible = 0;
    let totalMembers = 0;

    const countNodes = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        total++;
        if (node.matchesFilter) visible++;
        totalMembers += node.memberCount || 0;
        if (node.children.length > 0) countNodes(node.children);
      });
    };

    countNodes(treeData);

    return { total, visible, totalMembers };
  }, [treeData]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Organization Hierarchy</CardTitle>
            <CardDescription>
              {stats.visible} of {stats.total} organizations
              {stats.totalMembers > 0 && ` · ${formatMemberCount(stats.totalMembers)} total members`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExpandAll}>
              Expand All
            </Button>
            <Button size="sm" variant="outline" onClick={handleCollapseAll}>
              Collapse All
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
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
        </div>
      </CardHeader>

      <CardContent>
        {treeData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No organizations found</p>
          </div>
        ) : stats.visible === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No organizations match your filters</p>
            <Button
              size="sm"
              variant="link"
              onClick={() => {
                setSearchTerm("");
                setTypeFilter(null);
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {treeData.map((node) => (
              <TreeNodeComponent
                key={node.id}
                node={node}
                level={0}
                onToggle={handleToggle}
                onSelect={onSelectOrganization}
                onEdit={onEditOrganization}
                onAddChild={onAddChild}
                onDelete={onDeleteOrganization}
                selectedOrgId={selectedOrgId}
                showActions={showActions}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

