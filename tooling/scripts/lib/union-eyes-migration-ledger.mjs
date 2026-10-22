/**
 * Union Eyes - migration ledger integrity.
 *
 * drizzle.__drizzle_migrations is shared by the scoped and platform executors.
 * The executors decide "already applied" by file hash, so a ledger row that was
 * altered or deleted does not stop anything: its migration simply looks
 * unapplied, is executed again, and is stamped again. That repairs the evidence
 * and hides the tampering. Only a migration that happened not to be idempotent
 * (0000) ever failed.
 *
 * The journals in the repository are the trusted history. This module requires
 * the database ledger to be a faithful, append-only prefix of each journal:
 *
 *   - every row is a known journal hash, or an explicitly reviewed exception
 *   - no hash is recorded twice
 *   - recorded entries are exactly the first k entries of their journal, in
 *     journal order (no gap, no reordering)
 *
 * Scoped and platform migrations interleave in the ledger, so each journal is
 * checked on its own. Appending a new migration to a journal is not drift.
 *
 * A prefix cannot distinguish "newest row deleted" from "newest migration not
 * yet applied". Every bootstrap attestation that carries a migrationLedger
 * receipt records the row count and a digest of the ledger it saw, so the rows
 * it covered must still be there, unchanged.
 *
 * Which attestations count: those that carry a migrationLedger key. A row
 * without the key predates the receipt contract (or was written by tooling that
 * does not know it) and is not evidence either way, so it can neither supply nor
 * hide an anchor. A row that carries the key but whose receipt is malformed, or
 * that contradicts an earlier receipt (fewer rows than before), is a violation.
 * It is never skipped in favour of an older valid receipt.
 *
 * Trust limit: the attestation lives in the same mutable database. Someone who
 * can rewrite the ledger, delete the receipts, or rewrite both is not detectable
 * from inside the database. Closing that needs an independently held release
 * record, which this module does not provide.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Migrations the reviewed existing-environment rollout may gap-fill: its row can
 * be absent while later entries are recorded, and is appended after them. That is
 * the explicit governed procedure. Every other migration must be recorded
 * exactly once, in journal order, with no gap. Adding to this list is a reviewed
 * change to this file.
 */
export const GOVERNED_GAP_FILL_TAGS = Object.freeze(['0005_add_icra_assessment_capability_token']);

