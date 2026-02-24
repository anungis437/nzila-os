"use client";

/**
 * Organization Tree Visualization Component
 * Interactive hierarchical tree view for CLC -> Federation -> Union -> Local structure
 */

import React from 'react';
import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Building2, Globe, Users, MapPin, Network, GitBranch, Loader2, AlertCircle, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Organization, OrganizationType } from "@/types/organization";

interface OrganizationTreeNode extends Organization {
  children?: OrganizationTreeNode[];
  memberCount?: number;
  childCount?: number;
  isLoading?: boolean;
  isExpanded?: boolean;
}

interface OrganizationTreeProps {
  rootOrgId?: string;
  onSelectOrganization?: (org: OrganizationTreeNode) => void;
  onSelect?: (org: OrganizationTreeNode) => void;
  selectedOrgId?: string;
  maxDepth?: number;
  showMemberCount?: boolean;
  className?: string;
}

const typeConfig: Record<OrganizationType, { label: string; icon: React.ReactElement; color: string }> = {
  platform: { label: "Platform", icon: <Layers className="w-4 h-4" />, color: "text-rose-600" },
  congress: { label: "Congress", icon: <Globe className="w-4 h-4" />, color: "text-blue-600" },
  federation: { label: "Federation", icon: <Network className="w-4 h-4" />, color: "text-purple-600" },
  union: { label: "Union", icon: <Building2 className="w-4 h-4" />, color: "text-green-600" },
  local: { label: "Local", icon: <Users className="w-4 h-4" />, color: "text-orange-600" },
  region: { label: "Region", icon: <MapPin className="w-4 h-4" />, color: "text-teal-600" },
  district: { label: "District", icon: <GitBranch className="w-4 h-4" />, color: "text-indigo-600" }
};

export function OrganizationTree({
  rootOrgId,
  onSelectOrganization,
  onSelect,
  selectedOrgId,
  maxDepth = 10,
  showMemberCount = true,
  className
}: OrganizationTreeProps) {
  const [treeData, setTreeData] = useState<OrganizationTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = rootOrgId 
        ? `/api/organizations/${rootOrgId}?include_children=true&include_stats=true`
        : `/api/organizations/tree`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load organization tree");
      
      const data = await response.json();
      setTreeData(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tree");
    } finally {
      setLoading(false);
    }
  }, [rootOrgId]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const loadChildren = async (node: OrganizationTreeNode, path: number[]) => {
    const updateTree = (tree: OrganizationTreeNode, targetPath: number[], children: OrganizationTreeNode[]): OrganizationTreeNode => {
      if (targetPath.length === 0) {
        return { ...tree, children, isExpanded: true, isLoading: false };
      }
      
      const [index, ...rest] = targetPath;
      const newChildren = tree.children ? [...tree.children] : [];
      if (newChildren[index]) {
        newChildren[index] = updateTree(newChildren[index], rest, children);
      }
      
      return { ...tree, children: newChildren };
    };

    // Mark as loading
    setTreeData(prev => {
      if (!prev) return null;
      return updateTree(prev, path, []);
    });

    try {
      const response = await fetch(`/api/organizations/${node.id}/children?include_stats=true`);
      if (!response.ok) throw new Error("Failed to load children");
      
      const data = await response.json();
      const children: OrganizationTreeNode[] = data.data || [];
      
      setTreeData(prev => {
        if (!prev) return null;
        return updateTree(prev, path, children);
      });
    } catch (_err) {
setTreeData(prev => {
        if (!prev) return null;
        return updateTree(prev, path, []);
      });
    }
  };

  const toggleNode = (node: OrganizationTreeNode, path: number[]) => {
    if (!node.isExpanded && (!node.children || node.children.length === 0)) {
      loadChildren(node, path);
    } else {
      // Just toggle expanded state
      const updateTree = (tree: OrganizationTreeNode, targetPath: number[]): OrganizationTreeNode => {
        if (targetPath.length === 0) {
          return { ...tree, isExpanded: !tree.isExpanded };
        }
        
        const [index, ...rest] = targetPath;
        const newChildren = tree.children ? [...tree.children] : [];
        if (newChildren[index]) {
          newChildren[index] = updateTree(newChildren[index], rest);
        }
        
        return { ...tree, children: newChildren };
      };

      setTreeData(prev => prev ? updateTree(prev, path) : null);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading organization tree...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !treeData) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-sm text-destructive">{error || "Failed to load tree"}</p>
            <Button variant="outline" size="sm" onClick={loadTree}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Organization Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <TreeNode
            node={treeData}
            path={[]}
            depth={0}
            maxDepth={maxDepth}
            onToggle={toggleNode}
            onSelect={onSelect || onSelectOrganization}
            selectedId={selectedOrgId}
            showMemberCount={showMemberCount}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface TreeNodeProps {
  node: OrganizationTreeNode;
  path: number[];
  depth: number;
  maxDepth: number;
  onToggle: (node: OrganizationTreeNode, path: number[]) => void;
  onSelect?: (node: OrganizationTreeNode) => void;
  selectedId?: string;
  showMemberCount: boolean;
}

function TreeNode({ node, path, depth, maxDepth, onToggle, onSelect, selectedId, showMemberCount }: TreeNodeProps) {
  const hasChildren = (node.childCount && node.childCount > 0) || (node.children && node.children.length > 0);
  const isExpanded = node.isExpanded || false;
  const isSelected = selectedId === node.id;
  const config = typeConfig[node.organization_type];
  const canExpand = hasChildren && depth < maxDepth;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md hover:bg-accent cursor-pointer transition-colors",
          isSelected && "bg-accent border-l-2 border-primary"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
        onClick={() => onSelect?.(node)}
      >
        {canExpand ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node, path);
            }}
            className="p-0.5 hover:bg-accent-foreground/10 rounded"
          >
            {node.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}
        
        <div className={cn("shrink-0", config.color)}>
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{node.name}</span>
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
          </div>
          {node.slug && (
            <p className="text-xs text-muted-foreground truncate">@{node.slug}</p>
          )}
        </div>
        
        {showMemberCount && node.memberCount !== undefined && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {node.memberCount.toLocaleString()}
          </Badge>
        )}
        
        {hasChildren && (
          <Badge variant="outline" className="text-xs">
            {node.childCount || node.children?.length || 0} {(node.childCount || node.children?.length || 0) === 1 ? 'child' : 'children'}
          </Badge>
        )}
      </div>
      
      {isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              path={[...path, index]}
              depth={depth + 1}
              maxDepth={maxDepth}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              showMemberCount={showMemberCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

