import { MetadataRoute } from 'next';
import { insightArticles, insightCategories } from '@/lib/insights-content';
import { defaultLocale, locales } from '@/lib/locales';
import { localeMarketingPaths } from '@/lib/marketing-seo';
import { getUnionEyesSiteTopology } from '@/lib/site-topology';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getUnionEyesSiteTopology();

  if (site.isStaging) {
    return [];
  }

  const now = new Date();

  const staticMarketingRoutes: Array<{
    path: string;
    changeFrequency: 'weekly' | 'monthly';
    priority: number;
  }> = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: '/story', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/pilot-request', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/trust', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/case-studies', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/status', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/proof', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/governance', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/institutional-continuity', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/executive-intelligence', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/for-clc', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/for-federations', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/for-leadership', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/for-members', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/for-representatives', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/platform', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/solutions/executive-leadership', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/governance-leadership', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/labour-leadership', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/operations-leadership', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/procurement', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/technology-leadership', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/features/ai-workbench', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/features/analytics', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/features/grievance-tracking', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/features/inbox', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/features/member-portal', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/features/priorities', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/insights', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/insights/categories', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/insights/doctrine', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/insights/methodology', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/insights/resonance', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/legal/accessibility', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/legal/privacy', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/legal/security', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/legal/terms', changeFrequency: 'monthly', priority: 0.5 },
  ];

  const dynamicInsightRoutes = [
    ...insightCategories.map((category) => `/insights/categories/${category.slug}`),
    ...insightArticles.map((article) => `/insights/${article.slug}`),
  ];

  const allLocalizedRoutes = [
    ...staticMarketingRoutes.flatMap((route) =>
      localeMarketingPaths(route.path).map((localizedPath) => ({
        path: localizedPath,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
      })),
    ),
    ...dynamicInsightRoutes.flatMap((path) =>
      localeMarketingPaths(path).map((localizedPath) => ({
        path: localizedPath,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ),
  ];

  const uniqueRoutes = Array.from(new Map(allLocalizedRoutes.map((route) => [route.path, route])).values());

  return uniqueRoutes.map((route) => {
    const languages = locales.reduce<Record<string, string>>((accumulator, locale) => {
      const localizedPath = route.path.replace(/^\/[^/]+/, `/${locale}`);
      accumulator[locale] = `${site.marketingUrl}${localizedPath}`;
      return accumulator;
    }, {});

    const defaultPath = route.path.replace(/^\/[^/]+/, `/${defaultLocale}`);
    languages['x-default'] = `${site.marketingUrl}${defaultPath}`;

    return {
      url: `${site.marketingUrl}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages,
      },
    };
  });
}
