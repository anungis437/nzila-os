/**
 * Narrative-CI report writer.
 *
 * Emits both `narrative-audit.json` (full machine-readable report) and
 * `narrative-audit.md` (human-readable PAGE / SCORES / FLAGS / RECOMMENDATIONS).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type { AuditReport, FileAuditResult } from "../narrative-audit";

function recommendationsFor(file: FileAuditResult): string[] {
  const recs = new Set<string>();
  for (const v of file.violations) {
    if (v.term.suggestion) {
      recs.add(`Replace "${v.term.term}" → ${v.term.suggestion}`);
    } else {
      recs.add(`Remove or rephrase "${v.term.term}" (${v.term.category}).`);
    }
  }
  for (const r of file.ruleResults) {
    for (const flag of r.flags) {
      if (flag.suggestion) recs.add(flag.suggestion);
    }
  }
  return [...recs];
}

function renderFile(file: FileAuditResult): string {
  const lines: string[] = [];
  lines.push(`### ${file.ctx.label}`);
  lines.push("");
  lines.push(`- **Path:** \`${file.ctx.path}\``);
  lines.push(`- **Institutional Maturity:** ${file.maturity}/100`);
  lines.push("");
  lines.push("**Scores:**");
  for (const r of file.ruleResults) {
    lines.push(`- ${r.rule}: ${r.score}/100 (${r.status})`);
  }
  lines.push("");

  if (file.violations.length > 0) {
    lines.push("**Vocabulary violations:**");
    for (const v of file.violations) {
      lines.push(
        `- L${v.line} [${v.term.severity}/${v.term.category}] \`${v.term.term}\` — ${v.excerpt}`,
      );
    }
    lines.push("");
  }

  const flagLines: string[] = [];
  for (const r of file.ruleResults) {
    for (const f of r.flags) {
      flagLines.push(`- (${r.rule}) ${f.message}`);
    }
  }
  if (flagLines.length > 0) {
    lines.push("**Flags:**");
    lines.push(...flagLines);
    lines.push("");
  }

  const recs = recommendationsFor(file);
  if (recs.length > 0) {
    lines.push("**Recommendations:**");
    for (const r of recs) lines.push(`- ${r}`);
    lines.push("");
  }

  return lines.join("\n");
}

function renderMarkdown(report: AuditReport): string {
  const { summary } = report;
  const out: string[] = [];
  out.push("# Union Eyes — Narrative CI Report");
  out.push("");
  out.push(`Generated: ${report.generatedAt}`);
  out.push("");
  out.push("## Summary");
  out.push("");
  out.push(`- Files scanned: **${summary.totalFiles}**`);
  out.push(`- Hard-fail violations: **${summary.hardFails}**`);
  out.push(`- Warning violations: **${summary.warnings}**`);
  out.push(`- Rule failures: **${summary.ruleFailures}**`);
  out.push(`- Average Institutional Maturity: **${summary.averageMaturity}/100**`);
  out.push("");
  out.push("## Per-Surface Detail");
  out.push("");
  for (const f of report.files) {
    out.push(renderFile(f));
  }
  return out.join("\n");
}

export async function writeNarrativeReport(
  report: AuditReport,
  outDir: string,
): Promise<{ jsonPath: string; mdPath: string }> {
  await fs.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "narrative-audit.json");
  const mdPath = path.join(outDir, "narrative-audit.md");
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(mdPath, renderMarkdown(report), "utf8");
  return { jsonPath, mdPath };
}
