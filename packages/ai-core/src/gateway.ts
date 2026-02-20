/**
 * @nzila/ai-core — AI Gateway
 *
 * Central routing engine: resolves capability profiles, enforces policy,
 * applies redaction, checks budgets, calls provider, logs everything.
 */
import { db } from '@nzila/db'
import { aiCapabilityProfiles, aiDeploymentRoutes, aiDeployments, aiModels } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAiEnv } from '@nzila/os-core/ai-env'
import { createAzureOpenAIProvider } from './providers/azure-openai'
import { createOpenAIProvider } from './providers/openai'
import { createAnthropicProvider } from './providers/anthropic'
import { redactText } from './redact'
import { checkBudget, recordSpend } from './budgets'
import { logAiRequest, sha256, appendAiAuditEvent } from './logging'
import { resolvePrompt } from './prompts'
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiEmbedRequest,
  AiEmbedResponse,
  AiStreamChunk,
  ChatMessage,
  ResolvedCapabilityProfile,
  AiProviderClient,
  AiControlPlaneError,
  AiFeature,
  AiProvider,
  DataClass,
  RedactionMode,
} from './types'
import { AiControlPlaneError as AiError } from './types'

// ── Provider registry ───────────────────────────────────────────────────────

const providers = new Map<string, AiProviderClient>()

function getProvider(providerKey: string): AiProviderClient {
  if (providers.has(providerKey)) return providers.get(providerKey)!

  if (providerKey === 'azure_openai') {
    const client = createAzureOpenAIProvider()
    providers.set(providerKey, client)
    return client
  }

  if (providerKey === 'openai') {
    const client = createOpenAIProvider()
    providers.set(providerKey, client)
    return client
  }

  if (providerKey === 'anthropic') {
    const client = createAnthropicProvider()
    providers.set(providerKey, client)
    return client
  }

  throw new AiError('provider_error', `Unknown provider: ${providerKey}`)
}

// ── Resolve capability profile ──────────────────────────────────────────────

export async function resolveProfile(opts: {
  entityId: string
  appKey: string
  profileKey: string
}): Promise<ResolvedCapabilityProfile> {
  const env = getAiEnv()
  const environment = (process.env.NODE_ENV === 'production' ? 'prod' : 'dev') as 'dev' | 'staging' | 'prod'

  const [row] = await db
    .select()
    .from(aiCapabilityProfiles)
    .where(
      and(
        eq(aiCapabilityProfiles.entityId, opts.entityId),
        eq(aiCapabilityProfiles.appKey, opts.appKey),
        eq(aiCapabilityProfiles.environment, environment),
        eq(aiCapabilityProfiles.profileKey, opts.profileKey),
      ),
    )
    .limit(1)

  if (!row) {
    throw new AiError(
      'profile_not_found',
      `Capability profile not found: ${opts.appKey}/${opts.profileKey} (env=${environment})`,
      404,
    )
  }

  if (!row.enabled) {
    throw new AiError('profile_disabled', `Capability profile is disabled: ${opts.profileKey}`)
  }

  return {
    id: row.id,
    entityId: row.entityId,
    appKey: row.appKey,
    environment: row.environment,
    profileKey: row.profileKey,
    enabled: row.enabled,
    allowedProviders: (row.allowedProviders ?? ['azure_openai']) as ResolvedCapabilityProfile['allowedProviders'],
    allowedModels: (row.allowedModels ?? []) as string[],
    modalities: (row.modalities ?? ['text']) as ResolvedCapabilityProfile['modalities'],
    features: (row.features ?? []) as ResolvedCapabilityProfile['features'],
    dataClassesAllowed: (row.dataClassesAllowed ?? ['public', 'internal']) as DataClass[],
    streamingAllowed: row.streamingAllowed,
    determinismRequired: row.determinismRequired,
    retentionDays: row.retentionDays,
    toolPermissions: (row.toolPermissions ?? []) as string[],
    budgets: (row.budgets ?? {}) as ResolvedCapabilityProfile['budgets'],
    redactionMode: row.redactionMode as RedactionMode,
  }
}

// ── Deployment route resolution (DB-backed model registry) ─────────────────

export interface ResolvedDeployment {
  deploymentName: string
  modelFamily: string
  modality: 'text' | 'embeddings'
  provider: AiProvider
  maxTokens: number
  defaultTemperature: number
  costProfile: { costPerKIn?: number; costPerKOut?: number }
}

/**
 * Resolve deployment via aiDeploymentRoutes → aiDeployments → aiModels.
 * Falls back to env vars if no route is configured (backward-compatible).
 */
