/**
 * Migration script: Move all root-level page directories under app/[locale]/
 * so every page is served with NextIntlClientProvider (i18n support).
 *
 * Strategy:
 * - For directories that don't exist in [locale], move them entirely
 * - For directories that exist in both, merge (move unique files, skip duplicates)
 * - Remove empty source directories after moving
 */
import fs from 'fs';
import path from 'path';

const appDir = path.resolve('apps/union-eyes/app');
const localeDir = path.join(appDir, '[locale]');

let moved = 0;
let skipped = 0;
let deleted = 0;

function getAllFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...getAllFiles(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      removeEmptyDirs(path.join(dir, entry.name));
    }
  }
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

function mergeMove(srcDir, dstDir, label) {
  if (!fs.existsSync(srcDir)) {
    console.log(`  [skip] ${label} does not exist`);
    return;
  }
  console.log(`\n=== ${label} ===`);

  const files = getAllFiles(srcDir);
  for (const file of files) {
    const relPath = path.relative(srcDir, file);
    const dstPath = path.join(dstDir, relPath);

    if (fs.existsSync(dstPath)) {
      console.log(`  SKIP (exists in locale): ${relPath}`);
      // Remove the duplicate root file
      fs.unlinkSync(file);
      skipped++;
      deleted++;
    } else {
      // Move to locale
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.renameSync(file, dstPath);
      console.log(`  MOVE: ${relPath}`);
      moved++;
    }
  }

  // Clean up empty dirs left behind
  removeEmptyDirs(srcDir);
}

// ── 1. Move entire directories (no locale equivalent) ──
const moveEntire = [
  'calendar', 'cases', 'deadlines', 'docs', 'elections',
  'grievances', 'mobile', 'strike-fund', 'trust',
  'workbench', 'api-docs', 'pay'
];
for (const dir of moveEntire) {
  mergeMove(
    path.join(appDir, dir),
    path.join(localeDir, dir),
    `${dir}/ → [locale]/${dir}/`
  );
}

// ── 2. Merge directories that exist in both root and [locale] ──
// dashboard/ has many overlapping subdirs + 2 unique (leadership, structure)
mergeMove(
  path.join(appDir, 'dashboard'),
  path.join(localeDir, 'dashboard'),
  'dashboard/ → [locale]/dashboard/ (merge)'
);

// admin/ has different pages in root vs locale
mergeMove(
  path.join(appDir, 'admin'),
  path.join(localeDir, 'admin'),
  'admin/ → [locale]/admin/ (merge)'
);

// members/ root has [id], [id]/edit, import, new, segments; locale has only page.tsx
mergeMove(
  path.join(appDir, 'members'),
  path.join(localeDir, 'members'),
  'members/ → [locale]/members/ (merge)'
);

// dues/ root-level page (member-facing, separate from dashboard/dues)
mergeMove(
  path.join(appDir, 'dues'),
  path.join(localeDir, 'dues'),
  'dues/ → [locale]/dues/ (merge)'
);

console.log(`\n✅ Migration complete: ${moved} files moved, ${skipped} duplicates skipped, ${deleted} duplicates deleted`);

// Verify no stray dirs remain
const remainingDirs = [...moveEntire, 'dashboard', 'admin', 'members', 'dues'];
const stillExists = remainingDirs.filter(d => fs.existsSync(path.join(appDir, d)));
if (stillExists.length > 0) {
  console.log(`⚠️  These root dirs still have files: ${stillExists.join(', ')}`);
} else {
  console.log('✅ All root page directories cleaned up');
}
