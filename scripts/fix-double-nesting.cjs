/**
 * fix-double-nesting.cjs
 *
 * Fixes the double-nesting bug in withApi route handlers.
 *
 * Bug: handlers return { data: VALUE } but withApi already wraps in
 *      { success: true, data: RESULT }, creating { data: { data: VALUE } }.
 *
 * Fix: unwrap `return { data: VALUE };` → `return VALUE;`
 *      For returns with extra keys (pagination, total), drop them and
 *      return just the data value.
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(walk(p));
    else if (e.name === 'route.ts') results.push(p);
  }
  return results;
}

/**
 * Find matching closing brace for an opening brace at `start`.
 * Handles strings (single, double, backtick) to avoid false matches.
 */
function findMatchingBrace(str, start) {
  let depth = 0, inStr = false, sCh = '';
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === sCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; sCh = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * Process a single file: find all `return { data: ... }` patterns and unwrap.
 * Returns { content, count } or null if nothing changed.
 */
function fixFile(content) {
  const re = /return\s*\{/g;
  let m;
  const reps = [];

  while ((m = re.exec(content)) !== null) {
    const rStart = m.index;
    const bStart = rStart + m[0].length - 1; // position of '{'
    const bEnd = findMatchingBrace(content, bStart);
    if (bEnd === -1) continue;

    // Find the semicolon after the closing brace
    let semi = bEnd + 1;
    while (semi < content.length && /\s/.test(content[semi])) semi++;
    if (semi >= content.length || content[semi] !== ';') continue;

    // Extract content between braces, trimmed
    const inner = content.slice(bStart + 1, bEnd).trim();

    // Check if the FIRST key is `data:`
    const dm = inner.match(/^data:\s*/);
    if (!dm) continue;

    const afterData = inner.slice(dm[0].length);

    // Find end of the data value: first comma at bracket-depth 0
    let vEnd = -1, depth = 0, inStr = false, sCh = '';
    for (let i = 0; i < afterData.length; i++) {
      const c = afterData[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === sCh) inStr = false;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = true; sCh = c; continue; }
      if (c === '{' || c === '(' || c === '[') depth++;
      if (c === '}' || c === ')' || c === ']') depth--;
      if (depth === 0 && c === ',') { vEnd = i; break; }
    }

    let dataValue;
    if (vEnd === -1) {
      // data is the only key (possibly with trailing comma)
      dataValue = afterData.replace(/,?\s*$/, '').trim();
    } else {
      dataValue = afterData.slice(0, vEnd).trim();
      // Check if there's meaningful content after the comma (other keys)
      // If so, we still just return the data value (dropping pagination/total/etc.)
    }

    if (!dataValue) continue;

    reps.push({ start: rStart, end: semi + 1, value: dataValue });
  }

  if (reps.length === 0) return null;

  // Apply replacements in reverse order to preserve positions
  let result = content;
  for (const r of reps.reverse()) {
    result = result.slice(0, r.start) + `return ${r.value};` + result.slice(r.end);
  }
  return { content: result, count: reps.length };
}

// ── Main ─────────────────────────────────────────────────────────────────────
const apiDir = path.join(process.cwd(), 'apps', 'union-eyes', 'app', 'api');
const files = walk(apiDir);
let totalFiles = 0, totalFixes = 0;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('withApi')) continue;

  const result = fixFile(content);
  if (result) {
    fs.writeFileSync(f, result.content);
    totalFiles++;
    totalFixes += result.count;
    console.log(`  ${path.relative(process.cwd(), f)}  (${result.count})`);
  }
}

console.log(`\nFixed ${totalFixes} return statements across ${totalFiles} files.\n`);

// ── Verify: scan for any remaining patterns ──────────────────────────────────
let remaining = 0;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('withApi')) continue;

  // Quick heuristic: look for `return {` followed by `data:` within a few lines
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Single-line check
    if (/return\s*\{/.test(line) && /\bdata\s*:/.test(line)) {
      remaining++;
      console.log(`  REMAINING: ${path.relative(process.cwd(), f)}:${i + 1}`);
      continue;
    }
    // Multi-line check: return { on this line, data: within next 3 lines
    if (/return\s*\{\s*$/.test(line)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (/^\s*data\s*:/.test(lines[j])) {
          remaining++;
          console.log(`  REMAINING: ${path.relative(process.cwd(), f)}:${i + 1}`);
          break;
        }
        if (/\}/.test(lines[j])) break;
      }
    }
  }
}

if (remaining === 0) {
  console.log('No remaining double-nesting patterns found.');
} else {
  console.log(`\n${remaining} pattern(s) still need manual review.`);
}