export async function resolveDeployment(opts: {
  entityId: string
  appKey: string
  profileKey: string
  feature: 'chat' | 'generate' | 'embed' | 'rag' | 'extract'
}): Promise<ResolvedDeployment | null> {
  const environment = (process.env.NODE_ENV === 'production' ? 'prod' : 'dev') as 'dev' | 'staging' | 'prod'

  const [route] = await db
    .select({
      deploymentName: aiDeployments.deploymentName,
      maxTokens: aiDeployments.maxTokens,
      defaultTemperature: aiDeployments.defaultTemperature,
      costProfile: aiDeployments.costProfile,
      enabled: aiDeployments.enabled,
      modelFamily: aiModels.family,
      modality: aiModels.modality,
      provider: aiModels.provider,
    })
    .from(aiDeploymentRoutes)
    .innerJoin(aiDeployments, eq(aiDeploymentRoutes.deploymentId, aiDeployments.id))
    .innerJoin(aiModels, eq(aiDeployments.modelId, aiModels.id))
    .where(
      and(
        eq(aiDeploymentRoutes.entityId, opts.entityId),
        eq(aiDeploymentRoutes.appKey, opts.appKey),
        eq(aiDeploymentRoutes.profileKey, opts.profileKey),
        eq(aiDeploymentRoutes.feature, opts.feature),
        eq(aiDeployments.environment, environment),
        eq(aiDeployments.enabled, true),
      ),
    )
    .limit(1)

  if (!route) return null

  return {
    deploymentName: route.deploymentName,
    modelFamily: route.modelFamily,
    modality: route.modality,
    provider: route.provider as AiProvider,
    maxTokens: route.maxTokens,
    defaultTemperature: Number(route.defaultTemperature),
    costProfile: (route.costProfile ?? {}) as ResolvedDeployment['costProfile'],
  }
}

// ── Policy enforcement ──────────────────────────────────────────────────────

function enforcePolicy(
  profile: ResolvedCapabilityProfile,
  feature: AiFeature,
  dataClass: DataClass,
  opts?: { streaming?: boolean; requiredModality?: 'text' | 'embeddings' },
): void {
  // 1. Feature check
  if (!profile.features.includes(feature)) {
    throw new AiError(
      'feature_not_allowed',
      `Feature "${feature}" not allowed for profile ${profile.profileKey}`,
      403,
    )
  }

  // 2. Modality check
  if (opts?.requiredModality && !profile.modalities.includes(opts.requiredModality)) {
    throw new AiError(
      'modality_not_allowed',
      `Modality "${opts.requiredModality}" not allowed for profile ${profile.profileKey}`,
      403,
    )
  }

  // 3. Data class check
  if (!profile.dataClassesAllowed.includes(dataClass)) {
    throw new AiError(
      'data_class_not_allowed',
      `Data class "${dataClass}" not allowed for profile ${profile.profileKey}`,
      403,
    )
  }

  // 4. Streaming check
  if (opts?.streaming && !profile.streamingAllowed) {
    throw new AiError(
      'streaming_not_allowed',
      `Streaming not allowed for profile ${profile.profileKey}`,
      403,
    )
  }

  // 5. Tool permissions check (for actions_propose feature)
  if (feature === 'actions_propose' && profile.toolPermissions.length === 0) {
    throw new AiError(
      'policy_denied',
      `No tool permissions configured for profile ${profile.profileKey} — actions blocked`,
      403,
    )
  }
}

/**
 * Resolve per-feature maxTokens override from profile budgets.
 * Profile budgets JSON may contain: { perFeatureMaxTokens: { "generate": 2000, "chat": 4000 } }
 */
function getFeatureMaxTokens(profile: ResolvedCapabilityProfile, feature: AiFeature): number | undefined {
  const budgets = profile.budgets as Record<string, unknown>
  const perFeature = budgets?.perFeatureMaxTokens as Record<string, number> | undefined
  return perFeature?.[feature]
}

// ── Generate (non-stream) ───────────────────────────────────────────────────

