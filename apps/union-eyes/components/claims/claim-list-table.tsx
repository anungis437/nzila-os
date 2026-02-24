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
import { ColumnDef } from "@tanstack/react-table";
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
 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface ClaimRow {
  claimId: string;
  claimNumber: string;
  memberName: string;
  memberAvatar?: string;
  claimType: string;
  status: string;
  priority: string;
  incidentDate: Date;
  createdAt: Date;
  assignedToName?: string;
}

export interface ClaimListTableProps {
  data: ClaimRow[];
  onView?: (claim: ClaimRow) => void;
  onEdit?: (claim: ClaimRow) => void;
  onDelete?: (claim: ClaimRow) => void;
  onStatusChange?: (claimId: string, status: string) => void;
  loading?: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  "in-review": { label: "In Review", variant: "default" },
  "under-investigation": { label: "Investigating", variant: "default" },
  resolved: { label: "Resolved", variant: "outline" },
  closed: { label: "Closed", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-gray-700 bg-gray-100" },
  medium: { label: "Medium", color: "text-blue-700 bg-blue-100" },
  high: { label: "High", color: "text-orange-700 bg-orange-100" },
  urgent: { label: "Urgent", color: "text-red-700 bg-red-100" },
};

export function ClaimListTable({
  data,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  loading: _loading = false,
}: ClaimListTableProps) {
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
        <div className="font-medium">{row.getValue("claimNumber")}</div>
      ),
    },
    {
      accessorKey: "memberName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Member" />
      ),
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={member.memberAvatar} />
              <AvatarFallback>
                {member.memberName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{member.memberName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "claimType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <span className="capitalize">{row.getValue("claimType")}</span>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const config = statusConfig[status];
        return (
          <Badge variant={config?.variant || "secondary"}>
            {config?.label || status}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string;
        const config = priorityConfig[priority];
        return (
          <Badge className={config?.color}>
            {config?.label || priority}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "incidentDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Incident Date" />
      ),
      cell: ({ row }) => {
        return format(row.getValue("incidentDate"), "MMM d, yyyy");
      },
    },
    {
      accessorKey: "assignedToName",
      header: "Assigned To",
      cell: ({ row }) => {
        const name = row.getValue("assignedToName") as string | undefined;
        return name ? (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-gray-400" />
            <span className="text-sm">{name}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Unassigned</span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => {
        return format(row.getValue("createdAt"), "MMM d, yyyy");
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
                    onClick={() => onStatusChange(claim.claimId, "in-review")}
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

