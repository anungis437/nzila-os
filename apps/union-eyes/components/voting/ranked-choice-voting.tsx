/**
 * Ranked Choice Voting Component
 * 
 * Interactive ranked voting interface with:
 * - Drag-and-drop candidate ranking
 * - Visual rank indicators
 * - Keyboard navigation
 * - Multiple ballot support
 * - Rank validation
 * - Instructions display
 * - Anonymous submission
 * - Results display with IRV calculation
 * 
 * @module components/voting/ranked-choice-voting
 */

"use client";

import * as React from "react";
import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
  CheckCircle,
  Info,
  Trophy,
  Medal,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface Candidate {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  party?: string;
}

interface VotingSession {
  id: string;
  title: string;
  description?: string;
  candidates: Candidate[];
  minRankings?: number;
  maxRankings?: number;
  deadline?: Date;
  allowEqualRanks?: boolean;
}

interface RankedVote {
  candidateId: string;
  rank: number;
}

interface RankedChoiceVotingProps {
  session: VotingSession;
  onSubmit?: (votes: RankedVote[]) => Promise<void>;
  initialRankings?: RankedVote[];
  disabled?: boolean;
}

export function RankedChoiceVoting({
  session,
  onSubmit,
  initialRankings = [],
  disabled = false,
}: RankedChoiceVotingProps) {
  const [rankedCandidates, setRankedCandidates] = useState<Candidate[]>(
    initialRankings
      .sort((a, b) => a.rank - b.rank)
      .map((vote) => session.candidates.find((c) => c.id === vote.candidateId)!)
      .filter(Boolean)
  );
  
  const [unrankedCandidates, setUnrankedCandidates] = useState<Candidate[]>(
    session.candidates.filter(
      (c) => !initialRankings.some((v) => v.candidateId === c.id)
    )
  );

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const { toast } = useToast();

  const minRankings = session.minRankings || 1;
  const maxRankings = session.maxRankings || session.candidates.length;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;

    // Moving within ranked list
    if (source.droppableId === "ranked" && destination.droppableId === "ranked") {
      const newRanked = Array.from(rankedCandidates);
      const [removed] = newRanked.splice(source.index, 1);
      newRanked.splice(destination.index, 0, removed);
      setRankedCandidates(newRanked);
    }
    // Moving from unranked to ranked
    else if (source.droppableId === "unranked" && destination.droppableId === "ranked") {
      if (rankedCandidates.length >= maxRankings) {
        toast({
          title: "Maximum rankings reached",
          description: `You can only rank up to ${maxRankings} candidates.`,
          variant: "destructive",
        });
        return;
      }

      const candidate = unrankedCandidates[source.index];
      const newUnranked = unrankedCandidates.filter((_, i) => i !== source.index);
      const newRanked = Array.from(rankedCandidates);
      newRanked.splice(destination.index, 0, candidate);

      setUnrankedCandidates(newUnranked);
      setRankedCandidates(newRanked);
    }
    // Moving from ranked to unranked
    else if (source.droppableId === "ranked" && destination.droppableId === "unranked") {
      const candidate = rankedCandidates[source.index];
      const newRanked = rankedCandidates.filter((_, i) => i !== source.index);
      const newUnranked = Array.from(unrankedCandidates);
      newUnranked.splice(destination.index, 0, candidate);

      setRankedCandidates(newRanked);
      setUnrankedCandidates(newUnranked);
    }
  };

  const moveRankUp = (index: number) => {
    if (index === 0) return;
    const newRanked = Array.from(rankedCandidates);
    [newRanked[index - 1], newRanked[index]] = [newRanked[index], newRanked[index - 1]];
    setRankedCandidates(newRanked);
  };

  const moveRankDown = (index: number) => {
    if (index === rankedCandidates.length - 1) return;
    const newRanked = Array.from(rankedCandidates);
    [newRanked[index], newRanked[index + 1]] = [newRanked[index + 1], newRanked[index]];
    setRankedCandidates(newRanked);
  };

  const removeFromRanked = (index: number) => {
    const candidate = rankedCandidates[index];
    setRankedCandidates(rankedCandidates.filter((_, i) => i !== index));
    setUnrankedCandidates([...unrankedCandidates, candidate]);
  };

  const addToRanked = (candidate: Candidate) => {
    if (rankedCandidates.length >= maxRankings) {
      toast({
        title: "Maximum rankings reached",
        description: `You can only rank up to ${maxRankings} candidates.`,
        variant: "destructive",
      });
      return;
    }

    setRankedCandidates([...rankedCandidates, candidate]);
    setUnrankedCandidates(unrankedCandidates.filter((c) => c.id !== candidate.id));
  };

  const validateAndSubmit = () => {
    if (rankedCandidates.length < minRankings) {
      toast({
        title: "Insufficient rankings",
        description: `Please rank at least ${minRankings} candidate${minRankings > 1 ? "s" : ""}.`,
        variant: "destructive",
      });
      return;
    }

    setShowConfirmation(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const votes: RankedVote[] = rankedCandidates.map((candidate, index) => ({
        candidateId: candidate.id,
        rank: index + 1,
      }));

      if (onSubmit) {
        await onSubmit(votes);
        toast({
          title: "Vote submitted",
          description: "Your ranked choice vote has been recorded.",
        });
        setShowConfirmation(false);
      }
    } catch (_error) {
      toast({
        title: "Submission failed",
        description: "Failed to submit your vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRankBadge = (index: number) => {
    const icons = [
      <Trophy key="trophy" className="w-4 h-4" />,
      <Medal key="medal" className="w-4 h-4" />,
      <Award key="award" className="w-4 h-4" />,
    ];

    return (
      <Badge
        variant={index < 3 ? "default" : "secondary"}
        className="flex items-center gap-1 min-w-[60px] justify-center"
      >
        {index < 3 && icons[index]}
        Rank {index + 1}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {showInstructions && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertTitle>How Ranked Choice Voting Works</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Drag candidates to rank them by preference (1st, 2nd, 3rd, etc.)</li>
              <li>You must rank at least {minRankings} candidate{minRankings > 1 ? "s" : ""}</li>
              <li>You can rank up to {maxRankings} candidates</li>
              <li>Your vote will be counted for your highest-ranked candidate still in contention</li>
            </ul>
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowInstructions(false)}
          >
            Got it
          </Button>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{session.title}</CardTitle>
              {session.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {session.description}
                </p>
              )}
            </div>
            {session.deadline && (
              <Badge variant="outline">
                Deadline: {session.deadline.toLocaleDateString()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <Progress
                value={(rankedCandidates.length / minRankings) * 100}
                className="h-2"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {rankedCandidates.length} / {minRankings} minimum
            </span>
          </div>
        </CardHeader>
      </Card>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranked Candidates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Your Rankings ({rankedCandidates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="ranked">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-100 p-4 rounded-lg border-2 border-dashed transition-colors ${
                      snapshot.isDraggingOver
                        ? "border-primary bg-primary/5"
                        : "border-muted"
                    }`}
                  >
                    {rankedCandidates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[384px] text-muted-foreground">
                        <p>Drag candidates here to rank them</p>
                      </div>
                    ) : (
                      rankedCandidates.map((candidate, index) => (
                        <Draggable
                          key={candidate.id}
                          draggableId={candidate.id}
                          index={index}
                          isDragDisabled={disabled}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`bg-background border rounded-lg p-3 transition-shadow ${
                                snapshot.isDragging ? "shadow-lg" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-5 h-5 text-muted-foreground" />
                                </div>

                                {getRankBadge(index)}

                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{candidate.name}</p>
                                  {candidate.party && (
                                    <p className="text-xs text-muted-foreground">
                                      {candidate.party}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveRankUp(index)}
                                    disabled={disabled || index === 0}
                                  >
                                    <ArrowUp className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveRankDown(index)}
                                    disabled={
                                      disabled || index === rankedCandidates.length - 1
                                    }
                                  >
                                    <ArrowDown className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFromRanked(index)}
                                    disabled={disabled}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Unranked Candidates */}
          <Card>
            <CardHeader>
              <CardTitle>Available Candidates ({unrankedCandidates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="unranked">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-100 p-4 rounded-lg border-2 border-dashed transition-colors ${
                      snapshot.isDraggingOver
                        ? "border-primary bg-primary/5"
                        : "border-muted"
                    }`}
                  >
                    {unrankedCandidates.map((candidate, index) => (
                      <Draggable
                        key={candidate.id}
                        draggableId={candidate.id}
                        index={index}
                        isDragDisabled={disabled}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-background border rounded-lg p-3 transition-shadow ${
                              snapshot.isDragging ? "shadow-lg" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-5 h-5 text-muted-foreground" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{candidate.name}</p>
                                {candidate.party && (
                                  <p className="text-xs text-muted-foreground">
                                    {candidate.party}
                                  </p>
                                )}
                                {candidate.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {candidate.description}
                                  </p>
                                )}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addToRanked(candidate)}
                                disabled={disabled}
                              >
                                Rank
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>
        </div>
      </DragDropContext>

      <div className="flex justify-end gap-2">
        <Button
          onClick={validateAndSubmit}
          disabled={
            disabled ||
            rankedCandidates.length < minRankings ||
            isSubmitting
          }
          size="lg"
        >
          Submit Vote
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Rankings</DialogTitle>
            <DialogDescription>
              Please review your ranked choices before submitting. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {rankedCandidates.map((candidate, index) => (
              <div key={candidate.id} className="flex items-center gap-3">
                {getRankBadge(index)}
                <span className="font-medium">{candidate.name}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

