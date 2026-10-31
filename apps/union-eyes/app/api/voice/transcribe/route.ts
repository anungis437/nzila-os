import { NextResponse } from "next/server";
import { isSupportedLanguage, transcribeAudioWithLanguage, type SupportedLanguage } from "@/lib/azure-speech";
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { checkVoiceDisclosure } from '@/lib/voice/disclosure-consent';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const runtime = "nodejs";
export const maxDuration = 60; // Maximum duration in seconds

export const POST = withRoleAuth('steward', async (request, context) => {
  try {
      const { userId, organizationId } = context as { userId?: string; organizationId?: string };
      if (!userId || !organizationId) {
        return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
      }

      // The recording goes to an external speech service, so each caller's use is bounded.
      const limit = await checkRateLimit(`voice-transcribe:${userId}`, RATE_LIMITS.AI_COMPLETION);
      if (!limit.allowed) {
        return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { resetIn: limit.resetIn });
      }

      // Parse form data
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File;
      const requestedLanguage = formData.get("language");
      const language: SupportedLanguage =
        typeof requestedLanguage === "string" && isSupportedLanguage(requestedLanguage)
          ? requestedLanguage
          : "en-CA";

      if (!audioFile) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Audio file is required');
      }

      // Validate file type
      const validTypes = ["audio/wav", "audio/webm", "audio/ogg", "audio/mp3", "audio/mpeg"];
      if (!validTypes.includes(audioFile.type)) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid audio file type');
      }

      // Validate file size (max 25MB)
      const maxSize = 25 * 1024 * 1024;
      if (audioFile.size > maxSize) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Audio file too large (max 25MB)');
      }

      const disclosure = checkVoiceDisclosure(formData);
      if (!disclosure.allowed) {
        return NextResponse.json({ error: disclosure.error }, { status: disclosure.status });
      }

      // The disclosure to the external service is recorded before the audio leaves; no transcript or audio is kept in the record.
      await withRLSContext({ organizationId, userId }, (tx) => persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'voice.transcribe.disclosure_acknowledged',
        resourceType: 'voice_recording',
        resourceId: userId,
        details: {
          language,
          bytes: audioFile.size,
          contentType: audioFile.type,
          noticeVersion: disclosure.notice.version,
          approvalReference: disclosure.notice.approvalReference,
          provider: disclosure.notice.provider,
          participantPermissionAsserted: true,
        },
      }));

      // Convert file to buffer
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Transcribe audio
      const text = await transcribeAudioWithLanguage(buffer, language);

      if (!text || text.trim().length === 0) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Transcription returned empty result');
      }

      return NextResponse.json({
        text: text.trim(),
        language,
        // Duration is not returned: the speech adapter provides text, not measured seconds.\n        // Audio byte length is not elapsed recording time.
        success: true,
      });

    } catch (_error) {
return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Transcription failed');
    }
});

