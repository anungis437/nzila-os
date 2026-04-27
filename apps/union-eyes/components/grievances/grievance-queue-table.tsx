/**
 * Grievance Queue Table
 *
 * Enterprise-grade data table for the steward/staff grievance queue.
 * Supports sorting, row click, priority badges, status badges,
 * overdue indicators, and bulk selection.
 *
 * @module components/grievances/grievance-queue-table
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { format, differenceInDays, isPast } from "date-fns";
import {
  AlertTriangle,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  Eye,
  UserPlus,
  Send,
  Scale,
  CheckCircle,
} from "lucide-react";
import { DataTableAdvanced } from "@/components/ui/data-table-advanced";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface GrievanceRow {
  id: string;
  grievanceNumber: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  grievantName: string;
  employerName: string;
  stewardName: string | null;
  filedDate: string | null;
  responseDeadline: string | null;
  lastUpdated: string;
  step: string | null;
}

export interface GrievanceQueueTableProps {
  data: GrievanceRow[];
  loading?: boolean;
  onView?: (row: GrievanceRow) => void;
  onAssign?: (row: GrievanceRow) => void;
  onEscalate?: (row: GrievanceRow) => void;
  onExport?: (format: "csv" | "excel") => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  filed: "bg-blue-100 text-blue-700",
  acknowledged: "bg-blue-100 text-blue-700",
  investigating: "bg-yellow-100 text-yellow-700",
  response_due: "bg-orange-100 text-orange-700",
  response_received: "bg-cyan-100 text-cyan-700",
  escalated: "bg-red-100 text-red-700",
  mediation: "bg-purple-100 text-purple-700",
  arbitration: "bg-red-100 text-red-700",
  settled: "bg-green-100 text-green-700",
  withdrawn: "bg-gray-100 text-gray-500",
  denied: "bg-gray-100 text-gray-500",
  closed: "bg-gray-100 text-gray-500",
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("text-xs capitalize", STATUS_VARIANT[status] ?? "bg-gray-100")}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", PRIORITY_VARIANT[priority])}
    >
      {priority === "urgent" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {priority}
    </Badge>
  );
}

function DeadlineCell({ deadline }: { deadline: string | null }) {
  const t = useTranslations("grievanceQueue");
  if (!deadline) return <span className="text-muted-foreground text-xs">—</span>;
  const date = new Date(deadline);
  const isOverdue = isPast(date);
  const daysLeft = differenceInDays(date, new Date());

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            isOverdue && "text-red-600 font-semibold",
            !isOverdue && daysLeft <= 3 && "text-orange-600",
            !isOverdue && daysLeft > 3 && "text-muted-foreground"
          )}
        >
          {isOverdue ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("daysOverdue", { days: Math.abs(daysLeft) })}
            </span>
          ) : (
            t("daysLeft", { days: daysLeft })
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{format(date, "PPP")}</TooltipContent>
    </Tooltip>
  );
}

// ─── Component ────────────────────────────────────────────────

export function GrievanceQueueTable({
  data,
  loading,
  onView,
  onAssign,
  onEscalate,
  onExport,
  className,
}: GrievanceQueueTableProps) {
  const t = useTranslations("grievanceQueue");
  const columns: ColumnDef<GrievanceRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "grievanceNumber",
        header: t("columns.caseNumber"),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.grievanceNumber}</span>
        ),
        size: 110,
      },
      {
        accessorKey: "title",
        header: t("columns.grievance"),
        cell: ({ row }) => (
          <div className="max-w-[240px]">
            <p className="text-sm font-medium truncate">{row.original.title}</p>
            <p className="text-xs text-muted-foreground truncate">{row.original.grievantName}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 130,
      },
      {
        accessorKey: "priority",
        header: t("columns.priority"),
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
        size: 100,
      },
      {
        accessorKey: "employerName",
        header: t("columns.employer"),
        cell: ({ row }) => (
          <span className="text-sm truncate max-w-[150px] inline-block">
            {row.original.employerName}
          </span>
        ),
      },
      {
        accessorKey: "stewardName",
        header: t("columns.steward"),
        cell: ({ row }) =>
          row.original.stewardName ? (
            <span className="text-sm">{row.original.stewardName}</span>
          ) : (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              {t("unassigned")}
            </Badge>
          ),
        size: 130,
      },
      {
        accessorKey: "responseDeadline",
        header: t("columns.deadline"),
        cell: ({ row }) => <DeadlineCell deadline={row.original.responseDeadline} />,
        size: 110,
      },
      {
        accessorKey: "lastUpdated",
        header: t("columns.updated"),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.lastUpdated ? format(new Date(row.original.lastUpdated), "MMM d") : "—"}
          </span>
        ),
        size: 90,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(row.original)}>
                <Eye className="h-4 w-4 mr-2" />
                {t("actions.viewDetails")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAssign?.(row.original)}>
                <UserPlus className="h-4 w-4 mr-2" />
                {t("actions.assignSteward")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Send className="h-4 w-4 mr-2" />
                {t("actions.contactEmployer")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEscalate?.(row.original)}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                {t("actions.escalate")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Scale className="h-4 w-4 mr-2" />
                {t("actions.sendArbitration")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("actions.resolve")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 50,
      },
    ],
    [onView, onAssign, onEscalate, t]
  );

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <DataTableAdvanced
      columns={columns}
      data={data}
      searchKey="title"
      searchPlaceholder={t("searchPlaceholder")}
      onRowClick={(row) => onView?.(row.original)}
      onExport={onExport}
      enableRowSelection
      enablePagination
      pageSize={20}
      className={className}
    />
  );
}
