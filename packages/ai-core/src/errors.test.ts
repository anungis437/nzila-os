import { describe, it, expect } from 'vitest'
import { AiControlPlaneError } from './types'
import {
  profileNotFound,
  profileDisabled,
  featureNotAllowed,
  modalityNotAllowed,
  dataClassNotAllowed,
  streamingNotAllowed,
  budgetExceeded,
  policyDenied,
  schemaInvalid,
} from './errors'

describe('AiControlPlaneError instances', () => {
  it('profileNotFound creates correct error', () => {
    const err = profileNotFound('default', 'console')
    expect(err).toBeInstanceOf(AiControlPlaneError)
    expect(err.code).toBe('profile_not_found')
    expect(err.statusCode).toBe(404)
    expect(err.message).toContain('console/default')
  })

  it('profileDisabled creates correct error', () => {
    const err = profileDisabled('restricted')
    expect(err.code).toBe('profile_disabled')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('restricted')
  })

  it('featureNotAllowed creates correct error', () => {
    const err = featureNotAllowed('rag_query', 'free-tier')
    expect(err.code).toBe('feature_not_allowed')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('rag_query')
    expect(err.message).toContain('free-tier')
  })

  it('modalityNotAllowed creates correct error', () => {
    const err = modalityNotAllowed('vision', 'text-only')
    expect(err.code).toBe('modality_not_allowed')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('vision')
  })

  it('dataClassNotAllowed creates correct error', () => {
    const err = dataClassNotAllowed('regulated', 'basic-profile')
    expect(err.code).toBe('data_class_not_allowed')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('regulated')
  })

  it('streamingNotAllowed creates correct error', () => {
    const err = streamingNotAllowed('sync-only')
    expect(err.code).toBe('streaming_not_allowed')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('sync-only')
  })

  it('budgetExceeded creates correct error', () => {
    const err = budgetExceeded('console', 'default', '2026-01')
    expect(err.code).toBe('budget_exceeded')
    expect(err.statusCode).toBe(429)
    expect(err.message).toContain('2026-01')
  })

  it('policyDenied creates correct error', () => {
    const err = policyDenied('cross-tenant query blocked')
    expect(err.code).toBe('policy_denied')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('cross-tenant query blocked')
  })

  it('schemaInvalid creates correct error', () => {
    const err = schemaInvalid('missing required field: orgId')
    expect(err.code).toBe('schema_invalid')
    expect(err.message).toContain('missing required field')
  })

  it('AiControlPlaneError has correct name', () => {
    const err = policyDenied('test')
    expect(err.name).toBe('AiControlPlaneError')
  })
})
