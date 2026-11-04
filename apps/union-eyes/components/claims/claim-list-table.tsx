/**
 * Claim List Table Component
 * 
 * Advanced table for displaying claims with:
 * - Sorting, filtering, pagination
 * - Status and priority badges
 * - Quick actions
 * - Row selection
 * - Export functionality
 * - Responsive design
 * 
 * @module components/claims/claim-list-table
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import { ColumnDef, FilterFn } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash,
  CheckCircle,
  Clock,
  User,
} from "lucide-react";
import { DataTableAdvanced, DataTableColumnHeader } from "@/components/ui/data-table-advanced";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClaimLabels } from "@/components/claims/claim-labels";
import type { ClaimRow } from "@/components/claims/claim-row";

export type { ClaimRow };

export interface ClaimListTableProps {
  data: ClaimRow[];
  onView?: (claim: ClaimRow) => void;
  onEdit?: (claim: ClaimRow) => void;
  onDelete?: (claim: ClaimRow) => void;
  onStatusChange?: (claimId: string, status: string) => void;
  loading?: boolean;
}

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "resolved") return "outline";
  if (status === "rejected") return "destructive";
  if (status === "closed") return "secondary";
  return "default";
};

const priorityColor: Record<string, string> = {
  low: "text-gray-700 bg-gray-100",
  medium: "text-blue-700 bg-blue-100",
  high: "text-orange-700 bg-orange-100",
  critical: "text-red-700 bg-red-100",
};

/** A faceted filter holds the chosen values; a row passes when its value is one of them. */
const facetFilter: FilterFn<ClaimRow> = (row, id, value: unknown) => Array.isArray(value) && value.includes(row.getValue(id));

export function ClaimListTable({
  data,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  loading: _loading = false,
}: ClaimListTableProps) {
  const { typeLabel, statusLabel, priorityLabel } = useClaimLabels();
  const columns: ColumnDef<ClaimRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "claimNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Claim #" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.original.claimNumber ?? "—"}</div>
      ),
    },
    {
      accessorKey: "memberName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Member" />
      ),
      cell: ({ row }) => {
        const claim = row.original;
        if (claim.memberName !== null) return <span className="truncate">{claim.memberName}</span>;
        // The triage queue shows what a case is, never whose: the absence is the design, not a missing value.
        return (
          <span className="text-sm text-gray-400">{claim.triageOnly ? "Triage queue" : "—"}</span>
        );
      },
    },
    {
      accessorKey: "claimType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <span>{row.original.claimType === null ? "—" : typeLabel(row.original.claimType)}</span>
      ),
      filterFn: facetFilter,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
      },
      filterFn: facetFilter,
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => {
        const priority = row.original.priority;
        return <Badge className={priorityColor[priority]}>{priorityLabel(priority)}</Badge>;
      },
      filterFn: facetFilter,
    },
    {
      accessorKey: "incidentDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Incident Date" />
      ),
      cell: ({ row }) => {
        const date = row.original.incidentDate;
        return date === null ? "—" : format(date, "MMM d, yyyy");
      },
    },
    {
      accessorKey: "assignedToName",
      header: "Assigned To",
      cell: ({ row }) => {
        const claim = row.original;
        if (!claim.assigned) return <span className="text-sm text-gray-400">Unassigned</span>;
        return (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-gray-400" />
            <span className="text-sm">{claim.assignedToName ?? "Assigned"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => {
        return format(row.original.createdAt, "MMM d, yyyy");
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const claim = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onView && (
                <DropdownMenuItem onClick={() => onView(claim)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(claim)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onStatusChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onStatusChange(claim.claimId, "under_review")}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Mark In Review
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusChange(claim.claimId, "resolved")}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Resolved
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(claim)}
                    className="text-red-600"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DataTableAdvanced
      columns={columns}
      data={data}
      searchKey="memberName"
      searchPlaceholder="Search by member name..."
      enableRowSelection
      enableColumnFilters
      enablePagination
      pageSize={10}
    />
  );
}

