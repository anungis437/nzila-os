import { MetadataRoute } from 'next';
import { getUnionEyesSiteTopology } from '@/lib/site-topology';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getUnionEyesSiteTopology();

  if (site.isStaging) {
    return [];
  }

  const now = new Date();
  return [
    {
      url: site.marketingUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${site.marketingUrl}/story`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${site.marketingUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${site.marketingUrl}/pilot-request`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${site.marketingUrl}/trust`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${site.marketingUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${site.marketingUrl}/case-studies`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${site.marketingUrl}/features`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
