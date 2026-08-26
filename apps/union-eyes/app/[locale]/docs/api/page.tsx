'use client';


export const dynamic = 'force-dynamic';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

// NOTE: Interactive Swagger UI was previously rendered via `swagger-ui-react`,
// but its transitive dep `swagger-client` uses a default import from `js-yaml`,
// whose v4 ESM entry has no default export. Turbopack (Next 16 default builder)
// refuses to bundle it and the app-scoped `turbopack.resolveAlias` in
// next.config.ts is only honored by the dev server, not by `next build`. CSP
// forbids loading swagger-ui from a public CDN. Until the upstream chain
// ships an ESM-clean default export, this page links to the raw OpenAPI JSON,
// which any external Swagger Editor / Redoc / Stoplight can consume.

export default function APIDocsPage() {
  const t = useTranslations('docsApiPage');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-4">
        <p>
          The OpenAPI schema is served at:{' '}
          <Link href="/api/docs/openapi" className="text-primary underline">
            /api/docs/openapi
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          Load this URL in Swagger Editor, Redoc, Postman, or any OpenAPI
          viewer for interactive exploration.
        </p>
      </div>
    </div>
  );
}