export function ledgerDigest(rows) {
  const text = rows.map((row) => `${row.id}:${row.hash}`).join('\n');
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function readLedgerExceptions(exceptionsPath) {
  if (!exceptionsPath || !fs.existsSync(exceptionsPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'));
  const entries = parsed.exceptions ?? [];
  for (const entry of entries) {
    if (!HASH_PATTERN.test(entry.hash ?? '')) {
      throw new Error(`Ledger exception has an invalid hash: ${JSON.stringify(entry)}`);
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
      throw new Error(`Ledger exception ${entry.hash} needs a reviewed reason of at least 20 characters.`);
    }
  }
  return entries;
}

/**
 * Pure evaluation. `journals` is [{ name, entries: [{ tag, hash }] }].
 * attested is one or more { id?, rowCount, digest } receipts (oldest first), { malformed: true }  for an unreadable receipt, or null.
 */
export function evaluateLedgerIntegrity({
  rows,
  journals,
  exceptions = [],
  attested = null,
  ignoreUnknown = false,
  governedTags = GOVERNED_GAP_FILL_TAGS,
}) {
  const violations = [];
  const owner = new Map();
  for (const journal of journals) {
    const tags = new Set();
    journal.entries.forEach((entry, index) => {
      if (tags.has(entry.tag)) violations.push(`${journal.name} journal lists ${entry.tag} more than once`);
      tags.add(entry.tag);
      if (owner.has(entry.hash)) {
        const other = owner.get(entry.hash);
        violations.push(`${journal.name} ${entry.tag} and ${other.journal} ${other.tag} share one file hash`);
        return;
      }
      owner.set(entry.hash, { journal: journal.name, tag: entry.tag, index });
    });
  }

  const allowed = new Set(exceptions.map((entry) => entry.hash));
  const seen = new Set();
  const recorded = new Map(journals.map((journal) => [journal.name, []]));
  for (const row of rows) {
    if (seen.has(row.hash)) {
      const known = owner.get(row.hash);
      violations.push(`ledger row ${row.id} records ${known ? known.tag : row.hash} a second time`);
      continue;
    }
    seen.add(row.hash);
    const known = owner.get(row.hash);
    if (!known) {
      if (!ignoreUnknown && !allowed.has(row.hash)) {
        violations.push(`ledger row ${row.id} holds hash ${row.hash}, which is in no journal and has no reviewed exception`);
      }
      continue;
    }
    recorded.get(known.journal).push({ id: row.id, tag: known.tag, index: known.index });
  }

  const governed = new Set(governedTags);
  for (const journal of journals) {
    // Governed gap-fill rows are exempt from gap and order analysis; every other row is not.
    const list = recorded.get(journal.name).filter((item) => !governed.has(item.tag));
    const present = new Set(list.map((item) => item.index));
    const maxIndex = list.reduce((max, item) => Math.max(max, item.index), -1);
    for (let index = 0; index <= maxIndex; index += 1) {
      const entry = journal.entries[index];
      if (present.has(index) || governed.has(entry.tag)) continue;
      const later = list.find((item) => item.index > index);
      violations.push(`${journal.name} ${entry.tag} is missing from the ledger although ${later.tag} is recorded after it`);
    }
    for (let position = 1; position < list.length; position += 1) {
      if (list[position].index < list[position - 1].index) {
        violations.push(
          `${journal.name} ledger order differs from the journal: ${list[position].tag} is recorded after ${list[position - 1].tag}`,
        );
      }
    }
  }
  const anchors = attested == null ? [] : [].concat(attested);
  let earlierCoverage = 0;
  anchors.forEach((anchor, position) => {
    const label = position === anchors.length - 1 ? 'the last attestation' : `attestation ${anchor.id ?? position + 1}`;
    if (anchor.malformed) {
      violations.push(`${label} carries a malformed migrationLedger receipt`);
      return;
    }
    if (anchor.rowCount < earlierCoverage) {
      violations.push(`${label} covers ${anchor.rowCount} ledger rows, fewer than the ${earlierCoverage} an earlier attestation covered`);
    }
    earlierCoverage = Math.max(earlierCoverage, anchor.rowCount);
    if (rows.length < anchor.rowCount) {
      violations.push(`ledger has ${rows.length} rows but ${label} covered ${anchor.rowCount}`);
    } else if (ledgerDigest(rows.slice(0, anchor.rowCount)) !== anchor.digest) {
      violations.push(`ledger rows covered by ${label} no longer match its recorded digest`);
    }
  });

  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

export async function readLedgerRows(client) {
  const exists = await client.query(`SELECT to_regclass('drizzle.__drizzle_migrations') AS regclass`);
  if (!exists.rows[0]?.regclass) return [];
  const result = await client.query('SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id');
  return result.rows.map((row) => ({ id: Number(row.id), hash: row.hash }));
}

function parseLedgerReceipt(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Number.isInteger(value.rowCount) ||
    value.rowCount < 0 ||
    typeof value.digest !== 'string' ||
    !HASH_PATTERN.test(value.digest)
  ) {
    return { malformed: true };
  }
  return { rowCount: value.rowCount, digest: value.digest };
}

/**
 * Every attestation that carries a migrationLedger key, oldest first. Rows
 * without the key are legacy-format and are not evidence either way.
 */
export async function readAttestedLedgers(client) {
  const exists = await client.query(`SELECT to_regclass('drizzle.bootstrap_attestations') AS regclass`);
  if (!exists.rows[0]?.regclass) return [];
  const result = await client.query(
    `SELECT id, payload->'migrationLedger' AS ledger
       FROM drizzle.bootstrap_attestations
      WHERE jsonb_typeof(payload) = 'object' AND payload ? 'migrationLedger'
      ORDER BY id`,
  );
  return result.rows.map((row) => ({ id: Number(row.id), ...parseLedgerReceipt(row.ledger) }));
}
/**
 * Throws, and changes nothing, when the ledger is not a faithful prefix of the
 * journals. Never repairs, stamps, or deletes a row.
 */
export async function assertMigrationLedgerIntegrity(client, { journals, exceptions = [], useAttestation = true, stagingLineageContext }) {
  if (stagingLineageContext) {
    const { validateRecoveryContext, historicalJournal } = await import('./ue-staging-historical-lineage.mjs');
    await validateRecoveryContext(client, stagingLineageContext);
    journals = journals.map((journal) => journal.name === 'scoped' ? historicalJournal(journal) : journal);
  }
  const rows = await readLedgerRows(client);
  const attested = useAttestation ? await readAttestedLedgers(client) : null;
  const result = evaluateLedgerIntegrity({ rows, journals, exceptions, attested });
  if (!result.ok) {
    throw new Error(
      `Migration ledger integrity failure. Nothing was applied, repaired or stamped.\n  - ${result.violations.join('\n  - ')}`,
    );
  }
  return { rowCount: rows.length, digest: ledgerDigest(rows) };
}

/** Executor-level guard: only this journal's own rows must be an unbroken, ordered prefix. */
export async function assertJournalPrefix(client, journal, { stagingLineageContext } = {}) {
  if (stagingLineageContext) {
    const { validateRecoveryContext, historicalJournal } = await import('./ue-staging-historical-lineage.mjs');
    await validateRecoveryContext(client, stagingLineageContext);
    if (journal.name !== 'scoped') throw new Error('Staging historical lineage applies only to the scoped journal');
    journal = historicalJournal(journal);
  }
  const rows = await readLedgerRows(client);
  const result = evaluateLedgerIntegrity({ rows, journals: [journal], ignoreUnknown: true });
  if (!result.ok) {
    throw new Error(
      `Migration ledger integrity failure in the ${journal.name} journal. Nothing was applied, repaired or stamped.\n  - ${result.violations.join('\n  - ')}`,
    );
  }
}
