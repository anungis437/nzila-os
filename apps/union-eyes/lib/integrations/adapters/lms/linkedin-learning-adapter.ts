/**
 * LinkedIn Learning Integration Adapter
 * 
 * Orchestrates sync operations for LinkedIn Learning data including
 * courses, enrollments, progress, and completions.
 */

import { BaseIntegration } from '../../base-integration';
import { LinkedInLearningClient } from './linkedin-learning-client';
import type {
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
} from '../../types';
import { db } from '@/db';
import {
  externalLmsCourses,
  externalLmsEnrollments,
  externalLmsProgress,
  externalLmsCompletions,
  externalLmsLearners,
} from '@/db/schema/domains/data/lms';
import { IntegrationType, IntegrationProvider, ConnectionStatus } from '../../types';

const PAGE_SIZE = 50; // LinkedIn Learning pagination

export class LinkedInLearningAdapter extends BaseIntegration {
  private client: LinkedInLearningClient;
  private orgId: string;

  constructor(orgId: string, config: Record<string, unknown>) {
    super(IntegrationType.LMS, IntegrationProvider.LINKEDIN_LEARNING, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['courses', 'enrollments', 'progress', 'completions', 'learners'],
      requiresOAuth: true,
      rateLimitPerMinute: 30,
    });
    this.orgId = orgId;

