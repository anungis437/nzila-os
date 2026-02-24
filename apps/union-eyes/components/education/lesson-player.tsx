/**
 * Lesson Player Component
 * 
 * Content delivery system with:
 * - Video playback with progress tracking
 * - PDF/document viewer
 * - Interactive content slides
 * - Progress persistence
 * - Completion tracking
 * - Navigation controls
 * - Bookmark support
 * 
 * @module components/education/lesson-player
 */

"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Bookmark,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Video,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

interface LessonContent {
  id: string;
  type: "video" | "document" | "slides" | "interactive";
  url: string;
  title: string;
  duration?: number; // in seconds for video
  pages?: number; // for documents/slides
}

interface LessonData {
  id: string;
  title: string;
  description?: string;
  contents: LessonContent[];
  courseId: string;
  completionThreshold?: number; // percentage of content to view for completion
}

interface LessonProgress {
  lessonId: string;
  contentId: string;
  progress: number; // 0-100
  lastPosition?: number; // for video: seconds, for docs: page number
  completed: boolean;
  bookmarks?: number[]; // timestamps or page numbers
}

interface LessonPlayerProps {
  lesson: LessonData;
  initialProgress?: LessonProgress[];
  onProgressUpdate?: (progress: LessonProgress) => void;
  onComplete?: (lessonId: string) => void;
  onBookmark?: (contentId: string, position: number) => void;
}

export function LessonPlayer({
  lesson,
  initialProgress = [],
  onProgressUpdate,
  onComplete,
  onBookmark,
}: LessonPlayerProps) {
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(
    new Map(initialProgress.map((p) => [p.contentId, p]))
  );
  const currentContent = lesson.contents[currentContentIndex];
  const { toast } = useToast();

  const handleProgressUpdate = (contentId: string, updates: Partial<LessonProgress>) => {
    const current = progress.get(contentId) || {
      lessonId: lesson.id,
      contentId,
      progress: 0,
      completed: false,
    };

    const updated = { ...current, ...updates };
    const newProgress = new Map(progress);
    newProgress.set(contentId, updated);
    setProgress(newProgress);

    if (onProgressUpdate) {
      onProgressUpdate(updated);
    }

    // Check if lesson is complete
    const completionThreshold = lesson.completionThreshold || 80;
    const overallProgress = calculateOverallProgress(newProgress);
    
    if (overallProgress >= completionThreshold && !isLessonComplete(newProgress)) {
      markLessonComplete();
    }
  };

  const calculateOverallProgress = (progressMap: Map<string, LessonProgress>) => {
    if (lesson.contents.length === 0) return 0;
    
    const totalProgress = lesson.contents.reduce((sum, content) => {
      const contentProgress = progressMap.get(content.id);
      return sum + (contentProgress?.progress || 0);
    }, 0);
    
    return totalProgress / lesson.contents.length;
  };

  const isLessonComplete = (progressMap: Map<string, LessonProgress>) => {
    return lesson.contents.every((content) => {
      const contentProgress = progressMap.get(content.id);
      return contentProgress?.completed || false;
    });
  };

  const markLessonComplete = () => {
    if (onComplete) {
      onComplete(lesson.id);
      toast({
        title: "Lesson Complete!",
        description: "You've successfully completed this lesson.",
      });
    }
  };

  const goToNextContent = () => {
    if (currentContentIndex < lesson.contents.length - 1) {
      setCurrentContentIndex(currentContentIndex + 1);
    }
  };

  const goToPreviousContent = () => {
    if (currentContentIndex > 0) {
      setCurrentContentIndex(currentContentIndex - 1);
    }
  };

  const overallProgress = calculateOverallProgress(progress);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{lesson.title}</CardTitle>
              {lesson.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {lesson.description}
                </p>
              )}
            </div>
            <Badge variant={overallProgress >= (lesson.completionThreshold || 80) ? "default" : "secondary"}>
              {Math.round(overallProgress)}% Complete
            </Badge>
          </div>
          <Progress value={overallProgress} className="mt-2" />
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">{currentContent.title}</CardTitle>
                <ContentTypeIcon type={currentContent.type} />
              </div>
            </CardHeader>
            <CardContent>
              {currentContent.type === "video" && (
                <VideoPlayer
                  content={currentContent}
                  initialProgress={progress.get(currentContent.id)}
                  onProgressUpdate={(updates) =>
                    handleProgressUpdate(currentContent.id, updates)
                  }
                  onBookmark={(position) =>
                    onBookmark?.(currentContent.id, position)
                  }
                />
              )}

              {currentContent.type === "document" && (
                <DocumentViewer
                  content={currentContent}
                  initialProgress={progress.get(currentContent.id)}
                  onProgressUpdate={(updates) =>
                    handleProgressUpdate(currentContent.id, updates)
                  }
                />
              )}

              {currentContent.type === "slides" && (
                <SlideViewer
                  content={currentContent}
                  initialProgress={progress.get(currentContent.id)}
                  onProgressUpdate={(updates) =>
                    handleProgressUpdate(currentContent.id, updates)
                  }
                />
              )}

              {currentContent.type === "interactive" && (
                <InteractiveContent
                  content={currentContent}
                  initialProgress={progress.get(currentContent.id)}
                  onProgressUpdate={(updates) =>
                    handleProgressUpdate(currentContent.id, updates)
                  }
                />
              )}

              <div className="flex justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={goToPreviousContent}
                  disabled={currentContentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button
                  onClick={goToNextContent}
                  disabled={currentContentIndex === lesson.contents.length - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <ContentNavigation
            contents={lesson.contents}
            currentIndex={currentContentIndex}
            progress={progress}
            onSelect={setCurrentContentIndex}
          />
        </div>
      </div>
    </div>
  );
}

