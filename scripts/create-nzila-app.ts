#!/usr/bin/env node
/**
 * create-nzila-app — CLI wrapper around Backstage scaffolder templates
 *
 * Scaffolds a new Nzila OS app or package using the golden-path templates
 * defined in tooling/backstage/templates/.
 *
 * Usage:
 *   npx create-nzila-app
 *   npx create-nzila-app --template nextjs-app --name my-app
 *   npx create-nzila-app --template fastify-service --name my-api
 *   npx create-nzila-app --list
 *
 * Templates:
 *   nextjs-app          Next.js app with Entra auth, Tailwind v4, OTel
 *   fastify-service     Fastify API service with OTel + rate limiting
 *   django-backend      Django REST Framework backend
 *   integration-package Shared integration package
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { createInterface } from 'node:readline';

// ── Constants ───────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(import.meta.dirname ?? __dirname, '..');
const TEMPLATES_DIR = join(REPO_ROOT, 'tooling', 'backstage', 'templates');
const APPS_DIR = join(REPO_ROOT, 'apps');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  targetDir: string;
  port?: number;
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'nextjs-app',
    name: 'Next.js App',
    description: 'Next.js app with Entra auth, Tailwind CSS v4, OTel instrumentation, and evidence-first governance',
    targetDir: 'apps',
    port: 3012,
  },
  {
    id: 'fastify-service',
    name: 'Fastify Service',
    description: 'Fastify API service with helmet, rate limiting, OTel, and health checks',
    targetDir: 'apps',
  },
  {
    id: 'django-backend',
    name: 'Django Backend',
    description: 'Django REST Framework backend with stack-authority compliance',
    targetDir: 'apps',
  },
  {
    id: 'integration-package',
    name: 'Integration Package',
    description: 'Shared TypeScript package for internal or external integrations',
    targetDir: 'packages',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function logStep(step: number, total: number, msg: string): void {
  console.log(`\n  [${step}/${total}] ${msg}`);
}

function findNextPort(): number {
  // Scan apps directories for existing ports in package.json scripts
  const existingPorts: number[] = [];
  if (existsSync(APPS_DIR)) {
    for (const dir of readdirSync(APPS_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const pkgPath = join(APPS_DIR, dir.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const devScript = pkg.scripts?.dev ?? '';
        const portMatch = devScript.match(/--port\s+(\d+)/);
        if (portMatch) existingPorts.push(Number(portMatch[1]));
      } catch { /* skip */ }
    }
  }
  const maxPort = existingPorts.length > 0 ? Math.max(...existingPorts) : 3011;
  return maxPort + 1;
}

// ── Scaffold Logic ──────────────────────────────────────────────────────────

