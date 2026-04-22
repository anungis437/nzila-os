import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkHttps,
  getDnsConfig,
  parseArgs,
  resolveA,
  resolveCnameHost,
  resolveNs,
} from './lib';

function toMarkdownReport(payload: {
  authoritative_provider: string;
  nameserver_status: string;
  prod_resolution: string;
  staging_resolution: string;
  last_verified_at: string;
  certificate_status: string;
  certificate_checks: Array<{ host: string; ok: boolean; status: number; error?: string }>;
  drift_detected: boolean;
  drift_reasons: string[];
}) {
  const certificateLines = payload.certificate_checks.map(
    (check) => `  - ${check.host}: ${check.ok ? 'ok' : 'failed'} (status=${check.status}${check.error ? `, error=${check.error}` : ''})`,
  );

  const reasonLines = payload.drift_reasons.map((reason) => `  - ${reason}`);

  return [
    '# DNS Health',
    '',
    `- authoritative_provider: ${payload.authoritative_provider}`,
    `- nameserver_status: ${payload.nameserver_status}`,
    `- prod_resolution: ${payload.prod_resolution}`,
    `- staging_resolution: ${payload.staging_resolution}`,
    `- certificate_status: ${payload.certificate_status}`,
    '- certificate_checks:',
    ...certificateLines,
    `- drift_detected: ${payload.drift_detected}`,
    '- drift_reasons:',
    ...reasonLines,
    `- last_verified_at: ${payload.last_verified_at}`,
    '',
  ].join('\n');
}

async function main() {
  parseArgs(process.argv);
  const config = getDnsConfig();

  const zoneNs = await resolveNs(config.zoneName);
  const nsLower = zoneNs.map((ns) => ns.toLowerCase());
  const nameserverStatus =
    config.provider === 'cloudflare'
      ? nsLower.some((ns) => ns.includes('cloudflare'))
        ? 'authoritative'
        : 'unexpected'
      : zoneNs.length > 0
        ? 'authoritative'
        : 'unresolved';

  const [prodAppCname, stagingAppCname, apexA, prodA, stagingA] = await Promise.all([
    resolveCnameHost(`app.${config.zoneName}`),
    resolveCnameHost(`staging-app.${config.zoneName}`),
    resolveA(config.zoneName),
    resolveA(config.prodTarget),
    resolveA(config.stagingTarget),
  ]);

  const prodResolution =
    prodAppCname.some((name) => name.toLowerCase().replace(/\.$/, '') === config.prodTarget.toLowerCase()) ||
    apexA.some((ip) => prodA.includes(ip));

  const stagingResolution =
    stagingAppCname.some((name) => name.toLowerCase().replace(/\.$/, '') === config.stagingTarget.toLowerCase()) ||
    (await resolveA(`staging.${config.zoneName}`)).some((ip) => stagingA.includes(ip));

  const [prodHttps, appHttps, stagingHttps, stagingAppHttps] = await Promise.all([
    checkHttps(`https://${config.zoneName}`),
    checkHttps(`https://app.${config.zoneName}`),
    checkHttps(`https://staging.${config.zoneName}`),
    checkHttps(`https://staging-app.${config.zoneName}`),
  ]);

  const certificateChecks = [
    { host: config.zoneName, ...prodHttps },
    { host: `app.${config.zoneName}`, ...appHttps },
    { host: `staging.${config.zoneName}`, ...stagingHttps },
    { host: `staging-app.${config.zoneName}`, ...stagingAppHttps },
  ];

  const certificateStatus = certificateChecks.every((x) => x.ok)
    ? 'reachable'
    : 'degraded';

  const driftReasons: string[] = [];
  if (!prodResolution) driftReasons.push('prod_resolution_failed');
  if (!stagingResolution) driftReasons.push('staging_resolution_failed');
  if (certificateStatus !== 'reachable') {
    const failedHosts = certificateChecks
      .filter((check) => !check.ok)
      .map((check) => `${check.host}:${check.status}${check.error ? `:${check.error}` : ''}`);
    driftReasons.push(`certificate_degraded(${failedHosts.join(',')})`);
  }

  const payload = {
    authoritative_provider: config.provider,
    nameserver_status: nameserverStatus,
    prod_resolution: prodResolution ? 'ok' : 'failed',
    staging_resolution: stagingResolution ? 'ok' : 'failed',
    last_verified_at: new Date().toISOString(),
    certificate_status: certificateStatus,
    certificate_checks: certificateChecks,
    drift_detected: driftReasons.length > 0,
    drift_reasons: driftReasons,
  };

  const reportDir = join(process.cwd(), 'reports', 'ops');
  mkdirSync(reportDir, { recursive: true });

  const jsonPath = join(reportDir, 'dns-health.json');
  const mdPath = join(reportDir, 'dns-health.md');

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, toMarkdownReport(payload), 'utf8');

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(JSON.stringify(payload, null, 2));

  if (payload.drift_detected) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
