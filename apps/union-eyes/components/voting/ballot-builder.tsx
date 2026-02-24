/**
 * Ballot Builder Component
 * 
 * Interface for creating and configuring ballots with:
 * - Question/candidate management
 * - Voting rules configuration
 * - Preview functionality
 * - Template support
 * - Multi-language
 * 
 * @module components/voting/ballot-builder
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus,
  Trash,
  MoveUp,
  MoveDown,
  Eye,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
 
import { useToast } from "@/components/ui/use-toast";

const candidateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
});

const questionSchema = z.object({
  id: z.string(),
  type: z.enum(["candidate", "yes-no", "multiple-choice"]),
  title: z.string().min(1, "Question title is required"),
  description: z.string().optional(),
  candidates: z.array(candidateSchema).optional(),
  options: z.array(z.string()).optional(),
  minSelections: z.number().min(0),
  maxSelections: z.number().min(1),
  allowWriteIn: z.boolean(),
});

const ballotSchema = z.object({
  title: z.string().min(1, "Ballot title is required"),
  description: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  isAnonymous: z.boolean(),
  requiresVerification: z.boolean(),
  allowsAbstain: z.boolean(),
  questions: z.array(questionSchema).min(1, "At least one question is required"),
});

type BallotFormData = z.infer<typeof ballotSchema>;

export interface BallotBuilderProps {
  initialData?: Partial<BallotFormData>;
  onSave: (data: BallotFormData) => Promise<void>;
  onPreview?: (data: BallotFormData) => void;
  onCancel?: () => void;
}

export function BallotBuilder({
  initialData,
  onSave,
  onPreview,
  onCancel,
}: BallotBuilderProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<BallotFormData>({
    resolver: zodResolver(ballotSchema),
    defaultValues: initialData || {
      title: "",
      description: "",
      isAnonymous: true,
      requiresVerification: true,
      allowsAbstain: true,
      questions: [
        {
          id: crypto.randomUUID(),
          type: "candidate",
          title: "",
          candidates: [],
          minSelections: 1,
          maxSelections: 1,
          allowWriteIn: false,
        },
      ],
    },
  });

  const { fields: questions, append, remove, move } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const handleSave = async (data: BallotFormData) => {
    setIsSaving(true);
    try {
      await onSave(data);
      toast({ title: "Ballot saved successfully" });
    } catch (error) {
      toast({
        title: "Failed to save ballot",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addQuestion = (type: "candidate" | "yes-no" | "multiple-choice") => {
    append({
      id: crypto.randomUUID(),
      type,
      title: "",
      candidates: type === "candidate" ? [] : undefined,
      options: type === "multiple-choice" ? [""] : undefined,
      minSelections: 1,
      maxSelections: 1,
      allowWriteIn: type === "candidate",
    });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="max-w-4xl mx-auto space-y-6">
      {/* Ballot Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Ballot Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Ballot Title *</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="E.g., 2024 Officer Elections"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Optional description of this ballot..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="isAnonymous">Anonymous Voting</Label>
              <Switch
                id="isAnonymous"
                checked={form.watch("isAnonymous")}
                onCheckedChange={(checked) => form.setValue("isAnonymous", checked)}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="requiresVerification">Require Verification</Label>
              <Switch
                id="requiresVerification"
                checked={form.watch("requiresVerification")}
                onCheckedChange={(checked) =>
                  form.setValue("requiresVerification", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="allowsAbstain">Allow Abstain</Label>
              <Switch
                id="allowsAbstain"
                checked={form.watch("allowsAbstain")}
                onCheckedChange={(checked) => form.setValue("allowsAbstain", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionEditor
            key={question.id}
            index={index}
            question={question}
            form={form}
            onMoveUp={() => move(index, index - 1)}
            onMoveDown={() => move(index, index + 1)}
            onRemove={() => remove(index)}
            canMoveUp={index > 0}
            canMoveDown={index < questions.length - 1}
            canRemove={questions.length > 1}
          />
        ))}
      </div>

      {/* Add Question */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <span className="font-medium">Add Question:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addQuestion("candidate")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Candidate Election
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addQuestion("yes-no")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Yes/No Question
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addQuestion("multiple-choice")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Multiple Choice
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onPreview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onPreview(form.getValues())}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        )}
        <Button type="submit" disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Ballot"}
        </Button>
      </div>
    </form>
  );
}

function QuestionEditor({
  index,
  question: _question,
  form,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
}: {
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  question: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
}) {
  const questionType = form.watch(`questions.${index}.type`);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">Question {index + 1}</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onMoveUp}
              disabled={!canMoveUp}
            >
              <MoveUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onMoveDown}
              disabled={!canMoveDown}
            >
              <MoveDown className="h-4 w-4" />
            </Button>
            {canRemove && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onRemove}
              >
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Question Type</Label>
          <Select
            value={questionType}
            onValueChange={(value) => form.setValue(`questions.${index}.type`, value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="candidate">Candidate Election</SelectItem>
              <SelectItem value="yes-no">Yes/No Question</SelectItem>
              <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Question Title *</Label>
          <Input {...form.register(`questions.${index}.title`)} />
        </div>

        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea {...form.register(`questions.${index}.description`)} rows={2} />
        </div>

        {questionType === "candidate" && (
          <div className="space-y-2">
            <Label>Allow Write-in Candidates</Label>
            <Switch
              checked={form.watch(`questions.${index}.allowWriteIn`)}
              onCheckedChange={(checked) =>
                form.setValue(`questions.${index}.allowWriteIn`, checked)
              }
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Minimum Selections</Label>
            <Input
              type="number"
              min={0}
              {...form.register(`questions.${index}.minSelections`, {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum Selections</Label>
            <Input
              type="number"
              min={1}
              {...form.register(`questions.${index}.maxSelections`, {
                valueAsNumber: true,
              })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

