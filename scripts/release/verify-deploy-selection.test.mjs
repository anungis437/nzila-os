import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyDeploySelection } from './verify-deploy-selection.mjs'

const image = name => 'nzilacanadaacr.azurecr.io/nzila/' + name + '@sha256:' + (name === 'alpha' ? 'a' : 'b').repeat(64)
const alpha = { containerAppName: 'alpha', image: image('alpha') }
const bravo = { containerAppName: 'bravo', image: image('bravo') }
const signed = () => ({ deployTargets: [structuredClone(alpha), structuredClone(bravo)] })
const selected = () => ({ deployTargets: [structuredClone(alpha)] })
const reject = (a,b,c) => assert.throws(() => verifyDeploySelection(a,b,c), /DEPLOY_SELECTION_DENIED/)

test('accepts exactly the approved subset of signed immutable deployment targets', () => {
  assert.deepEqual(verifyDeploySelection(signed(), selected(), 'alpha'),
    { approvedCount: 1, names: ['alpha'] })
  assert.deepEqual(verifyDeploySelection(signed(), signed(), 'bravo,alpha').names,
    ['bravo','alpha'])
})
test('denies silent partial deployments, extra targets and unknown approvals', () => {
  reject(signed(), selected(), 'alpha,bravo')
  reject(signed(), signed(), 'alpha')
  reject(signed(), selected(), 'charlie')
  reject(signed(), selected(), '')
})
test('denies modified image digests, destinations or unsigned target substitutions', () => {
  const swapped = selected(); swapped.deployTargets[0].image = image('bravo')
  reject(signed(), swapped, 'alpha')
  const alias = selected(); alias.deployTargets[0].imageRef = image('bravo')
  reject(signed(), alias, 'alpha')
  const mutated = selected(); mutated.deployTargets[0].containerAppName = 'bravo'
  reject(signed(), mutated, 'alpha')
})
test('denies duplicate approvals, duplicate signed destinations and malformed aliases', () => {
  reject(signed(), selected(), 'alpha,alpha')
  const duplicate = signed(); duplicate.deployTargets.push(structuredClone(alpha))
  reject(duplicate, selected(), 'alpha')
  const conflicting = signed(); conflicting.deployTargets[0].app = 'bravo'
  reject(conflicting, selected(), 'alpha')
  reject(signed(), selected(), 'alpha;rm -rf /')
})
test('denies empty, oversized or noncanonical target sets', () => {
  reject(signed(), { deployTargets: [] }, 'alpha')
  const many = signed(); many.deployTargets = Array.from({length:33},(_,i)=>({
    containerAppName: 'app'+i, image: image('alpha'),
  }))
  reject(many, selected(), 'alpha')
  const malformed = selected(); malformed.deployTargets[0].image = 'repo:latest'
  reject(signed(), malformed, 'alpha')
})
