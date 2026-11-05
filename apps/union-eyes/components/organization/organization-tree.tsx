"use client";

/**
 * Organization Tree Visualization Component
 * Interactive hierarchical tree view for CLC -> Federation -> Union -> Local structure
 *
 * Reads GET /api/organizations/tree, which answers plain JSON { data: [organizations] }: a flat list, each organization with its parentId, of the organizations
 * the caller may read. The tree is nested here, and an organization whose parent is not in the list is shown at the top. A list that could not be read is an
 * error with a retry, not an empty tree; a member count the route does not have is a dash, not zero.
 */

import React from "react";
import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Building2, Globe, Users, MapPin, Network, GitBranch, Loader2, AlertCircle, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { isRecord, readApiError } from "@/lib/client/api-envelope";
import { ApiShapeError, asRecord, countOrNull, humanize, optionalString, requiredString } from "@/lib/client/row-fields";

interface OrganizationTreeNode {
  id: string;
  name: string;
  slug: string | null;
  type: string | null;
  /** Null where the count was never computed. */
  memberCount: number | null;
  children: OrganizationTreeNode[];
}

interface OrganizationTreeProps {
  onSelectOrganization?: (org: OrganizationTreeNode) => void;
  onSelect?: (org: OrganizationTreeNode) => void;
  selectedOrgId?: string;
  maxDepth?: number;
  showMemberCount?: boolean;
  className?: string;
}

const typeConfig: Record<string, { label: string; icon: React.ReactElement; color: string }> = {
  platform: { label: "Platform", icon: <Layers className="w-4 h-4" />, color: "text-rose-600" },
  congress: { label: "Congress", icon: <Globe className="w-4 h-4" />, color: "text-blue-600" },
  federation: { label: "Federation", icon: <Network className="w-4 h-4" />, color: "text-purple-600" },
  union: { label: "Union", icon: <Building2 className="w-4 h-4" />, color: "text-green-600" },
  local: { label: "Local", icon: <Users className="w-4 h-4" />, color: "text-orange-600" },
  region: { label: "Region", icon: <MapPin className="w-4 h-4" />, color: "text-teal-600" },
  district: { label: "District", icon: <GitBranch className="w-4 h-4" />, color: "text-indigo-600" }
};

const fallbackConfig = { icon: <Building2 className="w-4 h-4" />, color: "text-muted-foreground" };

function toRow(raw: unknown): { node: OrganizationTreeNode; parentId: string | null } {
  const row = asRecord(raw, "organization");
  return {
    node: {
      id: requiredString(row, "id"),
      name: requiredString(row, "name"),
      slug: optionalString(row, "slug"),
      // The route names the type both ways; the canonical list names it `type` only.
      type: optionalString(row, "type") ?? optionalString(row, "organization_type"),
      // member_count is null where the count was never computed (memberCount is that or 0); the canonical list has memberCount only.
      memberCount: "member_count" in row ? countOrNull(row, "member_count") : countOrNull(row, "memberCount"),
      children: [],
    },
    parentId: optionalString(row, "parentId"),
  };
}

const countNodes = (nodes: OrganizationTreeNode[]): number => nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);

