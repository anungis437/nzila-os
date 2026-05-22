/**
 * Workbook theme \u2014 re-exports the ICRA report design system and adds
 * workbook-specific tokens (chapter divider, locked-module styling).
 *
 * Same palette, type scale, and spacing as the Executive Continuity Brief
 * to keep the OCI artefact family coherent.
 */

export {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
} from '@/lib/icra-pdf/reportTheme';

import { COLORS } from '@/lib/icra-pdf/reportTheme';

export const WORKBOOK_PALETTE = {
  chapterRule: COLORS.gold,
  lockedChip: COLORS.amber,
  signalCritical: COLORS.rust,
  signalWarning: COLORS.amber,
  signalObservation: COLORS.navyLight,
  signalNote: COLORS.teal,
} as const;
