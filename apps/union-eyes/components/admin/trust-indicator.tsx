"use client";

import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

interface TrustIndicatorProps {
  sourceSystem?: string | null;
  importBatchId?: string | null;
  verified?: boolean;
  className?: string;
}

/**
 * Trust Indicator (§4)
 *
 * Visual badge showing whether a case was imported from a legacy system
 * and whether the import has been verified.
 *
 * States:
 * - Native: no source_system → no badge shown
 * - Imported + Verified: green shield badge
 * - Imported + Unverified: amber warning badge
 */
export default function TrustIndicator({
  sourceSystem,
  importBatchId,
  verified = false,
  className,
}: TrustIndicatorProps) {
  // Native records — no indicator needed
  if (!sourceSystem && !importBatchId) return null;

  if (verified) {
    return (
      <Badge variant="outline" className={`gap-1 border-green-200 bg-green-50 text-green-700 ${className ?? ""}`}>
        <CheckCircle2 className="h-3 w-3" />
        Migration verified
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`gap-1 border-amber-200 bg-amber-50 text-amber-700 ${className ?? ""}`}>
      <Shield className="h-3 w-3" />
      Imported from {sourceSystem ?? "legacy system"}
    </Badge>
  );
}

/**
 * Compact trust indicator for table rows
 */
export function TrustBadge({
  sourceSystem,
  verified,
}: { sourceSystem?: string | null; verified?: boolean }) {
  if (!sourceSystem) return null;

  if (verified) {
    return (
      <span title="Migration verified" className="inline-flex items-center text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span title={`Imported from ${sourceSystem}`} className="inline-flex items-center text-amber-500">
      <AlertTriangle className="h-3.5 w-3.5" />
    </span>
  );
}
