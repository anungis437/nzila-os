import type { NavigationItem } from './role-experience';

/** Query keys owned by a destination participate in identity; unrelated filters do not. */
export function navigationDestination(href: string): string {
  const url = new URL(href, 'https://navigation.invalid');
  url.searchParams.sort();
  return url.pathname.replace(/\/$/, '') + url.search;
}

/** Select one most-specific destination, including query-specific inbox views. */
export function selectedNavigationDestination(
  items: readonly NavigationItem[], pathname: string, search: string,
): string | undefined {
  const path = pathname.replace(/^\/(?:en-CA|fr-CA)(?=\/)/, '').replace(/\/$/, '');
  const query = new URLSearchParams(search);
  return items.map((item) => {
    const url = new URL(item.href, 'https://navigation.invalid');
    const exact = path === url.pathname;
    if (!exact && (url.pathname === '/dashboard' || !path.startsWith(url.pathname + '/'))) return null;
    if ([...url.searchParams].some(([key, value]) => query.get(key) !== value)) return null;
    return { id: navigationDestination(item.href), score: url.pathname.length * 10 + [...url.searchParams].length + (exact ? 1 : 0) };
  }).filter((item): item is { id: string; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)[0]?.id;
}
