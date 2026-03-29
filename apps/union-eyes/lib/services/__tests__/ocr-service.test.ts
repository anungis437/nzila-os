import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockCreateWorker: vi.fn(),
  mockRecognize: vi.fn(),
  mockTerminate: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: mocks.mockCreateWorker,
}));

vi.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: class MockImageAnnotatorClient {
    textDetection = vi.fn().mockRejectedValue(new Error('Google Vision SDK not configured'));
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processImageOCR } from '../ocr-service';

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
  });

  describe('aws-textract provider', () => {
    it('throws on missing SDK', async () => {
      await expect(
        processImageOCR(Buffer.from('test'), { provider: 'aws-textract' })
      ).rejects.toThrow();
    });
  });

  describe('google-vision provider', () => {
    it('throws on missing SDK', async () => {
      await expect(
        processImageOCR(Buffer.from('test'), { provider: 'google-vision' })
      ).rejects.toThrow();
    });
  });

  describe('azure provider', () => {
    it('throws on missing SDK', async () => {
      await expect(
        processImageOCR(Buffer.from('test'), { provider: 'azure' })
      ).rejects.toThrow();
    });
  });
});
