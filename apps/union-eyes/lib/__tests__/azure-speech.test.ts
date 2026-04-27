import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFromSubscription: vi.fn(),
  mockFromWavFileInput: vi.fn(),
  mockFromStreamInput: vi.fn(),
  mockCreatePushStream: vi.fn(),
  mockStartContinuous: vi.fn((ok: unknown) => (ok as (() => void) | undefined)?.()),
  mockStopContinuous: vi.fn((ok: unknown) => (ok as (() => void) | undefined)?.()),
  mockRecognizerClose: vi.fn(),
  recognizerInstances: [] as unknown[],
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
      recognized: unknown = null;
      canceled: unknown = null;
      sessionStopped: unknown = null;
      startContinuousRecognitionAsync = (...args: unknown[]) => mocks.mockStartContinuous(...args);
      stopContinuousRecognitionAsync = (...args: unknown[]) => mocks.mockStopContinuous(...args);
      close = mocks.mockRecognizerClose;
      constructor() {
        mocks.recognizerInstances.push(this);
      }
    },
    ResultReason: { RecognizedSpeech: 1 },
    CancellationReason: { Error: 1 },
  };
});

describe('azure-speech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recognizerInstances.length = 0;
    mocks.mockStartContinuous.mockImplementation((ok: unknown) => (ok as (() => void) | undefined)?.());
    mocks.mockStopContinuous.mockImplementation((ok: unknown) => (ok as (() => void) | undefined)?.());
    process.env.AZURE_SPEECH_KEY = 'test-key';
    process.env.AZURE_SPEECH_REGION = 'eastus';
  });

  // ── createSpeechConfig ──────────────────────────────────────────────
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

  // ── createRecognizerFromFile ────────────────────────────────────────
  it('createRecognizerFromFile creates recognizer from buffer', async () => {
    const { createRecognizerFromFile } = await import('../azure-speech');
    const buf = Buffer.from('fake-audio');
    const recognizer = createRecognizerFromFile(buf);
    expect(recognizer).toBeDefined();
    expect(mocks.mockFromWavFileInput).toHaveBeenCalledWith(buf);
  });

  // ── SUPPORTED_LANGUAGES ────────────────────────────────────────────
  it('SUPPORTED_LANGUAGES has the four UE languages plus en-US', async () => {
    const { SUPPORTED_LANGUAGES } = await import('../azure-speech');
    expect(SUPPORTED_LANGUAGES['en-CA']).toBe('English (Canada)');
    expect(SUPPORTED_LANGUAGES['fr-CA']).toBe('French (Canada)');
    expect(SUPPORTED_LANGUAGES['it-IT']).toBe('Italiano');
    expect(SUPPORTED_LANGUAGES['pt-PT']).toBe('Portugues');
    expect(SUPPORTED_LANGUAGES['en-US']).toBe('English (United States)');
  });

  it('maps UE locales to supported speech languages', async () => {
    const { speechLanguageForLocale } = await import('../azure-speech');
    expect(speechLanguageForLocale('en-CA')).toBe('en-CA');
    expect(speechLanguageForLocale('fr-CA')).toBe('fr-CA');
    expect(speechLanguageForLocale('it')).toBe('it-IT');
    expect(speechLanguageForLocale('pt')).toBe('pt-PT');
    expect(speechLanguageForLocale('unknown')).toBe('en-CA');
  });

  // ── transcribeAudio ─────────────────────────────────────────────────
  describe('transcribeAudio', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('resolves with recognized speech text', async () => {
      const { transcribeAudio } = await import('../azure-speech');
      const promise = transcribeAudio(Buffer.from('audio'));
      const rec = mocks.recognizerInstances[0];
      rec.recognized(null, { result: { reason: 1, text: 'Hello world' } });
      rec.sessionStopped(null, {});
      expect(await promise).toBe('Hello world');
    });

    it('concatenates multiple recognized segments', async () => {
      const { transcribeAudio } = await import('../azure-speech');
      const promise = transcribeAudio(Buffer.from('audio'));
      const rec = mocks.recognizerInstances[0];
      rec.recognized(null, { result: { reason: 1, text: 'Hello' } });
      rec.recognized(null, { result: { reason: 1, text: 'World' } });
      rec.sessionStopped(null, {});
      expect(await promise).toBe('Hello World');
    });

    it('returns empty string when no speech recognized', async () => {
      const { transcribeAudio } = await import('../azure-speech');
      const promise = transcribeAudio(Buffer.from('audio'));
      const rec = mocks.recognizerInstances[0];
      rec.sessionStopped(null, {});
      expect(await promise).toBe('');
    });

    it('rejects on cancellation error', async () => {
      const { transcribeAudio } = await import('../azure-speech');
      const promise = transcribeAudio(Buffer.from('audio'));
      const rec = mocks.recognizerInstances[0];
      rec.canceled(null, { reason: 1, errorDetails: 'Mic failure' });
      await expect(promise).rejects.toThrow('Speech recognition error: Mic failure');
    });

    it('resolves via timeout after 60 seconds', async () => {
      const { transcribeAudio } = await import('../azure-speech');
      const promise = transcribeAudio(Buffer.from('audio'));
      const rec = mocks.recognizerInstances[0];
      rec.recognized(null, { result: { reason: 1, text: 'Timed text' } });
      vi.advanceTimersByTime(60000);
      expect(await promise).toBe('Timed text');
    });

    it('rejects on startContinuousRecognitionAsync error', async () => {
      mocks.mockStartContinuous.mockImplementation((_ok: unknown, err: unknown) => (err as ((e: string) => void) | undefined)?.('start failed'));
      const { transcribeAudio } = await import('../azure-speech');
      const promise = transcribeAudio(Buffer.from('audio'));
      await expect(promise).rejects.toBe('start failed');
    });
  });

  // ── transcribeAudioWithLanguage ─────────────────────────────────────
  describe('transcribeAudioWithLanguage', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('transcribes with specified language', async () => {
      const { transcribeAudioWithLanguage } = await import('../azure-speech');
      const promise = transcribeAudioWithLanguage(Buffer.from('audio'), 'fr-CA');
      const rec = mocks.recognizerInstances[0];
      rec.recognized(null, { result: { reason: 1, text: 'Bonjour' } });
      rec.sessionStopped(null, {});
      expect(await promise).toBe('Bonjour');
    });

    it('rejects on cancellation error', async () => {
      const { transcribeAudioWithLanguage } = await import('../azure-speech');
      const promise = transcribeAudioWithLanguage(Buffer.from('audio'), 'en-US');
      const rec = mocks.recognizerInstances[0];
      rec.canceled(null, { reason: 1, errorDetails: 'Network error' });
      await expect(promise).rejects.toThrow('Speech recognition error: Network error');
    });

    it('resolves via timeout path', async () => {
      const { transcribeAudioWithLanguage } = await import('../azure-speech');
      const promise = transcribeAudioWithLanguage(Buffer.from('audio'));
      const rec = mocks.recognizerInstances[0];
      rec.recognized(null, { result: { reason: 1, text: 'Default' } });
      vi.advanceTimersByTime(60000);
      expect(await promise).toBe('Default');
    });
  });
});
