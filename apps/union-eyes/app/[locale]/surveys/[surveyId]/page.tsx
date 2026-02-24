/**
 * Survey Response Collection Page (Phase 5 - Week 2)
 * Public survey page for collecting member responses
 * 
 * Features:
 * - Public shareable link
 * - Welcome message display
 * - Progress tracking
 * - 6 question type renderers
 * - Validation (required fields, min/max)
 * - Thank you page
 * - Anonymous/authenticated modes
 * - Time tracking
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle, Loader2 } from 'lucide-react';

interface Survey {
  id: string;
  title: string;
  description?: string;
  welcomeMessage?: string;
  thankYouMessage?: string;
  allowAnonymous: boolean;
  requireAuthentication: boolean;
  shuffleQuestions: boolean;
  showResults: boolean;
  status: string;
}

interface Question {
  id: string;
  questionText: string;
  questionType: QuestionType;
  description?: string;
  orderIndex: number;
  required: boolean;
  choices?: Array<{ id: string; text: string; order: number }>;
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

interface Answer {
  questionId: string;
  answerText?: string;
  answerNumber?: number;
  answerChoices?: string | string[];
  answerOther?: string;
}

export default function SurveyResponsePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const surveyId = params.surveyId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [_currentPage, _setCurrentPage] = useState(0);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Respondent info (for anonymous surveys)
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');

  const loadSurvey = useCallback(async () => {
    try {
      const response = await fetch(`/api/communications/surveys/${surveyId}`);
      if (!response.ok) throw new Error('Survey not found');

      const data = await response.json();
      setSurvey(data.survey);
      
      let questionsList = data.questions || [];
      if (data.survey.shuffleQuestions) {
        questionsList = [...questionsList].sort(() => Math.random() - 0.5);
      }
      
      setQuestions(questionsList);
      setIsLoading(false);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load survey',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  const updateAnswer = (questionId: string, answer: Partial<Answer>) => {
    const newAnswers = new Map(answers);
    const existing = newAnswers.get(questionId) || { questionId };
    newAnswers.set(questionId, { ...existing, ...answer });
    setAnswers(newAnswers);

    // Clear error for this question
    const newErrors = new Map(errors);
    newErrors.delete(questionId);
    setErrors(newErrors);
  };

  const validateQuestion = (question: Question): string | null => {
    const answer = answers.get(question.id);

    if (question.required) {
      if (!answer) return 'This question is required';

      if (question.questionType === 'text' || question.questionType === 'textarea') {
        if (!answer.answerText?.trim()) return 'This question is required';
      } else if (question.questionType === 'single_choice' || question.questionType === 'yes_no') {
        if (!answer.answerChoices) return 'Please select an option';
      } else if (question.questionType === 'multiple_choice') {
        if (!answer.answerChoices || (Array.isArray(answer.answerChoices) && answer.answerChoices.length === 0)) {
          return 'Please select at least one option';
        }
      } else if (question.questionType === 'rating') {
        if (answer.answerNumber === undefined || answer.answerNumber === null) {
          return 'Please select a rating';
        }
      }
    }

    // Text length validation
    if (answer?.answerText) {
      if (question.minLength && answer.answerText.length < question.minLength) {
        return `Minimum ${question.minLength} characters required`;
      }
      if (question.maxLength && answer.answerText.length > question.maxLength) {
        return `Maximum ${question.maxLength} characters allowed`;
      }
    }

    // Multiple choice min/max
    if (question.questionType === 'multiple_choice' && answer?.answerChoices && Array.isArray(answer.answerChoices)) {
      if (question.minChoices && answer.answerChoices.length < question.minChoices) {
        return `Select at least ${question.minChoices} options`;
      }
      if (question.maxChoices && answer.answerChoices.length > question.maxChoices) {
        return `Select at most ${question.maxChoices} options`;
      }
    }

    return null;
  };

  const validateAllQuestions = (): boolean => {
    const newErrors = new Map<string, string>();
    let isValid = true;

    for (const question of questions) {
      const error = validateQuestion(question);
      if (error) {
        newErrors.set(question.id, error);
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateAllQuestions()) {
      toast({
        title: 'Validation Error',
        description: 'Please complete all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      const response = await fetch(`/api/communications/surveys/${surveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentName: survey?.allowAnonymous ? respondentName : undefined,
          respondentEmail: survey?.allowAnonymous ? respondentEmail : undefined,
          answers: Array.from(answers.values()),
          timeSpentSeconds,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit response');

      setIsComplete(true);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to submit response',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const answer = answers.get(question.id);
    const error = errors.get(question.id);

    return (
      <div key={question.id} className="space-y-4">
        <div>
          <div className="flex items-start gap-2">
            <Label className="text-lg font-medium">
              {question.questionText}
              {question.required && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
          {question.description && (
            <p className="text-sm text-muted-foreground mt-1">{question.description}</p>
          )}
        </div>

        {/* Text input */}
        {question.questionType === 'text' && (
          <div>
            <Input
              value={answer?.answerText || ''}
              onChange={(e) => updateAnswer(question.id, { answerText: e.target.value })}
              placeholder={question.placeholder || 'Your answer...'}
              maxLength={question.maxLength}
            />
            {question.maxLength && (
              <p className="text-xs text-muted-foreground mt-1">
                {answer?.answerText?.length || 0} / {question.maxLength}
              </p>
            )}
          </div>
        )}

        {/* Textarea */}
        {question.questionType === 'textarea' && (
          <div>
            <Textarea
              value={answer?.answerText || ''}
              onChange={(e) => updateAnswer(question.id, { answerText: e.target.value })}
              placeholder={question.placeholder || 'Your answer...'}
              rows={5}
              maxLength={question.maxLength}
            />
            {question.maxLength && (
              <p className="text-xs text-muted-foreground mt-1">
                {answer?.answerText?.length || 0} / {question.maxLength}
              </p>
            )}
          </div>
        )}

        {/* Single choice */}
        {question.questionType === 'single_choice' && (
          <RadioGroup
            value={answer?.answerChoices as string}
            onValueChange={(value) => updateAnswer(question.id, { answerChoices: value })}
          >
            {question.choices?.map((choice) => (
              <div key={choice.id} className="flex items-center space-x-2">
                <RadioGroupItem value={choice.id} id={`${question.id}-${choice.id}`} />
                <Label htmlFor={`${question.id}-${choice.id}`} className="font-normal cursor-pointer">
                  {choice.text}
                </Label>
              </div>
            ))}
            {question.allowOther && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id={`${question.id}-other`} />
                  <Label htmlFor={`${question.id}-other`} className="font-normal cursor-pointer">
                    Other
                  </Label>
                </div>
                {answer?.answerChoices === 'other' && (
                  <Input
                    value={answer?.answerOther || ''}
                    onChange={(e) => updateAnswer(question.id, { answerOther: e.target.value })}
                    placeholder="Please specify..."
                    className="ml-6"
                  />
                )}
              </div>
            )}
          </RadioGroup>
        )}

        {/* Multiple choice */}
        {question.questionType === 'multiple_choice' && (
          <div className="space-y-2">
            {question.choices?.map((choice) => {
              const selectedChoices = (answer?.answerChoices as string[]) || [];
              const isChecked = selectedChoices.includes(choice.id);
              
              return (
                <div key={choice.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${choice.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const newChoices = checked
                        ? [...selectedChoices, choice.id]
                        : selectedChoices.filter((id) => id !== choice.id);
                      updateAnswer(question.id, { answerChoices: newChoices });
                    }}
                  />
                  <Label htmlFor={`${question.id}-${choice.id}`} className="font-normal cursor-pointer">
                    {choice.text}
                  </Label>
                </div>
              );
            })}
            {question.allowOther && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-other`}
                    checked={((answer?.answerChoices as string[]) || []).includes('other')}
                    onCheckedChange={(checked) => {
                      const selectedChoices = (answer?.answerChoices as string[]) || [];
                      const newChoices = checked
                        ? [...selectedChoices, 'other']
                        : selectedChoices.filter((id) => id !== 'other');
                      updateAnswer(question.id, { answerChoices: newChoices });
                    }}
                  />
                  <Label htmlFor={`${question.id}-other`} className="font-normal cursor-pointer">
                    Other
                  </Label>
                </div>
                {((answer?.answerChoices as string[]) || []).includes('other') && (
                  <Input
                    value={answer?.answerOther || ''}
                    onChange={(e) => updateAnswer(question.id, { answerOther: e.target.value })}
                    placeholder="Please specify..."
                    className="ml-6"
                  />
                )}
              </div>
            )}
            {(question.minChoices || question.maxChoices) && (
              <p className="text-xs text-muted-foreground">
                {question.minChoices && question.maxChoices
                  ? `Select ${question.minChoices}-${question.maxChoices} options`
                  : question.minChoices
                  ? `Select at least ${question.minChoices} options`
                  : `Select at most ${question.maxChoices} options`}
              </p>
            )}
          </div>
        )}

        {/* Rating scale */}
        {question.questionType === 'rating' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              {question.ratingMinLabel && (
                <span className="text-sm text-muted-foreground">{question.ratingMinLabel}</span>
              )}
              <div className="flex gap-2">
                {Array.from(
                  { length: (question.ratingMax || 10) - (question.ratingMin || 1) + 1 },
                  (_, i) => (question.ratingMin || 1) + i
                ).map((value) => (
                  <Button
                    key={value}
                    variant={answer?.answerNumber === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateAnswer(question.id, { answerNumber: value })}
                    className="w-12 h-12"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              {question.ratingMaxLabel && (
                <span className="text-sm text-muted-foreground">{question.ratingMaxLabel}</span>
              )}
            </div>
          </div>
        )}

        {/* Yes/No */}
        {question.questionType === 'yes_no' && (
          <RadioGroup
            value={answer?.answerText || ''}
            onValueChange={(value) => updateAnswer(question.id, { answerText: value })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`} className="font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`} className="font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-2">Survey Not Found</h2>
        <p className="text-muted-foreground">This survey may have been deleted or is no longer available.</p>
      </div>
    );
  }

  if (survey.status !== 'published') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-2">Survey Not Available</h2>
        <p className="text-muted-foreground">This survey is not currently accepting responses.</p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="max-w-2xl w-full">
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              {survey.thankYouMessage || 'Your response has been submitted successfully.'}
            </p>
            {survey.showResults && (
              <Button onClick={() => router.push(`/surveys/${surveyId}/results`)}>
                View Results
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = questions.length > 0 ? ((answers.size / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{survey.title}</CardTitle>
            {survey.description && (
              <CardDescription className="text-base">{survey.description}</CardDescription>
            )}
            {survey.welcomeMessage && (
              <p className="text-sm mt-2">{survey.welcomeMessage}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Progress: {answers.size} of {questions.length} questions answered
                </span>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>

            {/* Anonymous respondent info */}
            {survey.allowAnonymous && !survey.requireAuthentication && (
              <div className="mb-8 p-4 border rounded-lg space-y-4">
                <h3 className="font-semibold">Contact Information (Optional)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                      placeholder="Your name..."
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={respondentEmail}
                      onChange={(e) => setRespondentEmail(e.target.value)}
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="h-[600px]">
              <div className="space-y-8 pr-4">
                {questions.map((question, index) => (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Question {index + 1}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {renderQuestion(question)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Response
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
