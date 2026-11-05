import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hasOwnedContainerLabels,
  UE_DISPOSABLE_MISSION,
} from './ue-disposable-container-ownership.mjs'

const owner = 'a'.repeat(32)
const labels = {
  'nzila.mission': UE_DISPOSABLE_MISSION,
  'nzila.qualification-owner': owner,
}

describe('disposable Union Eyes Docker ownership', () => {
  it('accepts the exact matching mission and worktree owner', () => {
    assert.equal(hasOwnedContainerLabels(labels, owner), true)
  })
  it('never treats an unlabelled or unrelated container as disposable', () => {
    assert.equal(hasOwnedContainerLabels(null, owner), false)
    assert.equal(hasOwnedContainerLabels({}, owner), false)
    assert.equal(hasOwnedContainerLabels({ ...labels, 'nzila.mission': 'OTHER' }, owner), false)
  })
  it('refuses another worktree owner and an invalid/missing token', () => {
    assert.equal(hasOwnedContainerLabels(labels, 'b'.repeat(32)), false)
    assert.equal(hasOwnedContainerLabels(labels, ''), false)
    assert.equal(hasOwnedContainerLabels(labels, '../escaped'), false)
  })
})
