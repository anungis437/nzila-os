/**
 * Vote Casting Interface Component
 * 
 * Secure voting interface with:
 * - Ballot display
 * - Selection validation
 * - Write-in candidate support
 * - Review before submission
 * - Verification
 * - Receipt generation
 * 
 * @module components/voting/vote-casting-interface
 */

"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
 
import { cn } from "@/lib/utils";

export interface BallotQuestion {
  id: string;
  type: "candidate" | "yes-no" | "multiple-choice";
  title: string;
  description?: string;
  minSelections: number;
  maxSelections: number;
  allowWriteIn?: boolean;
  candidates?: Array<{
    id: string;
    name: string;
    description?: string;
    photoUrl?: string;
  }>;
  options?: string[];
}

export interface Ballot {
  id: string;
  title: string;
  description?: string;
  questions: BallotQuestion[];
  isAnonymous: boolean;
  requiresVerification: boolean;
  allowsAbstain: boolean;
}

export interface VoteCastingInterfaceProps {
  ballot: Ballot;
  onSubmit: (votes: Record<string, string[]>) => Promise<void>;
  onCancel?: () => void;
}

export function VoteCastingInterface({
  ballot,
  onSubmit,
  onCancel: _onCancel,
}: VoteCastingInterfaceProps) {
  const { toast } = useToast();
  const [votes, setVotes] = React.useState<Record<string, string[]>>({});
  const [writeIns, setWriteIns] = React.useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [showReviewDialog, setShowReviewDialog] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const currentQuestion = ballot.questions[currentQuestionIndex];

  const handleVoteChange = (questionId: string, value: string | string[]) => {
    setVotes((prev) => ({
      ...prev,
      [questionId]: Array.isArray(value) ? value : [value],
    }));
  };

  const handleWriteInChange = (questionId: string, value: string) => {
    setWriteIns((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const validateQuestion = (question: BallotQuestion): boolean => {
    const questionVotes = votes[question.id] || [];
    
    if (questionVotes.length < question.minSelections) {
      toast({
        title: "Selection required",
        description: `Please make at least ${question.minSelections} selection(s)`,
        variant: "destructive",
      });
      return false;
    }

    if (questionVotes.length > question.maxSelections) {
      toast({
        title: "Too many selections",
        description: `Please select no more than ${question.maxSelections} option(s)`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateQuestion(currentQuestion)) return;

    if (currentQuestionIndex < ballot.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowReviewDialog(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Merge write-ins with regular votes
      const finalVotes = { ...votes };
      Object.entries(writeIns).forEach(([questionId, writeIn]) => {
        if (writeIn.trim()) {
          finalVotes[questionId] = [...(finalVotes[questionId] || []), `write-in:${writeIn}`];
        }
      });

      await onSubmit(finalVotes);
      
      toast({
        title: "Vote submitted successfully",
        description: "Thank you for participating in this election",
      });
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowReviewDialog(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-1">{ballot.title}</h2>
              {ballot.description && (
                <p className="text-sm text-blue-800">{ballot.description}</p>
              )}
              <div className="flex gap-2 mt-2">
                {ballot.isAnonymous && (
                  <Badge variant="secondary">Anonymous</Badge>
                )}
                {ballot.requiresVerification && (
                  <Badge variant="secondary">Verified</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Question {currentQuestionIndex + 1} of {ballot.questions.length}
        </span>
        <div className="flex gap-1">
          {ballot.questions.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-8 h-1 rounded-full transition-colors",
                index === currentQuestionIndex
                  ? "bg-blue-600"
                  : index < currentQuestionIndex
                  ? "bg-green-500"
                  : "bg-gray-300"
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <Card>
        <CardHeader>
          <CardTitle>{currentQuestion.title}</CardTitle>
          {currentQuestion.description && (
            <p className="text-sm text-gray-600">{currentQuestion.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion.type === "candidate" && (
            <CandidateQuestion
              question={currentQuestion}
              selectedVotes={votes[currentQuestion.id] || []}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onVoteChange={(value: any) => handleVoteChange(currentQuestion.id, value)}
              writeInValue={writeIns[currentQuestion.id] || ""}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onWriteInChange={(value: any) => handleWriteInChange(currentQuestion.id, value)}
            />
          )}

          {currentQuestion.type === "yes-no" && (
            <YesNoQuestion
              question={currentQuestion}
              selectedVote={votes[currentQuestion.id]?.[0]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onVoteChange={(value: any) => handleVoteChange(currentQuestion.id, [value])}
            />
          )}

          {currentQuestion.type === "multiple-choice" && (
            <MultipleChoiceQuestion
              question={currentQuestion}
              selectedVotes={votes[currentQuestion.id] || []}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onVoteChange={(value: any) => handleVoteChange(currentQuestion.id, value)}
            />
          )}

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <p>
              Select {currentQuestion.minSelections === currentQuestion.maxSelections
                ? `exactly ${currentQuestion.minSelections}`
                : `${currentQuestion.minSelections} to ${currentQuestion.maxSelections}`}{" "}
              option(s)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>
        <Button onClick={handleNext}>
          {currentQuestionIndex === ballot.questions.length - 1 ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Review Ballot
            </>
          ) : (
            "Next Question"
          )}
        </Button>
      </div>

      {/* Review Dialog */}
      <ReviewDialog
        ballot={ballot}
        votes={votes}
        writeIns={writeIns}
        isOpen={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

function CandidateQuestion({
  question,
  selectedVotes,
  onVoteChange,
  writeInValue,
  onWriteInChange,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) {
  const multiSelect = question.maxSelections > 1;

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {question.candidates?.map((candidate: any) => (
        <div
          key={candidate.id}
          className={cn(
            "border rounded-lg p-4 cursor-pointer transition-colors",
            selectedVotes.includes(candidate.id)
              ? "border-blue-500 bg-blue-50"
              : "hover:bg-gray-50"
          )}
          onClick={() => {
            if (multiSelect) {
              const newVotes = selectedVotes.includes(candidate.id)
                ? selectedVotes.filter((v: string) => v !== candidate.id)
                : [...selectedVotes, candidate.id];
              onVoteChange(newVotes);
            } else {
              onVoteChange([candidate.id]);
            }
          }}
        >
          <div className="flex items-start gap-4">
            {multiSelect ? (
              <Checkbox
                checked={selectedVotes.includes(candidate.id)}
                onCheckedChange={() => {}}
              />
            ) : (
              <RadioGroupItem
                value={candidate.id}
                checked={selectedVotes.includes(candidate.id)}
              />
            )}
            <div className="flex-1">
              <div className="font-medium">{candidate.name}</div>
              {candidate.description && (
                <p className="text-sm text-gray-600 mt-1">{candidate.description}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {question.allowWriteIn && (
        <div className="border rounded-lg p-4">
          <Label className="mb-2 block">Write-in Candidate</Label>
          <Input
            value={writeInValue}
            onChange={(e) => onWriteInChange(e.target.value)}
            placeholder="Enter candidate name..."
          />
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function YesNoQuestion({ _question, selectedVote, onVoteChange }: any) {
  return (
    <RadioGroup value={selectedVote} onValueChange={onVoteChange}>
      <div className="space-y-3">
        {["yes", "no", "abstain"].map((option) => (
          <div
            key={option}
            className={cn(
              "border rounded-lg p-4 cursor-pointer transition-colors",
              selectedVote === option ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
            )}
            onClick={() => onVoteChange(option)}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value={option} />
              <Label className="cursor-pointer capitalize font-medium">
                {option}
              </Label>
            </div>
          </div>
        ))}
      </div>
    </RadioGroup>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MultipleChoiceQuestion({ question, selectedVotes, onVoteChange }: any) {
  const multiSelect = question.maxSelections > 1;

  return (
    <div className="space-y-3">
      {question.options?.map((option: string, index: number) => (
        <div
          key={index}
          className={cn(
            "border rounded-lg p-4 cursor-pointer transition-colors",
            selectedVotes.includes(option)
              ? "border-blue-500 bg-blue-50"
              : "hover:bg-gray-50"
          )}
          onClick={() => {
            if (multiSelect) {
              const newVotes = selectedVotes.includes(option)
                ? selectedVotes.filter((v: string) => v !== option)
                : [...selectedVotes, option];
              onVoteChange(newVotes);
            } else {
              onVoteChange([option]);
            }
          }}
        >
          <div className="flex items-center gap-3">
            {multiSelect ? (
              <Checkbox checked={selectedVotes.includes(option)} />
            ) : (
              <RadioGroupItem value={option} checked={selectedVotes.includes(option)} />
            )}
            <Label className="cursor-pointer">{option}</Label>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewDialog({
  ballot,
  votes,
  _writeIns,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Your Ballot</DialogTitle>
          <DialogDescription>
            Please review your selections before submitting. Once submitted, your vote cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ballot.questions.map((question: BallotQuestion, index: number) => (
            <Card key={question.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Question {index + 1}: {question.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  {votes[question.id]?.map((voteId: string) => {
                    if (voteId.startsWith("write-in:")) {
                      return (
                        <div key={voteId} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Write-in: {voteId.replace("write-in:", "")}</span>
                        </div>
                      );
                    }
                    const candidate = question.candidates?.find((c) => c.id === voteId);
                    return (
                      <div key={voteId} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{candidate?.name || voteId}</span>
                      </div>
                    );
                  }) || (
                    <div className="flex items-center gap-2 text-gray-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>No selection made</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Go Back
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Ballot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

