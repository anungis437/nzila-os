#!/usr/bin/env node
/**
 * Fix v2 routes that have parse errors by regenerating them with stub handlers.
 * These routes had complex handler bodies that the regex-based extractor couldn't cleanly parse.
 * The stub handlers delegate to the original v1 business logic via direct import.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const UE_ROOT = join(import.meta.dirname, '..');
const API_DIR = join(UE_ROOT, 'app', 'api');
const V2_DIR = join(UE_ROOT, 'app', 'api', 'v2');

const BROKEN_FILES = [
  'admin/clc/analytics/trends/route.ts',
  'admin/dues/send-reminders/route.ts',
  'admin/pki/signatures/[id]/sign/route.ts',
  'ai/ingest/route.ts',
  'ai/mamba/route.ts',
  'analytics/metrics/route.ts',
  'cron/external-data-sync/route.ts',
  'documents/upload/route.ts',
  'emergency/activate/route.ts',
  'gdpr/data-export/route.ts',
  'integrations/shopify/webhooks/route.ts',
  'onboarding/discover-federation/route.ts',
  'onboarding/peer-benchmarks/route.ts',
  'onboarding/suggest-clauses/route.ts',
  'portal/dues/pay/route.ts',
  'reports/execute/route.ts',
  'rewards/redemptions/route.ts',
  'social-media/accounts/route.ts',
  'social-media/analytics/route.ts',
  'social-media/campaigns/route.ts',
  'social-media/posts/route.ts',
];

// ─── Role level to name mapping ───────────────────────────────────────────────
const LEVEL_TO_ROLE = {
  10: 'member', 20: 'delegate', 30: 'steward', 40: 'chief_steward',
  50: 'committee_chair', 60: 'trustee', 70: 'secretary_treasurer',
  80: 'vice_president', 90: 'president', 100: 'executive_board',
  110: 'director', 120: 'regional_director', 130: 'national_officer',
  200: 'admin', 250: 'super_admin', 300: 'platform_admin',
};

function extractMethods(src) {
  const methods = [];
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (new RegExp(`export\\s+(const|async\\s+function|function)\\s+${m}\\b`).test(src)) {
      methods.push(m);
    }
  }
  return methods;
}

function classify(src) {
  if (/withRoleAuth/.test(src)) return 'withRoleAuth';
  if (/withAdminAuth/.test(src)) return 'withAdminAuth';
  if (/withMinRole/.test(src)) return 'withMinRole';
  if (/withApiAuth/.test(src)) return 'withApiAuth';
  if (/djangoProxy|django-proxy/.test(src)) return 'djangoProxy';
  return 'raw';
}

function extractRole(src) {
  const strMatch = src.match(/withRoleAuth\(['"]([^'"]+)['"]/);
  if (strMatch) return strMatch[1];
  const numMatch = src.match(/withRoleAuth\((\d+)/);
  if (numMatch) return LEVEL_TO_ROLE[parseInt(numMatch[1], 10)] || 'admin';
  return 'admin';
}

function extractRateLimit(src) {
  const match = src.match(/RATE_LIMITS\.(\w+)/);
  return match ? `RATE_LIMITS.${match[1]}` : null;
}

function extractZodSchemas(src) {
  const schemas = [];
  const schemaPattern = /const\s+(\w+)\s*=\s*z\.object\(\{[\s\S]*?\}\);/g;
  let m;
  while ((m = schemaPattern.exec(src)) !== null) {
    schemas.push({ name: m[1], code: m[0] });
  }
  return schemas;
}

function extractServiceImports(src) {
  const results = [];
  const importRegex = /^import\s+.*?from\s+['"]([^'"]+)['"];?\s*$/gm;
  let m;
  while ((m = importRegex.exec(src)) !== null) {
    const mod = m[1];
    if (
      mod.includes('api-auth-guard') ||
      mod.includes('standardized-responses') ||
      mod.includes('rate-limiter') ||
      mod.includes('next/server') ||
      mod.includes('api/framework') ||
      (mod === 'zod')
    ) continue;
    results.push(m[0]);
  }
  return results;
}

function deriveTag(relPath) {
  const parts = relPath.split(/[/\\]/);
  const tag = parts[0] || 'General';
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

let fixed = 0;

for (const relPath of BROKEN_FILES) {
  const v1Path = join(API_DIR, relPath);
  const v2Path = join(V2_DIR, relPath);
  const routeP = '/api/' + relPath.replace(/[/\\]route\.ts$/, '').replace(/\\/g, '/');

  let v1Src;
  try {
    v1Src = readFileSync(v1Path, 'utf-8');
  } catch {
    console.error(`  SKIP (v1 not found): ${relPath}`);
    continue;
  }

  const methods = extractMethods(v1Src);
  const category = classify(v1Src);
  const schemas = extractZodSchemas(v1Src);
  const rateLimit = extractRateLimit(v1Src);
  const serviceImports = extractServiceImports(v1Src);
  const tag = deriveTag(relPath);
  const _hasDynamic = /\[/.test(relPath);

  // Build auth config
  let authLine;
  switch (category) {
    case 'withAdminAuth':
      authLine = `auth: { required: true, minRole: 'admin' as const },`;
      break;
    case 'withRoleAuth':
    case 'withMinRole': {
      const role = extractRole(v1Src);
      authLine = `auth: { required: true, minRole: '${role}' as const },`;
      break;
    }
    case 'withApiAuth':
      authLine = `auth: { required: true },`;
      break;
    default: {
      const hasAuth = /getCurrentUser|auth\(\)|getAuth/.test(v1Src);
      authLine = `auth: { required: ${hasAuth} },`;
    }
  }

  // Build v2 route that delegates to v1 handlers
  const lines = [
    `// @ts-nocheck`,
    `/**`,
    ` * ${methods.join(' ')} ${routeP}`,
    ` * Migrated to withApi() framework`,
    ` */`,
  ];

  for (const imp of serviceImports) {
    lines.push(imp);
  }

  const frameworkImports = ['withApi', 'ApiError'];
  if (schemas.length > 0) frameworkImports.push('z');
  if (rateLimit) frameworkImports.push('RATE_LIMITS');
  lines.push(`import { ${frameworkImports.join(', ')} } from '@/lib/api/framework';`);
  lines.push('');

  // Emit schemas
  for (const s of schemas) {
    lines.push(s.code);
    lines.push('');
  }

  // Relative import path from v2 back to v1
  const v1ImportPath = '@/app/api/' + relPath.replace(/\.ts$/, '').replace(/\\/g, '/');

  // Import v1 handlers
  const v1Alias = methods.map(m => `${m} as v1${m}`).join(', ');
  lines.push(`import { ${v1Alias} } from '${v1ImportPath}';`);
  lines.push('');

  // Re-export each method wrapped in withApi
  for (const method of methods) {
    const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const optParts = [
      `    ${authLine}`,
    ];

    if (rateLimit && isWriteMethod) {
      optParts.push(`    rateLimit: ${rateLimit},`);
    }

    optParts.push(`    openapi: {`);
    optParts.push(`      tags: ['${tag}'],`);
    optParts.push(`      summary: '${method} ${routeP.split('/').pop() || routeP}',`);
    optParts.push(`    },`);

    lines.push(
      `export const ${method} = withApi(`,
      `  {`,
      ...optParts,
      `  },`,
      `  async ({ request, params }) => {`,
      `    // Delegate to v1 handler while framework migration is in progress`,
      `    const response = await v1${method}(request, { params: Promise.resolve(params) });`,
      `    return response;`,
      `  },`,
      `);`,
      ``,
    );
  }

  writeFileSync(v2Path, lines.join('\n'), 'utf-8');
  fixed++;
  console.log(`  ✓ Fixed: ${relPath} [${category}] (${methods.join(',')})`);
}

console.log(`\n  Fixed ${fixed}/${BROKEN_FILES.length} files`);
