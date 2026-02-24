"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Play, Pause, Trash2, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface VoiceRecorderProps {
  onTranscriptionComplete?: (text: string, audioBlob: Blob) => void;
  language?: "en-CA" | "fr-CA" | "en-US";
  maxDuration?: number; // in seconds
  className?: string;
}

export function VoiceRecorder({
  onTranscriptionComplete,
  language = "en-CA",
  maxDuration = 300, // 5 minutes default
  className,
}: VoiceRecorderProps) {
  const t = useTranslations('voice');
  const locale = useLocale();
  const { toast } = useToast();
  
  // Auto-detect language from locale if not provided
  const detectedLanguage = language || (locale === 'fr' ? 'fr-CA' : 'en-CA');
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);

        if (seconds >= maxDuration) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);

      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone",
      });

    } catch (_error) {
toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [maxDuration, toast]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast({
        title: "Recording stopped",
        description: `Duration: ${formatTime(recordingTime)}`,
      });
    }
  }, [isRecording, recordingTime, toast]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  // Play audio
  const playAudio = useCallback(() => {
    if (!audioUrl) return;

    if (isPlaying) {
      audioPlayerRef.current?.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  // Delete recording
  const deleteRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription("");
    setRecordingTime(0);
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    
    setIsPlaying(false);
  }, [audioUrl]);

  // Transcribe audio
  const transcribeAudio = useCallback(async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("language", detectedLanguage);

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || "Transcription failed");
      }

      const data = await response.json();
      setTranscription(data.text);

      if (onTranscriptionComplete) {
        onTranscriptionComplete(data.text, audioBlob);
      }

      toast({
        title: t('transcriptionComplete'),
        description: t('transcriptionSuccess'),
      });

    } catch (error) {
toast({
        title: t('transcriptionFailed'),
        description: error instanceof Error ? error.message : t('unknownError'),
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  }, [audioBlob, detectedLanguage, onTranscriptionComplete, t, toast]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className={cn("p-6", className)}>
      <div className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording && !audioBlob && (
            <Button
              onClick={startRecording}
              size="lg"
              className="rounded-full w-16 h-16"
            >
              <Mic className="h-6 w-6" />
            </Button>
          )}

          {isRecording && (
            <>
              <Button
                onClick={togglePause}
                size="lg"
                variant="outline"
                className="rounded-full w-14 h-14"
              >
                {isPaused ? (
                  <Play className="h-5 w-5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
              </Button>

              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                className="rounded-full w-16 h-16"
              >
                <Square className="h-6 w-6" />
              </Button>
            </>
          )}

          {audioBlob && !isRecording && (
            <>
              <Button
                onClick={playAudio}
                size="lg"
                variant="outline"
                className="rounded-full w-14 h-14"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                onClick={transcribeAudio}
                size="lg"
                disabled={isTranscribing}
                className="rounded-full w-16 h-16"
              >
                {isTranscribing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
              </Button>

              <Button
                onClick={deleteRecording}
                size="lg"
                variant="destructive"
                className="rounded-full w-14 h-14"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Recording Timer */}
        {isRecording && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
              )} />
              <span className="text-2xl font-mono font-bold">
                {formatTime(recordingTime)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isPaused ? t('paused') : t('recording')}
            </p>
          </div>
        )}

        {/* Transcription Display */}
        {transcription && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">{t('transcription')}:</p>
            <p className="text-sm">{transcription}</p>
          </div>
        )}

        {/* Instructions */}
        {!isRecording && !audioBlob && (
          <div className="text-center text-sm text-muted-foreground">
            <p>{t('clickToStart')}</p>
            <p className="mt-1">{t('maxDuration')}: {Math.floor(maxDuration / 60)} {t('minutes')}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

