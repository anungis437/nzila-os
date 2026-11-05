#!/usr/bin/env node
/**
 * Dependency-free, read-only validation for checked-in agent skill documents.
 * It validates packaging and metadata only, not runtime capabilities or grants.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const roots = [
  '.agents/skills',
  '.cursor/skills',
  '.claude/skills',
  '.codex/skills',
  '.augment/skills',
  '.github/skills',
];
const required = new Set([
  'nzila-repository-orientation',
  'nzila-defect-family-remediation',
  'nzila-audit-atomicity',
  'nzila-governance-evidence',
  'nzila-tool-fabric-review',
  'nzila-runtime-acceptance',
]);
const errors = [];
const skills = [];

function walk(folder) {
  if (!fs.existsSync(folder)) return;
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) walk(full);
    else if (item.isFile() && item.name === 'SKILL.md') skills.push(full);
  }
}

for (const root of roots) walk(path.join(repoRoot, root));

function metadataOf(content, rel) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content);
  if (!front) {
    errors.push(`${rel}: missing YAML frontmatter`);
    return null;
  }
  const raw = front[1].split(/\r?\n/);
  const readField = (field) => {
    const i = raw.findIndex((line) => line.startsWith(field + ':'));
    if (i < 0) return '';
    const value = raw[i].slice(field.length + 1).trim();
    if (value !== '>' && value !== '|' && value !== '>-' && value !== '|-') {
      return value.replace(/^["']|["']$/g, '');
    }
    const parts = [];
    for (let j = i + 1; j < raw.length && /^\s+\S/.test(raw[j]); j++) {
      parts.push(raw[j].trim());
    }
    return parts.join(' ').trim();
  };
  return { name: readField('name'), description: readField('description'), body: content.slice(front[0].length), front: front[1] };
}

const seen = new Map();
const canonical = new Set();
for (const full of skills) {
  const rel = path.relative(repoRoot, full).replaceAll(path.sep, '/');
  const content = fs.readFileSync(full, 'utf8');
  const meta = metadataOf(content, rel);
  if (!meta) continue;
  const expectedName = path.basename(path.dirname(full));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name) || meta.name.length > 64) {
    errors.push(`${rel}: name must be lowercase-hyphen, 1-64 characters`);
  }
  if (meta.name !== expectedName) errors.push(`${rel}: name must match containing directory ${expectedName}`);
  if (!meta.description || meta.description.length > 1024) errors.push(`${rel}: description required, maximum 1024 characters`);
  if (!/^#\s+\S/m.test(meta.body)) errors.push(`${rel}: expected Markdown heading and instructions`);

  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const older = seen.get(meta.name);
  if (older && older.hash !== hash) errors.push(`${rel}: conflicting duplicate skill ${meta.name} (first ${older.rel})`);
  else if (!older) seen.set(meta.name, { rel, hash });

  if (meta.name.startsWith('nzila-')) {
    if (!rel.startsWith('.agents/skills/')) errors.push(`${rel}: first-party skills must use the canonical .agents/skills root`);
    if (/^(allowed-tools|permissions|authority|approved|trust|grants):/mi.test(meta.front)) {
      errors.push(`${rel}: first-party skill metadata must not declare tool authority or grants`);
    }
    if (!/^## Trigger\s*$/m.test(meta.body) || !/^## Procedure\s*$/m.test(meta.body)) {
      errors.push(`${rel}: first-party skills require Trigger and Procedure sections`);
    }
    if (rel.startsWith('.agents/skills/')) canonical.add(meta.name);
  }

  for (const m of meta.body.matchAll(/\]\(((?:references|scripts|assets)\/[^)\s#]+)(?:#[^)]+)?\)/g)) {
    const ref = path.resolve(path.dirname(full), m[1]);
    const boundary = path.dirname(full) + path.sep;
    if (!ref.startsWith(boundary) || !fs.existsSync(ref)) errors.push(`${rel}: broken or escaping local resource ${m[1]}`);
  }
}
for (const name of required) if (!canonical.has(name)) errors.push(`missing required first-party skill: ${name}`);
if (!skills.length) errors.push('no checked-in SKILL.md files found');
if (errors.length) {
  console.error(`Agent skills check failed: ${errors.length} issue(s)`);
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Agent skills check PASS: ${skills.length} file(s), ${seen.size} unique skill(s), ${canonical.size} first-party Nzila skill(s)`);
}

