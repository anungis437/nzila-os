'use strict'
// Moves a remaining disposition card to `implemented` once the runtime-schema authority oracle shows its relation has a governed creation lineage.
//
// reports/union-eyes/runtime-schema-lineage/disposition-cards-29.json records, for every relation the oracle once found without a creation
// migration, why: a card in `remainingCards` is an unresolved one (an F or G disposition: optional feature storage, or otherwise evidenced), and the canonical
// schema publisher excludes exactly those tables from the published manifest. When a platform migration creates the relation, the card is resolved, the
// publisher includes the table, and the oracle binding's dispositionExcluded shrinks with it.
//
// Run after regenerating the oracle (apps/union-eyes: npx tsx scripts/generate-runtime-schema-authority-oracle.ts):
//   node apps/union-eyes/scripts/codemods/resolve-disposition-cards.cjs
// It changes nothing for a card whose relation still has no creation lineage, and refuses to touch a file it cannot write back byte for byte.
const fs = require('node:fs')
const path = require('node:path')

const repo = path.resolve(__dirname, '../../../..')
const cardsFile = path.join(repo, 'reports/union-eyes/runtime-schema-lineage/disposition-cards-29.json')
const oracleFile = path.join(repo, 'reports/union-eyes-runtime-schema-authority-oracle.json')

const raw = fs.readFileSync(cardsFile, 'utf8')
const cards = JSON.parse(raw)
const roundTrip = JSON.stringify(cards, null, 2) + (raw.endsWith('\n') ? '\n' : '')
if (roundTrip !== raw) {
  console.error('disposition-cards-29.json does not round-trip at two-space indentation; not touching it')
  process.exit(1)
}

const records = new Map(JSON.parse(fs.readFileSync(oracleFile, 'utf8')).records.map((record) => [record.table, record]))
const resolved = []
const remaining = []
for (const card of cards.remainingCards) {
  const record = records.get(card.TABLE)
  const migration = record && (record.sqlCreatingMigration ?? record.djangoCreatingMigration ?? record.otherCreatingMigration)
  if (!record || !migration || record.creationLineage === 'PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE') {
    remaining.push(card)
    continue
  }
  resolved.push({
    TABLE: card.TABLE,
    STATUS: 'IMPLEMENTED',
    PRIOR_DISPOSITION: card.DISPOSITION,
    SCHEMA_OWNER: record.schemaOwner,
    CREATION_MIGRATION: migration,
    CREATION_LINEAGE: record.creationLineage,
    CURRENT_BOOTSTRAP_INCLUDED: (record.creationEvidence ?? []).some((evidence) => evidence.currentBootstrapStatus === 'EXECUTED_BY_FRESH_BOOTSTRAP'),
  })
  cards.resolutionNotes[card.TABLE] = `${record.schemaOwner} — was ${card.DISPOSITION} (${card.DISPOSITION_LABEL}); created by ${path.posix.relative('apps/union-eyes/db', migration)} with its row-security closure`
}

cards.implemented.push(...resolved)
cards.remainingCards = remaining
const byDisposition = {}
for (const card of remaining) byDisposition[card.DISPOSITION] = (byDisposition[card.DISPOSITION] ?? 0) + 1
cards.counts.implementedFromFG = (cards.counts.implementedFromFG ?? 0) + resolved.filter((entry) => entry.PRIOR_DISPOSITION !== 'A').length
cards.counts.remainingNoLineage = remaining.length
cards.counts.byDispositionRemaining = byDisposition

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2) + (raw.endsWith('\n') ? '\n' : ''))
console.log(`resolved ${resolved.length} card(s): ${resolved.map((entry) => entry.TABLE).join(', ') || '(none)'}`)
console.log(`${remaining.length} card(s) remain`)
