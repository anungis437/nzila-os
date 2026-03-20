/**
 * Zonga — robots.txt configuration.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonga.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/en-CA/dashboard/', '/fr-CA/dashboard/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
