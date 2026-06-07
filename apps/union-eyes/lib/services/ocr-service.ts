/**
 * OCR Service Integration
 * 
 * Provides OCR processing capabilities using:
 * - Tesseract.js for client-side OCR
 * - AWS Textract integration (optional)
 * - Google Cloud Vision API integration (optional)
 * - Azure Computer Vision integration (optional)
 * - Confidence scoring
 * - Multi-language support
 * - Image preprocessing
 * - Text extraction and formatting
 * 
 * @module lib/services/ocr-service
 */

import { createWorker } from "tesseract.js";
import { logger } from "@/lib/logger";

interface ProgressMessage {
  status?: string;
  progress?: number;
}

interface OCRWordData {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface OCRLineData {
  text: string;
  confidence: number;
  words: OCRWordData[];
}

interface TextractLineBlock {
  BlockType?: string;
  Text?: string;
  Confidence?: number;
}

interface GoogleVisionVertex {
  x?: number;
  y?: number;
}

interface _GoogleVisionDetection {
  description?: string;
  boundingPoly?: {
    vertices?: GoogleVisionVertex[];
  };
}

interface AzureReadWord {
  text?: string;
}

interface AzureReadLine {
  text?: string;
  confidence?: number;
  words?: AzureReadWord[];
}

interface AzureReadPage {
  lines?: AzureReadLine[];
}

type PdfParseResult = { text?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  return isRecord(error) ? readString(error.code) : undefined;
}

function toOCRWord(value: unknown): OCRWordData {
  const record = isRecord(value) ? value : {};
  const bboxRecord = isRecord(record.bbox) ? record.bbox : {};

  return {
    text: readString(record.text) ?? "",
    confidence: readNumber(record.confidence) ?? 0,
    bbox: {
      x0: readNumber(bboxRecord.x0) ?? 0,
      y0: readNumber(bboxRecord.y0) ?? 0,
      x1: readNumber(bboxRecord.x1) ?? 0,
      y1: readNumber(bboxRecord.y1) ?? 0,
    },
  };
}

function toOCRLine(value: unknown): OCRLineData {
  const record = isRecord(value) ? value : {};
  const words = Array.isArray(record.words) ? record.words.map(toOCRWord) : [];

  return {
    text: readString(record.text) ?? "",
    confidence: readNumber(record.confidence) ?? 0,
    words,
  };
}

function toProgressMessage(value: unknown): ProgressMessage {
  return isRecord(value)
    ? {
        status: readString(value.status),
        progress: readNumber(value.progress),
      }
    : {};
}

export interface OCRResult {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  lines?: Array<{
    text: string;
    confidence: number;
    words: string[];
  }>;
}

export interface OCROptions {
  language?: string;
  tesseractPath?: string;
  provider?: "tesseract" | "aws-textract" | "google-vision" | "azure";
  preprocessImage?: boolean;
}

async function importOptionalModule<T>(moduleName: string, timeoutMs = 1000): Promise<T> {
  try {
    return await Promise.race([
      import(moduleName) as Promise<T>,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out importing optional module: ${moduleName}`)), timeoutMs);
      }),
    ]);
  } catch {
    throw new Error(`${moduleName} is not available`);
  }
}

/**
 * Process image for OCR using Tesseract.js
 * This is the default provider and works client-side or server-side
 */
export async function processImageOCR(
  imageBuffer: Buffer | string,
  options: OCROptions = {}
): Promise<OCRResult> {
  const {
    language = "eng",
    provider = "tesseract",
  } = options;

  switch (provider) {
    case "tesseract":
      return processTesseractOCR(imageBuffer, language);
    case "aws-textract":
      return processAWSTextractOCR(imageBuffer);
    case "google-vision":
      return processGoogleVisionOCR(imageBuffer);
    case "azure":
      return processAzureOCR(imageBuffer);
    default:
      return processTesseractOCR(imageBuffer, language);
  }
}

/**
 * Tesseract.js OCR processing
 */
async function processTesseractOCR(
  imageBuffer: Buffer | string,
  language: string
): Promise<OCRResult> {
  const worker = await createWorker(language, 1, {
    logger: (m: unknown) => {
      const message = toProgressMessage(m);
      if (message.status === "recognizing text") {
        logger.debug("OCR progress", { percent: Math.round((message.progress ?? 0) * 100) });
      }
    },
  });

  try {
    const { data } = await worker.recognize(imageBuffer);
    const dataRecord: Record<string, unknown> = isRecord(data) ? data : {};
    const rawWords = Array.isArray(dataRecord.words) ? dataRecord.words : [];
    const rawLines = Array.isArray(dataRecord.lines) ? dataRecord.lines : [];

    const words = rawWords.map(toOCRWord);
    const lines = rawLines
      .map((line: unknown) => {
          const normalizedLine = toOCRLine(line);
          return {
            text: normalizedLine.text,
            confidence: normalizedLine.confidence,
            words: normalizedLine.words.map((word) => word.text),
          };
        })
      ;

    await worker.terminate();

    return {
      text: data.text,
      confidence: data.confidence,
      words,
      lines,
    };
  } catch (error) {
    await worker.terminate();
    throw new Error(`Tesseract OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * AWS Textract OCR processing
 * Requires AWS credentials configured
 */
async function processAWSTextractOCR(
  imageBuffer: Buffer | string
): Promise<OCRResult> {
  // Check if AWS SDK is available
  try {
    const { TextractClient, DetectDocumentTextCommand } = await importOptionalModule<typeof import("@aws-sdk/client-textract")>("@aws-sdk/client-textract");

    const client = new TextractClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });

    const buffer = typeof imageBuffer === "string" 
      ? Buffer.from(imageBuffer, "base64")
      : imageBuffer;

    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: buffer,
      },
    });

    const response = await client.send(command);

    // Extract text and confidence
    const blocks: TextractLineBlock[] = (response.Blocks || []).map((block) => ({
      BlockType: block.BlockType,
      Text: block.Text,
      Confidence: block.Confidence,
    }));
    const lines = blocks
      .filter((block) => block.BlockType === "LINE")
      .map((block) => ({
        text: block.Text || "",
        confidence: block.Confidence || 0,
        words: block.Text?.split(" ") || [],
      }));

    const text = lines.map((line) => line.text).join("\n");
    const confidence = lines.length > 0
      ? lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length
      : 0;

    return {
      text,
      confidence,
      lines,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('@aws-sdk/client-textract is not available')) {
      throw new Error("AWS Textract SDK not installed. Run: npm install @aws-sdk/client-textract");
    }
    throw new Error(`AWS Textract OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Google Cloud Vision API OCR processing
 * Requires Google Cloud credentials configured
 */
async function processGoogleVisionOCR(
  imageBuffer: Buffer | string
): Promise<OCRResult> {
  try {
    const vision = await importOptionalModule<typeof import("@google-cloud/vision")>("@google-cloud/vision");
    const client = new vision.ImageAnnotatorClient();

    const buffer = typeof imageBuffer === "string"
      ? Buffer.from(imageBuffer, "base64")
      : imageBuffer;

    const [result] = await client.textDetection(buffer);
    const detections = result.textAnnotations || [];

    if (detections.length === 0) {
      return {
        text: "",
        confidence: 0,
      };
    }

    // First annotation contains full text
    const fullText = detections[0].description || "";
    
    const words = detections.slice(1).map((detection) => {
      const vertices = detection.boundingPoly?.vertices || [];
      return {
        text: detection.description || "",
        confidence: 95, // Google Vision doesn&apos;t provide per-word confidence
        bbox: {
          x0: vertices[0]?.x || 0,
          y0: vertices[0]?.y || 0,
          x1: vertices[2]?.x || 0,
          y1: vertices[2]?.y || 0,
        },
      };
    });

    return {
      text: fullText,
      confidence: 95, // Google Vision has high accuracy
      words,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('@google-cloud/vision is not available')) {
      throw new Error("Google Cloud Vision SDK not installed. Run: npm install @google-cloud/vision");
    }
    throw new Error(`Google Vision OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Azure Computer Vision OCR processing
 * Requires Azure credentials configured
 */
async function processAzureOCR(
  imageBuffer: Buffer | string
): Promise<OCRResult> {
  try {
    const { ComputerVisionClient } = await importOptionalModule<typeof import("@azure/cognitiveservices-computervision")>("@azure/cognitiveservices-computervision");
    const { ApiKeyCredentials } = await importOptionalModule<typeof import("@azure/ms-rest-js")>("@azure/ms-rest-js");

    const key = process.env.AZURE_COMPUTER_VISION_KEY || "";
    const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT || "";

    const client = new ComputerVisionClient(
      new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": key } }),
      endpoint
    );

    const buffer = typeof imageBuffer === "string"
      ? Buffer.from(imageBuffer, "base64")
      : imageBuffer;

    // Use Read API for better accuracy
    const result = await client.readInStream(buffer);
    const operationId = result.operationLocation.split("/").pop() || "";

    // Poll for result
    let readResult;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      readResult = await client.getReadResult(operationId);
    } while (
      readResult.status === "running" || readResult.status === "notStarted"
    );

    if (readResult.status !== "succeeded") {
      throw new Error("Azure OCR processing failed");
    }

    // Extract text from pages
    const pages: AzureReadPage[] = (readResult.analyzeResult?.readResults || []).map((page) => ({
      lines: page.lines?.map((line) => ({
        text: line.text,
        confidence: readNumber((line as unknown as Record<string, unknown>).confidence) ?? undefined,
        words: line.words?.map((word) => ({ text: word.text })),
      })),
    }));
    const lines = pages.flatMap((page) =>
      (page.lines || []).map((line) => ({
        text: line.text || "",
        confidence: line.confidence || 95,
        words: line.words?.map((w) => w.text || "") || [],
      }))
    );

    const text = lines.map((line) => line.text).join("\n");
    const confidence = lines.length > 0
      ? lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length
      : 0;

    return {
      text,
      confidence,
      lines,
    };
  } catch (error) {
    if (
      error instanceof Error
      && (
        error.message.includes('@azure/cognitiveservices-computervision is not available')
        || error.message.includes('@azure/ms-rest-js is not available')
      )
    ) {
      throw new Error("Azure Cognitive Services SDK not installed. Run: npm install @azure/cognitiveservices-computervision @azure/ms-rest-js");
    }
    throw new Error(`Azure OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Process PDF document for OCR
 * Converts PDF pages to images and processes each page
 */
export async function processPDFOCR(
  pdfBuffer: Buffer,
  _options: OCROptions = {}
): Promise<{ pages: OCRResult[]; fullText: string }> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParseExport = "default" in pdfParseModule ? pdfParseModule.default : pdfParseModule;
    const pdfParse = pdfParseExport as (buffer: Buffer) => Promise<PdfParseResult>;
    
    // First try to extract text directly from PDF
    const pdfData = await pdfParse(pdfBuffer);
    
    if (pdfData.text && pdfData.text.trim().length > 0) {
      // PDF has extractable text
      return {
        pages: [{
          text: pdfData.text,
          confidence: 100, // Direct extraction is 100% accurate
        }],
        fullText: pdfData.text,
      };
    }

    // If no text found, PDF is likely scanned - need image OCR
    // This requires converting PDF to images first
    throw new Error("Scanned PDF OCR requires pdf2pic or similar library. Please install: npm install pdf2pic");
    
  } catch (error) {
    if (getErrorCode(error) === "MODULE_NOT_FOUND") {
      throw new Error("PDF parsing library not installed. Run: npm install pdf-parse");
    }
    throw error;
  }
}

/**
 * Preprocess image for better OCR results
 * - Convert to grayscale
 * - Increase contrast
 * - Remove noise
 * - Deskew
 */
export async function preprocessImage(
  imageBuffer: Buffer
): Promise<Buffer> {
  try {
    const sharp = await import("sharp");
    
    return await sharp.default(imageBuffer)
      .grayscale()
      .normalize() // Enhance contrast
      .sharpen()
      .toBuffer();
  } catch (error) {
    if (getErrorCode(error) === "MODULE_NOT_FOUND") {
      logger.warn("Sharp not installed. Image preprocessing disabled. Run: npm install sharp");
      return imageBuffer;
    }
    throw error;
  }
}

/**
 * Detect language in image
 */
export async function detectLanguage(
  imageBuffer: Buffer | string
): Promise<string> {
  const worker = await createWorker("eng", 1);
  
  try {
    const { data } = await worker.recognize(imageBuffer);
    await worker.terminate();
    
    // Simple language detection based on character patterns
    const text = data.text;
    
    if (/[\u4e00-\u9fa5]/.test(text)) return "chi_sim"; // Chinese
    if (/[\u0600-\u06FF]/.test(text)) return "ara"; // Arabic
    if (/[\u0400-\u04FF]/.test(text)) return "rus"; // Russian
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "jpn"; // Japanese
    if (/[\uAC00-\uD7AF]/.test(text)) return "kor"; // Korean
    
    return "eng"; // Default to English
  } catch (_error) {
    await worker.terminate();
    return "eng";
  }
}

/**
 * Get supported OCR languages
 */
export function getSupportedLanguages(): string[] {
  return [
    "eng", "ara", "chi_sim", "chi_tra", "fra", "deu", "hin", 
    "ita", "jpn", "kor", "por", "rus", "spa", "tur", "vie"
  ];
}

/**
 * Validate OCR result quality
 */
export function validateOCRQuality(result: OCRResult): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (result.confidence < 50) {
    issues.push("Low overall confidence score");
  }
  
  if (result.text.trim().length === 0) {
    issues.push("No text extracted");
  }
  
  if (result.words && result.words.length > 0) {
    const lowConfidenceWords = result.words.filter((w) => w.confidence < 60);
    if (lowConfidenceWords.length > result.words.length * 0.3) {
      issues.push("Many words have low confidence");
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}

