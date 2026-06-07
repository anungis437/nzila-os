'use client';


export const dynamic = 'force-dynamic';
import nextDynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import 'swagger-ui-react/swagger-ui.css';

// Dynamic import to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SwaggerUI = nextDynamic(() => import('swagger-ui-react'), { ssr: false }) as unknown;

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
      
      <div className="container mx-auto px-4 py-8">
        <SwaggerUI 
          url="/api/docs/openapi" 
          docExpansion="list"
          defaultModelsExpandDepth={1}
          defaultModelExpandDepth={1}
          displayOperationId={true}
          filter={true}
          showRequestHeaders={true}
          tryItOutEnabled={true}
        />
      </div>
    </div>
  );
}