function scaffoldNextJsApp(name: string, port: number): void {
  const appDir = join(APPS_DIR, name);
  mkdirSync(join(appDir, 'app'), { recursive: true });
  mkdirSync(join(appDir, 'components'), { recursive: true });
  mkdirSync(join(appDir, 'lib'), { recursive: true });

  // package.json
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({
    name: `@nzila/${name}`,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: `next dev --port ${port}`,
      build: 'next build',
      start: 'next start',
      lint: 'eslint',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      clean: 'rm -rf .next .turbo node_modules',
    },
    dependencies: {
      '@nzila/platform-auth': 'workspace:*',
      '@nzila/os-core': 'workspace:*',
      '@nzila/ui': 'workspace:*',
      '@nzila/platform-observability': 'workspace:*',
      next: '16.1.6',
      react: '19.2.4',
      'react-dom': '19.2.4',
      zod: '^3.24.0',
    },
    devDependencies: {
      '@types/node': '^25',
      '@types/react': '^19',
      typescript: '^5',
      vitest: '^4.0.18',
    },
  }, null, 2) + '\n');

  // instrumentation.ts
  writeFileSync(join(appDir, 'instrumentation.ts'), `/**
 * Next.js Instrumentation Hook — ${name}
 *
 * Initializes OpenTelemetry distributed tracing via @nzila/os-core.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    const { initOtel } = await import('@nzila/os-core/telemetry')
    await initOtel({ appName: '${name}' })
  } catch {
    // Non-critical — tracing degrades gracefully
  }
}
`);

  // tsconfig.json
  writeFileSync(join(appDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2) + '\n');

  // next.config.ts
  writeFileSync(join(appDir, 'next.config.ts'), `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@nzila/ui', '@nzila/os-core', '@nzila/platform-observability'],
}

export default nextConfig
`);

  // .env.example
  writeFileSync(join(appDir, '.env.example'), `# ${name} environment variables
AUTH_SECRET=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=
`);

  // app/layout.tsx
  writeFileSync(join(appDir, 'app', 'layout.tsx'), `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${name} — Nzila',
  description: '${name} application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`);

  // app/page.tsx
  writeFileSync(join(appDir, 'app', 'page.tsx'), `export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-2xl font-bold">${name}</h1>
      <p className="mt-2 text-gray-600">Scaffolded with create-nzila-app</p>
    </main>
  )
}
`);

  // catalog-info.yaml
  writeFileSync(join(appDir, 'catalog-info.yaml'), `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${name}
  description: ${name} application
  annotations:
    github.com/project-slug: anungis437/nzila-os
spec:
  type: website
  lifecycle: experimental
  owner: platform-team
  system: nzila-os
`);
}

