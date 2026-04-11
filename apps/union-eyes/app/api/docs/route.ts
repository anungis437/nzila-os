import { NextRequest, NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/api/openapi';

/**
 * API Documentation endpoint
 * 
 * GET /api/docs - Returns OpenAPI JSON spec
 * GET /api/docs?format=html - Returns Swagger UI
 */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format');
  const spec = generateOpenAPISpec();
  
  if (format === 'html') {
    const specJson = JSON.stringify(spec);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UnionEyes API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
    .swagger-ui .info .title { 
      font-size: 2.5em; 
      background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .swagger-ui .info .description { 
      font-size: 1.1em; 
      line-height: 1.6;
      color: #4a5568;
    }
    .swagger-ui .opblock-tag {
      background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
      color: white;
    }
    .swagger-ui .opblock-tag:hover {
      background: linear-gradient(135deg, #2c5282 0%, #3182ce 100%);
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    const spec = ${specJson};
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'put', 'post', 'delete', 'patch'],
      });
    };
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
  
  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
