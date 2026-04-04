"use client";

/**
 * Pilot Help Tooltip — contextual "What is this page?" helper.
 *
 * Renders a small floating help icon in the bottom-right of the page.
 * When clicked, shows a card with a short page-specific explanation.
 * Only visible when pilot mode is active.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePilotMode } from "@/contexts/pilot-mode-context";

interface PilotHelpTooltipProps {
  /** i18n key suffix under pilot.support (e.g. "dashboardHelp") */
  helpKey: string;
  /** Optional additional tip text key under pilot.support */
  tipKey?: string;
}

export function PilotHelpTooltip({ helpKey, tipKey }: PilotHelpTooltipProps) {
  const { isPilotMode } = usePilotMode();
  const t = useTranslations("pilot.support");
  const [open, setOpen] = useState(false);

  if (!isPilotMode) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-3"
          >
            <Card className="w-72 shadow-xl border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">{t("whatIsThis")}</h4>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{t(helpKey)}</p>
                {tipKey && (
                  <p className="text-xs text-blue-600 mt-2">
                    {t("tipPrefix")} {t(tipKey)}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={t("helpTitle")}
      >
        <HelpCircle size={20} />
      </motion.button>
    </div>
  );
}
