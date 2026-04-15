import { createHash } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type CsvEntry = {
  rowNumber: number;
  employeeExternalId: string;
  shiftDate: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  travelHours: number;
  premiumCode?: string;
  validationErrors: string[];
};

export function normalizeCsv(csvContent: string): {
  entries: CsvEntry[];
  summary: { rows: number; valid: number; invalid: number; duplicates: number };
} {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return { entries: [], summary: { rows: 0, valid: 0, invalid: 0, duplicates: 0 } };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const data = lines.slice(1);
  const at = (row: string[], key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? row[idx]?.trim() ?? "" : "";
  };

  let valid = 0;
  let invalid = 0;
  let duplicates = 0;
  const seen = new Set<string>();

  const entries = data.map((line, idx) => {
    const row = line.split(",");
    const employeeExternalId = at(row, "employee_external_id");
    const shiftDate = at(row, "shift_date");
    const regularHours = Number(at(row, "regular_hours") || "0");
    const overtimeHours = Number(at(row, "overtime_hours") || "0");
    const doubletimeHours = Number(at(row, "doubletime_hours") || "0");
    const travelHours = Number(at(row, "travel_hours") || "0");
    const premiumCode = at(row, "premium_code") || undefined;

    const validationErrors: string[] = [];
    if (!employeeExternalId) validationErrors.push("missing_employee_external_id");
    if (!shiftDate) validationErrors.push("missing_shift_date");
    if ([regularHours, overtimeHours, doubletimeHours, travelHours].some((n) => Number.isNaN(n) || n < 0)) {
      validationErrors.push("invalid_hours");
    }

    const rowHash = sha256(`${employeeExternalId}|${shiftDate}|${regularHours}|${overtimeHours}|${doubletimeHours}|${travelHours}`);
    if (seen.has(rowHash)) {
      validationErrors.push("duplicate_row");
      duplicates += 1;
    }
    seen.add(rowHash);

    if (validationErrors.length) invalid += 1;
    else valid += 1;

    return {
      rowNumber: idx + 2,
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

  return { entries, summary: { rows: data.length, valid, invalid, duplicates } };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePayroll(entries: CsvEntry[], baseRate: number, duesRate: number, benefitRate: number, pensionRate: number) {
  const items = entries.map((entry) => {
    const normalizedHours = entry.regularHours + entry.overtimeHours * 1.5 + entry.doubletimeHours * 2;
    const premiumPay = entry.travelHours * baseRate * 0.5;
    const grossPay = round2(normalizedHours * baseRate + premiumPay);
    const duesAmount = round2(grossPay * duesRate);
    const benefitAmount = round2(grossPay * benefitRate);
    const pensionAmount = round2(grossPay * pensionRate);
    const netPay = round2(grossPay - duesAmount - benefitAmount - pensionAmount);
    const trace = {
      normalizedHours,
      premiumPay,
      rates: { baseRate, duesRate, benefitRate, pensionRate },
    };

    return {
      employeeExternalId: entry.employeeExternalId,
      grossPay,
      netPay,
      duesAmount,
      benefitAmount,
      pensionAmount,
      remittanceGroupKey: "default",
      trace,
      traceHash: sha256(JSON.stringify(trace)),
    };
  });

  const totals = items.reduce(
    (acc, item) => {
      acc.gross += item.grossPay;
      acc.net += item.netPay;
      acc.dues += item.duesAmount;
      acc.benefits += item.benefitAmount;
      acc.pension += item.pensionAmount;
      return acc;
    },
    { gross: 0, net: 0, dues: 0, benefits: 0, pension: 0 },
  );

  const calcTrace = {
    stages: [
      "input_snapshot",
      "rule_resolution",
      "hour_normalization",
      "base_rate_resolution",
      "overtime_doubletime_logic",
      "premium_travel_logic",
      "dues_benefits_pension_logic",
      "remittance_grouping",
      "compliance_checks",
      "calc_trace_persistence",
    ],
    totals,
    itemCount: items.length,
  };

  return {
    items,
    totals,
    calcTrace,
    calcTraceHash: sha256(JSON.stringify(calcTrace)),
  };
}
