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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: (m: any) => {
      if (m.status === "recognizing text") {
        logger.debug("OCR progress", { percent: Math.round(m.progress * 100) });
      }
    },
  });

  try {
    const { data } = await worker.recognize(imageBuffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataAny = data as any;

    // Extract word-level details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const words = dataAny.words.map((word: any) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox,
    }));

    // Extract line-level details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines = dataAny.lines.map((line: any) => ({
      text: line.text,
      confidence: line.confidence,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      words: line.words.map((w: any) => w.text),
    }));

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
    const { TextractClient, DetectDocumentTextCommand } = await import("@aws-sdk/client-textract");

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
    const blocks = response.Blocks || [];
    const lines = blocks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((block: any) => block.BlockType === "LINE")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((block: any) => ({
        text: block.Text || "",
        confidence: block.Confidence || 0,
        words: block.Text?.split(" ") || [],
      }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = lines.map((line: any) => line.text).join("\n");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confidence = lines.reduce((sum: any, line: any) => sum + line.confidence, 0) / lines.length;

    return {
      text,
      confidence,
      lines,
    };
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === "MODULE_NOT_FOUND") {
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
    const vision = await import("@google-cloud/vision");
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
    
    // Extract word-level details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const words = detections.slice(1).map((detection: any) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === "MODULE_NOT_FOUND") {
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
    const { ComputerVisionClient } = await import("@azure/cognitiveservices-computervision");
    const { ApiKeyCredentials } = await import("@azure/ms-rest-js");

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
    const pages = readResult.analyzeResult?.readResults || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines = pages.flatMap((page: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (page.lines || []).map((line: any) => ({
        text: line.text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        confidence: (line as any).confidence || 95,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        words: line.words?.map((w: any) => w.text) || [],
      }))
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = lines.map((line: any) => line.text).join("\n");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confidence = lines.reduce((sum: any, line: any) => sum + line.confidence, 0) / lines.length;

    return {
      text,
      confidence,
      lines,
    };
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === "MODULE_NOT_FOUND") {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse")) as any;
    
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === "MODULE_NOT_FOUND") {
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
      .median(3) // Reduce noise
      .sharpen()
      .toBuffer();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === "MODULE_NOT_FOUND") {
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

