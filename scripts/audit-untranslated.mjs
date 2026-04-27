#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/union-eyes/app/[locale]';
const big = [];
const small = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (name === 'page.tsx') {
      const content = readFileSync(p, 'utf8');
      const hasT = /useTranslations|getTranslations/.test(content);
      if (!hasT) {
        const lines = content.split('\n').length;
        if (lines > 30) big.push({ lines, p });
        else small.push(p);
      }
    }
  }
}

walk(ROOT);
big.sort((a, b) => b.lines - a.lines);
console.log(`BIG (>30 lines, ${big.length} files):`);
for (const { lines, p } of big.slice(0, 100)) console.log(`  ${lines.toString().padStart(4)} : ${p}`);
console.log(`\nSMALL (<=30 lines, ${small.length} files — likely wrappers):`);
for (const p of small.slice(0, 20)) console.log(`  ${p}`);
