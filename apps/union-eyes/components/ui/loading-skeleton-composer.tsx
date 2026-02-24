/**
 * Loading Skeleton Composer Component
 * 
 * Flexible skeleton loader with:
 * - Pre-built layouts (card, table, list, form)
 * - Custom composition
 * - Animation variants
 * - Responsive design
 * 
 * @module components/ui/loading-skeleton-composer
 */

"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SkeletonComposerProps {
  variant?: "card" | "table" | "list" | "form" | "custom";
  rows?: number;
  className?: string;
  children?: React.ReactNode;
}

export function LoadingSkeletonComposer({
  variant = "card",
  rows = 3,
  className,
  children,
}: SkeletonComposerProps) {
  if (variant === "custom" && children) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {variant === "card" && <SkeletonCard rows={rows} />}
      {variant === "table" && <SkeletonTable rows={rows} />}
      {variant === "list" && <SkeletonList rows={rows} />}
      {variant === "form" && <SkeletonForm rows={rows} />}
    </div>
  );
}

// Pre-built Skeleton Layouts

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20 ml-auto" />
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b p-4 last:border-b-0">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function SkeletonForm({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

// Helper Components for Custom Composition

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-5/6" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <Skeleton className={cn(sizeMap[size], "rounded-full", className)} />
  );
}

export function SkeletonButton({
  className,
}: {
  className?: string;
}) {
  return <Skeleton className={cn("h-10 w-24 rounded-md", className)} />;
}

export function SkeletonImage({
  aspect = "video",
  className,
}: {
  aspect?: "square" | "video" | "portrait";
  className?: string;
}) {
  const aspectMap = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  };

  return (
    <Skeleton className={cn("w-full rounded-md", aspectMap[aspect], className)} />
  );
}

