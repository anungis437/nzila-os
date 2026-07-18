import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(TEST_DIR, '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const PROOF_DIR = path.join(REPO_ROOT, 'artifacts', 'courtlens-gap3-browser');
const FIXTURE_MANIFEST_PATH = path.join(REPO_ROOT, 'artifacts', 'courtlens-gap3-fixture', 'fixture-manifest.json');
const SUMMARY_PATH = path.join(PROOF_DIR, 'browser-proof-summary.json');
const TRACE_PATH = path.join(PROOF_DIR, 'browser-proof-trace.zip');
const HAR_PATH = path.join(PROOF_DIR, 'browser-proof.har');
const AUTHORIZED_JSON_PATH = path.join(PROOF_DIR, 'authorized-en-json.bin');
const AUTHORIZED_MD_PATH = path.join(PROOF_DIR, 'authorized-fr-markdown.bin');
const AUTHORIZED_EN_SCREENSHOT = path.join(PROOF_DIR, 'authorized-en-page.png');
const AUTHORIZED_FR_SCREENSHOT = path.join(PROOF_DIR, 'authorized-fr-page.png');
const DENIED_SAME_TENANT_SCREENSHOT = path.join(PROOF_DIR, 'denied-same-tenant.png');
const DENIED_CROSS_TENANT_SCREENSHOT = path.join(PROOF_DIR, 'denied-cross-tenant.png');
const TSX_COMMAND = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

let manifest;

function fixtureEnv() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PLAYWRIGHT_TEST_AUTH: 'true',
    ABR_DEMO_ORG_ID: 'metro-university',
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://nzila:nzila_dev@localhost:5433/nzila_automation',
  };
}

