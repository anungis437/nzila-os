import type { movementTrendCategoryEnum } from '@/db/schema/domains/marketing';

/** The categories a movement trend, and a data-sharing consent, can cover (the movement_trend_category enum). */
export type MovementTrendCategory = (typeof movementTrendCategoryEnum.enumValues)[number];

export type CategoryLanguage = 'en' | 'fr';

// Keyed by the enum so a category added to the database cannot be left without a label at compile time.
const LABELS: Record<MovementTrendCategory, Record<CategoryLanguage, string>> = {
  'grievance-type': { en: 'Grievance types', fr: 'Types de griefs' },
  'resolution-pattern': { en: 'Resolution patterns', fr: 'Tendances de résolution' },
  'systemic-issue': { en: 'Systemic issues', fr: 'Enjeux systémiques' },
  'sector-trend': { en: 'Sector trends', fr: 'Tendances sectorielles' },
  'jurisdiction-pattern': { en: 'Jurisdiction patterns', fr: 'Tendances par territoire de compétence' },
};

/** The label of a stored category; a value the labels do not know is shown as stored rather than hidden or guessed. */
export function movementTrendCategoryLabel(category: string, language: CategoryLanguage): string {
  const labels: Partial<Record<string, Record<CategoryLanguage, string>>> = LABELS;
  return labels[category]?.[language] ?? category;
}
