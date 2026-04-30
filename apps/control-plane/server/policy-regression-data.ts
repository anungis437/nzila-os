import 'server-only'
import { runPolicyRegressionAnalysis } from '@nzila/policies'

export function getPolicyRegressionAnalysis(candidateVersion: string, baselineVersion = 'v1', perDomain = 75) {
  return runPolicyRegressionAnalysis(candidateVersion, baselineVersion, perDomain)
}
