/**
 * Azure Cognitive Services Speech SDK Configuration
 * Provides speech-to-text and text-to-speech capabilities
 */

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

/**
 * Creates a speech configuration for Azure Speech Services
 */
export function createSpeechConfig() {
  if (!process.env.AZURE_SPEECH_KEY) {
    throw new Error("AZURE_SPEECH_KEY is not defined in environment variables");
  }

  if (!process.env.AZURE_SPEECH_REGION) {
    throw new Error("AZURE_SPEECH_REGION is not defined in environment variables");
  }

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!
  );

  // Set recognition language (supports bilingual: English and French)
  speechConfig.speechRecognitionLanguage = "en-CA";

  return speechConfig;
}

/**
 * Creates a speech recognizer from audio file
 */
export function createRecognizerFromFile(audioFile: Buffer) {
  const speechConfig = createSpeechConfig();
  const audioConfig = sdk.AudioConfig.fromWavFileInput(audioFile);
  
  return new sdk.SpeechRecognizer(speechConfig, audioConfig);
}

/**
 * Transcribes audio buffer to text
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const speechConfig = createSpeechConfig();
    
    // Create push stream for audio data
    const pushStream = sdk.AudioInputStream.createPushStream();
    pushStream.write(new Uint8Array(audioBuffer).buffer as ArrayBuffer);
    pushStream.close();
    
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    let transcription = "";

    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        transcription += e.result.text + " ";
      }
    };

    recognizer.canceled = (s, e) => {
      recognizer.close();
      if (e.reason === sdk.CancellationReason.Error) {
        reject(new Error(`Speech recognition error: ${e.errorDetails}`));
      }
    };

    recognizer.sessionStopped = (_s, _e) => {
      recognizer.close();
      resolve(transcription.trim());
    };

    recognizer.startContinuousRecognitionAsync(
      () => {
        // Recognition started successfully
      },
      (err) => {
        recognizer.close();
        reject(err);
      }
    );

    // Stop after 60 seconds
    setTimeout(() => {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          recognizer.close();
          resolve(transcription.trim());
        },
        (err) => {
          recognizer.close();
          reject(err);
        }
      );
    }, 60000);
  });
}

/**
 * Supported languages for speech recognition
 */
export const SUPPORTED_LANGUAGES = {
  "en-CA": "English (Canada)",
  "fr-CA": "French (Canada)",
  "en-US": "English (United States)",
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Transcribes audio with specific language
 */
export async function transcribeAudioWithLanguage(
  audioBuffer: Buffer,
  language: SupportedLanguage = "en-CA"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const speechConfig = createSpeechConfig();
    speechConfig.speechRecognitionLanguage = language;
    
    const pushStream = sdk.AudioInputStream.createPushStream();
    pushStream.write(new Uint8Array(audioBuffer).buffer as ArrayBuffer);
    pushStream.close();
    
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    let transcription = "";

    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        transcription += e.result.text + " ";
      }
    };

    recognizer.canceled = (s, e) => {
      recognizer.close();
      if (e.reason === sdk.CancellationReason.Error) {
        reject(new Error(`Speech recognition error: ${e.errorDetails}`));
      }
    };

    recognizer.sessionStopped = (_s, _e) => {
      recognizer.close();
      resolve(transcription.trim());
    };

    recognizer.startContinuousRecognitionAsync(
      () => {
        // Recognition started successfully
      },
      (err) => {
        recognizer.close();
        reject(err);
      }
    );

    setTimeout(() => {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          recognizer.close();
          resolve(transcription.trim());
        },
        (err) => {
          recognizer.close();
          reject(err);
        }
      );
    }, 60000);
  });
}

