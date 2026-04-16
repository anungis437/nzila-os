#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const COVERAGE_XML = path.join(ROOT, 'coverage.xml');
const OUT_DIR = path.join(ROOT, 'reports', 'coverage');
const OUT_MD = path.join(OUT_DIR, 'dashboard.md');
const OUT_JSON = path.join(OUT_DIR, 'dashboard.json');

function parseCoverageSummary(xml) {
  const m = xml.match(/<coverage[^>]*lines-valid="(\d+)"[^>]*lines-covered="(\d+)"[^>]*line-rate="([0-9.]+)"[^>]*>/);
  if (!m) {
    throw new Error('Could not parse coverage summary from coverage.xml');
  }
  const linesValid = Number(m[1]);
  const linesCovered = Number(m[2]);
  const lineRate = Number(m[3]);
  return {
    linesValid,
    linesCovered,
    linesMissed: Math.max(linesValid - linesCovered, 0),
    lineRate,
    lineRatePct: (lineRate * 100).toFixed(2),
  };
}

function parseClasses(xml) {
  const classes = [];
  const re = /<class\s+name="([^"]+)"\s+filename="([^"]+)"[^>]*line-rate="([0-9.]+)"[^>]*>/g;
  for (const m of xml.matchAll(re)) {
    const lineRate = Number(m[3]);
    classes.push({
      name: m[1],
      filename: m[2],
      lineRate,
      lineRatePct: Number((lineRate * 100).toFixed(2)),
    });
  }
  return classes;
}

function topWorst(classes, count = 25) {
  return [...classes]
    .sort((a, b) => a.lineRate - b.lineRate || a.filename.localeCompare(b.filename))
    .slice(0, count);
}

function bucketCounts(classes) {
  const buckets = {
    lt20: 0,
    lt40: 0,
    lt60: 0,
    lt80: 0,
    gte80: 0,
  };

  for (const c of classes) {
    if (c.lineRate < 0.2) buckets.lt20 += 1;
    else if (c.lineRate < 0.4) buckets.lt40 += 1;
    else if (c.lineRate < 0.6) buckets.lt60 += 1;
    else if (c.lineRate < 0.8) buckets.lt80 += 1;
    else buckets.gte80 += 1;
  }
  return buckets;
}

function toMarkdown(summary, classes, worst, buckets) {
  const ts = new Date().toISOString();
  const rows = worst.map((c) => `| ${c.filename} | ${c.lineRatePct.toFixed(2)}% |`).join('\n');

  return `# Coverage Dashboard\n\nGenerated: ${ts}\n\n## Summary\n\n| Metric | Value |\n|---|---:|\n| Lines Valid | ${summary.linesValid} |\n| Lines Covered | ${summary.linesCovered} |\n| Lines Missed | ${summary.linesMissed} |\n| Global Line Coverage | ${summary.lineRatePct}% |\n| Classes Parsed | ${classes.length} |\n\n## Distribution\n\n| Bucket | Count |\n|---|---:|\n| < 20% | ${buckets.lt20} |\n| 20% to < 40% | ${buckets.lt40} |\n| 40% to < 60% | ${buckets.lt60} |\n| 60% to < 80% | ${buckets.lt80} |\n| >= 80% | ${buckets.gte80} |\n\n## Lowest Coverage Files (Top ${worst.length})\n\n| File | Line Coverage |\n|---|---:|\n${rows}\n\n## Source Artifacts\n\n- coverage.xml\n- coverage_html/index.html\n`;
}

function main() {
  if (!fs.existsSync(COVERAGE_XML)) {
    console.error('coverage.xml not found at repo root');
    process.exit(1);
  }

  const xml = fs.readFileSync(COVERAGE_XML, 'utf8');
  const summary = parseCoverageSummary(xml);
  const classes = parseClasses(xml);
  const worst = topWorst(classes, 25);
  const buckets = bucketCounts(classes);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jsonPayload = {
    generatedAt: new Date().toISOString(),
    summary,
    distribution: buckets,
    classCount: classes.length,
    lowestCoverage: worst,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(jsonPayload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_MD, toMarkdown(summary, classes, worst, buckets), 'utf8');

  console.log(`Coverage dashboard written: ${path.relative(ROOT, OUT_MD)}`);
  console.log(`Coverage data written: ${path.relative(ROOT, OUT_JSON)}`);
}

main();
