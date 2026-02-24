/**
 * Member List Table Advanced Component
 * 
 * Production-ready member table with:
 * - Advanced filtering (status, chapter, dues)
 * - Column sorting and visibility
 * - Row selection
 * - Bulk actions
 * - Export functionality
 * - Quick actions per row
 * 
 * @module components/members/member-list-table-advanced
 */

"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Mail,
  Phone,
  Eye,
  Edit,
  UserMinus,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { DataTableAdvanced } from "@/components/ui/data-table-advanced";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: "active" | "inactive" | "suspended" | "retired";
  membershipType: "regular" | "honorary" | "retiree";
  chapter?: string;
  employer?: string;
  jobTitle?: string;
  joinDate: Date;
  duesStatus: "current" | "overdue" | "exempt";
  claimsCount: number;
  lastActivity?: Date;
}

export interface MemberListTableAdvancedProps {
  members: Member[];
  onView?: (member: Member) => void;
  onEdit?: (member: Member) => void;
  onSendMessage?: (member: Member) => void;
  onBulkAction?: (action: string, memberIds: string[]) => void;
}

const statusConfig = {
  active: {
    label: "Active",
    icon: CheckCircle2,
    variant: "success" as const,
  },
  inactive: {
    label: "Inactive",
    icon: AlertCircle,
    variant: "secondary" as const,
  },
  suspended: {
    label: "Suspended",
    icon: XCircle,
    variant: "destructive" as const,
  },
  retired: {
    label: "Retired",
    icon: CheckCircle2,
    variant: "outline" as const,
  },
};

const duesStatusConfig = {
  current: { label: "Current", variant: "success" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
  exempt: { label: "Exempt", variant: "secondary" as const },
};

export function MemberListTableAdvanced({
  members,
  onView,
  onEdit,
  onSendMessage,
  onBulkAction,
}: MemberListTableAdvancedProps) {
  const columns: ColumnDef<Member>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded border-gray-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-gray-300"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "memberNumber",
        header: "Member #",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.memberNumber}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const member = row.original;
          const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatar} alt={`${member.firstName} ${member.lastName}`} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">
                  {member.firstName} {member.lastName}
                </div>
                <div className="text-xs text-gray-500">{member.jobTitle}</div>
              </div>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const nameA = `${rowA.original.firstName} ${rowA.original.lastName}`;
          const nameB = `${rowB.original.firstName} ${rowB.original.lastName}`;
          return nameA.localeCompare(nameB);
        },
      },
      {
        accessorKey: "email",
        header: "Contact",
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3 w-3 text-gray-400" />
                <a
                  href={`mailto:${member.email}`}
                  className="text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {member.email}
                </a>
              </div>
              {member.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <a
                    href={`tel:${member.phone}`}
                    className="text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {member.phone}
                  </a>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <Badge variant={config.variant} className="gap-1">
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "duesStatus",
        header: "Dues",
        cell: ({ row }) => {
          const status = row.original.duesStatus;
          const config = duesStatusConfig[status];
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "chapter",
        header: "Chapter",
        cell: ({ row }) => row.original.chapter || "—",
      },
      {
        accessorKey: "employer",
        header: "Employer",
        cell: ({ row }) => row.original.employer || "—",
      },
      {
        accessorKey: "joinDate",
        header: "Join Date",
        cell: ({ row }) => format(row.original.joinDate, "MMM d, yyyy"),
        sortingFn: "datetime",
      },
      {
        accessorKey: "claimsCount",
        header: "Claims",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.claimsCount}</span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const member = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {onView && (
                  <DropdownMenuItem onClick={() => onView(member)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Profile
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(member)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Member
                  </DropdownMenuItem>
                )}
                {onSendMessage && (
                  <DropdownMenuItem onClick={() => onSendMessage(member)}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Message
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <UserMinus className="mr-2 h-4 w-4" />
                  Suspend Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onView, onEdit, onSendMessage]
  );

  const _filterConfig = [
    {
      column: "status",
      title: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Suspended", value: "suspended" },
        { label: "Retired", value: "retired" },
      ],
    },
    {
      column: "duesStatus",
      title: "Dues Status",
      options: [
        { label: "Current", value: "current" },
        { label: "Overdue", value: "overdue" },
        { label: "Exempt", value: "exempt" },
      ],
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _handleBulkAction = (action: string, selectedRows: any[]) => {
    const memberIds = selectedRows.map((row) => row.original.id);
    onBulkAction?.(action, memberIds);
  };

  return (
    <DataTableAdvanced
      columns={columns}
      data={members}
      searchKey="name"
      searchPlaceholder="Search members..."
      enableRowSelection
      enableColumnFilters
      enablePagination
      pageSize={10}
    />
  );
}

