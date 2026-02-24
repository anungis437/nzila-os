import { NextResponse } from "next/server";
import { transcribeAudioWithLanguage, type SupportedLanguage } from "@/lib/azure-speech";
import { withRoleAuth } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const runtime = "nodejs";
export const maxDuration = 60; // Maximum duration in seconds

export const POST = withRoleAuth('steward', async (request, _context) => {
  try {
      // Authenticate user
      // Parse form data
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File;
      const language = (formData.get("language") as SupportedLanguage) || "en-CA";

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
        duration: audioFile.size, // Approximate
        success: true,
      });

    } catch (_error) {
return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Transcription failed');
    }
});