// Content Type Icon
function ContentTypeIcon({ type }: { type: LessonContent["type"] }) {
  const icons = {
    video: <Video className="w-5 h-5" />,
    document: <FileText className="w-5 h-5" />,
    slides: <ImageIcon className="w-5 h-5" />,
    interactive: <Play className="w-5 h-5" />,
  };
  return icons[type];
}

// Video Player Component
function VideoPlayer({
  content,
  initialProgress,
  onProgressUpdate,
  onBookmark,
}: {
  content: LessonContent;
  initialProgress?: LessonProgress;
  onProgressUpdate: (updates: Partial<LessonProgress>) => void;
  onBookmark: (position: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialProgress?.lastPosition || 0);
  const [duration, setDuration] = useState(content.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Update progress every 5 seconds
      if (Math.floor(time) % 5 === 0) {
        const progress = duration > 0 ? (time / duration) * 100 : 0;
        onProgressUpdate({
          progress,
          lastPosition: time,
          completed: progress >= 90, // Consider complete at 90%
        });
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [duration, onProgressUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const time = value[0];
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const vol = value[0];
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={content.url}
          className="w-full aspect-video"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration}
          step={0.1}
          onValueChange={handleSeek}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSeek([Math.max(0, currentTime - 10)])}
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSeek([Math.min(duration, currentTime + 10)])}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onBookmark(currentTime)}>
              <Bookmark className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleMute}>
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
            />
            <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Document Viewer Component
function DocumentViewer({
  content,
  initialProgress,
  onProgressUpdate,
}: {
  content: LessonContent;
  initialProgress?: LessonProgress;
  onProgressUpdate: (updates: Partial<LessonProgress>) => void;
}) {
  const [currentPage, setCurrentPage] = useState(initialProgress?.lastPosition || 1);
  const totalPages = content.pages || 1;

  useEffect(() => {
    const progress = (currentPage / totalPages) * 100;
    onProgressUpdate({
      progress,
      lastPosition: currentPage,
      completed: currentPage === totalPages,
    });
  }, [currentPage, totalPages, onProgressUpdate]);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden bg-muted min-h-[600px] flex items-center justify-center">
        <iframe
          src={`${content.url}#page=${currentPage}`}
          className="w-full h-[600px]"
          title={content.title}
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous Page
        </Button>

        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next Page
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <Button variant="outline" className="w-full" asChild>
        <a href={content.url} download target="_blank" rel="noopener noreferrer">
          <Download className="w-4 h-4 mr-2" />
          Download Document
        </a>
      </Button>
    </div>
  );
}

// Slide Viewer Component
function SlideViewer({
  content,
  initialProgress,
  onProgressUpdate,
}: {
  content: LessonContent;
  initialProgress?: LessonProgress;
  onProgressUpdate: (updates: Partial<LessonProgress>) => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(initialProgress?.lastPosition || 1);
  const totalSlides = content.pages || 1;

  useEffect(() => {
    const progress = (currentSlide / totalSlides) * 100;
    onProgressUpdate({
      progress,
      lastPosition: currentSlide,
      completed: currentSlide === totalSlides,
    });
  }, [currentSlide, totalSlides, onProgressUpdate]);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden bg-muted min-h-[500px] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${content.url}?slide=${currentSlide}`}
          alt={`Slide ${currentSlide}`}
          className="max-w-full max-h-[500px]"
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentSlide(Math.max(1, currentSlide - 1))}
          disabled={currentSlide === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <Progress value={(currentSlide / totalSlides) * 100} className="w-1/2" />

        <span className="text-sm">
          {currentSlide} / {totalSlides}
        </span>

        <Button
          variant="outline"
          onClick={() => setCurrentSlide(Math.min(totalSlides, currentSlide + 1))}
          disabled={currentSlide === totalSlides}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Interactive Content Component
function InteractiveContent({
  content,
  initialProgress,
  onProgressUpdate,
}: {
  content: LessonContent;
  initialProgress?: LessonProgress;
  onProgressUpdate: (updates: Partial<LessonProgress>) => void;
}) {
  const [hasInteracted, setHasInteracted] = useState(initialProgress?.completed || false);

  useEffect(() => {
    if (hasInteracted) {
      onProgressUpdate({
        progress: 100,
        completed: true,
      });
    }
  }, [hasInteracted, onProgressUpdate]);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden min-h-[600px]">
        <iframe
          src={content.url}
          className="w-full h-[600px]"
          title={content.title}
          onLoad={() => setHasInteracted(true)}
        />
      </div>
    </div>
  );
}

// Content Navigation Component
function ContentNavigation({
  contents,
  currentIndex,
  progress,
  onSelect,
}: {
  contents: LessonContent[];
  currentIndex: number;
  progress: Map<string, LessonProgress>;
  onSelect: (index: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contents</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {contents.map((content, index) => {
              const contentProgress = progress.get(content.id);
              const isActive = index === currentIndex;
              const isComplete = contentProgress?.completed || false;

              return (
                <button
                  key={content.id}
                  onClick={() => onSelect(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <ContentTypeIcon type={content.type} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{content.title}</p>
                      {contentProgress && (
                        <Progress
                          value={contentProgress.progress}
                          className="h-1 mt-1"
                        />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