async function loadManifest() {
  const raw = await fs.readFile(FIXTURE_MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

async function seedFixture() {
  await fs.mkdir(PROOF_DIR, { recursive: true });
  execFileSync(TSX_COMMAND, ['scripts/courtlens-gap3-fixture.ts'], {
    cwd: APP_DIR,
    env: fixtureEnv(),
    stdio: 'pipe',
    shell: true,
  });
  manifest = await loadManifest();
}

async function cleanupFixture() {
  execFileSync(TSX_COMMAND, ['scripts/courtlens-gap3-fixture.ts', '--cleanup'], {
    cwd: APP_DIR,
    env: fixtureEnv(),
    stdio: 'pipe',
    shell: true,
  });
}

async function seedBrowserCookies(context, userId) {
  await context.addCookies([
    {
      name: 'nzila_session',
      value: `ue-seed-session-${userId}`,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function saveDownload(download, destinationPath) {
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error(`Unable to read download stream for ${download.suggestedFilename()}`);
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  await fs.writeFile(destinationPath, buffer);
  return {
    suggestedFilename: download.suggestedFilename(),
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    text: buffer.toString('utf8'),
  };
}

test.describe.serial('CourtLens Gap 3 browser proof', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(120_000);
    await seedFixture();
  });

  test.afterAll(async ({}, testInfo) => {
    testInfo.setTimeout(120_000);
    await cleanupFixture();
  });

  test('authorized exports do not prefetch and download with exact click-driven requests', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      acceptDownloads: true,
      recordHar: { path: HAR_PATH },
    });
    const page = await context.newPage();
    const reviewPacketRequests = [];

    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page.on('request', (request) => {
      if (request.url().includes('/api/courtlens/matters/') && request.url().includes('/review-packet')) {
        reviewPacketRequests.push(request.url());
      }
    });

    await seedBrowserCookies(context, manifest.reviewerUserId);

    await page.goto(`${baseURL}/en-CA/dashboard/courtlens/matters/${manifest.externalizableMatterId}?org=${manifest.orgId}`);
    await expect(page.getByTestId('review-packet-export-controls')).toBeVisible();
    await expect(page.getByRole('button', { name: 'JSON' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Markdown' })).toBeVisible();
    expect(reviewPacketRequests).toHaveLength(0);

    await page.getByRole('button', { name: 'JSON' }).hover();
    await page.getByRole('button', { name: 'JSON' }).focus();
    expect(reviewPacketRequests).toHaveLength(0);

    const jsonDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON' }).click();
    const jsonDownload = await jsonDownloadPromise;
    expect(reviewPacketRequests).toHaveLength(1);
    expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/);

    const jsonDownloadSummary = await saveDownload(jsonDownload, AUTHORIZED_JSON_PATH);
    await expect(page.getByTestId('review-packet-export-status')).toHaveText('Review packet export is ready.');
    expect(jsonDownloadSummary.text).toContain('AI-generated content in this review packet is draft-only and requires human reviewer approval before external use. This platform does not provide legal advice.');
    await page.screenshot({ path: AUTHORIZED_EN_SCREENSHOT, fullPage: true });

    const baselineCount = reviewPacketRequests.length;
    await page.goto(`${baseURL}/fr-CA/dashboard/courtlens/matters/${manifest.externalizableMatterId}?org=${manifest.orgId}`);
    await expect(page.getByTestId('review-packet-export-controls')).toBeVisible();

    const markdownDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Markdown' }).click();
    const markdownDownload = await markdownDownloadPromise;
    expect(reviewPacketRequests).toHaveLength(baselineCount + 1);
    expect(markdownDownload.suggestedFilename()).toMatch(/\.md$/);

    const markdownDownloadSummary = await saveDownload(markdownDownload, AUTHORIZED_MD_PATH);
    await expect(page.getByTestId('review-packet-export-status')).toHaveText('L’exportation du dossier d’examen est prête.');
    expect(markdownDownloadSummary.text).toContain('Le contenu généré par IA dans ce dossier est un brouillon et exige une approbation humaine avant tout usage externe. Cette plateforme ne fournit pas d\'avis juridique.');
    await page.screenshot({ path: AUTHORIZED_FR_SCREENSHOT, fullPage: true });

    await context.tracing.stop({ path: TRACE_PATH });
    await context.close();

    await fs.writeFile(
      SUMMARY_PATH,
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        fixture: {
          orgId: manifest.orgId,
          reviewerUserAlias: 'reviewer',
          sameTenantDeniedUserAlias: 'same-tenant-denied',
          crossTenantUserAlias: 'cross-tenant',
          externalizableMatterId: manifest.externalizableMatterId,
        },
        authorized: {
          englishJson: {
            status: 200,
            requestsCaptured: reviewPacketRequests.filter((url) => url.includes('format=json')).length,
            ...jsonDownloadSummary,
            screenshotPath: path.relative(REPO_ROOT, AUTHORIZED_EN_SCREENSHOT),
          },
          frenchMarkdown: {
            status: 200,
            requestsCaptured: reviewPacketRequests.filter((url) => url.includes('format=markdown')).length,
            ...markdownDownloadSummary,
            screenshotPath: path.relative(REPO_ROOT, AUTHORIZED_FR_SCREENSHOT),
          },
        },
        requests: reviewPacketRequests,
        artifacts: {
          trace: path.relative(REPO_ROOT, TRACE_PATH),
          har: path.relative(REPO_ROOT, HAR_PATH),
          jsonDownload: path.relative(REPO_ROOT, AUTHORIZED_JSON_PATH),
          markdownDownload: path.relative(REPO_ROOT, AUTHORIZED_MD_PATH),
        },
      }, null, 2)}\n`,
      'utf8',
    );
  });

  test('denied states hide export controls for low-privilege and cross-tenant users', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    await seedBrowserCookies(context, manifest.sameTenantDeniedUserId);
    await page.goto(`${baseURL}/en-CA/dashboard/courtlens/matters/${manifest.sameTenantDeniedMatterId}?org=${manifest.orgId}`);
    await expect(page.getByText('You do not have access to this matter.')).toBeVisible();
    await expect(page.getByTestId('review-packet-export-controls')).toHaveCount(0);
    await page.screenshot({ path: DENIED_SAME_TENANT_SCREENSHOT, fullPage: true });

    await context.clearCookies();
    await seedBrowserCookies(context, manifest.crossTenantUserId);
    await page.goto(`${baseURL}/en-CA/dashboard/courtlens/matters/${manifest.crossTenantMatterId}?org=${manifest.orgId}`);
    await expect(page.getByText('You do not have access to this matter.')).toBeVisible();
    await expect(page.getByTestId('review-packet-export-controls')).toHaveCount(0);
    await page.screenshot({ path: DENIED_CROSS_TENANT_SCREENSHOT, fullPage: true });

    await context.close();
  });
});