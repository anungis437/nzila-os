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

  // Entitlement
  const entitlement = await checkEntitlement(context.organizationId as string, 'ai_search');
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason, upgradeUrl: entitlement.upgradeUrl, feature: 'voice_upload' },
      { status: 403 },
    );
  }

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
      const errBody = await whisperResponse.text();
      logger.error('Whisper transcription failed', {
        status: whisperResponse.status,
        body: errBody,
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
    logger.error('Voice upload failed', { error });
    return NextResponse.json({ error: 'Voice upload and transcription failed' }, { status: 500 });
  }
});
