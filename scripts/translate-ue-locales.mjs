#!/usr/bin/env node
/**
 * Translate missing UnionEyes message keys for IT and PT using OpenAI.
 *
 * Strategy:
 *  - Use en-CA.json as the source of truth.
 *  - For each target locale (it, pt), find leaf paths whose value is missing
 *    in the locale file (treating it as a deep merge with en-CA).
 *  - Send batches of {path: english} to OpenAI with strict JSON output.
 *  - Deep-merge translations back into the locale file.
 *
 * Run:
 *   node scripts/translate-ue-locales.mjs            # both it + pt
 *   node scripts/translate-ue-locales.mjs it
 *   node scripts/translate-ue-locales.mjs pt --limit 200 --dry
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(process.cwd());
const MSG_DIR = path.join(ROOT, 'apps', 'union-eyes', 'messages');
const SRC_FILE = path.join(MSG_DIR, 'en-CA.json');

const args = process.argv.slice(2);
const flagValueIndices = new Set();
function flagValue(name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  flagValueIndices.add(i);
  flagValueIndices.add(i + 1);
  return args[i + 1];
}
const DRY = args.includes('--dry');
const LIMIT = flagValue('--limit') !== undefined ? Number(flagValue('--limit')) : Infinity;
const BATCH_SIZE = flagValue('--batch') !== undefined ? Number(flagValue('--batch')) : 40;
const CONCURRENCY = flagValue('--concurrency') !== undefined ? Number(flagValue('--concurrency')) : 6;
const requestedLocales = args.filter((a, i) => !a.startsWith('--') && !flagValueIndices.has(i));

const TARGETS = (requestedLocales.length ? requestedLocales : ['it', 'pt']).map((l) =>
  l.replace(/^--/, '')
);

const LOCALE_NAMES = {
  it: { name: 'Italian (Italy)', code: 'it-IT' },
  pt: { name: 'Portuguese (Brazil)', code: 'pt-BR' },
  fr: { name: 'French (France)', code: 'fr-FR' },
  'fr-CA': { name: 'French (Canada)', code: 'fr-CA' },
  en: { name: 'English (passthrough — copy source)', code: 'en', passthrough: true },
};

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o';

if (!DRY && !OPENAI_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set. Use --dry to preview only.');
  process.exit(1);
}

// ---------- helpers ----------
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function flatten(obj, prefix = '', out = {}) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function getDeep(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const k of parts) {
    if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
    else return undefined;
  }
  return cur;
}

// Sort keys recursively for deterministic output, matching en-CA ordering where possible.
function sortLikeReference(target, reference) {
  if (
    target === null ||
    typeof target !== 'object' ||
    Array.isArray(target) ||
    reference === null ||
    typeof reference !== 'object' ||
    Array.isArray(reference)
  ) {
    return target;
  }
  const out = {};
  for (const k of Object.keys(reference)) {
    if (k in target) out[k] = sortLikeReference(target[k], reference[k]);
  }
  for (const k of Object.keys(target)) {
    if (!(k in out)) out[k] = target[k];
  }
  return out;
}

// ---------- translation ----------
const SYSTEM_PROMPT = (locale) => `You are a senior software localization translator working on the UnionEyes platform — a governed operating system for Canadian unions.

Translate every English string into ${locale.name} (${locale.code}). Output professional, natural, idiomatic copy suitable for a public marketing site, legal pages, and enterprise UI.

Strict rules:
1. Reply with a single JSON object whose keys EXACTLY match the input keys, and whose values are translated strings.
2. Do NOT translate, alter, or remove ICU placeholders, including: {name}, {count}, {value}, {date}, {0}, {plural,one{...}other{...}}, <strong>...</strong>, %s, \\n, etc. They must appear with identical syntax.
3. Do NOT translate brand or proper nouns: UnionEyes, Nzila Ventures, Microsoft Azure, Clerk, OpenAI, GitHub, LinkedIn.
4. Do NOT translate technical acronyms / standards: PIPEDA, RBAC, SLA, T4, T4A, GST, HST, CBA, AI, API, JSON, SHA-256, AES-256, TLS, ARIA, WCAG, ACA, NVDA, JAWS, VoiceOver, EN, FR, IT, PT, EN/FR, ICU, MFA.
5. Preserve URLs, email addresses, file paths, and HTML tags exactly.
6. Preserve leading and trailing whitespace and punctuation including ":" "." "?" "!" and ellipses.
7. If the source contains the literal "ΓÇö" or "ΓÇÖ" (mojibake for em-dash and right single quote), normalize them to "—" and "’" in the translation.
8. Keep the translation length reasonably close to the source — do not add commentary or HTML you didn't see in the source.
9. Use Canadian/European spelling conventions appropriate for ${locale.name}.

Return ONLY raw JSON. No markdown fences. No comments.`;

async function translateBatch(entries, locale) {
  const payload = Object.fromEntries(entries);
  const userMsg = `Translate the values of this JSON object to ${locale.name}. Keys must remain identical.\n\n${JSON.stringify(payload)}`;
  const body = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT(locale) },
      { role: 'user', content: userMsg },
    ],
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`OpenAI ${res.status}: ${txt}`);
    err.status = res.status;
    // Parse "try again in 2.346s" or "Please try again in 184ms"
    const m = txt.match(/try again in ([0-9.]+)(ms|s)/i);
    if (m) {
      const n = parseFloat(m[1]);
      err.retryAfterMs = m[2].toLowerCase() === 'ms' ? n : n * 1000;
    }
    throw err;
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('Invalid JSON in response: ' + content.slice(0, 400));
  }
  return parsed;
}

async function main() {
  const en = readJson(SRC_FILE);
  const enFlat = flatten(en);
  const enKeys = Object.keys(enFlat);

  for (const code of TARGETS) {
    const locale = LOCALE_NAMES[code];
    if (!locale) {
      console.warn(`Skipping unknown locale: ${code}`);
      continue;
    }
    const file = path.join(MSG_DIR, `${code}.json`);
    const target = fs.existsSync(file) ? readJson(file) : {};
    const targetFlat = flatten(target);

    // Find missing or empty keys (only translate string leaves).
    const missing = enKeys.filter((k) => {
      const src = enFlat[k];
      if (typeof src !== 'string') return false;
      const cur = targetFlat[k];
      return cur === undefined || cur === null || cur === '';
    });

    console.log(`\n[${code}] ${missing.length} missing string keys (of ${enKeys.length} total)`);
    if (DRY) {
      console.log('Sample:', missing.slice(0, 10));
      continue;
    }
    const todo = missing.slice(0, LIMIT);
    if (!todo.length) {
      console.log(`[${code}] Nothing to translate.`);
      continue;
    }

    const updated = JSON.parse(JSON.stringify(target));

    // Passthrough locales (e.g. `en`) just copy source values verbatim.
    if (locale.passthrough) {
      for (const k of todo) setDeep(updated, k, enFlat[k]);
      const sorted = sortLikeReference(updated, en);
      writeJson(file, sorted);
      console.log(`[${code}] Copied ${todo.length} keys from source. Wrote ${file}`);
      continue;
    }

    let done = 0;

    // Build batches.
    const batches = [];
    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      batches.push(todo.slice(i, i + BATCH_SIZE));
    }

    // Run with bounded concurrency. Persist after each batch finishes.
    let next = 0;
    const writeFile = () => {
      const sorted = sortLikeReference(updated, en);
      writeJson(file, sorted);
    };
    async function worker() {
      while (true) {
        const idx = next++;
        if (idx >= batches.length) return;
        const slice = batches[idx];
        const entries = slice.map((k) => [k, enFlat[k]]);
        let attempt = 0;
        let translations;
        const maxAttempts = 12;
        while (attempt < maxAttempts) {
          try {
            translations = await translateBatch(entries, locale);
            break;
          } catch (e) {
            attempt++;
            const isRate = e.status === 429;
            const wait = isRate && e.retryAfterMs
              ? Math.max(e.retryAfterMs + 250, 1000)
              : Math.min(30000, 1500 * attempt * attempt);
            console.warn(`  [${code}] batch ${idx} attempt ${attempt} ${isRate ? 'rate-limited' : 'failed'} — waiting ${wait}ms`);
            if (attempt >= maxAttempts) {
              console.error(`  [${code}] batch ${idx} permanently failed; skipping`);
              translations = {};
              break;
            }
            await new Promise((r) => setTimeout(r, wait));
          }
        }
        for (const [k, v] of Object.entries(translations || {})) {
          if (typeof v === 'string') setDeep(updated, k, v);
        }
        done += slice.length;
        const pct = ((done / todo.length) * 100).toFixed(1);
        console.log(`[${code}] ${done}/${todo.length} (${pct}%)`);
        // Periodically persist progress so a crash doesn't lose work.
        if (idx % 5 === 0) writeFile();
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

    writeFile();
    console.log(`[${code}] Wrote ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
