const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/education/registrations/route.ts', [
  ["if (session.sessionStatus !== null && session.sessionStatus !== 'scheduled')", "if (session.sessionStatus != null && session.sessionStatus !== 'scheduled')"],
])
edit('app/api/education/registrations/__tests__/route.test.ts', [
  ["vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and }));", "vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, count: vi.fn(() => 'count') }));"],
  [
    "  it('allows enrollment when both foreign keys belong to the caller organization', async () => {",
    "  const open = (extra: Record<string, unknown>) => {\n    m.limit.mockResolvedValueOnce([{ id: 'course-1' }]).mockResolvedValueOnce([{ id: 'session-1', ...extra }]);\n  };\n\n  it.each([\n    ['a cancelled session', { sessionStatus: 'cancelled' }],\n    ['a session whose registration has not opened', { registrationOpenDate: '2999-01-01' }],\n    ['a session whose registration has closed', { registrationCloseDate: '2000-01-01' }],\n  ])('refuses registration for %s (DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK)', async (_name, extra) => {\n    open(extra);\n    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });\n  });\n\n  it('refuses registration for a session that is full, and allows one with room', async () => {\n    open({ maxEnrollment: 2 });\n    m.where.mockReturnValueOnce({ limit: m.limit }).mockReturnValueOnce({ limit: m.limit }).mockResolvedValueOnce([{ registered: 2 }]);\n    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });\n\n    open({ maxEnrollment: 2 });\n    m.where.mockReturnValueOnce({ limit: m.limit }).mockReturnValueOnce({ limit: m.limit }).mockResolvedValueOnce([{ registered: 1 }]).mockReturnValueOnce({ limit: m.limit });\n    m.limit.mockResolvedValueOnce([]);\n    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).resolves.toMatchObject({ registrationStatus: 'registered' });\n  });\n\n  it('allows enrollment when both foreign keys belong to the caller organization', async () => {",
  ],
])
