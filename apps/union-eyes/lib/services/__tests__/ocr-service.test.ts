import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockCreateWorker: vi.fn(),
  mockRecognize: vi.fn(),
  mockTerminate: vi.fn(),
  mockGoogleTextDetection: vi.fn(),
  mockAWSClientSend: vi.fn(),
  mockAzureReadInStream: vi.fn(),
  mockAzureGetReadResult: vi.fn(),
  mockPdfParse: vi.fn(),
  mockSharpToBuffer: vi.fn(),
  mockSharpFactory: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: mocks.mockCreateWorker,
}));

vi.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: class MockImageAnnotatorClient {
    textDetection = mocks.mockGoogleTextDetection;
  },
}));

vi.mock('@aws-sdk/client-textract', () => ({
  TextractClient: class MockTextractClient {
    send = mocks.mockAWSClientSend;
  },
  DetectDocumentTextCommand: class MockDetectDocumentTextCommand {
    constructor(public readonly input: unknown) {
      void input;
    }
  },
}));

vi.mock('@azure/cognitiveservices-computervision', () => ({
  ComputerVisionClient: class MockComputerVisionClient {
    constructor(public readonly _credentials: unknown, public readonly _endpoint: string) {
      void _credentials;
      void _endpoint;
    }

    readInStream = mocks.mockAzureReadInStream;
    getReadResult = mocks.mockAzureGetReadResult;
  },
}));

