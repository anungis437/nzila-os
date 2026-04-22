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
  drift_detected: boolean;
}) {
  return [
    '# DNS Health',
    '',
    `- authoritative_provider: ${payload.authoritative_provider}`,
    `- nameserver_status: ${payload.nameserver_status}`,
    `- prod_resolution: ${payload.prod_resolution}`,
    `- staging_resolution: ${payload.staging_resolution}`,
    `- certificate_status: ${payload.certificate_status}`,
    `- drift_detected: ${payload.drift_detected}`,
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

  const certificateStatus = [prodHttps, appHttps, stagingHttps, stagingAppHttps].every((x) => x.ok)
    ? 'reachable'
    : 'degraded';

  const payload = {
    authoritative_provider: config.provider,
    nameserver_status: nameserverStatus,
    prod_resolution: prodResolution ? 'ok' : 'failed',
    staging_resolution: stagingResolution ? 'ok' : 'failed',
    last_verified_at: new Date().toISOString(),
    certificate_status: certificateStatus,
    drift_detected: !(prodResolution && stagingResolution && certificateStatus === 'reachable'),
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