export async function generate(req: AiGenerateRequest): Promise<AiGenerateResponse> {
  const env = getAiEnv()
  const profile = await resolveProfile(req)

  // 1. Policy check (enforce text modality for generate)
  enforcePolicy(profile, 'generate', req.dataClass, { requiredModality: 'text' })

  // 2. Budget check
  await checkBudget({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
  })

  // 3. Build messages
  let messages: ChatMessage[] = []
  let promptVersionId: string | undefined

  if (req.promptKey) {
    const resolved = await resolvePrompt({
      appKey: req.appKey,
      promptKey: req.promptKey,
      variables: req.variables,
    })
    if (resolved) {
      messages = resolved.messages
      promptVersionId = resolved.versionId
    }
  }

  if (messages.length === 0) {
    // Direct input
    if (typeof req.input === 'string') {
      messages = [{ role: 'user', content: req.input }]
    } else if (Array.isArray(req.input)) {
      messages = req.input
    }
  }

  // 4. Redaction
  let inputRedacted = false
  const redactionResult = messages.map((m) => {
    const r = redactText(m.content, profile.redactionMode)
    if (r.redacted) inputRedacted = true
    return { ...m, content: r.text }
  })
  messages = redactionResult

  // 5. Select provider + model via deployment route (DB-backed registry)
  const deployment = await resolveDeployment({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
    feature: 'generate',
  })

  const providerKey = deployment?.provider ?? profile.allowedProviders[0] ?? env.AI_DEFAULT_PROVIDER
  const provider = getProvider(providerKey)
  const model = deployment?.deploymentName ?? profile.allowedModels[0] ?? env.AZURE_OPENAI_DEPLOYMENT_TEXT ?? env.OPENAI_MODEL_TEXT ?? env.ANTHROPIC_MODEL_TEXT ?? 'gpt-4o'
  const temperature = profile.determinismRequired
    ? 0
    : req.params?.temperature ?? deployment?.defaultTemperature ?? env.AI_TEMPERATURE_DEFAULT
  const featureMaxTokens = getFeatureMaxTokens(profile, 'generate')
  const maxTokens = featureMaxTokens ?? req.params?.maxTokens ?? deployment?.maxTokens ?? env.AI_MAX_TOKENS_DEFAULT

  // 6. Call provider
  const startTime = Date.now()
  const result = await provider.generate({
    messages,
    model,
    temperature,
    maxTokens,
    topP: req.params?.topP,
  })
  const latencyMs = Date.now() - startTime

  // 7. Estimate cost (simplified: Azure GPT-4o pricing approximation)
  const costUsd = estimateCost(result.tokensIn, result.tokensOut)

  // 8. Log request
  const logged = await logAiRequest({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
    feature: 'generate',
    promptVersionId,
    provider: providerKey,
    modelOrDeployment: model,
    requestBody: { messages, params: { temperature, maxTokens } },
    responseBody: { content: result.content },
    inputRedacted,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd,
    latencyMs,
    status: 'success',
    createdBy: null, // set by API route
    dataClass: req.dataClass,
    trace: req.trace,
  })

  // 9. Record spend
  if (costUsd) {
    await recordSpend({
      entityId: req.entityId,
      appKey: req.appKey,
      profileKey: req.profileKey,
      costUsd,
    })
  }

  return {
    requestId: logged.requestId,
    content: result.content,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd,
    latencyMs,
    model: result.model,
    provider: providerKey,
  }
}

// ── Chat (non-stream) ───────────────────────────────────────────────────────

export async function chat(req: AiGenerateRequest): Promise<AiGenerateResponse> {
  // Same as generate but enforces 'chat' feature
  const profile = await resolveProfile(req)
  enforcePolicy(profile, 'chat', req.dataClass, { requiredModality: 'text' })

  // Delegate to generate logic with 'chat' feature
  return generate({ ...req })
}

// ── Chat Stream ─────────────────────────────────────────────────────────────