function scaffoldFastifyService(name: string): void {
  const appDir = join(APPS_DIR, name);
  mkdirSync(join(appDir, 'src'), { recursive: true });

  writeFileSync(join(appDir, 'package.json'), JSON.stringify({
    name: `@nzila/${name}`,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/server.ts',
      build: 'tsc',
      start: 'node dist/server.js',
      lint: 'eslint src/',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
    },
    dependencies: {
      '@nzila/os-core': 'workspace:*',
      '@nzila/platform-observability': 'workspace:*',
      fastify: '^5.0.0',
      '@fastify/helmet': '^13.0.0',
      '@fastify/rate-limit': '^10.0.0',
      zod: '^3.24.0',
    },
    devDependencies: {
      '@types/node': '^25',
      typescript: '^5',
      tsx: '^4',
      vitest: '^4.0.18',
    },
  }, null, 2) + '\n');

  writeFileSync(join(appDir, 'src', 'server.ts'), `import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

const app = Fastify({ logger: true })

await app.register(helmet)
await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })

app.get('/health', async () => ({ status: 'ok', service: '${name}' }))

const port = Number(process.env.PORT ?? 4000)
await app.listen({ port, host: '0.0.0.0' })
console.log(\`${name} listening on :\${port}\`)
`);

  writeFileSync(join(appDir, 'src', 'instrumentation.ts'), `import { initOtel } from '@nzila/os-core/telemetry'
await initOtel({ appName: '${name}' })
`);

  writeFileSync(join(appDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: 'dist',
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n');
}

function scaffoldIntegrationPackage(name: string): void {
  const pkgDir = join(PACKAGES_DIR, name);
  mkdirSync(join(pkgDir, 'src', '__tests__'), { recursive: true });

  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
    name: `@nzila/${name}`,
    version: '0.1.0',
    private: true,
    type: 'module',
    exports: {
      '.': `./src/index.ts`,
    },
    scripts: {
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      lint: 'eslint . --max-warnings 0',
    },
    dependencies: {
      '@nzila/os-core': 'workspace:*',
      zod: '^3.24.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      vitest: '^4.0.0',
    },
  }, null, 2) + '\n');

  writeFileSync(join(pkgDir, 'src', 'index.ts'), `/**
 * @nzila/${name} — barrel exports
 */

export const PACKAGE_NAME = '@nzila/${name}'
`);

  writeFileSync(join(pkgDir, 'src', '__tests__', '${name}.test.ts'), `import { describe, it, expect } from 'vitest'
import { PACKAGE_NAME } from '../index.js'

describe('@nzila/${name}', () => {
  it('exports the package name', () => {
    expect(PACKAGE_NAME).toBe('@nzila/${name}')
  })
})
`);

  writeFileSync(join(pkgDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --list flag
  if (args.includes('--list')) {
    console.log('\n  Available templates:\n');
    for (const t of TEMPLATES) {
      console.log(`    ${t.id.padEnd(24)} ${t.description}`);
    }
    console.log();
    process.exit(0);
  }

  console.log('\n  ╔═══════════════════════════════════╗');
  console.log('  ║     create-nzila-app               ║');
  console.log('  ║     Golden Path Scaffolder          ║');
  console.log('  ╚═══════════════════════════════════╝\n');

  // Parse flags
  let templateId = args[args.indexOf('--template') + 1] ?? '';
  let name = args[args.indexOf('--name') + 1] ?? '';

  // Interactive mode if flags not provided
  if (!templateId) {
    console.log('  Templates:');
    TEMPLATES.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.id.padEnd(24)} ${t.description}`);
    });
    const choice = await ask('\n  Select template (1-4): ');
    const idx = parseInt(choice, 10) - 1;
    if (idx < 0 || idx >= TEMPLATES.length) {
      console.error('  Invalid selection.');
      process.exit(1);
    }
    templateId = TEMPLATES[idx]!.id;
  }

  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    console.error(`  Unknown template: ${templateId}`);
    console.error('  Run with --list to see available templates.');
    process.exit(1);
  }

  if (!name) {
    name = await ask(`  App/package name (kebab-case): `);
  }

  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error('  Invalid name. Use lowercase kebab-case (e.g. my-app).');
    process.exit(1);
  }

  const targetDir = template.targetDir === 'apps' ? join(APPS_DIR, name) : join(PACKAGES_DIR, name);
  if (existsSync(targetDir)) {
    console.error(`  Directory already exists: ${targetDir}`);
    process.exit(1);
  }

  const totalSteps = 4;

  logStep(1, totalSteps, `Scaffolding ${template.name}: ${name}`);

  switch (template.id) {
    case 'nextjs-app': {
      const port = findNextPort();
      scaffoldNextJsApp(name, port);
      console.log(`    → Port: ${port}`);
      break;
    }
    case 'fastify-service':
      scaffoldFastifyService(name);
      break;
    case 'django-backend':
      console.log('    → Use the Backstage scaffolder for Django: tooling/backstage/templates/django-backend-template/');
      console.log('    → Django scaffolding requires Python environment setup.');
      process.exit(0);
      break;
    case 'integration-package':
      scaffoldIntegrationPackage(name);
      break;
  }

  logStep(2, totalSteps, 'Creating catalog-info.yaml');
  // Already created inline for nextjs; create for others if missing
  const catalogPath = join(targetDir, 'catalog-info.yaml');
  if (!existsSync(catalogPath)) {
    writeFileSync(catalogPath, `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${name}
  description: ${name}
spec:
  type: ${template.targetDir === 'apps' ? 'service' : 'library'}
  lifecycle: experimental
  owner: platform-team
  system: nzila-os
`);
  }

  logStep(3, totalSteps, 'Scaffolding complete');
  console.log(`    → Created: ${targetDir}`);

  logStep(4, totalSteps, 'Next steps');
  console.log(`    1. cd ${template.targetDir}/${name}`);
  console.log('    2. pnpm install');
  if (template.targetDir === 'apps') {
    console.log(`    3. cp .env.example .env.local  (if applicable)`);
    console.log(`    4. pnpm dev:${name}`);
  } else {
    console.log('    3. Add to root vitest.config.ts projects array');
  }
  console.log(`    5. Register in root vitest.config.ts if tests exist`);
  console.log();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
