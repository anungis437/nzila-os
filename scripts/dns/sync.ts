import {
  checkCloudflareAccess,
  deleteCloudflareRecord,
  getDesiredRecords,
  getDnsConfig,
  listCloudflareRecords,
  normalizeRecordName,
  parseArgs,
  recordKey,
  upsertCloudflareRecord,
} from './lib';

async function main() {
  const args = parseArgs(process.argv);
  const config = getDnsConfig();

  if (config.provider !== 'cloudflare') {
    throw new Error(`DNS sync for provider ${config.provider} is not implemented yet`);
  }

  await checkCloudflareAccess(config);

  const desired = getDesiredRecords(config, args.includeOptional);
  const existing = await listCloudflareRecords(config);

  const desiredByKey = new Map(desired.map((record) => [recordKey(record), record]));

  const existingByKey = new Map(
    existing
      .filter((record) => record.type === 'CNAME')
      .map((record) => [
        recordKey({
          type: record.type,
          name: normalizeRecordName(record.name, config.zoneName),
        }),
        {
          ...record,
          name: normalizeRecordName(record.name, config.zoneName),
        },
      ]),
  );

  const operations: Array<{ action: string; key: string; details: string }> = [];

  for (const desiredRecord of desired) {
    const key = recordKey(desiredRecord);
    const current = existingByKey.get(key);

    if (args.dryRun) {
      operations.push({
        action: current ? 'upsert-preview' : 'create-preview',
        key,
        details: `${desiredRecord.name} -> ${desiredRecord.content}`,
      });
      continue;
    }

    const state = await upsertCloudflareRecord(config, desiredRecord, current);
    operations.push({
      action: state,
      key,
      details: `${desiredRecord.name} -> ${desiredRecord.content}`,
    });
  }

  if (args.allowDelete) {
    const desiredKeys = new Set(desiredByKey.keys());
    for (const [key, record] of existingByKey.entries()) {
      const isManaged = (record.comment || '').includes('managed-by=nzila-dns-sync');
      if (desiredKeys.has(key) || !isManaged) {
        continue;
      }

      if (args.dryRun) {
        operations.push({ action: 'delete-preview', key, details: record.name });
      } else {
        await deleteCloudflareRecord(config, record.id);
        operations.push({ action: 'deleted', key, details: record.name });
      }
    }
  }

  const summary = {
    ok: true,
    provider: config.provider,
    zoneName: config.zoneName,
    dryRun: args.dryRun,
    allowDelete: args.allowDelete,
    includeOptional: args.includeOptional,
    desiredRecordCount: desired.length,
    operationCount: operations.length,
    operations,
    syncedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
