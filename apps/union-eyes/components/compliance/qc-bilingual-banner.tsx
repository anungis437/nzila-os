"use client";

/**
 * QC Bilingual Banner
 *
 * Displays when an organization's province is Quebec (QC) and the user is
 * viewing the app in a non-French locale. Required by Quebec's Bill 96
 * (Charter of the French Language) and Law 25 to make French availability
 * visible to QC-based members.
 *
 * Server component sets `province`; we read the current locale via next-intl
 * and render dismissable banner. Dismissal is stored in sessionStorage so it
 * does not nag across pages but reappears on next session.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { X, Languages } from "lucide-react";

const FRENCH_LOCALES = new Set(["fr-CA", "fr"]);
const DISMISS_KEY = "qc-bilingual-banner-dismissed";

interface QcBilingualBannerProps {
  province: string | null | undefined;
}

export function QcBilingualBanner({ province }: QcBilingualBannerProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("qcBilingualBanner");
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (province?.toUpperCase() !== "QC") return null;
  if (FRENCH_LOCALES.has(locale)) return null;
  if (dismissed) return null;

  // Build the fr-CA equivalent of the current path.
  const segments = (pathname ?? "/").split("/");
  if (segments[1] && segments[1].length >= 2 && segments[1].includes("-")) {
    segments[1] = "fr-CA";
  } else {
    segments.splice(1, 0, "fr-CA");
  }
  const frPath = segments.join("/") || "/fr-CA";

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Quebec bilingual notice"
      className="bg-blue-50 border-b border-blue-200 px-3 md:px-6 py-2 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-blue-900 min-w-0">
        <Languages className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <span className="font-medium">{t("message")}</span>
          <span className="hidden md:inline ml-2 text-blue-700">{t("law25Note")}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={frPath}
          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {t("switchAction")}
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("dismiss")}
          className="p-1 text-blue-700 hover:bg-blue-100 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
