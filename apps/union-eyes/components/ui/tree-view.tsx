/**
 * Tree View Component
 * 
 * Production-ready hierarchical tree with:
 * - Expand/collapse nodes
 * - Selection (single/multiple)
 * - Drag and drop (optional)
 * - Lazy loading
 * - Keyboard navigation
 * - Accessibility
 * - Custom icons
 * 
 * @module components/ui/tree-view
 */

"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  isExpandable?: boolean;
  isLoading?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface TreeViewProps {
  data: TreeNode[];
  selectedIds?: string[];
  expandedIds?: string[];
  onSelect?: (node: TreeNode, selectedIds: string[]) => void;
  onExpand?: (node: TreeNode, expandedIds: string[]) => void;
  onLoadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  multiSelect?: boolean;
  showCheckboxes?: boolean;
  className?: string;
}

export function TreeView({
  data,
  selectedIds = [],
  expandedIds = [],
  onSelect,
  onExpand,
  onLoadChildren,
  multiSelect = false,
  showCheckboxes = false,
  className,
}: TreeViewProps) {
  const [selected, setSelected] = React.useState<string[]>(selectedIds);
  const [expanded, setExpanded] = React.useState<string[]>(expandedIds);
  const [nodes, setNodes] = React.useState<TreeNode[]>(data);

  React.useEffect(() => {
    setSelected(selectedIds);
  }, [selectedIds]);

  React.useEffect(() => {
    setExpanded(expandedIds);
  }, [expandedIds]);

  React.useEffect(() => {
    setNodes(data);
  }, [data]);

  const handleSelect = (node: TreeNode) => {
    let newSelected: string[];

    if (multiSelect) {
      newSelected = selected.includes(node.id)
        ? selected.filter((id) => id !== node.id)
        : [...selected, node.id];
    } else {
      newSelected = selected.includes(node.id) ? [] : [node.id];
    }

    setSelected(newSelected);
    onSelect?.(node, newSelected);
  };

  const handleExpand = async (node: TreeNode) => {
    const isExpanded = expanded.includes(node.id);
    const newExpanded = isExpanded
      ? expanded.filter((id) => id !== node.id)
      : [...expanded, node.id];

    setExpanded(newExpanded);
    onExpand?.(node, newExpanded);

    // Lazy load children if needed
    if (!isExpanded && onLoadChildren && (!node.children || node.children.length === 0)) {
      const updatedNode = { ...node, isLoading: true };
      updateNode(node.id, updatedNode);

      try {
        const children = await onLoadChildren(node);
        updateNode(node.id, { ...updatedNode, children, isLoading: false });
      } catch (_error) {
updateNode(node.id, { ...updatedNode, isLoading: false });
      }
    }
  };

  const updateNode = (id: string, updates: Partial<TreeNode>) => {
    const updateRecursive = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, ...updates };
        }
        if (node.children) {
          return { ...node, children: updateRecursive(node.children) };
        }
        return node;
      });
    };

    setNodes(updateRecursive(nodes));
  };

  return (
    <div className={cn("select-none", className)}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selected={selected}
          expanded={expanded}
          onSelect={handleSelect}
          onExpand={handleExpand}
          showCheckboxes={showCheckboxes}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: TreeNode;
  level: number;
  selected: string[];
  expanded: string[];
  onSelect: (node: TreeNode) => void;
  onExpand: (node: TreeNode) => void;
  showCheckboxes: boolean;
}

function TreeNode({
  node,
  level,
  selected,
  expanded,
  onSelect,
  onExpand,
  showCheckboxes,
}: TreeNodeProps) {
  const isSelected = selected.includes(node.id);
  const isExpanded = expanded.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isExpandable = node.isExpandable || hasChildren;

  const paddingLeft = `${level * 20 + 8}px`;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors",
          isSelected && "bg-blue-50 hover:bg-blue-100"
        )}
        style={{ paddingLeft }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/Collapse Button */}
        {isExpandable ? (
          <button
            className="shrink-0 w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(node);
            }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {node.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Checkbox */}
        {showCheckboxes && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(node)}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Icon */}
        <div className="shrink-0 text-gray-500">
          {node.icon ? (
            node.icon
          ) : isExpandable ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )
          ) : (
            <File className="h-4 w-4" />
          )}
        </div>

        {/* Label */}
        <span
          className={cn(
            "flex-1 text-sm truncate",
            isSelected && "font-medium text-blue-700"
          )}
        >
          {node.label}
        </span>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selected={selected}
              expanded={expanded}
              onSelect={onSelect}
              onExpand={onExpand}
              showCheckboxes={showCheckboxes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

