const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/services/rewards/redemption-service.ts', [
  [`  userId: string,
  limit = 20,
  offset = 0
): Promise<{
  redemptions: RewardRedemption[];
  total: number;
}> {
  const redemptions = await db.query.rewardRedemptions.findMany({
    where: and(
      eq(rewardRedemptions.orgId, orgId),
      eq(rewardRedemptions.userId, userId)
    ),`, `  userId: string,
  limit = 20,
  offset = 0,
  status?: RewardRedemption['status']
): Promise<{
  redemptions: RewardRedemption[];
  total: number;
}> {
  const own = status
    ? and(eq(rewardRedemptions.orgId, orgId), eq(rewardRedemptions.userId, userId), eq(rewardRedemptions.status, status))
    : and(eq(rewardRedemptions.orgId, orgId), eq(rewardRedemptions.userId, userId));
  const redemptions = await db.query.rewardRedemptions.findMany({
    where: own,`],
  [`    .where(
      and(
        eq(rewardRedemptions.orgId, orgId),
        eq(rewardRedemptions.userId, userId)
      )
    );`, `    .where(own);`],
])
edit('app/api/rewards/redemptions/route.ts', [
  [`    const validStatuses = ['pending', 'ordered', 'fulfilled', 'cancelled', 'refunded'];`, `    // The values the redemption status can hold; an earlier list named one it never holds and omitted the ones a redemption starts in.
    const validStatuses = ['initiated', 'pending_payment', 'ordered', 'fulfilled', 'cancelled', 'refunded'] as const;`],
  [`    if (status && !validStatuses.includes(status)) {`, `    if (status && !(validStatuses as readonly string[]).includes(status)) {`],
  [`      userId,
      limit,
      offset
    );`, `      userId,
      limit,
      offset,
      status as (typeof validStatuses)[number] | undefined
    );`],
])
edit('app/api/__tests__/rewards-redemptions-list.route.test.ts', [
  [`  it('turns a non-numeric or negative page request`, `  // DEF-0B11-PRP-REDEMPTIONS-GET-IGNORES-THE-STATUS-FILTER-AND-VALIDATES-AGAINST-AN-INCOMPLETE-LIST
  it('passes a valid status filter to the query and accepts the statuses a redemption starts in', async () => {
    const { GET } = await import('../rewards/redemptions/route');
    await GET(new NextRequest('http://localhost/api/rewards/redemptions?status=pending_payment'), { userId: 'member_1', organizationId: 'org_1' } as never);
    expect(m.list).toHaveBeenCalledWith('org_1', 'member_1', 20, 0, 'pending_payment');
  });

  it('refuses a status no redemption holds with 400, without querying', async () => {
    const { GET } = await import('../rewards/redemptions/route');
    const response = await GET(new NextRequest('http://localhost/api/rewards/redemptions?status=pending'), { userId: 'member_1', organizationId: 'org_1' } as never);
    expect(response.status).toBe(400);
    expect(m.list).not.toHaveBeenCalled();
  });

  it('turns a non-numeric or negative page request`],
])
console.log('ok')
