import 'server-only'
import { runPolicyStressTest } from '@nzila/policies'

let cached: ReturnType<typeof runPolicyStressTest> | null = null

export function getPolicyPerformance(perDomain = 75) {
  if (!cached) {
    cached = runPolicyStressTest(perDomain)
  }
  return cached
}

export function refreshPolicyPerformance(perDomain = 75) {
  cached = runPolicyStressTest(perDomain)
  return cached
}
