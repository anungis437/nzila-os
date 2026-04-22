import { MetadataRoute } from 'next';
import { getUnionEyesSiteTopology } from '@/lib/site-topology';

export default function robots(): MetadataRoute.Robots {
  const site = getUnionEyesSiteTopology();

  if (site.isStaging) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
      host: site.marketingUrl,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/en-CA/dashboard',
          '/fr-CA/dashboard',
          '/sign-in',
          '/sign-up',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${site.marketingUrl}/sitemap.xml`,
    host: site.marketingUrl,
  };
}
