/**
 * Quiz Builder Component
 * 
 * Interactive quiz creation tool with:
 * - Multiple question types (multiple choice, true/false, short answer)
 * - Drag-and-drop question reordering
 * - Rich text editing for questions
 * - Answer validation
 * - Point assignment
 * - Preview mode
 * 
 * @module components/education/quiz-builder
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Copy,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const questionSchema = z.object({
  id: z.string(),
  question: z.string().min(1, "Question is required"),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  points: z.number().min(1),
  explanation: z.string().optional(),
});

const quizSchema = z.object({
  title: z.string().min(1, "Quiz title is required"),
  description: z.string().optional(),
  courseId: z.string().optional(),
  passingScore: z.number().min(0).max(100),
  timeLimit: z.number().optional(),
  questions: z.array(questionSchema).min(1, "At least one question is required"),
});

type QuizData = z.infer<typeof quizSchema>;

interface QuizBuilderProps {
  courseId?: string;
  initialData?: Partial<QuizData>;
  onSave?: (data: QuizData) => void;
  onCancel?: () => void;
}

export function QuizBuilder({
  courseId,
  initialData,
  onSave,
  onCancel,
}: QuizBuilderProps) {
  const { toast } = useToast();
  const [previewMode, setPreviewMode] = React.useState(false);

  const form = useForm<QuizData>({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      courseId: courseId || initialData?.courseId,
      passingScore: initialData?.passingScore || 70,
      timeLimit: initialData?.timeLimit,
      questions: initialData?.questions || [
        {
          // eslint-disable-next-line react-hooks/purity
          id: `q-${Date.now()}`,
          question: "",
          type: "multiple_choice",
          options: ["", "", "", ""],
          correctAnswer: "",
          points: 1,
        },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const addQuestion = () => {
    append({
      id: `q-${Date.now()}`,
      question: "",
      type: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 1,
    });
  };

  const duplicateQuestion = (index: number) => {
    const question = form.getValues(`questions.${index}`);
    append({
      ...question,
      // eslint-disable-next-line react-hooks/purity
      id: `q-${Date.now()}`,
    });
  };

  const handleSubmit = async (data: QuizData) => {
    try {
      if (onSave) {
        await onSave(data);
        toast({
          title: "Quiz saved",
          description: "Your quiz has been saved successfully.",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save quiz. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={previewMode ? "preview" : "edit"} onValueChange={(v) => setPreviewMode(v === "preview")}>
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={form.handleSubmit(handleSubmit)}>
              <Save className="w-4 h-4 mr-2" />
              Save Quiz
            </Button>
          </div>
        </div>

        <TabsContent value="edit">
          <Form {...form}>
            <form className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quiz Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter quiz title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter quiz description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="passingScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passing Score (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timeLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Limit (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Optional"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseInt(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Leave empty for no time limit
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Questions</h3>
                  <Button onClick={addQuestion} type="button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <QuestionEditor
                    key={field.id}
                    index={index}
                    form={form}
                    onRemove={() => remove(index)}
                    onDuplicate={() => duplicateQuestion(index)}
                    onMoveUp={index > 0 ? () => move(index, index - 1) : undefined}
                    onMoveDown={
                      index < fields.length - 1
                        ? () => move(index, index + 1)
                        : undefined
                    }
                  />
                ))}
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="preview">
          <QuizPreview quiz={form.getValues()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Question Editor Component
function QuestionEditor({
  index,
  form,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const questionType = form.watch(`questions.${index}.type`);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
            <Badge>Question {index + 1}</Badge>
            <FormField
              control={form.control}
              name={`questions.${index}.type`}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">
                      Multiple Choice
                    </SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex gap-2">
            {onMoveUp && (
              <Button variant="ghost" size="sm" onClick={onMoveUp}>
                ↑
              </Button>
            )}
            {onMoveDown && (
              <Button variant="ghost" size="sm" onClick={onMoveDown}>
                ↓
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name={`questions.${index}.question`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question Text</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter your question" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {questionType === "multiple_choice" && (
          <MultipleChoiceEditor index={index} form={form} />
        )}

        {questionType === "true_false" && (
          <TrueFalseEditor index={index} form={form} />
        )}

        {questionType === "short_answer" && (
          <ShortAnswerEditor index={index} form={form} />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`questions.${index}.points`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Points</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name={`questions.${index}.explanation`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Explanation (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain the correct answer"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Shown to students after they answer
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

// Multiple Choice Editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MultipleChoiceEditor({ index, form }: { index: number; form: any }) {
  const options = form.watch(`questions.${index}.options`) || [];

  return (
    <div className="space-y-2">
      <Label>Answer Options</Label>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {options.map((_: any, optionIndex: number) => (
        <div key={optionIndex} className="flex gap-2 items-center">
          <FormField
            control={form.control}
            name={`questions.${index}.correctAnswer`}
            render={({ field }) => (
              <Checkbox
                checked={field.value === `${optionIndex}`}
                onCheckedChange={(checked) => {
                  if (checked) {
                    field.onChange(`${optionIndex}`);
                  }
                }}
              />
            )}
          />
          <FormField
            control={form.control}
            name={`questions.${index}.options.${optionIndex}`}
            render={({ field }) => (
              <Input placeholder={`Option ${optionIndex + 1}`} {...field} />
            )}
          />
        </div>
      ))}
    </div>
  );
}

// True/False Editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrueFalseEditor({ index, form }: { index: number; form: any }) {
  return (
    <FormField
      control={form.control}
      name={`questions.${index}.correctAnswer`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Correct Answer</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value as string}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id={`q${index}-true`} />
                <Label htmlFor={`q${index}-true`}>True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id={`q${index}-false`} />
                <Label htmlFor={`q${index}-false`}>False</Label>
              </div>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Short Answer Editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShortAnswerEditor({ index, form }: { index: number; form: any }) {
  return (
    <FormField
      control={form.control}
      name={`questions.${index}.correctAnswer`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Correct Answer</FormLabel>
          <FormControl>
            <Input
              placeholder="Enter the correct answer"
              {...field}
              value={field.value as string}
            />
          </FormControl>
          <FormDescription>
            Student answers will be checked against this
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Quiz Preview Component
function QuizPreview({ quiz }: { quiz: QuizData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{quiz.title}</CardTitle>
          {quiz.description && <p className="text-muted-foreground">{quiz.description}</p>}
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Passing Score: {quiz.passingScore}%</span>
            {quiz.timeLimit && <span>Time Limit: {quiz.timeLimit} minutes</span>}
            <span>{quiz.questions.length} Questions</span>
            <span>
              Total Points: {quiz.questions.reduce((sum, q) => sum + q.points, 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {quiz.questions.map((question, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle className="text-base">
                Question {index + 1}
              </CardTitle>
              <Badge variant="secondary">{question.points} pts</Badge>
            </div>
            <p className="text-sm mt-2">{question.question}</p>
          </CardHeader>
          <CardContent>
            {question.type === "multiple_choice" && question.options && (
              <div className="space-y-2">
                {question.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 border rounded-full" />
                    <span>{option}</span>
                  </div>
                ))}
              </div>
            )}
            {question.type === "true_false" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border rounded-full" />
                  <span>True</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border rounded-full" />
                  <span>False</span>
                </div>
              </div>
            )}
            {question.type === "short_answer" && (
              <Input placeholder="Type your answer here" disabled />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

