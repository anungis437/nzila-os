import "server-only";

import type { ChangeRecord } from "@nzila/platform-change-management/types";

async function getChangeRecordsDir(): Promise<string | null> {
  const { existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, "ops", "change-records"),
    resolve(cwd, "..", "ops", "change-records"),
    resolve(cwd, "..", "..", "ops", "change-records"),
    resolve(cwd, "..", "..", "..", "ops", "change-records"),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }

  return null;
}

async function readChangeRecordFile(filePath: string): Promise<ChangeRecord | null> {
  const { readFileSync } = await import("node:fs");

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as ChangeRecord;
  } catch {
    return null;
  }
}

async function readAllChangeRecords(): Promise<ChangeRecord[]> {
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const dir = await getChangeRecordsDir();
  if (!dir) return [];

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const records: ChangeRecord[] = [];

    for (const file of files) {
      const record = await readChangeRecordFile(join(dir, file));
      if (record) records.push(record);
    }

    return records;
  } catch {
    return [];
  }
}

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  return await readAllChangeRecords();
}

export async function getChangeRecordById(id: string): Promise<ChangeRecord | null> {
  const records = await readAllChangeRecords();
  return records.find((record) => record.change_id === id) ?? null;
}

export async function getUpcomingChanges(): Promise<ChangeRecord[]> {
  const now = Date.now();
  const records = await readAllChangeRecords();

  return records
    .filter((record) => {
      const start = Date.parse(record.implementation_window_start);
      return Number.isFinite(start) && start >= now;
    })
    .sort(
      (a, b) =>
        Date.parse(a.implementation_window_start) -
        Date.parse(b.implementation_window_start),
    );
}

export async function getChangeCalendarData(): Promise<{
  staging: ChangeRecord[];
  production: ChangeRecord[];
  pendingPIR: ChangeRecord[];
}> {
  const records = await readAllChangeRecords();
  const staging = records.filter((record) => record.environment === "STAGING");
  const production = records.filter((record) => record.environment === "PROD");
  const pendingPIR = records.filter(
    (record) =>
      (record.change_type === "NORMAL" || record.change_type === "EMERGENCY") &&
      (record.status === "COMPLETED" ||
        record.status === "FAILED" ||
        record.status === "ROLLED_BACK") &&
      !record.post_implementation_review,
  );

  return { staging, production, pendingPIR };
}
