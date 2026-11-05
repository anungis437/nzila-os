const fs = require('fs')
fs.mkdirSync('lib/communications', { recursive: true })
fs.writeFileSync('lib/communications/lifecycle.ts', `import { ApiError } from '@/lib/api/errors';

/**
 * A survey or poll moves forward only: draft, then open (active or published), then closed. The factory's PATCH used to accept any
 * status at any time, so a closed survey could be reopened with its responses intact and a draft could be marked published without a
 * publication time. The server stamps the publication time; the counters are never client-written.
 */
const OPEN = ['active', 'published'] as const;
const TRANSITIONS: Record<string, readonly string[]> = {
  draft: [...OPEN, 'closed'],
  active: ['closed'],
  published: ['closed'],
  closed: [],
};

export function lifecycleBeforeUpdate(kind: string) {
  return (updates: Record<string, unknown>, ctx: { existing: Record<string, unknown> }): Record<string, unknown> => {
    if (updates.status === undefined) return updates;
    const next = updates.status;
    const current = typeof ctx.existing.status === 'string' ? ctx.existing.status : 'draft';
    if (typeof next !== 'string' || !(next in TRANSITIONS)) throw ApiError.badRequest(\`Invalid \${kind} status\`);
    if (next === current) return updates;
    if (!(TRANSITIONS[current] ?? []).includes(next)) {
      throw ApiError.conflict(\`A \${kind} that is \${current} cannot become \${next}\`);
    }
    const opening = (OPEN as readonly string[]).includes(next);
    return opening && !ctx.existing.publishedAt ? { ...updates, publishedAt: new Date() } : updates;
  };
}
`)

const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
const CAMPAIGN_SERVER = "'status', 'sentAt', 'completedAt', 'stats', 'audienceCount'"
edit('app/api/communications/campaigns/route.ts', [[
  "  readRole: 'member',\n",
  `  // A campaign's audience, segment query and body are staff working records.\n  readRole: 'steward',\n  // Status, send times, delivery statistics and the audience count are set by delivery, never by the author's body.\n  writableFields: ['name', 'description', 'type', 'channel', 'templateId', 'segmentId', 'segmentQuery', 'subject', 'body', 'variables', 'scheduledAt', 'sendImmediately', 'timezone', 'settings', 'metadata', 'tags'],\n`,
]])
edit('app/api/communications/campaigns/[id]/route.ts', [[
  "  readRole: 'member',\n",
  `  readRole: 'steward',\n  blockedPatchFields: [${CAMPAIGN_SERVER}],\n`,
]])
edit('app/api/communications/surveys/route.ts', [[
  "  writeRole: 'steward',\n",
  "  writeRole: 'steward',\n  // A new survey is a draft: publication, counters and completion figures are the server's.\n  writableFields: ['title', 'description', 'surveyType', 'closesAt', 'allowAnonymous', 'allowMultipleResponses', 'requireAuthentication', 'shuffleQuestions', 'showResults', 'welcomeMessage', 'thankYouMessage'],\n",
]])
edit('app/api/communications/surveys/[surveyId]/route.ts', [
  ["import { ne } from 'drizzle-orm';", "import { ne } from 'drizzle-orm';\nimport { lifecycleBeforeUpdate } from '@/lib/communications/lifecycle';"],
  ["  writeRole: 'steward',\n", "  writeRole: 'steward',\n  blockedPatchFields: ['publishedAt', 'responseCount', 'viewCount', 'completionRate'],\n  beforeUpdate: lifecycleBeforeUpdate('survey'),\n"],
])
edit('app/api/communications/polls/route.ts', [[
  "  writeRole: 'steward',\n",
  "  writeRole: 'steward',\n  writableFields: ['question', 'description', 'options', 'allowMultipleVotes', 'requireAuthentication', 'showResultsBeforeVote', 'closesAt'],\n",
]])
edit('app/api/communications/polls/[pollId]/route.ts', [
  ["import { crudRoutes } from '@/lib/api/crud-factory';", "import { crudRoutes } from '@/lib/api/crud-factory';\nimport { lifecycleBeforeUpdate } from '@/lib/communications/lifecycle';"],
  ["  writeRole: 'steward',\n", "  writeRole: 'steward',\n  blockedPatchFields: ['publishedAt', 'totalVotes', 'uniqueVoters'],\n  beforeUpdate: lifecycleBeforeUpdate('poll'),\n"],
])
edit('scripts/codemods/f02-domain-facades-501.cjs', [[
  "  'events/[id]/occurrences':",
  "  'communications/campaigns/[id]/schedule': 'the generic CRUD factory over campaigns (a campaign row; nothing is scheduled and no sender reads it)',\n  'communications/campaigns/[id]/send-test': 'the generic CRUD factory over campaigns (a campaign row; no test message is sent)',\n  'events/[id]/occurrences':",
]])
edit('lib/api/__tests__/roster-facades.contract.test.ts', [[
  "'onboarding', 'wcb/claims',",
  "'communications/campaigns/[id]/schedule', 'communications/campaigns/[id]/send-test', 'onboarding', 'wcb/claims',",
]])
console.log('ok')
