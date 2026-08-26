/**
 * The CUPE 4373 demo previously rendered a top section-nav bar above each
 * dashboard surface. With the enriched sidebar carrying the same destinations,
 * the duplicate top bar added visual noise, so this component now renders
 * nothing. Call sites are left in place intentionally — keeping the import +
 * JSX neutral makes it cheap to re-enable a top bar later without re-wiring
 * every page.
 */
export function Cupe4373SectionNav() {
  return null;
}
