/**
 * One-off: rename visible "institution*" labels to "organization*"
 * in marketing i18n message files. Only mutates string VALUES — keys are
 * preserved so existing `t('institutionalProof')` callsites keep working.
 *
 * Skips:
 *  - The whitepaper deep-link path '#institutional-memory' (URL fragment, not a label).
 *  - Acronym-like substrings already capitalized as "Institution" inside a
 *    proper-noun phrase such as "Statistics Institution" — none observed.
 *
 * Run from repo root: node scripts/one-off/rename-institution-to-organization.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'apps/union-eyes/messages/en-CA.json',
  'apps/union-eyes/messages/en.json',
  'apps/union-eyes/messages/fr-CA.json',
  'apps/union-eyes/messages/fr.json',
  'apps/union-eyes/messages/it.json',
  'apps/union-eyes/messages/pt.json',
];

// case-preserving replacements applied to string VALUES only
const REPLACEMENTS = [
  // English
  [/Institutional/g, 'Organizational'],
  [/institutional/g, 'organizational'],
  [/Institutions/g, 'Organizations'],
  [/institutions/g, 'organizations'],
  [/\bInstitution\b/g, 'Organization'],
  [/\binstitution\b/g, 'organization'],
  // French
  [/Institutionnelles/g, 'Organisationnelles'],
  [/institutionnelles/g, 'organisationnelles'],
  [/Institutionnels/g, 'Organisationnels'],
  [/institutionnels/g, 'organisationnels'],
  [/Institutionnelle/g, 'Organisationnelle'],
  [/institutionnelle/g, 'organisationnelle'],
  [/Institutionnel/g, 'Organisationnel'],
  [/institutionnel/g, 'organisationnel'],
  // Italian
  [/Istituzionali/g, 'Organizzativi'],
  [/istituzionali/g, 'organizzativi'],
  [/Istituzionale/g, 'Organizzativa'],
  [/istituzionale/g, 'organizzativa'],
  // Portuguese
  [/Institucionais/g, 'Organizacionais'],
  [/institucionais/g, 'organizacionais'],
  [/Institucional/g, 'Organizacional'],
  [/institucional/g, 'organizacional'],
];

// Preserve specific tokens that must NOT change. We swap them out before
// replacement and back after. Currently: the deep-link fragment that the
// platform page anchor relies on.
const RESERVED = [
  ['#institutional-memory', '\u0000__RESERVED_ANCHOR_INSTMEM__\u0000'],
];

function applyToString(str) {
  let out = str;
  for (const [orig, ph] of RESERVED) out = out.split(orig).join(ph);
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  for (const [orig, ph] of RESERVED) out = out.split(ph).join(orig);
  return out;
}

function walk(node) {
  if (typeof node === 'string') return applyToString(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      // KEYS are preserved as-is — only the VALUE is transformed.
      out[k] = walk(v);
    }
    return out;
  }
  return node;
}

let totalChanged = 0;
for (const rel of FILES) {
  const abs = resolve(rel);
  const original = readFileSync(abs, 'utf8');
  const data = JSON.parse(original);
  const next = walk(data);
  const serialized = JSON.stringify(next, null, 2) + '\n';
  if (serialized !== original) {
    writeFileSync(abs, serialized, 'utf8');
    const before = (original.match(/institution|istituzion|institucion/gi) || []).length;
    const after = (serialized.match(/institution|istituzion|institucion/gi) || []).length;
    console.log(`${rel}: ${before} -> ${after}`);
    totalChanged += before - after;
  } else {
    console.log(`${rel}: unchanged`);
  }
}
console.log(`Total occurrences rewritten: ${totalChanged}`);
