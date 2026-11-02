/**
 * Survey & Polling System - Drizzle Schema (Phase 5 - Week 2)
 * TypeScript schema definitions for surveys, questions, responses, polls
 * 
 * Features:
 * - Survey management with 6 question types
 * - Response tracking and analytics
 * - Quick poll system
 * - RLS organization isolation
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  inet,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

// =====================================================
// SURVEYS
// =====================================================

export const surveys = pgTable(
  'surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Survey metadata
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    surveyType: varchar('survey_type', { length: 50 }).notNull().default('general'),

    // Status and lifecycle
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),

    // Settings
    allowAnonymous: boolean('allow_anonymous').notNull().default(false),
    allowMultipleResponses: boolean('allow_multiple_responses').notNull().default(false),
    requireAuthentication: boolean('require_authentication').notNull().default(true),
    shuffleQuestions: boolean('shuffle_questions').notNull().default(false),
    showResults: boolean('show_results').notNull().default(false),

    // Display settings
    welcomeMessage: text('welcome_message'),
    thankYouMessage: text('thank_you_message'),

    // Tracking
    responseCount: integer('response_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    completionRate: decimal('completion_rate', { precision: 5, scale: 2 }),

    // Metadata
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_surveys_organization').on(table.organizationId),
    statusIdx: index('idx_surveys_status').on(table.status),
    publishedIdx: index('idx_surveys_published').on(table.publishedAt),
    closesIdx: index('idx_surveys_closes').on(table.closesAt),
  })
);

// =====================================================
// SURVEY QUESTIONS
// =====================================================

export const surveyQuestions = pgTable(
  'survey_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),

    // Question content
    questionText: text('question_text').notNull(),
    questionType: varchar('question_type', { length: 50 }).notNull(),
    description: text('description'),

    // Order and grouping
    orderIndex: integer('order_index').notNull().default(0),
    section: varchar('section', { length: 255 }),

    // Validation and settings
    required: boolean('required').notNull().default(false),

    // Choice-based questions
    choices: jsonb('choices'), // array of {id, text, order}
    allowOther: boolean('allow_other').notNull().default(false),

    // Multiple choice settings
    minChoices: integer('min_choices'),
    maxChoices: integer('max_choices'),

    // Rating scale settings
    ratingMin: integer('rating_min').default(1),
    ratingMax: integer('rating_max').default(10),
    ratingMinLabel: varchar('rating_min_label', { length: 100 }),
    ratingMaxLabel: varchar('rating_max_label', { length: 100 }),

    // Text input settings
    minLength: integer('min_length'),
    maxLength: integer('max_length'),
    placeholder: text('placeholder'),

    // Conditional logic
    showIf: jsonb('show_if'), // {questionId, answer}

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_survey_questions_organization').on(table.organizationId),
    surveyIdx: index('idx_survey_questions_survey').on(table.surveyId),
    orderIdx: index('idx_survey_questions_order').on(table.surveyId, table.orderIndex),
    typeIdx: index('idx_survey_questions_type').on(table.questionType),
  })
);

// =====================================================
// SURVEY RESPONSES
// =====================================================

export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),

    // Respondent info
    userId: text('user_id'),
    respondentEmail: varchar('respondent_email', { length: 255 }),
    respondentName: varchar('respondent_name', { length: 255 }),

    // Response status
    status: varchar('status', { length: 50 }).notNull().default('in_progress'),

    // Tracking
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    timeSpentSeconds: integer('time_spent_seconds'),

    // Session tracking
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_survey_responses_organization').on(table.organizationId),
    surveyIdx: index('idx_survey_responses_survey').on(table.surveyId),
    userIdx: index('idx_survey_responses_user').on(table.userId),
    statusIdx: index('idx_survey_responses_status').on(table.status),
    completedIdx: index('idx_survey_responses_completed').on(table.completedAt),
  })
);

// =====================================================
// SURVEY ANSWERS
// =====================================================

export const surveyAnswers = pgTable(
  'survey_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    responseId: uuid('response_id')
      .notNull()
      .references(() => surveyResponses.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => surveyQuestions.id, { onDelete: 'cascade' }),

    // Answer data (polymorphic)
    answerText: text('answer_text'),
    answerNumber: decimal('answer_number', { precision: 10, scale: 2 }),
    answerChoices: jsonb('answer_choices'),
    answerOther: text('answer_other'),

    // Metadata
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_survey_answers_organization').on(table.organizationId),
    responseIdx: index('idx_survey_answers_response').on(table.responseId),
    questionIdx: index('idx_survey_answers_question').on(table.questionId),
    responseQuestionUnique: unique('survey_answers_response_question_unique').on(
      table.responseId,
      table.questionId
    ),
  })
);

// =====================================================
// POLLS
// =====================================================

export const polls = pgTable(
  'polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Poll content
    question: text('question').notNull(),
    description: text('description'),

    // Options
    options: jsonb('options').notNull(), // array of {id, text}

    // Status
    status: varchar('status', { length: 50 }).notNull().default('active'),

    // Settings
    allowMultipleVotes: boolean('allow_multiple_votes').notNull().default(false),
    requireAuthentication: boolean('require_authentication').notNull().default(true),
    showResultsBeforeVote: boolean('show_results_before_vote').notNull().default(false),

    // Timing
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    closesAt: timestamp('closes_at', { withTimezone: true }),

    // Tracking
    totalVotes: integer('total_votes').notNull().default(0),
    uniqueVoters: integer('unique_voters').notNull().default(0),

    // Metadata
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_polls_organization').on(table.organizationId),
    statusIdx: index('idx_polls_status').on(table.status),
    publishedIdx: index('idx_polls_published').on(table.publishedAt),
    closesIdx: index('idx_polls_closes').on(table.closesAt),
  })
);

// =====================================================
// POLL VOTES
// =====================================================

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),

    // Voter info
    userId: text('user_id'),
    voterEmail: varchar('voter_email', { length: 255 }),

    // Vote data
    optionId: varchar('option_id', { length: 50 }).notNull(),

    // Session tracking
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),

    // Metadata
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_poll_votes_organization').on(table.organizationId),
    pollIdx: index('idx_poll_votes_poll').on(table.pollId),
    userIdx: index('idx_poll_votes_user').on(table.userId),
    optionIdx: index('idx_poll_votes_option').on(table.pollId, table.optionId),
    userPollUnique: unique('poll_votes_user_poll_unique').on(table.pollId, table.userId),
  })
);

// =====================================================
// RELATIONS
// =====================================================

export const surveysRelations = relations(surveys, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [surveys.organizationId],
    references: [organizations.id],
  }),
  createdByProfile: one(profiles, {
    fields: [surveys.createdBy],
    references: [profiles.userId],
  }),
  questions: many(surveyQuestions),
  responses: many(surveyResponses),
}));

export const surveyQuestionsRelations = relations(surveyQuestions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [surveyQuestions.organizationId],
    references: [organizations.id],
  }),
  survey: one(surveys, {
    fields: [surveyQuestions.surveyId],
    references: [surveys.id],
  }),
  answers: many(surveyAnswers),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [surveyResponses.organizationId],
    references: [organizations.id],
  }),
  survey: one(surveys, {
    fields: [surveyResponses.surveyId],
    references: [surveys.id],
  }),
  user: one(profiles, {
    fields: [surveyResponses.userId],
    references: [profiles.userId],
  }),
  answers: many(surveyAnswers),
}));

export const surveyAnswersRelations = relations(surveyAnswers, ({ one }) => ({
  organization: one(organizations, {
    fields: [surveyAnswers.organizationId],
    references: [organizations.id],
  }),
  response: one(surveyResponses, {
    fields: [surveyAnswers.responseId],
    references: [surveyResponses.id],
  }),
  question: one(surveyQuestions, {
    fields: [surveyAnswers.questionId],
    references: [surveyQuestions.id],
  }),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [polls.organizationId],
    references: [organizations.id],
  }),
  createdByProfile: one(profiles, {
    fields: [polls.createdBy],
    references: [profiles.userId],
  }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [pollVotes.organizationId],
    references: [organizations.id],
  }),
  poll: one(polls, {
    fields: [pollVotes.pollId],
    references: [polls.id],
  }),
  user: one(profiles, {
    fields: [pollVotes.userId],
    references: [profiles.userId],
  }),
}));

// =====================================================
// TYPESCRIPT TYPES
// =====================================================

export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;

export type SurveyQuestion = typeof surveyQuestions.$inferSelect;
export type NewSurveyQuestion = typeof surveyQuestions.$inferInsert;

export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type NewSurveyResponse = typeof surveyResponses.$inferInsert;

export type SurveyAnswer = typeof surveyAnswers.$inferSelect;
export type NewSurveyAnswer = typeof surveyAnswers.$inferInsert;

export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;

export type PollVote = typeof pollVotes.$inferSelect;
export type NewPollVote = typeof pollVotes.$inferInsert;

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'single_choice'
  | 'multiple_choice'
  | 'rating'
  | 'yes_no';

export type SurveyType = 'general' | 'feedback' | 'poll' | 'assessment' | 'registration';

export type SurveyStatus = 'draft' | 'published' | 'closed' | 'archived';

export type ResponseStatus = 'in_progress' | 'completed' | 'abandoned';

export type PollStatus = 'active' | 'closed' | 'archived';

export interface QuestionChoice {
  id: string;
  text: string;
  order: number;
}

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  surveyType?: SurveyType;
  allowAnonymous?: boolean;
  allowMultipleResponses?: boolean;
  requireAuthentication?: boolean;
  shuffleQuestions?: boolean;
  showResults?: boolean;
  welcomeMessage?: string;
  thankYouMessage?: string;
  closesAt?: string;
  questions: CreateQuestionRequest[];
}

export interface CreateQuestionRequest {
  questionText: string;
  questionType: QuestionType;
  description?: string;
  orderIndex: number;
  section?: string;
  required?: boolean;
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

export interface SubmitResponseRequest {
  respondentEmail?: string;
  respondentName?: string;
  answers: {
    questionId: string;
    answerText?: string;
    answerNumber?: number;
    answerChoices?: string | string[];
    answerOther?: string;
  }[];
  timeSpentSeconds?: number;
}

export interface CreatePollRequest {
  question: string;
  description?: string;
  options: Array<{ id: string; text: string }>;
  allowMultipleVotes?: boolean;
  requireAuthentication?: boolean;
  showResultsBeforeVote?: boolean;
  closesAt?: string;
}

export interface SubmitVoteRequest {
  optionId: string;
  voterEmail?: string;
}

export interface SurveyResultsResponse {
  survey: Survey;
  totalResponses: number;
  completionRate: number;
  averageTimeSpent: number;
  questionResults: Array<{
    question: SurveyQuestion;
    totalAnswers: number;
    answerBreakdown: {
      text?: Array<{ text: string; count: number }>;
      choices?: Array<{ choice: string; count: number; percentage: number }>;
      rating?: { average: number; min: number; max: number; distribution: number[] };
      yesNo?: { yes: number; no: number };
    };
  }>;
}

export interface PollResultsResponse {
  poll: Poll;
  totalVotes: number;
  uniqueVoters: number;
  results: Array<{
    optionId: string;
    optionText: string;
    voteCount: number;
    percentage: number;
  }>;
}

