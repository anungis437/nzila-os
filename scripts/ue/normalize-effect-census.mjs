import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const docsRoot = path.join(repoRoot, 'docs/union-eyes')
const remediationRoot = path.join(docsRoot, 'reality-remediation')
const sourcePaths = {
  b2: path.join(docsRoot, 'PHASE_1A_2_SERVER_EFFECT_INDEX.json'),
  r1: path.join(remediationRoot, 'PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json'),
  r2: path.join(remediationRoot, 'PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json'),
  r2n: path.join(remediationRoot, 'PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json'),
  r2e: path.join(remediationRoot, 'PHASE_1A_2B2_R2E_EXISTING_EVIDENCE_BACKFILL.json'),
}
const outputPaths = {
  json: path.join(remediationRoot, 'PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json'),
  markdown: path.join(remediationRoot, 'PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.md'),
  r2eJson: path.join(remediationRoot, 'PHASE_1A_2B2_R2E_EXISTING_EVIDENCE_BACKFILL.json'),
  r2eMarkdown: path.join(remediationRoot, 'PHASE_1A_2B2_R2E_EXISTING_EVIDENCE_BACKFILL.md'),
}

const SERVER_TARGET_ENUM = [
  'LOCAL_NEXT_ROUTE',
  'SERVER_ACTION',
  'EXPLICIT_EXTERNAL_BACKEND',
  'EXPLICIT_PROXY_OR_REWRITE',
  'EXTERNAL_PROVIDER_DIRECT',
  'MISSING_ROUTE_CANDIDATE',
  'UNKNOWN_SERVER_TARGET',
]
const DATA_EFFECT_ENUM = [
  'DATABASE_INSERT',
  'DATABASE_UPDATE',
  'DATABASE_DELETE',
  'DATABASE_READ',
  'DATABASE_TRANSACTION',
  'EXTERNAL_PROVIDER_WRITE',
  'EXTERNAL_PROVIDER_READ',
  'OBJECT_STORAGE_WRITE',
  'OBJECT_STORAGE_READ',
  'QUEUE_OR_JOB_ENQUEUE',
  'EMAIL_SEND',
  'SMS_SEND',
  'EXPORT_GENERATION',
  'NO_PERSISTENT_EFFECT',
  'STUB_OR_MOCK_EFFECT',
  'MISSING_IMPLEMENTATION',
  'UNKNOWN_DATA_EFFECT',
]
const REQUEST_RESPONSE_ENUM = ['STRUCTURED', 'PARTIAL', 'UNVALIDATED', 'UNKNOWN']
const CONTROL_ENUM = ['YES', 'NO', 'NOT_APPLICABLE']
const HTTP_METHOD_EFFECT = {
  GET: 'DATABASE_READ',
  POST: 'DATABASE_INSERT',
  PUT: 'DATABASE_UPDATE',
  PATCH: 'DATABASE_UPDATE',
  DELETE: 'DATABASE_DELETE',
}
const EXPECTED_R2E_INPUT = {
  totalUnknownChains: 254,
  r1Only: 238,
  r2Disposition: 16,
  primaryUnknown: 252,
  secondaryUnknownEntries: 2,
}
const SERVER_CLASSIFICATION = {
  REQUEST_TARGET_AND_LOCAL_ROUTE_METHOD_MATCHED: 'LOCAL_NEXT_ROUTE',
  REQUEST_TARGET_IDENTIFIED_LOCAL_METHOD_ABSENT: 'LOCAL_NEXT_ROUTE',
  REQUEST_TARGET_IDENTIFIED_LOCAL_ROUTE_ABSENT: 'MISSING_ROUTE_CANDIDATE',
  REQUEST_TARGET_IDENTIFIED_LOCAL_MAPPING_UNCONFIRMED: 'UNKNOWN_SERVER_TARGET',
  NON_HTTP_SERVER_ACTION_OR_PROVIDER_CALL_IDENTIFIED: null,
}

const falseSuccessCodes = new Set([
  'EMPTY_REMITTANCE_EXPORT',
  'PLACEHOLDER_ACCEPTED_NO_REMITTANCE_EFFECT',
  'SUCCESS_SHAPED_NO_INVALIDATION',
])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function keyListEquals(actual, expected) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  )
}

function b2Pointer(index) {
  return `/chains/${index}`
}

function dispositionRootCause(disposition) {
  const source = disposition.sourceTarget ?? {}
  if (source.traceRootId) return source.traceRootId
  if (source.route) return `HTTP:${source.route}:${source.method ?? 'UNKNOWN'}`
  return `NON_HTTP:${disposition.chainKind}:${disposition.bindingId}`
}

function r1RootCause(chain) {
  if (chain.traceRootId) return chain.traceRootId
  const target = chain.serverTarget?.target
  if (typeof target === 'string' && target.startsWith('/')) {
    return `HTTP:${target}:${chain.requestResponse?.method ?? 'UNKNOWN'}`
  }
  return `NON_HTTP:${chain.chainKind}:${chain.sourceLocation?.sourceFile ?? chain.bindingId}`
}

function getServerTarget(chain, disposition) {
  if (disposition) {
    const source = disposition.sourceTarget ?? {}
    if (source.localRouteStatus === 'API_ROUTE_MISSING') return 'MISSING_ROUTE_CANDIDATE'
    if (source.localRouteStatus === 'API_ROUTE_PRESENT') return 'LOCAL_NEXT_ROUTE'
    if (source.route) return 'UNKNOWN_SERVER_TARGET'
  }

  const classification = chain.serverTarget?.classification
  if (classification === 'NON_HTTP_SERVER_ACTION_OR_PROVIDER_CALL_IDENTIFIED') {
    return chain.chainKind === 'SERVER_ACTION_TO_DATABASE_SERVICE'
      ? 'SERVER_ACTION'
      : 'EXTERNAL_PROVIDER_DIRECT'
  }
  return SERVER_CLASSIFICATION[classification] ?? 'UNKNOWN_SERVER_TARGET'
}

function getMethodStatus(chain, disposition, serverTargetClass) {
  if (serverTargetClass === 'MISSING_ROUTE_CANDIDATE') return 'NOT_APPLICABLE'
  if (!chain.chainKind.startsWith('HTTP_API_REQUEST')) return 'NOT_APPLICABLE'

  const localMethodStatus =
    disposition?.sourceTarget?.localMethodStatus ?? chain.serverTarget?.localMethodStatus
  if (localMethodStatus === 'API_METHOD_MISSING') return 'METHOD_MISMATCH'
  if (localMethodStatus === 'API_METHOD_PRESENT') return 'METHOD_MATCH'
  if (localMethodStatus === 'API_METHOD_UNKNOWN') return 'UNKNOWN'
  return 'UNKNOWN'
}

