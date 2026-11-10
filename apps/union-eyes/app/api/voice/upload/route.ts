/**
 * /api/voice/upload — Voice file upload + transcription
 *
 * POST: Accept an audio file (multipart/form-data), transcribe it
 *       via Azure OpenAI Whisper, and optionally summarize the transcript.
 *
 * Supported formats: wav, mp3, m4a, webm, ogg, flac (≤ 25 MB).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { logger } from '@/lib/logger';
import { checkVoiceDisclosure } from '@/lib/voice/disclosure-consent';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import {
  finalizeVoiceUsage,
  reserveVoiceUsage,
  voiceReservationCreditsForBytes,
} from '@/lib/voice/usage-reservation';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav', 'audio/x-wav',
  'audio/mpeg', 'audio/mp3',
  'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper API limit)

export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  const userId = context.userId;
  const organizationId = context.organizationId;
  if (!userId || !organizationId) {
    return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
  }
  // Rate limit
  const rateLimitResult = await checkRateLimit(
    `ai-completion:${context.userId}`,
    RATE_LIMITS.AI_COMPLETION,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded for AI operations. Please try again later.' },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) },
    );
  }

  const intentKey = request.headers.get('idempotency-key');
  if (!intentKey || !/^[A-Za-z0-9:_-]{16,128}$/.test(intentKey)) {
    return NextResponse.json({ error: 'A valid Idempotency-Key header is required' }, { status: 422 });
  }

  // Dedicated voice entitlement; AI search access is not voice authority.
  const entitlement = await checkEntitlement(context.organizationId as string, 'voice_transcription');
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason, upgradeUrl: entitlement.upgradeUrl, feature: 'voice_upload' },
      { status: 403 },
    );
  }

  let reservationId: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const language = (formData.get('language') as string) || undefined;

    if (!file) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'No file provided. Send an audio file as multipart form field "file".');
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Unsupported audio format: ${file.type}. Supported: wav, mp3, m4a, webm, ogg, flac.`,
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 25 MB.`,
      );
    }

    const disclosure = checkVoiceDisclosure(formData);
    if (!disclosure.allowed) {
      return NextResponse.json({ error: disclosure.error }, { status: disclosure.status });
    }

    // Check for Azure OpenAI Whisper endpoint (may be in a separate region)
    const endpoint = process.env.AZURE_OPENAI_WHISPER_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_WHISPER_API_KEY || process.env.AZURE_OPENAI_API_KEY;
    const whisperDeployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';

    if (!endpoint || !apiKey) {
      return NextResponse.json(
        { error: 'Voice transcription is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.' },
        { status: 503 },
      );
    }

    const reservedCredits = voiceReservationCreditsForBytes(file.size);
    const reserved = await withRLSContext({ organizationId, userId }, async (tx) => {
      const result = await reserveVoiceUsage(tx, {
        organizationId,
        userId,
        intentKey,
        credits: reservedCredits,
        monthlyLimit: entitlement.tier === 'enterprise' ? null : (entitlement.currentCredits ?? 0),
      });
      if (result.replay) return result;
      // A failed audit rolls the reservation back and prevents disclosure.
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'voice.usage.reserved',
        resourceType: 'voice_usage_reservation',
        resourceId: result.reservation.id,
        details: {
          noticeVersion: disclosure.notice.version,
          approvalReference: disclosure.notice.approvalReference,
          provider: disclosure.notice.provider,
          participantPermissionAsserted: true,
          reservedCredits,
          bytes: file.size,
          contentType: file.type,
        },
      });
      return result;
    });
    if (reserved.replay) {
      return NextResponse.json({ error: 'This voice intent was already used', status: reserved.reservation.status }, { status: 409 });
    }
    reservationId = reserved.reservation.id;

    // Call Azure OpenAI Whisper API
    const whisperUrl = `${endpoint}/openai/deployments/${whisperDeployment}/audio/transcriptions?api-version=2024-06-01`;

    const whisperForm = new FormData();
    whisperForm.append('file', file, file.name);
    whisperForm.append('response_format', 'verbose_json');
    if (language) {
      whisperForm.append('language', language);
    }

    const startMs = Date.now();
    const whisperResponse = await fetch(whisperUrl, {
      method: 'POST',
      headers: { 'api-key': apiKey },
      body: whisperForm,
    });

    const latencyMs = Date.now() - startMs;

    if (!whisperResponse.ok) {
      // Provider error bodies may contain sensitive audio/transcription diagnostics.
      logger.error('Whisper transcription failed', { status: whisperResponse.status });
      const definitive = whisperResponse.status >= 400 && whisperResponse.status < 500 && ![408, 409, 425, 429].includes(whisperResponse.status);
      await withRLSContext({ organizationId, userId }, async (tx) => {
        await finalizeVoiceUsage(tx, {
          organizationId,
          reservationId: reserved.reservation.id,
          status: definitive ? 'released' : 'held',
          providerReference: whisperResponse.headers.get('x-request-id') ?? undefined,
          reason: definitive ? `provider_refused_${whisperResponse.status}` : `provider_outcome_ambiguous_${whisperResponse.status}`,
        });
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: definitive ? 'voice.usage.released' : 'voice.usage.held',
          resourceType: 'voice_usage_reservation',
          resourceId: reserved.reservation.id,
          details: { providerStatus: whisperResponse.status },
        });
      });
      return NextResponse.json(
        { error: 'Transcription failed', details: whisperResponse.status === 404 ? 'Whisper deployment not found. Set AZURE_OPENAI_WHISPER_DEPLOYMENT.' : undefined },
        { status: 502 },
      );
    }

    const transcription = await whisperResponse.json() as {
      text: string;
      language?: string;
      duration?: number;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    await withRLSContext({ organizationId, userId }, async (tx) => {
      const finalized = await finalizeVoiceUsage(tx, {
        organizationId,
        reservationId: reserved.reservation.id,
        status: 'settled',
        actualSeconds: transcription.duration ?? 0,
        providerReference: whisperResponse.headers.get('x-request-id') ?? undefined,
        reason: 'provider_success',
      });
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: finalized?.status === 'settled' ? 'voice.usage.settled' : 'voice.usage.held',
        resourceType: 'voice_usage_reservation',
        resourceId: reserved.reservation.id,
        details: { durationSeconds: transcription.duration ?? null },
      });
    });

    return NextResponse.json({
      transcript: transcription.text,
      language: transcription.language ?? language ?? 'en',
      duration_seconds: transcription.duration ?? null,
      segments: transcription.segments ?? [],
      file_name: file.name,
      file_size_bytes: file.size,
      latency_ms: latencyMs,
    });
  } catch (error) {
    if (reservationId) {
      await withRLSContext({ organizationId, userId }, async (tx) => {
        const held = await finalizeVoiceUsage(tx, {
          organizationId,
          reservationId: reservationId!,
          status: 'held',
          reason: 'provider_outcome_unknown',
        });
        if (held) {
          await persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'voice.usage.held',
            resourceType: 'voice_usage_reservation',
            resourceId: reservationId!,
            details: { reason: 'provider_outcome_unknown' },
          });
        }
      }).catch((holdError) => logger.error('Voice usage hold failed', { error: holdError }));
    }
    if (error instanceof Error && error.message === 'VOICE_CREDITS_EXHAUSTED') {
      return NextResponse.json({ error: 'Insufficient voice transcription credits' }, { status: 402 });
    }
    logger.error('Voice upload failed', { error });
    return NextResponse.json({ error: 'Voice upload and transcription failed' }, { status: 500 });
  }
});
