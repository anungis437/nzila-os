import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://nzilaventures.com';
  const lastModified = new Date();

  const routes = [
    '',
    '/about',
    '/investors',
    '/products',
    '/portfolio',
    '/verticals',
    '/platform',
    '/contact',
    '/resources',
    '/legal/privacy',
    '/legal/terms',
    '/legal/ip-governance',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'weekly' : route.startsWith('/legal') ? 'yearly' : 'monthly',
    priority: route === '' ? 1.0 : route === '/investors' ? 0.9 : route.startsWith('/legal') ? 0.3 : 0.8,
  }));
}