export async function* chatStream(
  req: AiGenerateRequest,
): AsyncIterable<AiStreamChunk> {
  const env = getAiEnv()
  const profile = await resolveProfile(req)

  enforcePolicy(profile, 'chat', req.dataClass, { streaming: true, requiredModality: 'text' })
  await checkBudget({ entityId: req.entityId, appKey: req.appKey, profileKey: req.profileKey })

  // Build messages
  let messages: ChatMessage[] = []
  let promptVersionId: string | undefined

  if (req.promptKey) {
    const resolved = await resolvePrompt({
      appKey: req.appKey,
      promptKey: req.promptKey,
      variables: req.variables,
    })
    if (resolved) {
      messages = resolved.messages
      promptVersionId = resolved.versionId
    }
  }

  if (messages.length === 0) {
    if (typeof req.input === 'string') {
      messages = [{ role: 'user', content: req.input }]
    } else if (Array.isArray(req.input)) {
      messages = req.input
    }
  }

  // Redaction
  let inputRedacted = false
  messages = messages.map((m) => {
    const r = redactText(m.content, profile.redactionMode)
    if (r.redacted) inputRedacted = true
    return { ...m, content: r.text }
  })

  const chatDeployment = await resolveDeployment({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
    feature: 'chat',
  })

  const providerKey = chatDeployment?.provider ?? profile.allowedProviders[0] ?? env.AI_DEFAULT_PROVIDER
  const provider = getProvider(providerKey)
  const model = chatDeployment?.deploymentName ?? profile.allowedModels[0] ?? env.AZURE_OPENAI_DEPLOYMENT_TEXT ?? env.OPENAI_MODEL_TEXT ?? env.ANTHROPIC_MODEL_TEXT ?? 'gpt-4o'
  const temperature = profile.determinismRequired
    ? 0
    : req.params?.temperature ?? chatDeployment?.defaultTemperature ?? env.AI_TEMPERATURE_DEFAULT
  const chatFeatureMaxTokens = getFeatureMaxTokens(profile, 'chat')
  const maxTokens = chatFeatureMaxTokens ?? req.params?.maxTokens ?? chatDeployment?.maxTokens ?? env.AI_MAX_TOKENS_DEFAULT

  const startTime = Date.now()
  let fullContent = ''

  for await (const chunk of provider.generateStream({
    messages,
    model,
    temperature,
    maxTokens,
    topP: req.params?.topP,
  })) {
    fullContent += chunk.delta
    yield chunk
  }

  const latencyMs = Date.now() - startTime

  // Approximate token counts from content length
  const approxTokensIn = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
  const approxTokensOut = Math.ceil(fullContent.length / 4)
  const costUsd = estimateCost(approxTokensIn, approxTokensOut)

  // Log after stream completes
  await logAiRequest({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
    feature: 'chat',
    promptVersionId,
    provider: providerKey,
    modelOrDeployment: model,
    requestBody: { messages, params: { temperature, maxTokens }, streaming: true },
    responseBody: { content: fullContent },
    inputRedacted,
    tokensIn: approxTokensIn,
    tokensOut: approxTokensOut,
    costUsd,
    latencyMs,
    status: 'success',
    createdBy: null,
    dataClass: req.dataClass,
    trace: req.trace,
  })

  if (costUsd) {
    await recordSpend({
      entityId: req.entityId,
      appKey: req.appKey,
      profileKey: req.profileKey,
      costUsd,
    })
  }
}

// ── Embed ───────────────────────────────────────────────────────────────────

export async function embed(req: AiEmbedRequest): Promise<AiEmbedResponse> {
  const env = getAiEnv()
  const profile = await resolveProfile({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
  })

  if (!profile.modalities.includes('embeddings')) {
    throw new AiError('modality_not_allowed', 'Embeddings modality not allowed for this profile', 403)
  }

  enforcePolicy(profile, 'embed', req.dataClass, { requiredModality: 'embeddings' })
  await checkBudget({ entityId: req.entityId, appKey: req.appKey, profileKey: req.profileKey })

  const embedDeployment = await resolveDeployment({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
    feature: 'embed',
  })

  const providerKey = embedDeployment?.provider ?? profile.allowedProviders[0] ?? env.AI_DEFAULT_PROVIDER
  const provider = getProvider(providerKey)
  const model = embedDeployment?.deploymentName ?? env.AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS ?? env.OPENAI_MODEL_EMBEDDINGS ?? 'text-embedding-3-small'

  const input = typeof req.input === 'string' ? [req.input] : req.input

  const startTime = Date.now()
  const result = await provider.embed({ input, model })
  const latencyMs = Date.now() - startTime

  const costUsd = result.tokensUsed * 0.0000001 // ada-002 approx pricing

  const logged = await logAiRequest({
    entityId: req.entityId,
    appKey: req.appKey,
    profileKey: req.profileKey,
    feature: 'embed',
    provider: providerKey,
    modelOrDeployment: model,
    requestBody: { input },
    responseBody: { embeddingCount: result.embeddings.length },
    inputRedacted: false,
    tokensIn: result.tokensUsed,
    tokensOut: 0,
    costUsd,
    latencyMs,
    status: 'success',
    createdBy: null,
    dataClass: req.dataClass,
  })

  if (costUsd) {
    await recordSpend({ entityId: req.entityId, appKey: req.appKey, profileKey: req.profileKey, costUsd })
  }

  return {
    requestId: logged.requestId,
    embeddings: result.embeddings,
    model: result.model,
    tokensUsed: result.tokensUsed,
  }
}

// ── Cost estimation ─────────────────────────────────────────────────────────

function estimateCost(tokensIn: number, tokensOut: number): number {
  // Approximate pricing per 1K tokens (GPT-4o)
  const costPerKIn = 0.005
  const costPerKOut = 0.015
  return (tokensIn / 1000) * costPerKIn + (tokensOut / 1000) * costPerKOut
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export { resolvePrompt } from './prompts'
export { checkBudget, recordSpend, ensureBudgetRow } from './budgets'
export { logAiRequest, appendAiAuditEvent } from './logging'
export { redactText } from './redact'
