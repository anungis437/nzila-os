/**
 * Marketing surface feature flags.
 *
 * Set CASE_STUDIES_VISIBLE to true to re-enable public case studies after
 * pilots complete. While false, the public /case-studies routes return 404,
 * sitemap omits the entry, and footer links are hidden. The underlying API,
 * DB schema, components, admin authoring, and i18n strings remain intact so
 * re-enabling is a single-line flip.
 */
export const CASE_STUDIES_VISIBLE = false;
