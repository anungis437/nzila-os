const fs = require('fs')
const f = 'app/api/voice/transcribe/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap(
  "import { withRoleAuth } from '@/lib/api-auth-guard';",
  "import { withRoleAuth } from '@/lib/api-auth-guard';\nimport { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';\nimport { withRLSContext } from '@/lib/db/with-rls-context';\nimport { persistAtomicAudit } from '@/lib/audit/atomic-audit';",
)
swap(
  "export const POST = withRoleAuth('steward', async (request, _context) => {\n  try {\n      // Authenticate user\n      // Parse form data\n",
  "export const POST = withRoleAuth('steward', async (request, context) => {\n  try {\n      const { userId, organizationId } = context as { userId?: string; organizationId?: string };\n      if (!userId || !organizationId) {\n        return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');\n      }\n\n      // The recording goes to an external speech service, so each caller's use is bounded.\n      const limit = await checkRateLimit(`voice-transcribe:${userId}`, RATE_LIMITS.AI_COMPLETION);\n      if (!limit.allowed) {\n        return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { resetIn: limit.resetIn });\n      }\n\n      // Parse form data\n",
)
swap(
  "      // Convert file to buffer\n",
  "      // The disclosure to the external service is recorded before the audio leaves; no transcript or audio is kept in the record.\n      await withRLSContext({ organizationId, userId }, (tx) => persistAtomicAudit(tx, {\n        organizationId,\n        userId,\n        action: 'voice.transcribe.requested',\n        resourceType: 'voice_recording',\n        resourceId: userId,\n        details: { language, bytes: audioFile.size, contentType: audioFile.type },\n      }));\n\n      // Convert file to buffer\n",
)
fs.writeFileSync(f, s)
console.log('ok')
