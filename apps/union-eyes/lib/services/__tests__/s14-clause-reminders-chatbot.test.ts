import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expiryWarningQuery, sessionReminderQuery } from '@/lib/education/reminder-queries'
import { PgDialect } from 'drizzle-orm/pg-core'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B70: clause tags, reminders and the chatbot', () => {
  it('returns the tags of a shared clause without the author of each tag', () => {
    const tags = src('app/api/clause-library/[id]/tags/route.ts')
    expect(tags).toContain('.select({ id: clauseLibraryTags.id, clauseId: clauseLibraryTags.clauseId, tagName: clauseLibraryTags.tagName })')
    expect(tags).not.toMatch(/\.select\(\)\s*\.from\(clauseLibraryTags\)\s*\.where\(eq\(clauseLibraryTags\.clauseId, id\)\)/)
  })

  it('verified: every clause write validates its body and public sharing needs an officer', () => {
    for (const path of ['app/api/clause-library/route.ts', 'app/api/clause-library/[id]/route.ts', 'app/api/clause-library/[id]/share/route.ts']) {
      const route = src(path)
      expect(route, path).toContain('parseClauseBody(')
      expect(route, path).toContain('assertMayPublish(user?.role, body.sharingLevel)')
    }
    expect(src('app/api/clause-library/[id]/tags/route.ts')).toContain('parseClauseTagBody(')
    expect(src('lib/clause-library/clause-body.ts')).toContain('requires an officer role')
  })

  it('leaves out members who opted out of e-mail or training reminders in both reminder statements', () => {
    const dialect = new PgDialect()
    for (const query of [sessionReminderQuery, expiryWarningQuery]) {
      const text = dialect.sqlToQuery(query).sql
      expect(text).toContain('LEFT JOIN communication_preferences cp ON cp.user_id = om.user_id AND cp.organization_id = om.organization_id')
      expect(text).toContain('COALESCE(cp.email_enabled, true)')
      expect(text).toContain('COALESCE(cp.training_reminders, true)')
    }
  })

  it('passes the caller\'s own role to the safety policy and marks the reply as unreviewed', () => {
    for (const path of ['app/api/chatbot/messages/route.ts', 'app/api/chatbot/sessions/route.ts', 'app/api/chatbot/sessions/[sessionId]/messages/route.ts']) {
      const route = src(path)
      expect(route, path).not.toContain("userRole: 'member',")
      expect(route, path).toContain("userRole: user?.role ?? 'member'")
    }
    const messages = src('app/api/chatbot/messages/route.ts')
    expect(messages).toContain('reviewRequired: true')
    expect(messages).not.toContain('reviewRequired: false')
  })
})