/** Nests the flat list. An organization whose parent is not in it (the caller may not read the parent) is a root. */
function buildTree(rows: unknown[]): OrganizationTreeNode[] {
  const parsed = rows.map(toRow);
  const byId = new Map(parsed.map(({ node }) => [node.id, node]));
  const roots: OrganizationTreeNode[] = [];
  for (const { node, parentId } of parsed) {
    const parent = parentId !== null && parentId !== node.id ? byId.get(parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  // Organizations that are each other's ancestors would be in no root and silently vanish.
  if (countNodes(roots) !== parsed.length) throw new ApiShapeError("the organizations do not form a hierarchy");
  return roots;
}

async function loadTree(): Promise<OrganizationTreeNode[]> {
  const response = await fetch("/api/organizations/tree");
  if (!response.ok) throw new Error(await readApiError(response, `The organization tree could not be loaded (HTTP ${response.status}).`));
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no organizations");
  return buildTree(body.data);
}

type TreeState =
  | { status: "loading" }
  | { status: "ready"; roots: OrganizationTreeNode[] }
  | { status: "failed"; message: string };

export function OrganizationTree({
  onSelectOrganization,
  onSelect,
  selectedOrgId,
  maxDepth = 10,
  showMemberCount = true,
  className
}: OrganizationTreeProps) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; state: TreeState } | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadTree().then(
      (roots) => {
        if (cancelled) return;
        setLoaded({ attempt, state: { status: "ready", roots } });
        // A single root is opened, so that the first level of the hierarchy is in view.
        setExpanded(roots.length === 1 ? new Set([roots[0].id]) : new Set());
      },
      (failure: unknown) => {
        logger.error("Failed to load the organization tree", failure);
        if (!cancelled) setLoaded({ attempt, state: { status: "failed", message: failure instanceof Error ? failure.message : "The organization tree could not be loaded." } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const state: TreeState = loaded !== null && loaded.attempt === attempt ? loaded.state : { status: "loading" };

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  if (state.status === "loading") {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div role="status" className="text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading organization tree...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "failed") {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div role="alert" className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
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
        {state.roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations are visible to you.</p>
        ) : (
          <div role="tree" className="space-y-1">
            {state.roots.map((root) => (
              <TreeNode
                key={root.id}
                node={root}
                depth={0}
                maxDepth={maxDepth}
                expanded={expanded}
                onToggle={toggle}
                onSelect={onSelect || onSelectOrganization}
                selectedId={selectedOrgId}
                showMemberCount={showMemberCount}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TreeNodeProps {
  node: OrganizationTreeNode;
  depth: number;
  maxDepth: number;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect?: (node: OrganizationTreeNode) => void;
  selectedId?: string;
  showMemberCount: boolean;
}

function TreeNode({ node, depth, maxDepth, expanded, onToggle, onSelect, selectedId, showMemberCount }: TreeNodeProps) {
  const childCount = node.children.length;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const known = node.type !== null ? typeConfig[node.type] : undefined;
  const icon = known?.icon ?? fallbackConfig.icon;
  const color = known?.color ?? fallbackConfig.color;
  const typeLabel = node.type === null ? null : known?.label ?? humanize(node.type);
  const canExpand = childCount > 0 && depth < maxDepth;

  const label = (
    <>
      <div className={cn("shrink-0", color)}>{icon}</div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{node.name}</span>
          {typeLabel !== null && (
            <Badge variant="outline" className="text-xs capitalize">
              {typeLabel}
            </Badge>
          )}
        </div>
        {node.slug && (
          <p className="text-xs text-muted-foreground truncate">@{node.slug}</p>
        )}
      </div>
    </>
  );

  return (
    <div role="treeitem" aria-expanded={canExpand ? isExpanded : undefined} aria-selected={isSelected}>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md hover:bg-accent transition-colors",
          isSelected && "bg-accent border-l-2 border-primary"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
      >
        {canExpand ? (
          <button
            type="button"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
            onClick={() => onToggle(node.id)}
            className="p-0.5 hover:bg-accent-foreground/10 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {onSelect ? (
          <button type="button" className="flex flex-1 min-w-0 items-center gap-2 cursor-pointer" onClick={() => onSelect(node)}>
            {label}
          </button>
        ) : (
          <div className="flex flex-1 min-w-0 items-center gap-2">{label}</div>
        )}

        {showMemberCount && (
          <Badge variant="secondary" className="flex items-center gap-1" title={node.memberCount === null ? "The member count has not been computed" : undefined}>
            <Users className="w-3 h-3" />
            {node.memberCount === null ? "—" : node.memberCount.toLocaleString()}
          </Badge>
        )}

        {childCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {childCount} {childCount === 1 ? "child" : "children"}
          </Badge>
        )}
      </div>

      {isExpanded && canExpand && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              expanded={expanded}
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
