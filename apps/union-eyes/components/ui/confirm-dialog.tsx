/**
 * Confirm Dialog Component
 * 
 * Reusable confirmation dialog for dangerous actions with:
 * - Warning variants (info, warning, danger)
 * - Custom titles and descriptions
 * - Customizable action buttons
 * - Keyboard shortcuts (Enter to confirm, Esc to cancel)
 * - Loading states
 * 
 * @module components/ui/confirm-dialog
 */

"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "info" | "warning" | "danger";
  loading?: boolean;
}

const variantConfig = {
  info: {
    icon: Info,
    iconColor: "text-blue-600",
    iconBgColor: "bg-blue-100",
    confirmVariant: "default" as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-yellow-600",
    iconBgColor: "bg-yellow-100",
    confirmVariant: "default" as const,
  },
  danger: {
    icon: AlertCircle,
    iconColor: "text-red-600",
    iconBgColor: "bg-red-100",
    confirmVariant: "destructive" as const,
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  variant = "warning",
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (_error) {
}
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "shrink-0 flex items-center justify-center w-12 h-12 rounded-full",
                config.iconBgColor
              )}
            >
              <Icon className={cn("h-6 w-6", config.iconColor)} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-left mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for easy usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "info" | "warning" | "danger";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "warning",
  });

  const confirm = React.useCallback(
    (options: {
      title?: string;
      description?: string;
      onConfirm: () => void | Promise<void>;
      variant?: "info" | "warning" | "danger";
    }) => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          title: options.title || "Are you sure?",
          description: options.description || "This action cannot be undone.",
          onConfirm: async () => {
            await options.onConfirm();
            resolve(true);
          },
          variant: options.variant || "warning",
        });
      });
    },
    []
  );

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      title={state.title}
      description={state.description}
      onConfirm={state.onConfirm}
      variant={state.variant}
    />
  );

  return { confirm, dialog };
}

