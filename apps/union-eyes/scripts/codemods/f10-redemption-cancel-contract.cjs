const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/rewards/redemptions/route.ts', [
  ["import { initiateRedemptionSchema } from '@/lib/validation/rewards-schemas';", "import { cancelRedemptionSchema } from '@/lib/validation/rewards-schemas';"],
  [`    const body = await request.json();

    let _validatedData;
    try {
      _validatedData = initiateRedemptionSchema.parse(body);
    } catch (error) {`, `    // This path cancels a redemption, so it validates a cancellation: an initiation body (program, credits) is rejected rather than parsed and discarded.
    let validated;
    try {
      const body = await request.json();
      validated = cancelRedemptionSchema
        .extend({ reason: z.string().trim().min(1).max(200) })
        .strict()
        .parse(body);
    } catch (error) {`],
  [`      throw error;
    }

    const { searchParams } = new URL(request.url);
    const redemptionId = searchParams.get('id');

    if (!redemptionId) {
      return standardErrorResponse(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Redemption ID required'
      );
    }
`, `      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Request body must be a JSON cancellation');
    }

    const redemptionId = validated.redemptionId;
`],
  ["      'member_cancelled',\n", "      `member_cancelled: ${validated.reason}`,\n"],
])
edit('app/api/__tests__/social-posts-and-redemptions-audit.route.test.ts', [
  [`    new NextRequest(\`http://localhost/api/rewards/redemptions?id=\${id}\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        programId: '11111111-1111-4111-8111-111111111111',
        creditsToSpend: 10,
        provider: 'shopify',
      }),
    });`, `    new NextRequest('http://localhost/api/rewards/redemptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redemptionId: id, reason: 'changed my mind' }),
    });`],
  ["const cancel = (id = 'r1')", "const cancel = (id = '11111111-1111-4111-8111-111111111111')"],
  ["toHaveBeenCalledWith('r1', 'org_1', 'member_cancelled',", "toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'org_1', 'member_cancelled: changed my mind',"],
  ["POST(cancel('r-other'),", "POST(cancel('22222222-2222-4222-8222-222222222222'),"],
])
console.log('ok')
