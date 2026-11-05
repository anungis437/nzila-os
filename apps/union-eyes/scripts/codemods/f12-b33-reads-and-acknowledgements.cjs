const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
// 1. profile lookup that reports a failure instead of answering "no profile"
{
  const f = 'db/queries/profiles-queries.ts'
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  const start = s.indexOf('export const getProfileByUserId = async (')
  const end = s.indexOf('export const getAllProfiles')
  if (start < 0 || end < 0) throw new Error('profiles block')
  const block = `/** The profile of a user, or null when there is none. A failed or timed-out lookup throws: it is not the same answer as "no profile". */
export const findProfileByUserId = async (
  userId: string,
  tx?: RLSTx
): Promise<SelectProfile | null> => {
  const executeQuery = async (dbOrTx: RLSTx) => {
    logger.info("Looking up profile by user ID", { userId });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const profiles = await Promise.race([
        dbOrTx.select().from(profilesTable).where(eq(profilesTable.userId, userId)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Database query timeout")), 10000);
        }),
      ]) as SelectProfile[];
      return profiles && profiles.length > 0 ? profiles[0] : null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  if (tx) {
    return executeQuery(tx);
  }
  return withRLSContext(async (tx) => executeQuery(tx));
};

/** Tolerant form for callers that treat a failed lookup as "no profile". */
export const getProfileByUserId = async (
  userId: string,
  tx?: RLSTx
) => {
  try {
    return await findProfileByUserId(userId, tx);
  } catch (error) {
    logger.error("Error getting profile by user ID", { error, userId });
    return null;
  }
};

`
  s = s.slice(0, start) + block + s.slice(end)
  fs.writeFileSync(f, s)
}
edit('db/queries/__tests__/profiles-queries.test.ts', [
  [`  it('getAllProfiles returns rows', async () => {`, `  // DEF-0B11-PRP-PROFILE-ME-GET-SWALLOWS-DATABASE-ERRORS-INTO-A-SUCCESS-WITH-NULL-DATA
  it('findProfileByUserId reports a failed lookup instead of answering that there is no profile', async () => {
    push([{ userId: 'u1' }]);
    expect(await q.findProfileByUserId('u1')).toEqual({ userId: 'u1' });
    push([]);
    expect(await q.findProfileByUserId('u1')).toBeNull();
    push(new Error('boom'));
    await expect(q.findProfileByUserId('u1')).rejects.toThrow('boom');
  });

  it('getAllProfiles returns rows', async () => {`],
])
edit('app/api/profile/me/route.ts', [
  [`import { getProfileByUserId } from "@/db/queries/profiles-queries";`, `import { findProfileByUserId } from "@/db/queries/profiles-queries";`],
  [`    const profile = await getProfileByUserId(userId);
    return NextResponse.json({
      isSuccess: true,
      message: "Profile retrieved successfully",
      data: profile,
    });
  } catch {
    return NextResponse.json(
      { isSuccess: false, message: "Failed to get profile" },
      { status: 500 }
    );`, `    // A failed lookup is an error; only a completed lookup that found nothing says there is no profile.
    const profile = await findProfileByUserId(userId);
    return NextResponse.json({
      isSuccess: true,
      message: profile ? "Profile retrieved successfully" : "No profile exists for this user",
      data: profile,
    });
  } catch {
    return NextResponse.json(
      { isSuccess: false, message: "Failed to get profile" },
      { status: 500 }
    );`],
])
// 2. compliance reads answer a failure as a failure
for (const [f, what] of [['app/api/compliance/alerts/route.ts', 'alerts'], ['app/api/compliance/reports/route.ts', 'reports']]) {
  edit(f, [[`    return standardSuccessResponse([]);
  }
});`, `    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Compliance ${what} are temporarily unavailable");
  }
});`]])
}
edit('app/api/compliance/alerts/route.ts', [[`      .orderBy(desc(complianceAlerts.createdAt));`, `      .orderBy(desc(complianceAlerts.createdAt))
      .limit(500);`]])
edit('app/api/compliance/reports/route.ts', [[`      .orderBy(desc(employerReports.createdAt));`, `      .orderBy(desc(employerReports.createdAt))
      .limit(500);`]])
// 3. contact form: never tell a visitor it was received when nothing recorded it
edit('app/api/contact/route.ts', [
  [`    if (contactId) {
      await createDeal({`, `    // The submission is recorded only in the CRM; with no CRM record the visitor is told so instead of being acknowledged.
    if (!contactId) {
      logger.error('contact_form:not_recorded', { inquiryType });
      return NextResponse.json({ error: 'Your message could not be recorded. Please try again later.' }, { status: 503 });
    }

    {
      const dealId = await createDeal({`],
  [`          ...(message ? { ue_message: message.slice(0, 500) } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });`, `          ...(message ? { ue_message: message.slice(0, 500) } : {}),
        },
      });
      if (!dealId) {
        logger.error('contact_form:inquiry_not_recorded', { inquiryType });
        return NextResponse.json({ error: 'Your message could not be recorded. Please try again later.' }, { status: 503 });
      }
    }

    return NextResponse.json({ ok: true });`],
])
// 4. vocabulary is behind a session: no shared cache
for (const r of ['', 'statuses', 'severities', 'roles', 'priorities', 'case-types']) {
  edit(`app/api/vocabulary/${r ? r + '/' : ''}route.ts`, [[`'Cache-Control': 'public, max-age=3600'`, `'Cache-Control': 'private, max-age=3600'`]])
}
// 5. a missing stored time is null, never the time of the call
edit('app/api/users/me/organizations/route.ts', [
  [`        createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: o.updatedAt?.toISOString() ?? new Date().toISOString(),`, `        createdAt: o.createdAt?.toISOString() ?? null,
        updatedAt: o.updatedAt?.toISOString() ?? null,`],
  [`        joinedAt: m.joinedAt?.toISOString() ?? m.createdAt?.toISOString() ?? new Date().toISOString(),`, `        joinedAt: m.joinedAt?.toISOString() ?? m.createdAt?.toISOString() ?? null,`],
])
console.log('ok')
