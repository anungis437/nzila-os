const fs = require('fs')
for (const f of [
  'app/api/__tests__/icra-results-id.route.test.ts',
  'app/api/__tests__/icra-submit.route.test.ts',
  'app/api/__tests__/icra-telemetry.route.test.ts',
]) {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  s = s.replace("vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));", "vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.rateLimit }));")
  s = s.replace('m.rateLimit.mockReturnValue({ success: true });', 'm.rateLimit.mockResolvedValue({ allowed: true });')
  s = s.replace('m.rateLimit.mockReturnValueOnce({ success: false });', 'm.rateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });')
  fs.writeFileSync(f, s)
}
console.log('ok')
