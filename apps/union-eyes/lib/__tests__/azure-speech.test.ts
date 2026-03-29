import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFromSubscription: vi.fn(),
  mockFromWavFileInput: vi.fn(),
  mockFromStreamInput: vi.fn(),
  mockCreatePushStream: vi.fn(),
}));

vi.mock('microsoft-cognitiveservices-speech-sdk', () => {
  const speechConfigInstance = {
    speechRecognitionLanguage: '',
  };

  return {
    SpeechConfig: {
      fromSubscription: mocks.mockFromSubscription.mockReturnValue(speechConfigInstance),
    },
    AudioConfig: {
      fromWavFileInput: mocks.mockFromWavFileInput.mockReturnValue({}),
      fromStreamInput: mocks.mockFromStreamInput.mockReturnValue({}),
    },
    AudioInputStream: {
      createPushStream: mocks.mockCreatePushStream.mockReturnValue({
        write: vi.fn(),
        close: vi.fn(),
      }),
    },
    SpeechRecognizer: class {
      recognized: ((s: unknown, e: unknown) => void) | null = null;
      canceled: ((s: unknown, e: unknown) => void) | null = null;
      sessionStopped: ((s: unknown, e: unknown) => void) | null = null;
      startContinuousRecognitionAsync = vi.fn((ok) => ok?.());
      stopContinuousRecognitionAsync = vi.fn((ok) => ok?.());
      close = vi.fn();
    },
    ResultReason: { RecognizedSpeech: 1 },
    CancellationReason: { Error: 1 },
  };
});

describe('azure-speech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_SPEECH_KEY = 'test-key';
    process.env.AZURE_SPEECH_REGION = 'eastus';
  });

  it('createSpeechConfig creates config from env vars', async () => {
    const { createSpeechConfig } = await import('../azure-speech');
    const config = createSpeechConfig();
    expect(mocks.mockFromSubscription).toHaveBeenCalledWith('test-key', 'eastus');
    expect(config.speechRecognitionLanguage).toBe('en-CA');
  });

  it('createSpeechConfig throws without AZURE_SPEECH_KEY', async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const { createSpeechConfig } = await import('../azure-speech');
    expect(() => createSpeechConfig()).toThrow('AZURE_SPEECH_KEY');
  });

  it('createSpeechConfig throws without AZURE_SPEECH_REGION', async () => {
    delete process.env.AZURE_SPEECH_REGION;
    process.env.AZURE_SPEECH_KEY = 'key';
    const { createSpeechConfig } = await import('../azure-speech');
    expect(() => createSpeechConfig()).toThrow('AZURE_SPEECH_REGION');
  });

  it('createRecognizerFromFile creates recognizer from buffer', async () => {
    const { createRecognizerFromFile } = await import('../azure-speech');
    const buf = Buffer.from('fake-audio');
    const recognizer = createRecognizerFromFile(buf);
    expect(recognizer).toBeDefined();
    expect(mocks.mockFromWavFileInput).toHaveBeenCalledWith(buf);
  });
});
