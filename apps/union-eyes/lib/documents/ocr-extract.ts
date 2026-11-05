/**
 * Text extraction from document bytes. No authorization happens here: the caller must already hold a decision from
 * resolveOcrAuthority (lib/documents/ocr-authority.ts). The output is a machine extraction: untrusted, never document
 * content, and never evidence until a human reviews it and the publication contract is satisfied.
 */
import { processImageOCR, processPDFOCR } from '@/lib/services/ocr-service';
import { boundExtractedText, ocrDispatchKind } from '@/lib/documents/ocr-bytes';

export interface BytesExtraction {
  text: string;
  confidence: number;
  language: string;
  engine: string;
  engineVersion: string;
  metadata: Record<string, unknown>;
}

/** Pin the engine identity that appears in provenance. Bump when an engine's behaviour is intentionally changed. */
const ENGINE_VERSION = '1';

export async function extractTextFromBytes(
  buffer: Buffer,
  declaredMime: string,
  declaredFileType: string,
): Promise<BytesExtraction> {
  const kind = ocrDispatchKind(buffer, declaredMime, declaredFileType);
  let text = '';
  let confidence = 0;
  let engine: string;
  let metadata: Record<string, unknown> = {};

  if (kind === 'image') {
    const result = await processImageOCR(buffer);
    text = result.text;
    confidence = result.confidence;
    engine = 'image-ocr';
  } else if (kind === 'pdf') {
    const result = await processPDFOCR(buffer);
    text = result.fullText;
    confidence = result.pages.length > 0
      ? Math.round(result.pages.reduce((sum, page) => sum + page.confidence, 0) / result.pages.length)
      : 0;
    engine = 'pdf-ocr';
    metadata = { pages: result.pages.length };
  } else if (kind === 'text') {
    text = buffer.toString('utf8');
    confidence = 100;
    engine = 'text-decode';
  } else {
    throw new Error('OCR_UNSUPPORTED');
  }

  const bounded = boundExtractedText(text);
  return {
    text: bounded.text,
    confidence,
    language: 'en',
    engine,
    engineVersion: ENGINE_VERSION,
    metadata: { ...metadata, truncated: bounded.truncated },
  };
}
