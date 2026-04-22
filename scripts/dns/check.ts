import { checkCloudflareAccess, getDnsConfig, parseArgs } from './lib';

async function main() {
  const args = parseArgs(process.argv);
  const config = getDnsConfig();

  if (config.provider !== 'cloudflare') {
    throw new Error(
      `DNS provider ${config.provider} preflight is not implemented yet. Supported now: cloudflare`,
    );
  }

  await checkCloudflareAccess(config);

  const result = {
    ok: true,
    provider: config.provider,
    zoneName: config.zoneName,
    zoneId: config.zoneId,
    strict: args.strict,
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
