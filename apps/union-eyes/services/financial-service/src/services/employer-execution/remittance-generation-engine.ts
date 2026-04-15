import { createHash } from "crypto";
import type { PayrollRunResult, RemittanceGenerationResult } from "./types";

function addDays(isoDate: string, days: number): string {
  const base = new Date(isoDate);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function generateRemittancePackage(
  payroll: PayrollRunResult,
  periodEnd: string,
): RemittanceGenerationResult {
  const dueDate = addDays(periodEnd, 15);

  const csvHeader = "employee_external_id,gross_pay,dues_amount,benefit_amount,pension_amount,net_pay";
  const csvRows = payroll.items.map((item) =>
    [
      item.employeeExternalId,
      item.grossPay.toFixed(2),
      item.duesAmount.toFixed(2),
      item.benefitAmount.toFixed(2),
      item.pensionAmount.toFixed(2),
      item.netPay.toFixed(2),
    ].join(","),
  );
  const csvContent = [csvHeader, ...csvRows].join("\n");

  const summary = {
    totals: payroll.totals,
    dueDate,
    employees: payroll.items.length,
    traceHash: payroll.traceHash,
  };

  const jsonContent = JSON.stringify({ summary, items: payroll.items }, null, 2);

  const csvHash = createHash("sha256").update(csvContent).digest("hex");
  const jsonHash = createHash("sha256").update(jsonContent).digest("hex");
  const summaryHash = createHash("sha256").update(JSON.stringify(summary)).digest("hex");

  return {
    dueDate,
    totalDue: payroll.totals.dues + payroll.totals.benefits + payroll.totals.pension,
    csvContent,
    jsonContent,
    summary,
    hashes: { csvHash, jsonHash, summaryHash },
  };
}
