/**
 * Survey Builder Component (Phase 5 - Week 2)
 * Create and edit surveys with 6 question types
 * 
 * Features:
 * - Drag-drop question ordering
 * - 6 question types: text, textarea, single_choice, multiple_choice, rating, yes_no
 * - Question settings (required, validation, descriptions)
 * - Preview mode
 * - Save/publish workflow
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  Send,
  ChevronDown,
  ChevronUp,
  Copy,
  Settings,
  Type,
  AlignLeft,
  List,
  CheckSquare,
  Star,
  CheckCircle,
} from 'lucide-react';

interface SurveyBuilderProps {
  organizationId: string;
  surveyId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface QuestionChoice {
  id: string;
  text: string;
  order: number;
}

interface Question {
  id: string;
  questionText: string;
  questionType: QuestionType;
  description?: string;
  orderIndex: number;
  section?: string;
  required: boolean;
  choices?: QuestionChoice[];
  allowOther?: boolean;
  minChoices?: number;
  maxChoices?: number;
  ratingMin?: number;
  ratingMax?: number;
  ratingMinLabel?: string;
  ratingMaxLabel?: string;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

type QuestionType = 'text' | 'textarea' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no';
type SurveyType = 'general' | 'feedback' | 'poll' | 'assessment' | 'registration';

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text', icon: Type, description: 'Single line text input' },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft, description: 'Multi-line text area' },
  {
    value: 'single_choice',
    label: 'Single Choice',
    icon: List,
    description: 'Choose one option',
  },
  {
    value: 'multiple_choice',
    label: 'Multiple Choice',
    icon: CheckSquare,
    description: 'Choose multiple options',
  },
  { value: 'rating', label: 'Rating Scale', icon: Star, description: 'Numeric rating (1-10)' },
  { value: 'yes_no', label: 'Yes/No', icon: CheckCircle, description: 'Binary choice' },
];

export function SurveyBuilder({ organizationId, surveyId, onSave, onCancel }: SurveyBuilderProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);

  // Survey metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [surveyType, setSurveyType] = useState<SurveyType>('general');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');

  // Survey settings
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [requireAuthentication, setRequireAuthentication] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  // Load existing survey
  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;
    
    try {
      const response = await fetch(`/api/communications/surveys/${surveyId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load survey');
      }

      const data = await response.json();
      const { survey, questions: loadedQuestions } = data;

      // Set survey metadata
      setTitle(survey.title || '');
      setDescription(survey.description || '');
      setSurveyType(survey.surveyType || 'general');
      setWelcomeMessage(survey.welcomeMessage || '');
      setThankYouMessage(survey.thankYouMessage || '');
      
      // Set survey settings
      setAllowAnonymous(survey.allowAnonymous || false);
      setRequireAuthentication(survey.requireAuthentication || false);
      setShuffleQuestions(survey.shuffleQuestions || false);
      setShowResults(survey.showResults || false);

      // Convert loaded questions to component format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedQuestions: Question[] = loadedQuestions.map((q: any) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        description: q.description,
        orderIndex: q.orderIndex,
        section: q.section,
        required: q.required,
        choices: q.choices?.map((text: string, idx: number) => ({
          id: `opt${idx + 1}`,
          text,
          order: idx,
        })),
        allowOther: q.allowOther,
        minChoices: q.minChoices,
        maxChoices: q.maxChoices,
        ratingMin: q.ratingMin,
        ratingMax: q.ratingMax,
        ratingMinLabel: q.ratingMinLabel,
        ratingMaxLabel: q.ratingMaxLabel,
        minLength: q.minLength,
        maxLength: q.maxLength,
        placeholder: q.placeholder,
      }));

      setQuestions(formattedQuestions);

      toast({
        title: 'Success',
        description: 'Survey loaded successfully',
      });
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load survey',
        variant: 'destructive',
      });
    }
  }, [surveyId, toast]);

  useEffect(() => {
    if (surveyId) {
      loadSurvey();
    }
  }, [surveyId, loadSurvey]);

  // Add new question
  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      questionText: '',
      questionType: type,
      orderIndex: questions.length,
      required: false,
      ...(type === 'single_choice' || type === 'multiple_choice'
        ? {
            choices: [
              { id: 'opt1', text: 'Option 1', order: 0 },
              { id: 'opt2', text: 'Option 2', order: 1 },
            ],
            allowOther: false,
          }
        : {}),
      ...(type === 'rating'
        ? {
            ratingMin: 1,
            ratingMax: 10,
            ratingMinLabel: 'Poor',
            ratingMaxLabel: 'Excellent',
          }
        : {}),
    };

    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.id);
  };

  // Update question
  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  // Delete question
  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id).map((q, i) => ({ ...q, orderIndex: i })));
  };

  // Duplicate question
  const duplicateQuestion = (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    const duplicate: Question = {
      ...question,
      id: `q-${Date.now()}`,
      orderIndex: questions.length,
      questionText: `${question.questionText} (copy)`,
    };

    setQuestions([...questions, duplicate]);
  };

  // Move question
  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex((q) => q.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];

    setQuestions(newQuestions.map((q, i) => ({ ...q, orderIndex: i })));
  };

  // Add choice
  const addChoice = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || !question.choices) return;

    const newChoice: QuestionChoice = {
      id: `opt${Date.now()}`,
      text: `Option ${question.choices.length + 1}`,
      order: question.choices.length,
    };

    updateQuestion(questionId, {
      choices: [...question.choices, newChoice],
    });
  };

  // Update choice
  const updateChoice = (questionId: string, choiceId: string, text: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || !question.choices) return;

    updateQuestion(questionId, {
      choices: question.choices.map((c) => (c.id === choiceId ? { ...c, text } : c)),
    });
  };

  // Delete choice
  const deleteChoice = (questionId: string, choiceId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || !question.choices || question.choices.length <= 2) return;

    updateQuestion(questionId, {
      choices: question.choices.filter((c) => c.id !== choiceId).map((c, i) => ({ ...c, order: i })),
    });
  };

  // Save survey
  const handleSave = async (publish: boolean = false) => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Survey title is required',
        variant: 'destructive',
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Add at least one question',
        variant: 'destructive',
      });
      return;
    }

    // Validate questions
    for (const q of questions) {
      if (!q.questionText.trim()) {
        toast({
          title: 'Validation Error',
          description: 'All questions must have text',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);

    try {
      const url = surveyId 
        ? `/api/communications/surveys/${surveyId}`
        : '/api/communications/surveys';
      
      const response = await fetch(url, {
        method: surveyId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          title,
          description,
          surveyType,
          welcomeMessage,
          thankYouMessage,
          allowAnonymous,
          requireAuthentication,
          shuffleQuestions,
          showResults,
          status: publish ? 'published' : 'draft',
          publishedAt: publish ? new Date().toISOString() : null,
          questions: questions.map((q) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            description: q.description,
            orderIndex: q.orderIndex,
            section: q.section,
            required: q.required,
            choices: q.choices,
            allowOther: q.allowOther,
            minChoices: q.minChoices,
            maxChoices: q.maxChoices,
            ratingMin: q.ratingMin,
            ratingMax: q.ratingMax,
            ratingMinLabel: q.ratingMinLabel,
            ratingMaxLabel: q.ratingMaxLabel,
            minLength: q.minLength,
            maxLength: q.maxLength,
            placeholder: q.placeholder,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to save survey');

      toast({
        title: 'Success',
        description: publish ? 'Survey published successfully' : 'Survey saved as draft',
      });

      if (onSave) onSave();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to save survey',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Render question editor
  const renderQuestionEditor = (question: Question) => {
    const isExpanded = expandedQuestion === question.id;
    const typeInfo = QUESTION_TYPES.find((t) => t.value === question.questionType);
    const Icon = typeInfo?.icon || Type;

    return (
      <Card key={question.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="cursor-move">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{typeInfo?.label}</Badge>
              </div>
              <Input
                value={question.questionText}
                onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
                placeholder="Enter your question..."
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveQuestion(question.id, 'up')}
                disabled={question.orderIndex === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveQuestion(question.id, 'down')}
                disabled={question.orderIndex === questions.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateQuestion(question.id)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteQuestion(question.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Description */}
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={question.description || ''}
                onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
                placeholder="Add help text for respondents..."
                rows={2}
              />
            </div>

            {/* Choice-based questions */}
            {(question.questionType === 'single_choice' ||
              question.questionType === 'multiple_choice') && (
              <div className="space-y-2">
                <Label>Choices</Label>
                {question.choices?.map((choice) => (
                  <div key={choice.id} className="flex items-center gap-2">
                    <Input
                      value={choice.text}
                      onChange={(e) => updateChoice(question.id, choice.id, e.target.value)}
                      placeholder="Choice text..."
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChoice(question.id, choice.id)}
                      disabled={question.choices!.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addChoice(question.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Choice
                </Button>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={question.allowOther || false}
                    onCheckedChange={(checked) =>
                      updateQuestion(question.id, { allowOther: checked })
                    }
                  />
                  {/* eslint-disable-next-line react/no-unescaped-entities */}
                  <Label>Allow "Other" option</Label>
                </div>
              </div>
            )}

            {/* Multiple choice settings */}
            {question.questionType === 'multiple_choice' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Minimum selections</Label>
                  <Input
                    type="number"
                    min={0}
                    value={question.minChoices || ''}
                    onChange={(e) =>
                      updateQuestion(question.id, { minChoices: parseInt(e.target.value) || undefined })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label>Maximum selections</Label>
                  <Input
                    type="number"
                    min={1}
                    value={question.maxChoices || ''}
                    onChange={(e) =>
                      updateQuestion(question.id, { maxChoices: parseInt(e.target.value) || undefined })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            {/* Rating scale settings */}
            {question.questionType === 'rating' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Minimum value</Label>
                    <Input
                      type="number"
                      value={question.ratingMin || 1}
                      onChange={(e) =>
                        updateQuestion(question.id, { ratingMin: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Maximum value</Label>
                    <Input
                      type="number"
                      value={question.ratingMax || 10}
                      onChange={(e) =>
                        updateQuestion(question.id, { ratingMax: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min label (optional)</Label>
                    <Input
                      value={question.ratingMinLabel || ''}
                      onChange={(e) =>
                        updateQuestion(question.id, { ratingMinLabel: e.target.value })
                      }
                      placeholder="e.g., Poor"
                    />
                  </div>
                  <div>
                    <Label>Max label (optional)</Label>
                    <Input
                      value={question.ratingMaxLabel || ''}
                      onChange={(e) =>
                        updateQuestion(question.id, { ratingMaxLabel: e.target.value })
                      }
                      placeholder="e.g., Excellent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Text input settings */}
            {(question.questionType === 'text' || question.questionType === 'textarea') && (
              <div className="space-y-4">
                <div>
                  <Label>Placeholder (optional)</Label>
                  <Input
                    value={question.placeholder || ''}
                    onChange={(e) => updateQuestion(question.id, { placeholder: e.target.value })}
                    placeholder="Enter placeholder text..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min length</Label>
                    <Input
                      type="number"
                      min={0}
                      value={question.minLength || ''}
                      onChange={(e) =>
                        updateQuestion(question.id, { minLength: parseInt(e.target.value) || undefined })
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label>Max length</Label>
                    <Input
                      type="number"
                      min={1}
                      value={question.maxLength || ''}
                      onChange={(e) =>
                        updateQuestion(question.id, { maxLength: parseInt(e.target.value) || undefined })
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Required toggle */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch
                checked={question.required}
                onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
              />
              <Label>Required question</Label>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {surveyId ? 'Edit Survey' : 'Create Survey'}
          </h2>
          <p className="text-muted-foreground">
            Build your survey with drag-drop questions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}>
            <Eye className="mr-2 h-4 w-4" />
            {mode === 'edit' ? 'Preview' : 'Edit'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Survey Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Survey Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Survey title..."
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={surveyType} onValueChange={(v: SurveyType) => setSurveyType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="poll">Poll</SelectItem>
                    <SelectItem value="assessment">Assessment</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Allow anonymous</Label>
                <Switch checked={allowAnonymous} onCheckedChange={setAllowAnonymous} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require login</Label>
                <Switch
                  checked={requireAuthentication}
                  onCheckedChange={setRequireAuthentication}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Shuffle questions</Label>
                <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show results after</Label>
                <Switch checked={showResults} onCheckedChange={setShowResults} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUESTION_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addQuestion(type.value as QuestionType)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right: Questions */}
        <div className="md:col-span-2">
          <ScrollArea className="h-[800px]">
            {questions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <List className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Questions Yet</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Add questions from the left sidebar to build your survey
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => renderQuestionEditor(question))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

