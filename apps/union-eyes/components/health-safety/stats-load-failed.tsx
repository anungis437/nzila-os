/**
 * Shown above a screen's figures when its statistics could not be read: the figures are then dashes (unknown), and this says why and lets
 * the user try again.
 */
"use client";

import { useLocale } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const COPY = {
  en: {
    failed: "The statistics could not be loaded. A dash means the figure is unknown, not zero.",
    retry: "Retry",
  },
  fr: {
    failed: "Les statistiques n’ont pas pu être chargées. Un tiret signifie que le chiffre est inconnu, et non nul.",
    retry: "Réessayer",
  },
} as const;

export function StatsLoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  const copy = useLocale().toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{copy.failed}</p>
          {message !== "" && <p className="mt-1 text-xs opacity-80">{message}</p>}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {copy.retry}
      </Button>
    </div>
  );
}
