import {
  checkHttps,
  getDesiredRecords,
  getDnsConfig,
  parseArgs,
  resolveA,
  resolveCnameHost,
} from './lib';

type RecordVerification = {
  host: string;
  expectedTarget: string;
  cnameMatches: boolean;
  cnameValues: string[];
};

async function verifyCname(host: string, expectedTarget: string): Promise<RecordVerification> {
  const cnameValues = (await resolveCnameHost(host)).map((value) => value.toLowerCase().replace(/\.$/, ''));
  const expected = expectedTarget.toLowerCase().replace(/\.$/, '');
  const cnameMatches = cnameValues.includes(expected);

  return {
    host,
    expectedTarget: expectedTarget,
    cnameMatches,
    cnameValues,
  };
}

async function verifyApex(zoneName: string, expectedTarget: string) {
  const [zoneIps, targetIps] = await Promise.all([resolveA(zoneName), resolveA(expectedTarget)]);
  const targetSet = new Set(targetIps);
  const sharedIps = zoneIps.filter((ip) => targetSet.has(ip));

  return {
    host: zoneName,
    expectedTarget,
    zoneIps,
    targetIps,
    matchesByIp: sharedIps.length > 0,
    sharedIps,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const config = getDnsConfig();

  const desiredRecords = getDesiredRecords(config, args.includeOptional).filter((record) => record.type === 'CNAME');

  const nonApexChecks = desiredRecords
    .filter((record) => record.name !== '@')
    .map((record) => {
      const fqdn = `${record.name}.${config.zoneName}`;
      return verifyCname(fqdn, record.content);
    });

  const [apexCheck, cnameChecks] = await Promise.all([
    verifyApex(config.zoneName, config.prodTarget),
    Promise.all(nonApexChecks),
  ]);

  const httpsChecks = await Promise.all([
    checkHttps(`https://${config.zoneName}`),
    checkHttps(`https://app.${config.zoneName}`),
    checkHttps(`https://staging.${config.zoneName}`),
    checkHttps(`https://staging-app.${config.zoneName}`),
  ]);

  const httpsSummary = {
    [`https://${config.zoneName}`]: httpsChecks[0],
    [`https://app.${config.zoneName}`]: httpsChecks[1],
    [`https://staging.${config.zoneName}`]: httpsChecks[2],
    [`https://staging-app.${config.zoneName}`]: httpsChecks[3],
  };

  const cnameFailures = cnameChecks.filter((check) => !check.cnameMatches);
  const apexFailure = !apexCheck.matchesByIp;
  const httpsFailures = Object.entries(httpsSummary).filter(([, value]) => !value.ok);

  const result = {
    ok: !apexFailure && cnameFailures.length === 0 && httpsFailures.length === 0,
    provider: config.provider,
    zoneName: config.zoneName,
    apexCheck,
    cnameChecks,
    httpsChecks: httpsSummary,
    verifiedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
