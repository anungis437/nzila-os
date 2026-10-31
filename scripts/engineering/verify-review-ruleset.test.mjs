import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyReviewRuleset } from './verify-review-ruleset.mjs'
const required=['Merge Authority / Governance Integrity','Merge Authority / Architectural Contracts',
  'Merge Authority / Ops Documentation','Gitleaks','TruffleHog OSS']
function valid() {
  return {
    repository:{default_branch:'main',owner:{type:'Organization'}},
    ruleset:{id:12952284,target:'branch',enforcement:'active',
      conditions:{ref_name:{include:['~DEFAULT_BRANCH']}},
      rules:[{type:'pull_request',parameters:{
        required_approving_review_count:2,require_code_owner_review:true,
        dismiss_stale_reviews_on_push:true,require_last_push_approval:true,
      }},{type:'required_status_checks',parameters:{
        strict_required_status_checks_policy:true,
        required_status_checks:required.map(context=>({context})),
      }}]},
    codeowners:'/governance/** @nzila/security\n/.github/** @nzila/platform\n',
  }
}
test('protected branch with independent reviews passes',()=>{
  assert.equal(verifyReviewRuleset(valid()).verdict,'PASS')
})
test('false CODEOWNERS enforcement fails even with a CODEOWNERS file',()=>{
  const a=valid();a.ruleset.rules[0].parameters.require_code_owner_review=false
  assert.throws(()=>verifyReviewRuleset(a),/CODEOWNER review/)
})
test('zero reviews, no last-push approval and stale-review acceptance all fail',()=>{
  for (const [key,value] of [
    ['required_approving_review_count',0],
    ['require_last_push_approval',false],
    ['dismiss_stale_reviews_on_push',false],
  ]) {
    const a=valid();a.ruleset.rules[0].parameters[key]=value
    assert.throws(()=>verifyReviewRuleset(a),/independent/)
  }
})
test('missing required status cannot silently bypass governance',()=>{
  const a=valid();a.ruleset.rules[1].parameters.required_status_checks.pop()
  assert.throws(()=>verifyReviewRuleset(a),/mandatory merge status/)
})
test('organization team references in personal repo require ownership correction',()=>{
  const a=valid();a.repository.owner.type='User'
  assert.throws(()=>verifyReviewRuleset(a),/user-owned/)
})
