#!/usr/bin/env node
/**
 * Enforce GitHub's LIVE default-branch review settings, not CODEOWNERS prose.
 * Current repository is user-owned; GitHub organization-team CODEOWNERS cannot
 * be assumed valid. Missing repo admin authority always fails closed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function deny(message) { throw new Error('REVIEW_RULESET_DENIED: '+message) }
export function verifyReviewRuleset({repository,ruleset,codeowners}) {
  if (repository?.default_branch!=='main' || ruleset?.enforcement!=='active' ||
      ruleset?.target!=='branch' ||
      ruleset?.conditions?.ref_name?.include?.includes('~DEFAULT_BRANCH')!==true) {
    deny('default branch not protected by active repository ruleset')
  }
  const rules=ruleset.rules??[]
  const pull=rules.find(r=>r.type==='pull_request')?.parameters
  if (!pull || pull.required_approving_review_count<1 ||
      pull.require_code_owner_review!==true ||
      pull.dismiss_stale_reviews_on_push!==true ||
      pull.require_last_push_approval!==true) {
    deny('required independent, fresh CODEOWNER review is not enforced')
  }
  const statuses=rules.find(r=>r.type==='required_status_checks')?.parameters
  if (!statuses?.strict_required_status_checks_policy ||
      !Array.isArray(statuses.required_status_checks)) {
    deny('required status checks not enforced')
  }
  const required=new Set(statuses.required_status_checks.map(x=>x.context))
  for (const context of [
    'Merge Authority / Governance Integrity',
    'Merge Authority / Architectural Contracts',
    'Merge Authority / Ops Documentation',
    'Gitleaks', 'TruffleHog OSS',
  ]) {
    if (!required.has(context)) deny('mandatory merge status missing: '+context)
  }
  if (typeof codeowners!=='string' || !codeowners.includes('/.github/**') ||
      !codeowners.includes('/governance/**')) deny('sensitive CODEOWNERS boundaries absent')
  if (repository?.owner?.type==='User' && /@[a-z0-9_.-]+\/[a-z0-9_.-]+/i.test(codeowners)) {
    deny('organization-team CODEOWNERS in a user-owned repository are not independently enforceable')
  }
  return {verdict:'PASS',ruleId:ruleset.id,branch:'main',requiredReviews:pull.required_approving_review_count}
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [repoPath,rulesetPath,codeownersPath]=process.argv.slice(2)
    if (!repoPath || !rulesetPath || !codeownersPath) deny('missing authoritative GitHub records')
    const j=path=>JSON.parse(readFileSync(path,'utf8'))
    console.log('Authenticated branch review configuration:',verifyReviewRuleset({
      repository:j(repoPath),ruleset:j(rulesetPath),codeowners:readFileSync(codeownersPath,'utf8'),
    }))
  } catch(error) {
    console.error(error.message)
    process.exitCode=1
  }
}
