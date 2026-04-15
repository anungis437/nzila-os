import { createHash } from "crypto";
import type { NormalizedTimesheetEntry } from "./types";

export function parseCsvRows(csv: string): string[][] {
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export function normalizeTimesheetCsv(csv: string): {
  entries: NormalizedTimesheetEntry[];
  summary: {
    rows: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
} {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    return {
      entries: [],
      summary: { rows: 0, valid: 0, invalid: 0, duplicates: 0 },
    };
  }

  const header = rows[0].map((h) => h.toLowerCase());
  const dataRows = rows.slice(1);

  const get = (row: string[], key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? row[idx] : "";
  };

  const seen = new Set<string>();
  let valid = 0;
  let invalid = 0;
  let duplicates = 0;

  const entries = dataRows.map((row, i) => {
    const employeeExternalId = get(row, "employee_external_id");
    const shiftDate = get(row, "shift_date");
    const regularHours = Number(get(row, "regular_hours") || "0");
    const overtimeHours = Number(get(row, "overtime_hours") || "0");
    const doubletimeHours = Number(get(row, "doubletime_hours") || "0");
    const travelHours = Number(get(row, "travel_hours") || "0");
    const premiumCode = get(row, "premium_code") || undefined;

    const validationErrors: string[] = [];
    if (!employeeExternalId) validationErrors.push("missing_employee_external_id");
    if (!shiftDate) validationErrors.push("missing_shift_date");
    if ([regularHours, overtimeHours, doubletimeHours, travelHours].some((n) => Number.isNaN(n) || n < 0)) {
      validationErrors.push("invalid_hours");
    }

    const dedupeKey = createHash("sha256")
      .update([employeeExternalId, shiftDate, String(regularHours), String(overtimeHours), String(doubletimeHours), String(travelHours)].join("|"))
      .digest("hex");
    if (seen.has(dedupeKey)) {
      validationErrors.push("duplicate_row");
      duplicates += 1;
    }
    seen.add(dedupeKey);

    if (validationErrors.length === 0) valid += 1;
    else invalid += 1;

    return {
      rowNumber: i + 2,
      employeeExternalId,
      shiftDate,
      regularHours,
      overtimeHours,
      doubletimeHours,
      travelHours,
      premiumCode,
      validationErrors,
    };
  });

  return {
    entries,
    summary: {
      rows: dataRows.length,
      valid,
      invalid,
      duplicates,
    },
  };
}