    this.client = new LinkedInLearningClient({
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      accessToken: config.accessToken as string | undefined,
      apiUrl: config.apiUrl as string | undefined,
    });
  }

  async connect(): Promise<void> {
    const health = await this.client.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(`Failed to connect to LinkedIn Learning: ${health.message}`);
    }
    this.connected = true;
    this.logOperation('connect', { message: 'Connected to LinkedIn Learning API' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logOperation('disconnect', { message: 'LinkedIn Learning integration disconnected' });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      const health = await this.client.healthCheck();
      const latencyMs = Date.now() - startTime;
      return {
        healthy: health.status === 'ok',
        status: health.status === 'ok' ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR,
        latencyMs,
        lastCheckedAt: new Date(),
        lastError: health.status !== 'ok' ? health.message : undefined,
      };
    } catch (error) {
      return {
        healthy: false,
        status: ConnectionStatus.ERROR,
        lastCheckedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    return true; // Simplified for now
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { eventType: event.type, message: `Processing ${event.type}` });
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    await this.ensureConnected();

    const entities = options.entities || ['courses', 'enrollments', 'progress', 'completions', 'learners'];
    const results: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      cursor: options.cursor,
    };

    try {
      for (const entity of entities) {
        switch (entity) {
          case 'courses':
            await this.syncCourses(options, results);
            break;
          case 'enrollments':
            await this.syncEnrollments(options, results);
            break;
          case 'progress':
            await this.syncProgress(options, results);
            break;
          case 'completions':
            await this.syncCompletions(options, results);
            break;
          case 'learners':
            await this.syncLearners(options, results);
            break;
          default:
            this.logOperation('sync', { message: `Unknown entity type: ${entity}` });
        }
      }

      this.logOperation('sync', {
        message: 'LinkedIn Learning sync completed',
        processed: results.recordsProcessed,
        created: results.recordsCreated,
        updated: results.recordsUpdated,
      });
    } catch (error) {
      results.success = false;
      results.metadata = { error: error instanceof Error ? error.message : String(error) };
      this.logError('sync', error as Error);
    }

    return results;
  }

  /**
   * Sync all courses
   */
  private async syncCourses(options: SyncOptions, results: SyncResult): Promise<void> {
    let start = 0;
    let hasMore = true;
    const modifiedSince = options.cursor;

    while (hasMore) {
      const response = await this.client.getCourses({
        start,
        count: PAGE_SIZE,
        modifiedSince,
      });

      for (const course of response.courses) {
        try {
          await db
            .insert(externalLmsCourses)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.LINKEDIN_LEARNING,
              externalId: course.urn,
              courseName: course.title.value,
              description: course.description?.value,
              difficultyLevel: course.difficultyLevel.toLowerCase(),
              durationMinutes: course.timeToComplete.unit === 'HOUR' 
                ? course.timeToComplete.duration * 60 
                : course.timeToComplete.duration,
              publishedAt: new Date(course.publishedAt),
              lastUpdatedAt: new Date(course.lastUpdatedAt),
              provider: course.provider,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalLmsCourses.orgId,
                externalLmsCourses.externalProvider,
                externalLmsCourses.externalId,
              ],
              set: {
                courseName: course.title.value,
                description: course.description?.value,
                lastUpdatedAt: new Date(course.lastUpdatedAt),
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncCourse', error as Error, { message: `Failed to sync course ${course.urn}` });
          results.recordsFailed++;
        }
      }

      hasMore = response.courses.length === PAGE_SIZE;
      start += PAGE_SIZE;
    }
  }

  /**
   * Sync enrollments
   */
  private async syncEnrollments(options: SyncOptions, results: SyncResult): Promise<void> {
    let start = 0;
    let hasMore = true;
    const modifiedSince = options.cursor;

    while (hasMore) {
      const response = await this.client.getEnrollments({
        start,
        count: PAGE_SIZE,
        modifiedSince,
      });

      for (const enrollment of response.enrollments) {
        try {
          await db
            .insert(externalLmsEnrollments)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.LINKEDIN_LEARNING,
              externalId: `${enrollment.learnerUrn}-${enrollment.courseUrn}`,
              courseId: enrollment.courseUrn,
              learnerId: enrollment.learnerUrn,
              enrolledAt: new Date(enrollment.enrolledAt),
              status: enrollment.status.toLowerCase(),
              progressPercentage: enrollment.progressPercentage,
              lastAccessedAt: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt) : null,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalLmsEnrollments.orgId,
                externalLmsEnrollments.externalProvider,
                externalLmsEnrollments.externalId,
              ],
              set: {
                status: enrollment.status.toLowerCase(),
                progressPercentage: enrollment.progressPercentage,
                lastAccessedAt: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt) : null,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncEnrollment', error as Error, { message: `Failed to sync enrollment ${enrollment.learnerUrn}` });
          results.recordsFailed++;
        }
      }

      hasMore = response.enrollments.length === PAGE_SIZE;
      start += PAGE_SIZE;
    }
  }

  /**
   * Sync learner progress
   */
  private async syncProgress(options: SyncOptions, results: SyncResult): Promise<void> {
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getProgress({
        start,
        count: PAGE_SIZE,
      });

      for (const progress of response.progress) {
        try {
          await db
            .insert(externalLmsProgress)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.LINKEDIN_LEARNING,
              externalId: `${progress.learnerUrn}-${progress.contentUrn}`,
              courseId: progress.courseUrn,
              learnerId: progress.learnerUrn,
              contentId: progress.contentUrn,
              progressPercentage: progress.progressPercentage,
              timeSpentSeconds: progress.timeSpent,
              completedAt: progress.completedAt ? new Date(progress.completedAt) : null,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalLmsProgress.orgId,
                externalLmsProgress.externalProvider,
                externalLmsProgress.externalId,
              ],
              set: {
                progressPercentage: progress.progressPercentage,
                timeSpentSeconds: progress.timeSpent,
                completedAt: progress.completedAt ? new Date(progress.completedAt) : null,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncProgress', error as Error, { message: `Failed to sync progress ${progress.contentUrn}` });
          results.recordsFailed++;
        }
      }

      hasMore = response.progress.length === PAGE_SIZE;
      start += PAGE_SIZE;
    }
  }

  /**
   * Sync course completions
   */
  private async syncCompletions(options: SyncOptions, results: SyncResult): Promise<void> {
    let start = 0;
    let hasMore = true;
    const completedSince = options.cursor;

    while (hasMore) {
      const response = await this.client.getCompletions({
        start,
        count: PAGE_SIZE,
        completedSince,
      });

      for (const completion of response.completions) {
        try {
          await db
            .insert(externalLmsCompletions)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.LINKEDIN_LEARNING,
              externalId: `${completion.learnerUrn}-${completion.courseUrn}`,
              courseId: completion.courseUrn,
              learnerId: completion.learnerUrn,
              completedAt: new Date(completion.completedAt),
              certificateId: completion.certificateUrn,
              grade: completion.grade != null ? String(completion.grade) : null,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalLmsCompletions.orgId,
                externalLmsCompletions.externalProvider,
                externalLmsCompletions.externalId,
              ],
              set: {
                certificateId: completion.certificateUrn,
                grade: completion.grade != null ? String(completion.grade) : null,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncCompletion', error as Error, { message: `Failed to sync completion ${completion.learnerUrn}` });
          results.recordsFailed++;
        }
      }

      hasMore = response.completions.length === PAGE_SIZE;
      start += PAGE_SIZE;
    }
  }

  /**
   * Sync learners
   */
  private async syncLearners(options: SyncOptions, results: SyncResult): Promise<void> {
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getLearners({
        start,
        count: PAGE_SIZE,
      });

      for (const learner of response.learners) {
        try {
          await db
            .insert(externalLmsLearners)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.LINKEDIN_LEARNING,
              externalId: learner.urn,
              firstName: learner.firstName,
              lastName: learner.lastName,
              email: learner.email,
              profileUrl: learner.profileUrl,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalLmsLearners.orgId,
                externalLmsLearners.externalProvider,
                externalLmsLearners.externalId,
              ],
              set: {
                firstName: learner.firstName,
                lastName: learner.lastName,
                email: learner.email,
                profileUrl: learner.profileUrl,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncLearner', error as Error, { message: `Failed to sync learner ${learner.urn}` });
          results.recordsFailed++;
        }
      }

      hasMore = response.learners.length === PAGE_SIZE;
      start += PAGE_SIZE;
    }
  }
}
