const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/content/templates/[id]/status/route.ts', [
  ["        SELECT id, status, title FROM cms_pages", "        SELECT id, status, title, updated_by FROM cms_pages"],
  [
    "      // Update status\n      const publishedClause = newStatus === 'published'\n        ? sql`, published_at = now()`\n        : sql``;",
    "      // Whoever moved an item to review (or last edited it) is not the person who approves it for publication.\n      if (currentStatus === 'review' && newStatus === 'published' && current.updated_by === userId) {\n        throw ApiError.forbidden('The person who prepared this item for review cannot publish it');\n      }\n\n      // The first publication time is kept: republishing does not rewrite it.\n      const publishedClause = newStatus === 'published'\n        ? sql`, published_at = coalesce(published_at, now())`\n        : sql``;",
  ],
])
edit('app/api/education/registrations/route.ts', [
  [
    "import { and, eq } from 'drizzle-orm';",
    "import { and, count, eq } from 'drizzle-orm';",
  ],
  [
    "    const [session] = await db.select({ id: courseSessions.id }).from(courseSessions)\n      .where(and(eq(courseSessions.id, sessionId),\n        eq(courseSessions.courseId, courseId),\n        eq(courseSessions.organizationId, ctx.organizationId))).limit(1);\n    if (!session) throw ApiError.badRequest('Session does not belong to this course and organization');",
    "    const [session] = await db.select({\n      id: courseSessions.id,\n      sessionStatus: courseSessions.sessionStatus,\n      maxEnrollment: courseSessions.maxEnrollment,\n      registrationOpenDate: courseSessions.registrationOpenDate,\n      registrationCloseDate: courseSessions.registrationCloseDate,\n    }).from(courseSessions)\n      .where(and(eq(courseSessions.id, sessionId),\n        eq(courseSessions.courseId, courseId),\n        eq(courseSessions.organizationId, ctx.organizationId))).limit(1);\n    if (!session) throw ApiError.badRequest('Session does not belong to this course and organization');\n\n    // Registration is open only for a scheduled session inside its registration window, and only while there is room.\n    const today = new Date().toISOString().slice(0, 10);\n    if (session.sessionStatus !== null && session.sessionStatus !== 'scheduled') throw ApiError.conflict('This session is not open for registration');\n    if ((session.registrationOpenDate && session.registrationOpenDate > today) || (session.registrationCloseDate && session.registrationCloseDate < today)) {\n      throw ApiError.conflict('Registration for this session is not open');\n    }\n    if (session.maxEnrollment != null) {\n      const [{ registered }] = await db.select({ registered: count() }).from(courseRegistrations)\n        .where(and(eq(courseRegistrations.organizationId, ctx.organizationId), eq(courseRegistrations.sessionId, sessionId), eq(courseRegistrations.registrationStatus, 'registered')));\n      if (Number(registered) >= session.maxEnrollment) throw ApiError.conflict('This session is full');\n    }",
  ],
])