function knownOperationFromR2(disposition) {
  const code = disposition.disposition.code
  const method = disposition.sourceTarget?.method?.toUpperCase()

  if (['LOCAL_ROUTE_ABSENT', 'LOCAL_METHOD_ABSENT'].includes(code)) {
    return {
      primary: 'MISSING_IMPLEMENTATION',
      secondary: [],
      semantics: [],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'CONDITIONAL_VENDOR_DEPRECATION_OR_METHOD_ABSENT') {
    if (method === 'PATCH') {
      return {
        primary: 'MISSING_IMPLEMENTATION',
        secondary: [],
        semantics: [],
        note: disposition.disposition.sourceDisposition,
      }
    }
    if (method === 'POST' || method === 'GET') {
      return {
        primary: 'NO_PERSISTENT_EFFECT',
        secondary: [],
        semantics: [],
        note: disposition.disposition.sourceDisposition,
      }
    }
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: [],
      note: 'R2 establishes conditional POST/PATCH behavior but does not establish which branch applies to this chain.',
    }
  }
  if (
    code === 'PROFILE_LOOKUP' ||
    code === 'MFA_ENROLLMENT_STATUS_LOOKUP' ||
    code === 'CHAT_MESSAGE_HISTORY_READ' ||
    code === 'CLAIMS_COLLECTION_READ' ||
    code === 'CLC_TRENDS_READ' ||
    code === 'CURRENT_SESSION_IDENTITY_LOOKUP' ||
    code === 'CONTINUITY_SIMULATION_READ_AND_COMPUTATION' ||
    code === 'KNOWLEDGE_PROPAGATION_READ_AND_COMPUTATION' ||
    code === 'STEWARD_RECOMMENDATION_READ_AND_COMPUTATION' ||
    code === 'DATABASE_READ_SOURCE_CALLS'
  ) {
    const computation = code.includes('COMPUTATION') ? ['LOCAL_COMPUTATION'] : []
    return {
      primary: 'DATABASE_READ',
      secondary: [],
      semantics: computation,
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'DATABASE_READ_AND_WRITE_SOURCE_CALLS') {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: [],
      note: 'R2 establishes both a read and a mutation but does not identify a permitted CRUD operation.',
    }
  }
  if (code === 'PASSWORD_ACCOUNT_AND_SESSION_CREATION') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: ['DATABASE_READ'],
      semantics: ['SESSION_CREATED', 'COOKIE_SET', 'AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'MFA_CHALLENGE_CONSUMPTION_AND_SESSION') {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: ['SESSION_CREATED', 'COOKIE_SET'],
      note: 'R2 establishes challenge consumption but not whether the persisted challenge is updated or deleted.',
    }
  }
  if (code === 'PASSWORD_LOGIN_CONDITIONAL_SESSION') {
    return {
      primary: 'DATABASE_UPDATE',
      secondary: ['DATABASE_READ'],
      semantics: ['SESSION_CREATED', 'COOKIE_SET', 'AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'MAGIC_LINK_TOKEN_AND_EMAIL_ATTEMPT') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: ['EMAIL_SEND'],
      semantics: ['AUDIT_ATTEMPT', 'PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'INVITE_ACCEPTANCE_AND_MEMBERSHIP_UPSERT') {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: ['SESSION_CREATED', 'AUDIT_ATTEMPT'],
      note: 'R2 establishes a membership upsert, which cannot be represented by one permitted CRUD operation without more detail.',
    }
  }
  if (code === 'PASSWORD_RESET_TOKEN_AND_EMAIL_ATTEMPT') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: ['DATABASE_UPDATE', 'EMAIL_SEND'],
      semantics: ['AUDIT_ATTEMPT', 'PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'PASSWORD_RESET_TOKEN_CONSUMPTION') {
    return {
      primary: 'DATABASE_UPDATE',
      secondary: ['DATABASE_READ'],
      semantics: ['SESSION_TERMINATED', 'AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (
    code === 'MFA_DISABLE_AND_ACCOUNT_FLAG_UPDATE' ||
    code === 'BILLING_ACCOUNT_UPDATE' ||
    code === 'COPILOT_SESSION_UPDATE' ||
    code === 'PILOT_APPLICATION_PATCH_AFTER_OWNERSHIP_GUARDS'
  ) {
    return {
      primary: 'DATABASE_UPDATE',
      secondary: [],
      semantics: code === 'MFA_DISABLE_AND_ACCOUNT_FLAG_UPDATE' ? ['AUDIT_ATTEMPT'] : [],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'BILLING_ACCOUNT_CREATE' || code === 'INVITE_TOKEN_CREATION') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: code === 'INVITE_TOKEN_CREATION' ? ['EMAIL_SEND'] : [],
      semantics: [
        'AUDIT_ATTEMPT',
        ...(code === 'INVITE_TOKEN_CREATION' ? ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'] : []),
      ],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'VOTE_INSERT_AND_EVIDENCE_BLOB_PATH') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: ['OBJECT_STORAGE_WRITE'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (
    code === 'WHOP_CHECKOUT_PROVIDER_REQUEST' ||
    code === 'HUBSPOT_CONTACT_AND_CONDITIONAL_DEAL_ATTEMPT'
  ) {
    return {
      primary: 'EXTERNAL_PROVIDER_WRITE',
      secondary: [],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'HYBRID_SEARCH_WITH_CONDITIONAL_EMBEDDING') {
    return {
      primary: 'DATABASE_READ',
      secondary: ['EXTERNAL_PROVIDER_WRITE'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'LEADERSHIP_DASHBOARD_READ_AND_AUDIT_ATTEMPT') {
    return {
      primary: 'DATABASE_READ',
      secondary: [],
      semantics: ['AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'CLC_ANNUAL_REPORT_GENERATION_AND_AUDIT') {
    return {
      primary: 'DATABASE_READ',
      secondary: [],
      semantics: ['LOCAL_COMPUTATION', 'AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'COPILOT_QUERY_AND_SESSION_PERSISTENCE') {
    return {
      primary: 'EXTERNAL_PROVIDER_WRITE',
      secondary: ['UNKNOWN_DATA_EFFECT'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: 'R2 establishes AI generation as the Copilot query operation and database persistence, but does not identify the persisted CRUD subtype.',
    }
  }
  if (code === 'CHATBOT_MESSAGE_PERSISTENCE_AND_AI_FALLBACK') {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: ['EXTERNAL_PROVIDER_WRITE'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: 'R2 establishes message/session persistence as well as a conditional AI-generation attempt, but does not identify the principal permitted database operation.',
    }
  }
  if (code === 'FINANCE_ANALYSIS_READS_AND_AI_ATTEMPT') {
    return {
      primary: 'EXTERNAL_PROVIDER_WRITE',
      secondary: ['DATABASE_READ'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'ALLOCATION_SIMULATION_WITH_PERSISTED_SIMULATION_RECORDS') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: ['DATABASE_READ'],
      semantics: ['LOCAL_COMPUTATION', 'AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (
    code === 'PLACEHOLDER_ACCEPTED_NO_REMITTANCE_EFFECT' ||
    code === 'EMPTY_REMITTANCE_EXPORT' ||
    code === 'SUCCESS_SHAPED_NO_INVALIDATION'
  ) {
    return {
      primary: 'STUB_OR_MOCK_EFFECT',
      secondary: [],
      semantics: [],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'CASE_EVIDENCE_BLOB_AND_METADATA') {
    return {
      primary: 'OBJECT_STORAGE_WRITE',
      secondary: ['DATABASE_UPDATE'],
      semantics: ['AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'CHAT_SESSION_LIST_OR_CREATE') {
    return method === 'GET'
      ? {
          primary: 'DATABASE_READ',
          secondary: [],
          semantics: [],
          note: disposition.disposition.sourceDisposition,
        }
      : method === 'POST'
        ? {
            primary: 'DATABASE_INSERT',
            secondary: [],
            semantics: ['SESSION_CREATED'],
            note: disposition.disposition.sourceDisposition,
          }
        : {
            primary: 'UNKNOWN_DATA_EFFECT',
            secondary: [],
            semantics: [],
            note: 'R2 does not identify the selected read/create branch.',
          }
  }
  if (code === 'SCHEDULED_REPORT_CREATE_OR_UPDATE') {
    return method === 'POST'
      ? {
          primary: 'DATABASE_INSERT',
          secondary: [],
          semantics: [],
          note: disposition.disposition.sourceDisposition,
        }
      : method === 'PATCH'
        ? {
            primary: 'DATABASE_UPDATE',
            secondary: [],
            semantics: [],
            note: disposition.disposition.sourceDisposition,
          }
        : {
            primary: 'UNKNOWN_DATA_EFFECT',
            secondary: [],
            semantics: [],
            note: 'R2 does not identify the selected create/update branch.',
          }
  }
  if (code === 'BILLING_CYCLE_CONDITIONAL_DUES_INSERT') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: [],
      semantics: [],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'BILLING_PREVIEW_DRY_RUN') {
    return {
      primary: 'DATABASE_READ',
      secondary: [],
      semantics: ['LOCAL_COMPUTATION'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'SYSTEM_DEPENDENCY_STATUS_CHECK') {
    return {
      primary: 'EXTERNAL_PROVIDER_READ',
      secondary: [],
      semantics: [],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'LOCAL_NEXTAUTH_SIGNOUT') {
    return {
      primary: 'NO_PERSISTENT_EFFECT',
      secondary: [],
      semantics: ['SESSION_TERMINATED', 'COOKIE_CLEARED'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (
    code === 'GRIEVANCE_ACCESS_ASSIGNMENT_WRITE' ||
    code === 'PASSWORD_RESET_TOKEN_CONSUMPTION' ||
    code === 'MFA_ENROLLMENT_VERIFICATION_AND_ACCOUNT_UPDATE'
  ) {
    if (code === 'MFA_ENROLLMENT_VERIFICATION_AND_ACCOUNT_UPDATE') {
      return {
        primary: 'DATABASE_UPDATE',
        secondary: ['DATABASE_READ'],
        semantics: ['AUDIT_ATTEMPT'],
        note: disposition.disposition.sourceDisposition,
      }
    }
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: [],
      note: 'R2 identifies a write/consumption but does not distinguish the frozen CRUD operation.',
    }
  }
  if (code === 'DATABASE_READ_AND_LOCAL_COMPUTATION') {
    return {
      primary: 'DATABASE_READ',
      secondary: [],
      semantics: ['LOCAL_COMPUTATION'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'DATABASE_READ_AND_CONDITIONAL_PROVIDER_REQUEST') {
    return {
      primary: 'DATABASE_READ',
      secondary: ['EXTERNAL_PROVIDER_WRITE'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'DATABASE_READ_AND_AI_PROVIDER_ATTEMPT') {
    return {
      primary: 'EXTERNAL_PROVIDER_WRITE',
      secondary: ['DATABASE_READ'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'DATABASE_READ_WRITE_AND_AUDIT_ATTEMPT') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: ['DATABASE_READ'],
      semantics: ['LOCAL_COMPUTATION', 'AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (
    code === 'DATABASE_WRITE_AND_AI_PROVIDER_ATTEMPT' ||
    code === 'DATABASE_READ_WRITE_AND_AI_PROVIDER_ATTEMPT'
  ) {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: ['EXTERNAL_PROVIDER_WRITE'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: 'R2 establishes both persistence and a provider attempt but not the principal permitted database operation.',
    }
  }
  if (code === 'DATABASE_WRITE_AND_BLOB_PROVIDER_ATTEMPT') {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: ['OBJECT_STORAGE_WRITE'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: 'R2 establishes a database write and blob upload path but does not identify the database CRUD operation.',
    }
  }
  if (code === 'DATABASE_WRITE_AND_EMAIL_ATTEMPT' || code === 'DATABASE_WRITE_AND_EMAIL_BOUNDARY') {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: ['EMAIL_SEND'],
      semantics: ['PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN'],
      note: 'R2 establishes a database write and email attempt but not the database CRUD operation.',
    }
  }
  if (code === 'DEPRECATED_FINANCE_HANDLER') {
    return {
      primary: 'NO_PERSISTENT_EFFECT',
      secondary: [],
      semantics: [],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'METHOD_DEPENDENT_BLOB_AND_DATABASE_EFFECT') {
    return {
      primary: 'OBJECT_STORAGE_WRITE',
      secondary: ['DATABASE_UPDATE'],
      semantics: ['AUDIT_ATTEMPT'],
      note: disposition.disposition.sourceDisposition,
    }
  }
  if (code === 'METHOD_DEPENDENT_DATABASE_READ_OR_WRITE') {
    return method === 'GET'
      ? {
          primary: 'DATABASE_READ',
          secondary: [],
          semantics: [],
          note: disposition.disposition.sourceDisposition,
        }
      : method === 'POST'
        ? {
            primary: 'DATABASE_INSERT',
            secondary: [],
            semantics: ['SESSION_CREATED'],
            note: disposition.disposition.sourceDisposition,
          }
        : {
            primary: 'UNKNOWN_DATA_EFFECT',
            secondary: [],
            semantics: [],
            note: 'R2 does not identify the selected read/write branch.',
          }
  }
  if (code === 'CONDITIONAL_DATABASE_CREATE_OR_UPDATE') {
    return method === 'POST'
      ? {
          primary: 'DATABASE_INSERT',
          secondary: [],
          semantics: [],
          note: disposition.disposition.sourceDisposition,
        }
      : method === 'PATCH'
        ? {
            primary: 'DATABASE_UPDATE',
            secondary: [],
            semantics: [],
            note: disposition.disposition.sourceDisposition,
          }
        : {
            primary: 'UNKNOWN_DATA_EFFECT',
            secondary: [],
            semantics: [],
            note: 'R2 does not identify the selected create/update branch.',
          }
  }
  return {
    primary: 'UNKNOWN_DATA_EFFECT',
    secondary: [],
    semantics: [],
    note: `No frozen-enum mapping is evidenced for R2 disposition ${code}.`,
  }
}

function statusFromR1Evidence(value, observedMarker) {
  if (value === observedMarker) return 'YES'
  return 'NO'
}

function getControlObservations(chain, disposition, methodStatus, serverTargetClass) {
  if (serverTargetClass === 'MISSING_ROUTE_CANDIDATE' || methodStatus === 'METHOD_MISMATCH') {
    return {
      authCheckObserved: 'NOT_APPLICABLE',
      roleCheckObserved: 'NOT_APPLICABLE',
      orgResolutionObserved: 'NOT_APPLICABLE',
      resourcePermissionCheckObserved: 'NOT_APPLICABLE',
      auditWriteObserved: 'NOT_APPLICABLE',
    }
  }
  if (disposition) {
    const observations = disposition.sourceObservations ?? {}
    return {
      authCheckObserved: observations.authorization?.length ? 'YES' : 'NO',
      roleCheckObserved: 'NO',
      orgResolutionObserved: observations.organizationScope?.length ? 'YES' : 'NO',
      resourcePermissionCheckObserved: 'NO',
      auditWriteObserved: observations.audit?.length ? 'YES' : 'NO',
    }
  }

  const observed = chain.secondaryEffects ?? {}
  return {
    authCheckObserved: statusFromR1Evidence(
      observed.authorizationSourceEvidence,
      'GUARD_OR_CONTEXT_CALLS_OBSERVED',
    ),
    roleCheckObserved: 'NO',
    orgResolutionObserved: statusFromR1Evidence(
      observed.organizationScopeSourceEvidence,
      'ORG_OR_TENANT_CONTEXT_CALLS_OBSERVED',
    ),
    resourcePermissionCheckObserved: 'NO',
    auditWriteObserved: statusFromR1Evidence(observed.auditSourceEvidence, 'AUDIT_CALLS_OBSERVED'),
  }
}

function getSourceReferences(chain, disposition, b2Index, r1Index, r2Index) {
  const references = []
  if (disposition) {
    references.push(...(disposition.sourceReferences ?? []))
    references.push({
      artifact: 'PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json',
      jsonPointer: `/dispositions/${r2Index}`,
      evidenceRole: 'accepted_R2_disposition_record',
    })
  } else {
    const location = chain.sourceLocation ?? {}
    const addRef = (file, line, role) => {
      if (file && Number.isInteger(line))
        references.push({ file, lineStart: line, lineEnd: line, evidenceRole: role })
    }
    addRef(location.sourceFile, location.sourceLine, 'R1_source_location')
    addRef(location.sourceFile, location.bindingSourceLine, 'originating_binding')
    addRef(location.handlerDefinitionFile, location.handlerDefinitionLine, 'handler_definition')
    const target = chain.serverTarget ?? {}
    if (target.localRouteFile && target.methodTraceRef?.method) {
      references.push({
        file: target.localRouteFile,
        method: target.methodTraceRef.method,
        evidenceRole: 'R1_local_route_method_reference',
      })
    }
    references.push({
      artifact: 'PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json',
      jsonPointer: `/chains/${r1Index}`,
      evidenceRole: 'accepted_R1_chain_record',
    })
  }
  references.push({
    artifact: 'PHASE_1A_2_SERVER_EFFECT_INDEX.json',
    jsonPointer: b2Pointer(b2Index),
    evidenceRole: 'accepted_b2_chain_record',
  })
  return references
}

function normalizeRecord(chain, r1Index, b2Index, r2Index, disposition) {
  const serverTargetClass = getServerTarget(chain, disposition)
  const methodStatus = getMethodStatus(chain, disposition, serverTargetClass)
  const mappedEffect = disposition
    ? knownOperationFromR2(disposition)
    : mapR1Effect(chain, serverTargetClass, methodStatus)
  const requestResponseContract = chain.chainKind.startsWith('HTTP_API_REQUEST')
    ? 'PARTIAL'
    : 'UNKNOWN'
  const route = disposition?.sourceTarget?.route ?? chain.serverTarget?.target ?? null
  const method = disposition?.sourceTarget?.method ?? chain.requestResponse?.method ?? null
  const controlObservations = getControlObservations(
    chain,
    disposition,
    methodStatus,
    serverTargetClass,
  )
  const r1DataTargets = chain.dataEffect?.dataTargets
  return {
    chainId: chain.chainId,
    bindingId: chain.bindingId,
    serverTargetClass,
    methodStatus,
    primaryDataEffect: mappedEffect.primary,
    secondaryDataEffects: [...new Set(mappedEffect.secondary)],
    secondarySemanticEffects: [...new Set(mappedEffect.semantics)],
    dataTargets: Array.isArray(r1DataTargets) ? r1DataTargets : [],
    businessOperation:
      mappedEffect.note ||
      'Accepted R1 record does not contain a normalized business-operation description.',
    requestResponseContract,
    ...controlObservations,
    sourceReferences: getSourceReferences(chain, disposition, b2Index, r1Index, r2Index),
    rootCauseId: disposition ? dispositionRootCause(disposition) : r1RootCause(chain),
    falseSuccessSource: Boolean(disposition && falseSuccessCodes.has(disposition.disposition.code)),
    runtimeProven: 'NO',
  }
}

function mapR1Effect(chain, serverTargetClass, methodStatus) {
  if (serverTargetClass === 'MISSING_ROUTE_CANDIDATE' || methodStatus === 'METHOD_MISMATCH') {
    return {
      primary: 'MISSING_IMPLEMENTATION',
      secondary: [],
      semantics: [],
      note:
        serverTargetClass === 'MISSING_ROUTE_CANDIDATE'
          ? 'R1 establishes no local route and no explicit proxy/backend mapping.'
          : 'R1 establishes that the requested method is absent from the mapped local route.',
    }
  }
  const operations = chain.dataEffect?.operations ?? []
  if (operations.length === 1 && operations[0] === 'select') {
    return { primary: 'DATABASE_READ', secondary: [], semantics: [], note: chain.dataEffect.detail }
  }
  if (operations.length === 1 && operations[0] === 'insert') {
    return {
      primary: 'DATABASE_INSERT',
      secondary: [],
      semantics: [],
      note: chain.dataEffect.detail,
    }
  }
  if (operations.length > 1) {
    if (operations.includes('insert') && operations.includes('select') && operations.length === 2) {
      return {
        primary: 'DATABASE_INSERT',
        secondary: ['DATABASE_READ'],
        semantics: [],
        note: chain.dataEffect.detail,
      }
    }
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: [],
      note: 'R1 records multiple database operations but does not establish one principal frozen operation.',
    }
  }
  if (chain.dataEffect?.classification === 'PROVIDER_OR_SERVER_ACTION_IMPLEMENTATION_NOT_TRACED') {
    return {
      primary: 'NO_PERSISTENT_EFFECT',
      secondary: [],
      semantics: ['SESSION_TERMINATED', 'COOKIE_CLEARED'],
      note: 'R1 does not establish a persistent/provider terminal operation; session semantics remain source-only.',
    }
  }
  if (
    chain.dataEffect?.classification ===
    'TERMINAL_DATA_OR_PROVIDER_EFFECT_SOURCE_OBSERVED_DETAIL_NOT_RENORMALIZED'
  ) {
    return {
      primary: 'UNKNOWN_DATA_EFFECT',
      secondary: [],
      semantics: [],
      note: 'R1 establishes a terminal source effect but omits its operation subtype; no more specific frozen effect is justified.',
    }
  }
  return {
    primary: 'UNKNOWN_DATA_EFFECT',
    secondary: [],
    semantics: [],
    note: chain.dataEffect?.detail ?? 'R1 does not establish a frozen primary data effect.',
  }
}

function hasUnknownEffect(record) {
  return (
    record.primaryDataEffect === 'UNKNOWN_DATA_EFFECT' ||
    record.secondaryDataEffects.includes('UNKNOWN_DATA_EFFECT')
  )
}

function operationEffect(operation) {
  const normalized = operation.toLowerCase()
  if (normalized === 'insert') return 'DATABASE_INSERT'
  if (normalized === 'update') return 'DATABASE_UPDATE'
  if (normalized === 'delete') return 'DATABASE_DELETE'
  if (normalized === 'select' || normalized === 'findfirst') return 'DATABASE_READ'
  if (normalized === 'transaction') return 'DATABASE_TRANSACTION'
  return null
}

function resolveR1Operations(chain, record) {
  const operations = chain.dataEffect?.operations
  if (!Array.isArray(operations) || operations.length === 0) return null
  const effects = operations.map(operationEffect)
  if (effects.some((effect) => effect === null)) return null

  if (operations.length === 1) {
    if (effects[0] === 'DATABASE_TRANSACTION') return { primary: effects[0], secondary: [] }
    return { primary: effects[0], secondary: [] }
  }

  if (effects.every((effect) => effect === 'DATABASE_READ')) {
    return { primary: 'DATABASE_READ', secondary: [] }
  }

  const method = (chain.requestResponse?.method ?? '').toUpperCase()
  const methodEffect = HTTP_METHOD_EFFECT[method]
  const routeIsCrudBacked =
    record.serverTargetClass === 'LOCAL_NEXT_ROUTE' && record.methodStatus === 'METHOD_MATCH'
  if (!methodEffect || !routeIsCrudBacked || !effects.includes(methodEffect)) return null

  return {
    primary: methodEffect,
    secondary: [...new Set(effects.filter((effect) => effect !== methodEffect))],
  }
}

function resolveR2ReadWriteMethod(disposition) {
  if (
    disposition?.disposition?.code !== 'DATABASE_READ_AND_WRITE_SOURCE_CALLS' ||
    disposition.disposition.effectClass !== 'DATABASE_READ_AND_WRITE' ||
    disposition.sourceTarget?.localRouteStatus !== 'API_ROUTE_PRESENT' ||
    disposition.sourceTarget?.localMethodStatus !== 'API_METHOD_PRESENT'
  ) {
    return null
  }

  const method = (disposition.sourceTarget?.method ?? '').toUpperCase()
  const primary = HTTP_METHOD_EFFECT[method]
  if (!primary || primary === 'DATABASE_READ') return null
  return { primary, secondary: ['DATABASE_READ'] }
}

function adjudicateUnknownEffect(record, chain, disposition) {
  const result = {
    primary: record.primaryDataEffect,
    secondary: [...record.secondaryDataEffects],
    adjudication: 'EVIDENCE_INSUFFICIENT',
    decisionRule: 'NO_UNAMBIGUOUS_FROZEN_EFFECT_IN_ACCEPTED_EVIDENCE',
    evidenceUsed: [],
  }

  if (record.serverTargetClass === 'MISSING_ROUTE_CANDIDATE') {
    result.primary = 'MISSING_IMPLEMENTATION'
    result.decisionRule = 'LOCAL_ROUTE_ABSENT_WITHOUT_ALTERNATE_TARGET'
    result.decisionRationale =
      'The accepted route evidence says the local route is absent and establishes no alternate target.'
    result.evidenceUsed = ['R1.serverTarget.localRouteStatus', 'R1.serverTarget.classification']
  } else if (record.methodStatus === 'METHOD_MISMATCH') {
    result.primary = 'MISSING_IMPLEMENTATION'
    result.decisionRule = 'REQUESTED_LOCAL_METHOD_ABSENT'
    result.decisionRationale =
      'The accepted route evidence says the requested local method is absent.'
    result.evidenceUsed = ['R1.serverTarget.localMethodStatus']
  } else {
    const r2Resolution = resolveR2ReadWriteMethod(disposition)
    const r1Resolution = resolveR1Operations(chain, record)
    const resolution = r2Resolution ?? r1Resolution

    if (resolution) {
      if (result.primary === 'UNKNOWN_DATA_EFFECT') {
        result.primary = resolution.primary
        result.secondary = [
          ...new Set([
            ...result.secondary.filter((effect) => effect !== 'UNKNOWN_DATA_EFFECT'),
            ...resolution.secondary,
          ]),
        ]
      } else if (result.secondary.includes('UNKNOWN_DATA_EFFECT')) {
        result.secondary = [
          ...new Set([
            ...result.secondary.filter((effect) => effect !== 'UNKNOWN_DATA_EFFECT'),
            resolution.primary,
            ...resolution.secondary,
          ]),
        ]
      }
      if (
        !hasUnknownEffect({
          primaryDataEffect: result.primary,
          secondaryDataEffects: result.secondary,
        })
      ) {
        result.adjudication = 'EVIDENCE_SUFFICIENT'
        result.decisionRule = r2Resolution
          ? 'R2_DATABASE_READ_WRITE_WITH_PRESENT_CRUD_ROUTE_AND_METHOD'
          : 'R1_EXPLICIT_DATABASE_OPERATIONS'
        result.decisionRationale = r2Resolution
          ? `R2 establishes database reads and mutations on a present local CRUD route; the recorded ${(
              disposition.sourceTarget.method ?? ''
            ).toUpperCase()} method corroborates ${resolution.primary}, with DATABASE_READ retained as secondary.`
          : 'R1 explicitly records database operations; the selected primary operation is unambiguous from the recorded operation list and, where needed, its request method.'
        result.evidenceUsed = r2Resolution
          ? [
              'R2.disposition.code',
              'R2.disposition.effectClass',
              'R2.sourceTarget.localRouteStatus',
              'R2.sourceTarget.localMethodStatus',
              'R2.sourceTarget.method',
            ]
          : [
              'R1.dataEffect.operations',
              ...(chain.requestResponse?.method
                ? ['R1.requestResponse.method', 'R1.serverTarget.localMethodStatus']
                : []),
            ]
      }
    }
  }

  if (result.adjudication === 'EVIDENCE_INSUFFICIENT' && !result.decisionRationale) {
    if (disposition) {
      const mapped = knownOperationFromR2(disposition)
      result.decisionRule =
        mapped.primary === 'UNKNOWN_DATA_EFFECT' || mapped.secondary.includes('UNKNOWN_DATA_EFFECT')
          ? 'R2_DISPOSITION_DOES_NOT_IDENTIFY_FROZEN_EFFECT_SUBTYPE'
          : 'R2_SECONDARY_PERSISTENCE_SUBTYPE_NOT_IDENTIFIED'
      result.decisionRationale = mapped.note
    } else if ((chain.dataEffect?.operations ?? []).length > 1) {
      result.decisionRule = 'R1_MULTIPLE_OPERATIONS_WITHOUT_UNAMBIGUOUS_PRIMARY'
      result.decisionRationale =
        'R1 records multiple database operations but no request method or captured business-operation evidence selects one principal frozen effect.'
    } else {
      result.decisionRule = 'R1_GENERIC_TERMINAL_EFFECT_WITHOUT_OPERATION_SUBTYPE'
      result.decisionRationale =
        'R1 records only a generic source-effect observation and does not include an operation subtype, so the frozen data-effect enum cannot be selected.'
    }
    result.evidenceUsed = disposition
      ? [
          'R2.disposition.code',
          'R2.disposition.effectClass',
          'R2.terminalOutcome',
          'R2.disposition.sourceDisposition',
          'R2.sourceTarget.method',
          'R1.dataEffect.operations',
          'R1.dataEffect.dataTargets',
          'R1.dataEffect.classification',
          'R1.terminalEffectAssessment',
        ]
      : [
          'R1.dataEffect.operations',
          'R1.dataEffect.dataTargets',
          'R1.dataEffect.classification',
          'R1.terminalEffectAssessment',
          'R1.requestResponse.method',
          'R1.serverTarget.classification',
          'R1.chainKind',
        ]
  }

  return result
}

function validateBackfillInput(sourceData, candidates) {
  const r2ChainIds = new Set(sourceData.r2.dispositions.map((entry) => entry.chainId))
  const counts = {
    totalUnknownChains: candidates.length,
    r1Only: candidates.filter((record) => !r2ChainIds.has(record.chainId)).length,
    r2Disposition: candidates.filter((record) => r2ChainIds.has(record.chainId)).length,
    primaryUnknown: candidates.filter(
      (record) => record.primaryDataEffect === 'UNKNOWN_DATA_EFFECT',
    ).length,
    secondaryUnknownEntries: candidates.reduce(
      (count, record) =>
        count +
        record.secondaryDataEffects.filter((effect) => effect === 'UNKNOWN_DATA_EFFECT').length,
      0,
    ),
  }
  const expectedIds = candidates.map((record) => record.chainId)
  if (Object.entries(EXPECTED_R2E_INPUT).some(([key, value]) => counts[key] !== value)) {
    throw new Error(`R2E input evidence drift: ${JSON.stringify(counts)}`)
  }

  if (sourceData.r2e) {
    const priorIds = sourceData.r2e.inputReport?.unknownEffectChainIds ?? []
    if (!keyListEquals(priorIds, expectedIds)) {
      throw new Error(
        'Existing R2E unknown-chain membership differs from the accepted R1/R2 evidence.',
      )
    }
    for (const [key, value] of Object.entries(EXPECTED_R2E_INPUT)) {
      if (sourceData.r2e.inputReport?.[key] !== value) {
        throw new Error(`Existing R2E input report drift: ${key} is not ${value}.`)
      }
    }
  } else {
    const input = sourceData.r2n
    const required = input.requiredOutput ?? {}
    const validation = input.validation ?? {}
    const storedIds = validation.unknownDataEffectChainIds ?? []
    if (
      required.TOTAL_EFFECT_CHAINS !== 394 ||
      required.UNKNOWN_DATA_EFFECT !== EXPECTED_R2E_INPUT.primaryUnknown ||
      required.UNKNOWN_DATA_EFFECT_ENTRIES !==
        EXPECTED_R2E_INPUT.primaryUnknown + EXPECTED_R2E_INPUT.secondaryUnknownEntries ||
      !keyListEquals(storedIds, expectedIds) ||
      validation.unknownDataEffectByEvidence?.r1Only !== EXPECTED_R2E_INPUT.r1Only ||
      validation.unknownDataEffectByEvidence?.r2Disposition !== EXPECTED_R2E_INPUT.r2Disposition
    ) {
      throw new Error(
        'R2N baseline does not match the fixed R2E input report; stopping for evidence drift.',
      )
    }
  }

  return { ...counts, unknownEffectChainIds: expectedIds }
}

function violationCount(values, allowed) {
  return values.filter((value) => !allowed.includes(value)).length
}

function validateRecordSet(records, sourceData) {
  const enumViolations = {
    serverTarget: violationCount(
      records.map((record) => record.serverTargetClass),
      SERVER_TARGET_ENUM,
    ),
    primaryDataEffect: violationCount(
      records.map((record) => record.primaryDataEffect),
      DATA_EFFECT_ENUM,
    ),
    secondaryDataEffects: records.reduce(
      (count, record) => count + violationCount(record.secondaryDataEffects, DATA_EFFECT_ENUM),
      0,
    ),
    requestResponse: violationCount(
      records.map((record) => record.requestResponseContract),
      REQUEST_RESPONSE_ENUM,
    ),
    controlObservations: records.reduce(
      (count, record) =>
        count +
        [
          record.authCheckObserved,
          record.roleCheckObserved,
          record.orgResolutionObserved,
          record.resourcePermissionCheckObserved,
          record.auditWriteObserved,
        ].filter((value) => !CONTROL_ENUM.includes(value)).length,
      0,
    ),
  }
  const serverTargetCounts = Object.fromEntries(
    SERVER_TARGET_ENUM.map((value) => [
      value,
      records.filter((record) => record.serverTargetClass === value).length,
    ]),
  )
  const primaryEffectCounts = Object.fromEntries(
    DATA_EFFECT_ENUM.map((value) => [
      value,
      records.filter((record) => record.primaryDataEffect === value).length,
    ]),
  )
  const secondaryUnknownCount = records.reduce(
    (count, record) =>
      count + record.secondaryDataEffects.filter((value) => value === 'UNKNOWN_DATA_EFFECT').length,
    0,
  )
  const unknownDataEffectCount = primaryEffectCounts.UNKNOWN_DATA_EFFECT + secondaryUnknownCount
  const r2ChainIds = new Set(sourceData.r2.dispositions.map((disposition) => disposition.chainId))
  const unknownDataEffectByEvidence = {
    r1Only: records.filter(
      (record) =>
        (record.primaryDataEffect === 'UNKNOWN_DATA_EFFECT' ||
          record.secondaryDataEffects.includes('UNKNOWN_DATA_EFFECT')) &&
        !r2ChainIds.has(record.chainId),
    ).length,
    r2Disposition: records.filter(
      (record) =>
        (record.primaryDataEffect === 'UNKNOWN_DATA_EFFECT' ||
          record.secondaryDataEffects.includes('UNKNOWN_DATA_EFFECT')) &&
        r2ChainIds.has(record.chainId),
    ).length,
  }
  const controlNotObservedCounts = {
    authCheckNotObserved: records.filter((record) => record.authCheckObserved === 'NO').length,
    roleCheckNotObserved: records.filter((record) => record.roleCheckObserved === 'NO').length,
    orgResolutionNotObserved: records.filter((record) => record.orgResolutionObserved === 'NO')
      .length,
    resourcePermissionCheckNotObserved: records.filter(
      (record) => record.resourcePermissionCheckObserved === 'NO',
    ).length,
    auditWriteNotObserved: records.filter((record) => record.auditWriteObserved === 'NO').length,
  }
  const routeDefects = records.filter(
    (record) => record.serverTargetClass === 'MISSING_ROUTE_CANDIDATE',
  )
  const methodDefects = records.filter((record) => record.methodStatus === 'METHOD_MISMATCH')
  const missingImplementation = records.filter(
    (record) => record.primaryDataEffect === 'MISSING_IMPLEMENTATION',
  )
  const stubEffects = records.filter((record) => record.primaryDataEffect === 'STUB_OR_MOCK_EFFECT')
  const falseSuccess = records.filter((record) => record.falseSuccessSource)
  const rootCount = (items) => new Set(items.map((record) => record.rootCauseId)).size
  const b1 = {
    traceCandidates: sourceData.b2.carryForward.traceCandidateBindingIds.length,
    noInRepositoryCaller: sourceData.b2.carryForward.noInRepositoryCallerBindingIds.length,
  }
  const b1Count = b1.traceCandidates + b1.noInRepositoryCaller
  const requiredChecks = {
    totalEffectChains: records.length === 394,
    serverTargetSum:
      Object.values(serverTargetCounts).reduce((sum, count) => sum + count, 0) === 394,
    primaryDataEffectSum:
      Object.values(primaryEffectCounts).reduce((sum, count) => sum + count, 0) === 394,
    noEnumViolations: Object.values(enumViolations).every((count) => count === 0),
    noUnknownServerTarget: serverTargetCounts.UNKNOWN_SERVER_TARGET === 0,
    noUnknownDataEffect: unknownDataEffectCount === 0,
    b1CarryForwardTotal: b1Count === 40,
    b1ArraysUnchanged:
      keyListEquals(
        sourceData.r2.b1CarryForward.traceCandidateBindingIds,
        sourceData.b2.carryForward.traceCandidateBindingIds,
      ) &&
      keyListEquals(
        sourceData.r2.b1CarryForward.noInRepositoryCallerBindingIds,
        sourceData.b2.carryForward.noInRepositoryCallerBindingIds,
      ),
  }

  return {
    enumViolations,
    serverTargetCounts,
    serverTargetSum: Object.values(serverTargetCounts).reduce((sum, count) => sum + count, 0),
    primaryEffectCounts,
    primaryDataEffectSum: Object.values(primaryEffectCounts).reduce((sum, count) => sum + count, 0),
    secondaryUnknownCount,
    unknownDataEffectCount,
    unknownServerTarget: serverTargetCounts.UNKNOWN_SERVER_TARGET,
    unknownDataEffectByEvidence,
    unknownServerTargetChainIds: records
      .filter((record) => record.serverTargetClass === 'UNKNOWN_SERVER_TARGET')
      .map((record) => record.chainId),
    unknownDataEffectChainIds: records
      .filter(
        (record) =>
          record.primaryDataEffect === 'UNKNOWN_DATA_EFFECT' ||
          record.secondaryDataEffects.includes('UNKNOWN_DATA_EFFECT'),
      )
      .map((record) => record.chainId),
    controlNotObservedCounts,
    knownSourceDefects: {
      missingRouteCandidates: routeDefects.length,
      methodMismatchChains: methodDefects.length,
      missingImplementation: missingImplementation.length,
      stubOrMockEffect: stubEffects.length,
      falseSuccessSourceChains: falseSuccess.length,
      uniqueRootCauseCounts: {
        missingRouteCandidates: rootCount(routeDefects),
        methodMismatchChains: rootCount(methodDefects),
        missingImplementation: rootCount(missingImplementation),
        stubOrMockEffect: rootCount(stubEffects),
        falseSuccessSourceChains: rootCount(falseSuccess),
      },
    },
    b1CarryForward: {
      traceTerminalUnproven: b1.traceCandidates,
      noInRepositoryCaller: b1.noInRepositoryCaller,
      total: b1Count,
      arraysUnchanged: requiredChecks.b1ArraysUnchanged,
    },
    requiredChecks,
    gate: Object.values(requiredChecks).every(Boolean) ? 'PASS' : 'FAIL',
    totalEffectChains: records.length,
  }
}

function mapInputs() {
  const b2 = readJson(sourcePaths.b2)
  const r1 = readJson(sourcePaths.r1)
  const r2 = readJson(sourcePaths.r2)
  const r2n = readJson(sourcePaths.r2n)
  const r2e = fs.existsSync(sourcePaths.r2e) ? readJson(sourcePaths.r2e) : null
  const b2Chains = new Map(b2.chains.map((chain, index) => [chain.chainId, { chain, index }]))
  const r1Chains = new Map(r1.chains.map((chain, index) => [chain.chainId, { chain, index }]))
  const r2Dispositions = new Map(
    r2.dispositions.map((disposition, index) => [disposition.chainId, { disposition, index }]),
  )
  if (b2Chains.size !== 394 || r1Chains.size !== 394 || r2Dispositions.size !== 154) {
    throw new Error(
      `Input census mismatch: b2=${b2Chains.size}, R1=${r1Chains.size}, R2=${r2Dispositions.size}`,
    )
  }
  if (
    r1Chains.size !== b2Chains.size ||
    [...b2Chains.keys()].some((chainId) => !r1Chains.has(chainId))
  ) {
    throw new Error('R1 chain membership does not exactly match the accepted b2 census.')
  }
  if ([...r2Dispositions.keys()].some((chainId) => !r1Chains.has(chainId))) {
    throw new Error('R2 includes a chain that is absent from the accepted R1 census.')
  }
  if (
    !keyListEquals(
      r2.b1CarryForward.traceCandidateBindingIds,
      b2.carryForward.traceCandidateBindingIds,
    ) ||
    !keyListEquals(
      r2.b1CarryForward.noInRepositoryCallerBindingIds,
      b2.carryForward.noInRepositoryCallerBindingIds,
    )
  ) {
    throw new Error('R2 b1 carry-forward arrays differ from the accepted b2 arrays.')
  }

  const records = [...b2Chains.values()].map(({ chain: b2Chain, index: b2Index }) => {
    const { chain: r1Chain, index: r1Index } = r1Chains.get(b2Chain.chainId)
    const r2Entry = r2Dispositions.get(b2Chain.chainId)
    return normalizeRecord(
      r1Chain,
      r1Index,
      b2Index,
      r2Entry?.index ?? null,
      r2Entry?.disposition ?? null,
    )
  })
  return { b2, r1, r2, r2n, r2e, records }
}

function buildR2e(sourceData) {
  const candidates = sourceData.records.filter(hasUnknownEffect)
  const inputReport = validateBackfillInput(sourceData, candidates)
  const r1ById = new Map(sourceData.r1.chains.map((chain) => [chain.chainId, chain]))
  const r2ById = new Map(sourceData.r2.dispositions.map((entry) => [entry.chainId, entry]))
  const adjudications = candidates.map((record) => {
    const chain = r1ById.get(record.chainId)
    const disposition = r2ById.get(record.chainId)
    const resolution = adjudicateUnknownEffect(record, chain, disposition)
    return {
      chainId: record.chainId,
      evidenceOrigin: disposition ? 'R2' : 'R1',
      currentPrimary: record.primaryDataEffect,
      currentSecondary: [...record.secondaryDataEffects],
      r1Operations: chain.dataEffect?.operations ?? [],
      r1DataTargets: chain.dataEffect?.dataTargets ?? [],
      r1Classification: chain.dataEffect?.classification ?? null,
      r1TerminalAssessment: chain.terminalEffectAssessment ?? null,
      r2DispositionCode: disposition?.disposition?.code ?? null,
      r2EffectClass: disposition?.disposition?.effectClass ?? null,
      r2SourceDisposition: disposition?.disposition?.sourceDisposition ?? null,
      r2TerminalOutcome: disposition?.terminalOutcome ?? null,
      r2SourceTarget: disposition?.sourceTarget ?? null,
      r2SourceReferences: disposition?.sourceReferences ?? [],
      requestMethod: disposition?.sourceTarget?.method ?? chain.requestResponse?.method ?? null,
      serverTargetClass: record.serverTargetClass,
      adjudication: resolution.adjudication,
      finalPrimaryDataEffect: resolution.primary,
      finalSecondaryDataEffects: resolution.secondary,
      decisionRule: resolution.decisionRule,
      decisionRationale: resolution.decisionRationale,
      evidenceUsed: resolution.evidenceUsed,
    }
  })
  const adjudicationById = new Map(adjudications.map((entry) => [entry.chainId, entry]))
  const records = sourceData.records.map((record) => {
    const decision = adjudicationById.get(record.chainId)
    if (!decision) return record
    return {
      ...record,
      primaryDataEffect: decision.finalPrimaryDataEffect,
      secondaryDataEffects: decision.finalSecondaryDataEffects,
      existingEvidenceBackfill: {
        adjudication: decision.adjudication,
        decisionRule: decision.decisionRule,
        decisionRationale: decision.decisionRationale,
        evidenceUsed: decision.evidenceUsed,
        previousPrimaryDataEffect: decision.currentPrimary,
        previousSecondaryDataEffects: decision.currentSecondary,
      },
    }
  })
  const validation = validateRecordSet(records, sourceData)
  if (
    validation.totalEffectChains !== 394 ||
    validation.serverTargetSum !== 394 ||
    validation.primaryDataEffectSum !== 394 ||
    Object.values(validation.enumViolations).some((count) => count !== 0) ||
    validation.unknownServerTarget !== 0 ||
    validation.b1CarryForward.total !== 40 ||
    !validation.b1CarryForward.arraysUnchanged
  ) {
    throw new Error('R2E output failed frozen-enum, census arithmetic, target, or b1 validation.')
  }

  const evidenceSufficient = adjudications.filter(
    (entry) => entry.adjudication === 'EVIDENCE_SUFFICIENT',
  )
  const evidenceInsufficient = adjudications.filter(
    (entry) => entry.adjudication === 'EVIDENCE_INSUFFICIENT',
  )
  const primaryUnknownResolved =
    inputReport.primaryUnknown - validation.primaryEffectCounts.UNKNOWN_DATA_EFFECT
  const secondaryUnknownResolved =
    inputReport.secondaryUnknownEntries - validation.secondaryUnknownCount
  const residualUnknownRecords = records.filter(hasUnknownEffect)
  const residualByEvidence = validation.unknownDataEffectByEvidence
  const gate =
    validation.unknownDataEffectCount === 0 &&
    validation.secondaryUnknownCount === 0 &&
    validation.unknownServerTarget === 0 &&
    Object.values(validation.enumViolations).every((count) => count === 0) &&
    validation.serverTargetSum === 394 &&
    validation.primaryDataEffectSum === 394
      ? 'PASS'
      : 'SOURCE_CEILING'
  const resultReport = {
    evidenceSufficientChains: evidenceSufficient.length,
    evidenceInsufficientChains: evidenceInsufficient.length,
    primaryUnknownsResolved: primaryUnknownResolved,
    secondaryUnknownsResolved: secondaryUnknownResolved,
    residualUnknownChains: residualUnknownRecords.length,
    r1OnlyResidual: residualByEvidence.r1Only,
    r2Residual: residualByEvidence.r2Disposition,
    primaryUnknownResidual: validation.primaryEffectCounts.UNKNOWN_DATA_EFFECT,
    secondaryUnknownEntriesResidual: validation.secondaryUnknownCount,
    residualEffectChainIds: validation.unknownDataEffectChainIds,
    residualObligationType: 'LATER_DETERMINISTIC_RUNTIME_OR_IMPLEMENTATION_VERIFICATION',
  }
  const requiredOutput = {
    PHASE_1A_2B2_R2E_GATE: gate,
    INPUT_UNKNOWN_EFFECT_CHAINS: inputReport.totalUnknownChains,
    R1_ONLY_INPUT: inputReport.r1Only,
    R2_INPUT: inputReport.r2Disposition,
    PRIMARY_UNKNOWN_INPUT: inputReport.primaryUnknown,
    SECONDARY_UNKNOWN_ENTRIES_INPUT: inputReport.secondaryUnknownEntries,
    EVIDENCE_SUFFICIENT_CHAINS: resultReport.evidenceSufficientChains,
    EVIDENCE_INSUFFICIENT_CHAINS: resultReport.evidenceInsufficientChains,
    PRIMARY_UNKNOWNS_RESOLVED: resultReport.primaryUnknownsResolved,
    SECONDARY_UNKNOWNS_RESOLVED: resultReport.secondaryUnknownsResolved,
    RESIDUAL_UNKNOWN_CHAINS: resultReport.residualUnknownChains,
    RESIDUAL_OBLIGATIONS_LATER_VERIFICATION_ONLY: 'YES',
    R1_ONLY_RESIDUAL: resultReport.r1OnlyResidual,
    R2_RESIDUAL: resultReport.r2Residual,
    PRIMARY_UNKNOWN_RESIDUAL: resultReport.primaryUnknownResidual,
    SECONDARY_UNKNOWN_ENTRIES_RESIDUAL: resultReport.secondaryUnknownEntriesResidual,
    RESIDUAL_EFFECT_OBLIGATIONS: resultReport.residualUnknownChains,
    STATIC_EFFECT_ASSURANCE_CEILING_REACHED: gate === 'SOURCE_CEILING' ? 'YES' : 'NO',
    NO_FURTHER_STATIC_SOURCE_PASS_AUTHORIZED: gate === 'SOURCE_CEILING' ? 'YES' : 'NO',
    NEW_APPLICATION_SOURCE_FILES_READ: 0,
    NEW_ROUTE_IMPLEMENTATIONS_READ: 0,
    NEW_SERVICE_IMPLEMENTATIONS_READ: 0,
    NEW_PROVIDER_IMPLEMENTATIONS_READ: 0,
    PHASE_1A_2B2_SOURCE_CENSUS: gate,
    STATIC_SERVER_TARGET_MODEL_COMPLETE: 'YES',
    STATIC_DATA_EFFECT_MODEL_COMPLETE: resultReport.residualUnknownChains === 0 ? 'YES' : 'NO',
    B1_SOURCE_CEILING_BINDINGS: validation.b1CarryForward.total,
    PERSISTENCE_RUNTIME_PROVEN: 'NO',
    AUTHORIZATION_PROVEN: 'NO',
    ORG_SCOPE_PROVEN: 'NO',
    AUDIT_PROVEN: 'NO',
    RUNTIME_PROVEN: 'NO',
    PHASE_1A_2_FINAL: 'NOT YET PROVEN',
    PRODUCT_READY: 'NO',
  }
  const output = {
    metadata: {
      title: 'Phase 1A.2b2-R2E existing-evidence effect backfill',
      version: 'R2E',
      scope:
        'Deterministic adjudication of only the 254 unknown-effect records in the accepted R2N census. No application source was opened or newly traced.',
      generator: 'scripts/ue/normalize-effect-census.mjs',
      generatorCommand: 'node scripts/ue/normalize-effect-census.mjs',
      inputs: [
        '../PHASE_1A_2_SERVER_EFFECT_INDEX.json',
        'PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json',
        'PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json',
        'PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json',
      ],
      sourceEvidenceBoundary: 'ACCEPTED_ARTIFACTS_ONLY',
      normalizationTimestamp: '2026-10-08',
    },
    inputReport,
    resultReport,
    requiredOutput,
    gate: {
      phase: gate,
      sourceCensus: gate,
      staticServerTargetModelComplete: 'YES',
      staticDataEffectModelComplete: resultReport.residualUnknownChains === 0 ? 'YES' : 'NO',
      staticEffectAssuranceCeilingReached: gate === 'SOURCE_CEILING' ? 'YES' : 'NO',
      noFurtherStaticSourcePassAuthorized: gate === 'SOURCE_CEILING' ? 'YES' : 'NO',
      residualEffectObligations: resultReport.residualUnknownChains,
      residualObligationType: resultReport.residualObligationType,
      persistenceRuntimeProven: 'NO',
      authorizationProven: 'NO',
      organizationScopeProven: 'NO',
      auditProven: 'NO',
      runtimeProven: 'NO',
      phase1a2Final: 'NOT_YET_PROVEN',
      phase1b: 'NOT_AUTHORIZED',
      productReady: 'NO',
    },
    newSourceEvidenceRead: {
      applicationSourceFiles: 0,
      routeImplementations: 0,
      serviceImplementations: 0,
      providerImplementations: 0,
    },
    validation: {
      totalEffectChains: validation.totalEffectChains,
      serverTargetCounts: validation.serverTargetCounts,
      serverTargetSum: validation.serverTargetSum,
      primaryDataEffectCounts: validation.primaryEffectCounts,
      primaryDataEffectSum: validation.primaryDataEffectSum,
      secondaryUnknownDataEffectEntries: validation.secondaryUnknownCount,
      enumViolations: validation.enumViolations,
      unknownServerTarget: validation.unknownServerTarget,
      unknownDataEffectEntries: validation.unknownDataEffectCount,
      b1CarryForward: validation.b1CarryForward,
    },
    enums: {
      serverTarget: SERVER_TARGET_ENUM,
      dataEffect: DATA_EFFECT_ENUM,
      requestResponseContract: REQUEST_RESPONSE_ENUM,
      controlObservation: CONTROL_ENUM,
    },
    adjudications,
    residualEffectChainIds: resultReport.residualEffectChainIds,
  }

  return { inputReport, output, records }
}

function buildR2eMarkdown(output) {
  const report = output.validation
  const results = output.resultReport
  const formatIdList = (ids) =>
    ids.length
      ? ids
          .reduce((groups, id, index) => {
            const groupIndex = Math.floor(index / 8)
            groups[groupIndex] ??= []
            groups[groupIndex].push(id)
            return groups
          }, [])
          .map((group) => `- ${group.join(', ')}`)
      : ['- none']
  const lines = [
    '# Phase 1A.2b2-R2E — existing-evidence effect backfill',
    '',
    `**Gate: ${output.gate.phase}.** This pass used only accepted b2/R1/R2/R2N artifacts. It read no new application, route, service, or provider source and made no product-code or runtime changes.`,
    '',
    '## Fixed input report',
    '',
    '| Input | Chains / entries |',
    '|---|---:|',
    `| Unknown-effect chains | ${output.inputReport.totalUnknownChains} |`,
    `| R1-only chains | ${output.inputReport.r1Only} |`,
    `| R2-disposition chains | ${output.inputReport.r2Disposition} |`,
    `| Primary unknown effects | ${output.inputReport.primaryUnknown} |`,
    `| Secondary unknown entries | ${output.inputReport.secondaryUnknownEntries} |`,
    '',
    '## Backfill result',
    '',
    '| Result | Count |',
    '|---|---:|',
    `| Evidence sufficient | ${results.evidenceSufficientChains} |`,
    `| Evidence insufficient | ${results.evidenceInsufficientChains} |`,
    `| Primary unknowns resolved | ${results.primaryUnknownsResolved} |`,
    `| Secondary unknowns resolved | ${results.secondaryUnknownsResolved} |`,
    `| Residual unknown chains | ${results.residualUnknownChains} |`,
    `| R1-only residual | ${results.r1OnlyResidual} |`,
    `| R2 residual | ${results.r2Residual} |`,
    `| Primary unknown residual | ${results.primaryUnknownResidual} |`,
    `| Secondary unknown entries residual | ${results.secondaryUnknownEntriesResidual} |`,
    '',
    'Every input chain has one adjudication record in the JSON artifact, including the current and final classifications, evidence fields, decision rule, and evidence used.',
    '',
    '## Residual effect obligations',
    '',
    `Residual IDs are obligations for later deterministic runtime/implementation verification only (${results.residualObligationType}); this pass does not begin that work.`,
    'No further static source pass is authorized by this source-ceiling result.',
    '',
    `Residual chains (${results.residualUnknownChains}):`,
    '',
    ...formatIdList(results.residualEffectChainIds),
    '',
    '## Canonical server-target arithmetic',
    '',
    '| Server target | Chains |',
    '|---|---:|',
    ...Object.entries(report.serverTargetCounts).map(
      ([target, count]) => `| \`${target}\` | ${count} |`,
    ),
    `| **SUM** | **${report.serverTargetSum}** |`,
    '',
    '## Canonical primary data-effect arithmetic',
    '',
    '| Primary data effect | Chains |',
    '|---|---:|',
    ...Object.entries(report.primaryDataEffectCounts).map(
      ([effect, count]) => `| \`${effect}\` | ${count} |`,
    ),
    `| **SUM** | **${report.primaryDataEffectSum}** |`,
    '',
    '## Frozen-schema validation',
    '',
    '| Check | Result |',
    '|---|---:|',
    `| Server-target enum violations | ${report.enumViolations.serverTarget} |`,
    `| Primary data-effect enum violations | ${report.enumViolations.primaryDataEffect} |`,
    `| Secondary data-effect enum violations | ${report.enumViolations.secondaryDataEffects} |`,
    `| Request/response enum violations | ${report.enumViolations.requestResponse} |`,
    `| Control-observation enum violations | ${report.enumViolations.controlObservations} |`,
    `| Total effect chains | ${report.totalEffectChains} |`,
    `| Secondary unknown entries | ${report.secondaryUnknownDataEffectEntries} |`,
    `| B1 carry-forward | ${report.b1CarryForward.total} (23 trace + 17 no-caller) |`,
    '',
    '## Evidence boundary and status',
    '',
    '- New application source files read: 0.',
    '- New route implementations read: 0.',
    '- New service implementations read: 0.',
    '- New provider implementations read: 0.',
    '- Persistence runtime, authorization, organization scope, audit, and runtime remain unproven.',
    '- Phase 1B remains unauthorized; product readiness remains NO.',
    '',
    `The regenerated canonical census is in [the R2N report](./${path.basename(outputPaths.markdown)}).`,
    '',
  ]
  return lines.join('\n')
}

function buildOutput(sourceData, r2eOutput) {
  const validation = validateRecordSet(sourceData.records, sourceData)
  const sourceCensus = r2eOutput.gate.phase
  const requiredOutput = {
    PHASE_1A_2B2_R2N_GATE: validation.gate,
    PHASE_1A_2B2_SOURCE_CENSUS: sourceCensus,
    TOTAL_EFFECT_CHAINS: validation.totalEffectChains,
    SERVER_TARGET_ENUM_VIOLATIONS: validation.enumViolations.serverTarget,
    PRIMARY_DATA_EFFECT_ENUM_VIOLATIONS: validation.enumViolations.primaryDataEffect,
    SECONDARY_DATA_EFFECT_ENUM_VIOLATIONS: validation.enumViolations.secondaryDataEffects,
    REQUEST_RESPONSE_ENUM_VIOLATIONS: validation.enumViolations.requestResponse,
    CONTROL_OBSERVATION_ENUM_VIOLATIONS: validation.enumViolations.controlObservations,
    SERVER_TARGET_COUNTS: validation.serverTargetCounts,
    SERVER_TARGET_SUM: Object.values(validation.serverTargetCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    PRIMARY_DATA_EFFECT_COUNTS: validation.primaryEffectCounts,
    PRIMARY_DATA_EFFECT_SUM: Object.values(validation.primaryEffectCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    UNKNOWN_SERVER_TARGET: validation.serverTargetCounts.UNKNOWN_SERVER_TARGET,
    UNKNOWN_SERVER_TARGET_CHAIN_IDS: validation.unknownServerTargetChainIds,
    UNKNOWN_DATA_EFFECT: validation.primaryEffectCounts.UNKNOWN_DATA_EFFECT,
    UNKNOWN_DATA_EFFECT_ENTRIES: validation.unknownDataEffectCount,
    UNKNOWN_DATA_EFFECT_CHAIN_IDS: validation.unknownDataEffectChainIds,
    SECONDARY_UNKNOWN_DATA_EFFECT_ENTRIES: validation.secondaryUnknownCount,
    STATIC_SERVER_TARGET_MODEL_COMPLETE:
      validation.serverTargetCounts.UNKNOWN_SERVER_TARGET === 0 ? 'YES' : 'NO',
    STATIC_DATA_EFFECT_MODEL_COMPLETE: validation.unknownDataEffectCount === 0 ? 'YES' : 'NO',
    STATIC_EFFECT_ASSURANCE_CEILING_REACHED: sourceCensus === 'SOURCE_CEILING' ? 'YES' : 'NO',
    RESIDUAL_EFFECT_OBLIGATIONS: r2eOutput.resultReport.residualUnknownChains,
    MISSING_ROUTE_CANDIDATES: validation.knownSourceDefects.missingRouteCandidates,
    METHOD_MISMATCH_CHAINS: validation.knownSourceDefects.methodMismatchChains,
    MISSING_IMPLEMENTATION: validation.knownSourceDefects.missingImplementation,
    STUB_OR_MOCK_EFFECT: validation.knownSourceDefects.stubOrMockEffect,
    FALSE_SUCCESS_SOURCE_CHAINS: validation.knownSourceDefects.falseSuccessSourceChains,
    AUTH_CHECK_NOT_OBSERVED: validation.controlNotObservedCounts.authCheckNotObserved,
    ROLE_CHECK_NOT_OBSERVED: validation.controlNotObservedCounts.roleCheckNotObserved,
    ORG_RESOLUTION_NOT_OBSERVED: validation.controlNotObservedCounts.orgResolutionNotObserved,
    RESOURCE_PERMISSION_CHECK_NOT_OBSERVED:
      validation.controlNotObservedCounts.resourcePermissionCheckNotObserved,
    AUDIT_WRITE_NOT_OBSERVED: validation.controlNotObservedCounts.auditWriteNotObserved,
    B1_TRACE_TERMINAL_UNPROVEN: validation.b1CarryForward.traceTerminalUnproven,
    B1_NO_IN_REPOSITORY_CALLER: validation.b1CarryForward.noInRepositoryCaller,
    B1_CARRY_FORWARD_TOTAL: validation.b1CarryForward.total,
  }
  const output = {
    metadata: {
      title: 'Phase 1A.2b2-R2N canonical effect normalization',
      version: 'R2N',
      scope:
        'Canonical enum normalization of the accepted 394-chain b2 census with the additive R2E existing-evidence adjudication layer. No new source tracing or product changes were performed.',
      generator: 'scripts/ue/normalize-effect-census.mjs',
      generatorCommand: 'node scripts/ue/normalize-effect-census.mjs',
      inputs: [
        '../PHASE_1A_2_SERVER_EFFECT_INDEX.json',
        'PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json',
        'PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json',
        'PHASE_1A_2B2_R2E_EXISTING_EVIDENCE_BACKFILL.json',
      ],
      primaryEnumsFrozen: true,
      normalizationTimestamp: '2026-10-08',
    },
    gate: {
      phase: validation.gate,
      sourceCensus,
      staticServerTargetModelComplete:
        validation.serverTargetCounts.UNKNOWN_SERVER_TARGET === 0 ? 'YES' : 'NO',
      staticDataEffectModelComplete: validation.unknownDataEffectCount === 0 ? 'YES' : 'NO',
      staticEffectAssuranceCeilingReached: sourceCensus === 'SOURCE_CEILING' ? 'YES' : 'NO',
      residualEffectObligations: r2eOutput.resultReport.residualUnknownChains,
      r1SourceWork: 'PRESERVED',
      r2SourceDispositions: 'PRESERVED',
      r2nCanonicalNormalization: validation.gate,
      knownSourceDefectsRemain:
        validation.knownSourceDefects.missingRouteCandidates +
          validation.knownSourceDefects.methodMismatchChains +
          validation.knownSourceDefects.missingImplementation +
          validation.knownSourceDefects.stubOrMockEffect >
        0
          ? 'YES'
          : 'NO',
      b1SourceCeilingBindings: validation.b1CarryForward.total,
      persistenceRuntimeProven: 'NO',
      authorizationProven: 'NO',
      organizationScopeProven: 'NO',
      auditProven: 'NO',
      runtimeProven: 'NO',
      phase1a2Final: 'NOT_YET_PROVEN',
      phase1b: 'NOT_AUTHORIZED',
      productReady: 'NO',
    },
    requiredOutput,
    enums: {
      serverTarget: SERVER_TARGET_ENUM,
      dataEffect: DATA_EFFECT_ENUM,
      requestResponseContract: REQUEST_RESPONSE_ENUM,
      controlObservation: CONTROL_ENUM,
      secondarySemanticEffects: [
        'SESSION_CREATED',
        'SESSION_TERMINATED',
        'COOKIE_SET',
        'COOKIE_CLEARED',
        'LOCAL_COMPUTATION',
        'AUDIT_ATTEMPT',
        'PROVIDER_ATTEMPT_NOT_SUCCESS_PROVEN',
      ],
    },
    normalizationConventions: [
      'Exactly one frozen server-target value and one frozen primary data-effect value are assigned to every census chain; composite R2 effect classes are decomposed into primary and secondary fields.',
      'A missing local route is MISSING_ROUTE_CANDIDATE with MISSING_IMPLEMENTATION. A route with an absent requested method remains LOCAL_NEXT_ROUTE with METHOD_MISMATCH and MISSING_IMPLEMENTATION.',
      'UNKNOWN_* is used where the accepted R1/R2 records do not establish one honest frozen classification; no source files were reopened to resolve those records.',
      'NO means no observation in the accepted bounded source evidence, not proof that a control is absent or incorrect. NOT_APPLICABLE is used when the target has no local route/method handler.',
      'Object-storage deletion is represented as OBJECT_STORAGE_WRITE, following the accepted convention because the frozen enum has no storage-delete value.',
      'HTTP request/response contracts are PARTIAL because a source request is inventoried but runtime responses are unobserved; non-HTTP records use UNKNOWN.',
      'R2E adjudications add only classifications supported by already-accepted R1/R2 evidence; unresolved effects remain UNKNOWN_DATA_EFFECT and establish a static-evidence ceiling.',
    ],
    existingEvidenceBackfill: {
      gate: sourceCensus,
      inputReport: r2eOutput.inputReport,
      resultReport: r2eOutput.resultReport,
      newApplicationSourceFilesRead: 0,
      newRouteImplementationsRead: 0,
      newServiceImplementationsRead: 0,
      newProviderImplementationsRead: 0,
    },
    validation: {
      totalEffectChains: validation.totalEffectChains,
      serverTargetEnumViolations: validation.enumViolations.serverTarget,
      primaryDataEffectEnumViolations: validation.enumViolations.primaryDataEffect,
      secondaryDataEffectEnumViolations: validation.enumViolations.secondaryDataEffects,
      requestResponseEnumViolations: validation.enumViolations.requestResponse,
      controlObservationEnumViolations: validation.enumViolations.controlObservations,
      serverTargetCounts: validation.serverTargetCounts,
      serverTargetSum: Object.values(validation.serverTargetCounts).reduce(
        (sum, count) => sum + count,
        0,
      ),
      primaryDataEffectCounts: validation.primaryEffectCounts,
      primaryDataEffectSum: Object.values(validation.primaryEffectCounts).reduce(
        (sum, count) => sum + count,
        0,
      ),
      primaryUnknownDataEffect: validation.primaryEffectCounts.UNKNOWN_DATA_EFFECT,
      secondaryUnknownDataEffectEntries: validation.secondaryUnknownCount,
      unknownServerTarget: validation.serverTargetCounts.UNKNOWN_SERVER_TARGET,
      unknownServerTargetChainIds: validation.unknownServerTargetChainIds,
      unknownDataEffect: validation.unknownDataEffectCount,
      unknownDataEffectChainIds: validation.unknownDataEffectChainIds,
      unknownDataEffectByEvidence: validation.unknownDataEffectByEvidence,
      controlObservationNotObserved: validation.controlNotObservedCounts,
      knownSourceDefects: validation.knownSourceDefects,
      b1CarryForward: validation.b1CarryForward,
      requiredChecks: validation.requiredChecks,
    },
    evidenceBoundary: {
      runtimeOutcomesObserved: 0,
      newApplicationSourceFilesRead: 0,
      newRouteImplementationsRead: 0,
      newServiceImplementationsRead: 0,
      newProviderImplementationsRead: 0,
      persistenceRuntimeProven: false,
      authorizationProven: false,
      organizationScopeProven: false,
      auditProven: false,
      productReadinessClaim: false,
    },
    canonicalRecords: sourceData.records,
  }
  return output
}

function buildMarkdown(output) {
  const report = output.validation
  const formatIdList = (ids) =>
    ids.length
      ? ids
          .reduce((groups, id, index) => {
            const groupIndex = Math.floor(index / 8)
            groups[groupIndex] ??= []
            groups[groupIndex].push(id)
            return groups
          }, [])
          .map((group) => `- ${group.join(', ')}`)
      : ['- none']
  const lines = [
    '# Phase 1A.2b2-R2N — canonical effect normalization',
    '',
    `**R2N gate: ${output.gate.phase}. Phase 1A.2b2 source census: ${output.gate.sourceCensus}.** This census adds the bounded R2E adjudication of accepted b2/R1/R2/R2N evidence; no new source tracing, product changes, runtime runs, or readiness claims were made.`,
    '',
    '## Required enum validation',
    '',
    '| Check | Result |',
    '|---|---:|',
    `| Total effect chains | ${report.totalEffectChains} |`,
    `| Server-target enum violations | ${report.serverTargetEnumViolations} |`,
    `| Primary data-effect enum violations | ${report.primaryDataEffectEnumViolations} |`,
    `| Secondary data-effect enum violations | ${report.secondaryDataEffectEnumViolations} |`,
    `| Request/response enum violations | ${report.requestResponseEnumViolations} |`,
    `| Control-observation enum violations | ${report.controlObservationEnumViolations} |`,
    `| Server-target arithmetic | ${report.serverTargetSum} |`,
    `| Primary data-effect arithmetic | ${report.primaryDataEffectSum} |`,
    `| Unknown server targets | ${report.unknownServerTarget} |`,
    `| Primary unknown data effects | ${report.primaryUnknownDataEffect} |`,
    `| Secondary unknown data-effect entries | ${report.secondaryUnknownDataEffectEntries} |`,
    `| Unknown data-effect entries (primary and secondary) | ${report.unknownDataEffect} |`,
    `| B1 carry-forward | ${report.b1CarryForward.total} (23 trace + 17 no-caller) |`,
    '',
    `R2E adjudicated ${output.existingEvidenceBackfill.inputReport.totalUnknownChains} existing unknown-effect chains: ${output.existingEvidenceBackfill.resultReport.evidenceSufficientChains} were resolved from accepted evidence and ${output.existingEvidenceBackfill.resultReport.residualUnknownChains} remain at the static evidence ceiling. See [the R2E backfill report](./${path.basename(outputPaths.r2eMarkdown)}).`,
    '',
    'The schema checks pass only when enum violations are zero. Unresolved classifications remain UNKNOWN_DATA_EFFECT; the R2N gate remains FAIL and the source census is SOURCE_CEILING.',
    '',
    'Regenerate the R2E and R2N JSON and Markdown, then run enum and gate validation with `node scripts/ue/normalize-effect-census.mjs`. The artifacts are written before a nonzero process status is returned for an R2N `FAIL` gate.',
    '',
    '## Server-target arithmetic',
    '',
    '| Canonical server target | Chains |',
    '|---|---:|',
    ...Object.entries(report.serverTargetCounts).map(
      ([target, count]) => `| \`${target}\` | ${count} |`,
    ),
    `| **SUM** | **${report.serverTargetSum}** |`,
    '',
    '## Primary data-effect arithmetic',
    '',
    '| Canonical primary effect | Chains |',
    '|---|---:|',
    ...Object.entries(report.primaryDataEffectCounts).map(
      ([effect, count]) => `| \`${effect}\` | ${count} |`,
    ),
    `| **SUM** | **${report.primaryDataEffectSum}** |`,
    '',
    '## Known source-defect inventory',
    '',
    '| Finding | Chains | Unique roots |',
    '|---|---:|---:|',
    `| Missing route candidates | ${report.knownSourceDefects.missingRouteCandidates} | ${report.knownSourceDefects.uniqueRootCauseCounts.missingRouteCandidates} |`,
    `| Method mismatch | ${report.knownSourceDefects.methodMismatchChains} | ${report.knownSourceDefects.uniqueRootCauseCounts.methodMismatchChains} |`,
    `| Missing implementation | ${report.knownSourceDefects.missingImplementation} | ${report.knownSourceDefects.uniqueRootCauseCounts.missingImplementation} |`,
    `| Stub/mock effect | ${report.knownSourceDefects.stubOrMockEffect} | ${report.knownSourceDefects.uniqueRootCauseCounts.stubOrMockEffect} |`,
    `| False-success source chains | ${report.knownSourceDefects.falseSuccessSourceChains} | ${report.knownSourceDefects.uniqueRootCauseCounts.falseSuccessSourceChains} |`,
    '',
    '## Phase 1B source-observation inventory',
    '',
    '| Control not observed in accepted bounded evidence | Chains |',
    '|---|---:|',
    `| Auth check | ${report.controlObservationNotObserved.authCheckNotObserved} |`,
    `| Role check | ${report.controlObservationNotObserved.roleCheckNotObserved} |`,
    `| Organization resolution | ${report.controlObservationNotObserved.orgResolutionNotObserved} |`,
    `| Resource permission check | ${report.controlObservationNotObserved.resourcePermissionCheckNotObserved} |`,
    `| Audit write | ${report.controlObservationNotObserved.auditWriteNotObserved} |`,
    '',
    'These values are source-observation counts only; they are not vulnerability or correctness conclusions.',
    '',
    '## Exact unresolved classifications',
    '',
    `Unknown server-target chains (${report.unknownServerTargetChainIds.length}):`,
    '',
    ...formatIdList(report.unknownServerTargetChainIds),
    '',
    `Unknown data-effect chains (${report.unknownDataEffectChainIds.length}); ${report.unknownDataEffectByEvidence.r1Only} are only granularly unresolved in R1, and ${report.unknownDataEffectByEvidence.r2Disposition} remain ambiguous in R2:`,
    '',
    ...formatIdList(report.unknownDataEffectChainIds),
    '',
    '## Preserved boundary',
    '',
    '- R1 source work and the accepted 394-chain denominator are preserved.',
    '- R2 source dispositions and the unchanged 40-item b1 ceiling are preserved.',
    '- Persistence, authorization, organization scope, audit, and runtime behavior remain unproven.',
    '- Phase 1A.2 final is not yet proven; Phase 1B remains unauthorized; product readiness is NO.',
    '',
    `The complete row-level census is in [the R2N JSON record](./${path.basename(outputPaths.json)}).`,
    '',
  ]
  return lines.join('\n')
}

const sourceData = mapInputs()
const r2e = buildR2e(sourceData)
if (
  r2e.output.resultReport.evidenceSufficientChains +
    r2e.output.resultReport.evidenceInsufficientChains !==
  EXPECTED_R2E_INPUT.totalUnknownChains
) {
  throw new Error('R2E adjudications do not account for every fixed-input unknown-effect chain.')
}
const output = buildOutput({ ...sourceData, records: r2e.records }, r2e.output)
const jsonConfig = (await resolveConfig(outputPaths.json)) ?? {}
const markdownConfig = (await resolveConfig(outputPaths.markdown)) ?? {}
const r2eJsonConfig = (await resolveConfig(outputPaths.r2eJson)) ?? {}
const r2eMarkdownConfig = (await resolveConfig(outputPaths.r2eMarkdown)) ?? {}
const formattedJson = await format(`${JSON.stringify(output, null, 2)}\n`, {
  ...jsonConfig,
  filepath: outputPaths.json,
})
const formattedMarkdown = await format(buildMarkdown(output), {
  ...markdownConfig,
  filepath: outputPaths.markdown,
})
const formattedR2eJson = await format(`${JSON.stringify(r2e.output, null, 2)}\n`, {
  ...r2eJsonConfig,
  filepath: outputPaths.r2eJson,
})
const formattedR2eMarkdown = await format(buildR2eMarkdown(r2e.output), {
  ...r2eMarkdownConfig,
  filepath: outputPaths.r2eMarkdown,
})
fs.writeFileSync(outputPaths.json, formattedJson, 'utf8')
fs.writeFileSync(outputPaths.markdown, formattedMarkdown, 'utf8')
fs.writeFileSync(outputPaths.r2eJson, formattedR2eJson, 'utf8')
fs.writeFileSync(outputPaths.r2eMarkdown, formattedR2eMarkdown, 'utf8')

console.log(
  JSON.stringify(
    {
      gate: output.gate.phase,
      sourceCensus: output.gate.sourceCensus,
      totalEffectChains: output.validation.totalEffectChains,
      enumViolations: {
        serverTarget: output.validation.serverTargetEnumViolations,
        primaryDataEffect: output.validation.primaryDataEffectEnumViolations,
        secondaryDataEffect: output.validation.secondaryDataEffectEnumViolations,
        requestResponse: output.validation.requestResponseEnumViolations,
        controlObservations: output.validation.controlObservationEnumViolations,
      },
      unknownServerTarget: output.validation.unknownServerTarget,
      unknownDataEffect: output.validation.unknownDataEffect,
      r2e: {
        gate: r2e.output.gate.phase,
        sufficient: r2e.output.resultReport.evidenceSufficientChains,
        insufficient: r2e.output.resultReport.evidenceInsufficientChains,
        residual: r2e.output.resultReport.residualUnknownChains,
      },
      json: path.relative(repoRoot, outputPaths.json),
      markdown: path.relative(repoRoot, outputPaths.markdown),
      r2eJson: path.relative(repoRoot, outputPaths.r2eJson),
      r2eMarkdown: path.relative(repoRoot, outputPaths.r2eMarkdown),
    },
    null,
    2,
  ),
)

if (output.gate.phase !== 'PASS') process.exitCode = 1
