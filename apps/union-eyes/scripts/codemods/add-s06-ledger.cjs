const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S06-KNOWLEDGE-TRANSFER-OWNER-MIGRATION-0043'
if (!ledger.batches.some((x) => x.id === id)) {
  const mig = [A + 'db/migrations-platform/0043_knowledge_transfer_owner.sql', A + 'db/migrations-platform/0043_knowledge_transfer_owner.rollback.sql', A + 'db/__tests__/platform-0043-knowledge-transfer-owner.pglite.test.ts', A + 'db/schema/domains/ml/knowledge-transfer-runtime.ts']
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, ...mig], explanation })
  ledger.batches.push({
    id,
    family: 'Schema: a copilot conversation and a reasoning session belong to the person who opened them',
    evidenceCommit: null,
    items: [
      item('DEF-0B7-EXC-COPILOT-CONVERSATIONS-HAVE-NO-OWNER', [A + 'lib/knowledge-transfer/copilot/copilot-engine.ts', A + 'app/api/exit-interviews/copilot/route.ts', A + 'lib/knowledge-transfer/copilot/__tests__/copilot-engine.test.ts'],
        'Migration 0043 adds created_by to ue_copilot_conversations (nullable; rows that predate it have no owner and so are visible to nobody, nothing is backfilled). A conversation is created with its opener, listed and read only for that opener, and appended to only by that opener; naming a conversation that is not yours answers not found with no model call. The engine tests (signature and ownership) were updated and extended (disclosed).'),
      item('DEF-0B7-EXC-REASONING-SESSIONS-HAVE-NO-OWNER', [A + 'lib/knowledge-transfer/reasoning-sessions/session-manager.ts', A + 'app/api/exit-interviews/reasoning-sessions/route.ts', A + 'lib/knowledge-transfer/reasoning-sessions/__tests__/session-manager.test.ts'],
        'Migration 0043 adds created_by to ue_reasoning_sessions. A session records its creator; the route lists only the caller\'s sessions, and get, update, annotate, link and simulate are held to the creator in the SQL. The organization-wide list remains for the continuity engines that aggregate sessions into figures and show none to anyone.'),
      item('DEF-0B7-EXC-COPILOT-CONTEXT-IS-CLIENT-SUPPLIED-HISTORY', [A + 'lib/knowledge-transfer/copilot/copilot-engine.ts', A + 'lib/knowledge-transfer/copilot/copilot-models.ts', A + 'lib/knowledge-transfer/copilot/__tests__/copilot-engine.test.ts'],
        'The model input is built from the caller\'s stored conversation (the last 20 messages); prior messages sent by the client are accepted for compatibility and ignored, so a caller cannot put words in the assistant\'s mouth or pass instructions as earlier turns. Tested with a forged assistant turn.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S06 added')