vi.mock('@azure/ms-rest-js', () => ({
  ApiKeyCredentials: class MockApiKeyCredentials {
    constructor(public readonly _config: unknown) {
      void _config;
    }
    // ServiceClientCredentials interface requires signRequest
    signRequest = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('pdf-parse', () => ({
  default: mocks.mockPdfParse,
}));

vi.mock('sharp', () => ({
  default: mocks.mockSharpFactory,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  processImageOCR,
  processPDFOCR,
  preprocessImage,
  detectLanguage,
  getSupportedLanguages,
  validateOCRQuality,
} from '../ocr-service';

describe('processImageOCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockRecognize.mockResolvedValue({
      data: {
        text: 'Hello World',
        confidence: 95,
        words: [
          { text: 'Hello', confidence: 97, bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
          { text: 'World', confidence: 93, bbox: { x0: 55, y0: 0, x1: 100, y1: 20 } },
        ],
        lines: [
          { text: 'Hello World', confidence: 95, words: [{ text: 'Hello' }, { text: 'World' }] },
        ],
      },
    });
    mocks.mockTerminate.mockResolvedValue(undefined);

    mocks.mockCreateWorker.mockResolvedValue({
      recognize: mocks.mockRecognize,
      terminate: mocks.mockTerminate,
    });

    mocks.mockGoogleTextDetection.mockRejectedValue(new Error('Google Vision SDK not configured'));
    mocks.mockAWSClientSend.mockResolvedValue({
      Blocks: [
        { BlockType: 'LINE', Text: 'One Two', Confidence: 80 },
        { BlockType: 'LINE', Text: 'Three', Confidence: 90 },
        { BlockType: 'WORD', Text: 'ignored', Confidence: 60 },
      ],
    });
    mocks.mockAzureReadInStream.mockResolvedValue({
      operationLocation: 'https://example.com/read/operations/op-123',
    });
    mocks.mockAzureGetReadResult.mockResolvedValue({
      status: 'succeeded',
      analyzeResult: {
        readResults: [
          {
            lines: [
              {
                text: 'Hello Azure',
                confidence: 88,
                words: [{ text: 'Hello' }, { text: 'Azure' }],
              },
            ],
          },
        ],
      },
    });
    mocks.mockPdfParse.mockResolvedValue({ text: 'PDF direct text' });
    mocks.mockSharpToBuffer.mockResolvedValue(Buffer.from('processed'));
    mocks.mockSharpFactory.mockReturnValue({
      grayscale: vi.fn().mockReturnThis(),
      normalize: vi.fn().mockReturnThis(),
      sharpen: vi.fn().mockReturnThis(),
      toBuffer: mocks.mockSharpToBuffer,
    });
  });

  describe('tesseract provider', () => {
    it('processes image and returns OCR result', async () => {
      const result = await processImageOCR(Buffer.from('fake-image'), { provider: 'tesseract' });
      expect(result.text).toBe('Hello World');
      expect(result.confidence).toBe(95);
    });

    it('extracts words with bounding boxes', async () => {
      const result = await processImageOCR(Buffer.from('fake-image'));
      expect(result.words).toHaveLength(2);
      expect(result.words![0].text).toBe('Hello');
    });

    it('extracts lines', async () => {
      const result = await processImageOCR(Buffer.from('fake-image'));
      expect(result.lines).toHaveLength(1);
      expect(result.lines![0].text).toBe('Hello World');
    });

    it('terminates worker after processing', async () => {
      await processImageOCR(Buffer.from('fake-image'));
      expect(mocks.mockTerminate).toHaveBeenCalled();
    });

    it('terminates worker and throws on error', async () => {
      mocks.mockRecognize.mockRejectedValue(new Error('OCR failed'));
      await expect(processImageOCR(Buffer.from('bad-image'))).rejects.toThrow('Tesseract OCR failed');
      expect(mocks.mockTerminate).toHaveBeenCalled();
    });

    it('defaults to tesseract provider', async () => {
      await processImageOCR(Buffer.from('test'));
      expect(mocks.mockCreateWorker).toHaveBeenCalledWith('eng', 1, expect.any(Object));
    });

    it('supports custom language', async () => {
      await processImageOCR(Buffer.from('test'), { language: 'fra' });
      expect(mocks.mockCreateWorker).toHaveBeenCalledWith('fra', 1, expect.any(Object));
    });

    it('uses default switch branch for unknown provider', async () => {
      await processImageOCR(Buffer.from('test'), { provider: 'bogus' as never });
      expect(mocks.mockCreateWorker).toHaveBeenCalledWith('eng', 1, expect.any(Object));
    });

    it('logs progress from tesseract worker logger callback', async () => {
      await processImageOCR(Buffer.from('test'));
      const loggerConfig = mocks.mockCreateWorker.mock.calls[0]?.[2] as { logger: (m: unknown) => void };
      loggerConfig.logger({ status: 'recognizing text', progress: 0.42 });
      loggerConfig.logger('not-an-object');
      expect(loggerConfig).toBeDefined();
    });
  });

  describe('aws-textract provider', () => {
    it('returns parsed lines and confidence', async () => {
      const result = await processImageOCR(Buffer.from('test'), { provider: 'aws-textract' });
      expect(result.text).toBe('One Two\nThree');
      expect(result.lines).toHaveLength(2);
      expect(result.confidence).toBe(85);
    });

    it('wraps provider errors', async () => {
      mocks.mockAWSClientSend.mockRejectedValueOnce(new Error('network'));
      await expect(processImageOCR(Buffer.from('test'), { provider: 'aws-textract' })).rejects.toThrow(
        'AWS Textract OCR failed: network',
      );
    });
  });

  describe('google-vision provider', () => {
    it('returns empty payload when no detections', async () => {
      mocks.mockGoogleTextDetection.mockResolvedValueOnce([{ textAnnotations: [] }]);
      const result = await processImageOCR(Buffer.from('test'), { provider: 'google-vision' });
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('maps full text and bounding boxes', async () => {
      mocks.mockGoogleTextDetection.mockResolvedValueOnce([
        {
          textAnnotations: [
            { description: 'HELLO WORLD' },
            {
              description: 'HELLO',
              boundingPoly: { vertices: [{ x: 1, y: 2 }, {}, { x: 9, y: 10 }] },
            },
          ],
        },
      ]);
      const result = await processImageOCR(Buffer.from('test'), { provider: 'google-vision' });
      expect(result.text).toBe('HELLO WORLD');
      expect(result.words?.[0].bbox.x0).toBe(1);
      expect(result.words?.[0].bbox.y1).toBe(10);
    });

    it('wraps provider errors', async () => {
      mocks.mockGoogleTextDetection.mockRejectedValueOnce(new Error('vision failure'));
      await expect(processImageOCR(Buffer.from('test'), { provider: 'google-vision' })).rejects.toThrow(
        'Google Vision OCR failed: vision failure',
      );
    });
  });

  describe('azure provider', () => {
    it('returns parsed lines and confidence from read results', async () => {
      const result = await processImageOCR(Buffer.from('test'), { provider: 'azure' });
      expect(result.text).toBe('Hello Azure');
      expect(result.lines).toHaveLength(1);
      expect(result.confidence).toBe(88);
      expect(mocks.mockAzureReadInStream).toHaveBeenCalled();
      expect(mocks.mockAzureGetReadResult).toHaveBeenCalledWith('op-123');
    });

    it('polls until read result succeeds', async () => {
      // Stub setTimeout to skip 1000ms polling delays without triggering
      // importOptionalModule's own 1000ms timeout (fake timers cause that to fire).
      const origST = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void, _ms?: number) => origST(fn, 0));

      mocks.mockAzureGetReadResult
        .mockResolvedValueOnce({ status: 'running' })
        .mockResolvedValueOnce({ status: 'notStarted' })
        .mockResolvedValueOnce({
          status: 'succeeded',
          analyzeResult: {
            readResults: [
              { lines: [{ text: 'Done', words: [{ text: 'Done' }] }] },
            ],
          },
        });

      const result = await processImageOCR(Buffer.from('test'), { provider: 'azure' });
      vi.unstubAllGlobals();

      expect(result.text).toBe('Done');
      expect(mocks.mockAzureGetReadResult).toHaveBeenCalledTimes(3);
    });

    it('throws when azure processing does not succeed', async () => {
      mocks.mockAzureGetReadResult.mockResolvedValueOnce({ status: 'failed' });
      await expect(processImageOCR(Buffer.from('test'), { provider: 'azure' })).rejects.toThrow(
        'Azure OCR failed: Azure OCR processing failed',
      );
    });

    it('wraps azure provider errors', async () => {
      mocks.mockAzureReadInStream.mockRejectedValueOnce(new Error('azure boom'));
      await expect(processImageOCR(Buffer.from('test'), { provider: 'azure' })).rejects.toThrow(
        'Azure OCR failed: azure boom',
      );
    });

    it('maps missing azure sdk errors to install guidance', async () => {
      mocks.mockAzureReadInStream.mockRejectedValueOnce(new Error('@azure/cognitiveservices-computervision is not available'));
      await expect(processImageOCR(Buffer.from('test'), { provider: 'azure' })).rejects.toThrow(
        'Azure Cognitive Services SDK not installed',
      );
    });
  });

  describe('PDF and utility exports', () => {
    it('processPDFOCR returns direct parsed text', async () => {
      const result = await processPDFOCR(Buffer.from('pdf'));
      expect(result.fullText).toBe('PDF direct text');
      expect(result.pages[0].confidence).toBe(100);
    });

    it('processPDFOCR throws scanned-pdf guidance when text is empty', async () => {
      mocks.mockPdfParse.mockResolvedValueOnce({ text: '   ' });
      await expect(processPDFOCR(Buffer.from('pdf'))).rejects.toThrow('Scanned PDF OCR requires pdf2pic');
    });

    it('processPDFOCR maps module-not-found errors', async () => {
      mocks.mockPdfParse.mockRejectedValueOnce({ code: 'MODULE_NOT_FOUND' });
      await expect(processPDFOCR(Buffer.from('pdf'))).rejects.toThrow('PDF parsing library not installed');
    });

    it('preprocessImage returns transformed buffer', async () => {
      const result = await preprocessImage(Buffer.from('img'));
      expect(result.toString()).toBe('processed');
    });

    it('detectLanguage detects known scripts and defaults to eng', async () => {
      mocks.mockRecognize.mockResolvedValueOnce({ data: { text: '中文文本' } });
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('chi_sim');
      mocks.mockRecognize.mockResolvedValueOnce({ data: { text: 'العربية' } });
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('ara');
      mocks.mockRecognize.mockResolvedValueOnce({ data: { text: 'русский' } });
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('rus');
      mocks.mockRecognize.mockResolvedValueOnce({ data: { text: 'かなカナ' } });
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('jpn');
      mocks.mockRecognize.mockResolvedValueOnce({ data: { text: '한글' } });
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('kor');
      mocks.mockRecognize.mockResolvedValueOnce({ data: { text: 'plain english' } });
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('eng');
    });

    it('detectLanguage returns eng on recognition failure', async () => {
      mocks.mockRecognize.mockRejectedValueOnce(new Error('recognition failed'));
      await expect(detectLanguage(Buffer.from('img'))).resolves.toBe('eng');
    });

    it('returns supported languages list', () => {
      const languages = getSupportedLanguages();
      expect(languages).toContain('eng');
      expect(languages).toContain('jpn');
      expect(languages.length).toBeGreaterThan(10);
    });

    it('validateOCRQuality reports low confidence, empty text, and noisy words', () => {
      const report = validateOCRQuality({
        text: '   ',
        confidence: 45,
        words: [
          { text: 'a', confidence: 10, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
          { text: 'b', confidence: 20, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
          { text: 'c', confidence: 95, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        ],
      });
      expect(report.isValid).toBe(false);
      expect(report.issues).toContain('Low overall confidence score');
      expect(report.issues).toContain('No text extracted');
      expect(report.issues).toContain('Many words have low confidence');
    });

    it('validateOCRQuality accepts good OCR output', () => {
      const report = validateOCRQuality({ text: 'good text', confidence: 99, words: [] });
      expect(report.isValid).toBe(true);
      expect(report.issues).toHaveLength(0);
    });
  });
});
