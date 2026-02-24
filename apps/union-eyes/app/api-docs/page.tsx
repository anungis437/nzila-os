/**
 * API Documentation Page
 * 
 * Interactive Swagger UI for exploring the Union Eyes API
 * 
 * Route: /api-docs
 */

'use client';

export const dynamic = 'force-dynamic';
import Link from 'next/link';

import nextDynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = nextDynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Union Eyes API Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Interactive API reference generated from source code
          </p>
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-semibold">Endpoints:</span> 462
            </div>
            <div>
              <span className="font-semibold">Coverage:</span> 100%
            </div>
            <div>
              <span className="font-semibold">Version:</span> 2.0.0
            </div>
          </div>
        </div>
      </div>

      {/* Swagger UI */}
      <div className="container mx-auto">
        <SwaggerUI 
          url="/api/docs"
          docExpansion="list"
          defaultModelsExpandDepth={1}
          filter={true}
          tryItOutEnabled={true}
        />
      </div>

      {/* Footer Notice */}
      <div className="border-t bg-muted/50 py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            📝 This documentation is auto-generated from source code.
          </p>
          <p className="mt-2">
            To regenerate: <code className="px-2 py-1 bg-background rounded">pnpm run openapi:generate</code>
          </p>
          <p className="mt-4">
            <a 
              href="https://github.com/unioneyes/api-docs" 
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
            {' • '}
            <Link href="/docs/API_DOCUMENTATION_SCHEMA_CONSOLIDATION_GUIDE.md"
              className="text-primary hover:underline"
            >
              Documentation Guide
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
