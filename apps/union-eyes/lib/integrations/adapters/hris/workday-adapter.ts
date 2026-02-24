/**
 * Workday HRIS Integration Adapter
 * 
 * Implements integration with Workday for employee, position, and department data.
 * 
 * Features:
 * - OAuth2 authentication
 * - Full and incremental sync
 * - Employee, position, and department entities
 * - Rate limiting and retries
 * 
 * @see https://community.workday.com/sites/default/files/file-hosting/restapi/index.html
 */

import { BaseIntegration } from '../../base-integration';
import {
  IntegrationType,
  IntegrationProvider,
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
  SyncType,
  ConnectionStatus,
} from '../../types';
import { WorkdayClient, type WorkdayConfig } from './workday-client';
import { db } from '@/db';
import { externalEmployees, externalPositions, externalDepartments } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Workday Adapter
// ============================================================================

export class WorkdayAdapter extends BaseIntegration {
  private client?: WorkdayClient;
  private readonly BATCH_SIZE = 100;

  constructor() {
    super(IntegrationType.HRIS, IntegrationProvider.WORKDAY, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false, // Workday doesn&apos;t support webhooks in most plans
      supportsRealTime: false,
      supportedEntities: ['employees', 'positions', 'departments'],
      requiresOAuth: true,
      rateLimitPerMinute: 60,
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const workdayConfig: WorkdayConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        tenantId: (this.config!.settings?.organizationId as string) || '',
        environment: (this.config!.settings?.environment as 'production' | 'sandbox') || 'production',
        refreshToken: this.config!.credentials.refreshToken,
      };

      this.client = new WorkdayClient(workdayConfig);
      await this.client.authenticate();
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Workday' });
    } catch (error) {
      this.logError('connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Workday' });
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      this.ensureConnected();

      const startTime = Date.now();
      const isHealthy = await this.client!.healthCheck();

      return {
        healthy: isHealthy,
        status: ConnectionStatus.CONNECTED,
        latencyMs: Date.now() - startTime,
        lastCheckedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: ConnectionStatus.ERROR,
        latencyMs: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheckedAt: new Date(),
      };
    }
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  async sync(options: SyncOptions): Promise<SyncResult> {
    this.ensureConnected();

    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      const entities = options.entities || this.capabilities.supportedEntities;

      for (const entity of entities) {
        try {
          this.logOperation('sync', { message: `Syncing ${entity}` });

          switch (entity) {
            case 'employees':
              const empResult = await this.syncEmployees(options.type, options.cursor);
              recordsProcessed += empResult.processed;
              recordsCreated += empResult.created;
              recordsUpdated += empResult.updated;
              recordsFailed += empResult.failed;
              break;

            case 'positions':
              const posResult = await this.syncPositions(options.type);
              recordsProcessed += posResult.processed;
              recordsCreated += posResult.created;
              recordsUpdated += posResult.updated;
              recordsFailed += posResult.failed;
              break;

            case 'departments':
              const deptResult = await this.syncDepartments(options.type);
              recordsProcessed += deptResult.processed;
              recordsCreated += deptResult.created;
              recordsUpdated += deptResult.updated;
              recordsFailed += deptResult.failed;
              break;

            default:
              this.logOperation('sync', { message: `Unknown entity: ${entity}` });
          }
        } catch (error) {
          const errorMsg = `Failed to sync ${entity}: ${error instanceof Error ? error.message : 'Unknown'}`;
          errors.push(errorMsg);
          this.logError('sync', error, { entity });
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        cursor: undefined, // Would track for incremental
        metadata: { duration, ...(errors.length > 0 ? { errorMessages: errors } : {}) },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError('sync', error);

      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        metadata: { duration, error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ==========================================================================
  // Entity Sync Methods
  // ==========================================================================

  /**
   * Sync employees from Workday
   */
  private async syncEmployees(
    syncType: SyncType,
    cursor?: string
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getEmployees({
        limit: this.BATCH_SIZE,
        offset,
        cursor,
      });

      for (const workdayEmployee of response.data) {
        try {
          // Check if employee exists
          const existing = await db.query.externalEmployees.findFirst({
            where: eq(externalEmployees.externalId, workdayEmployee.id),
          });

          if (existing) {
            // Update existing employee
            await db
              .update(externalEmployees)
              .set({
                firstName: workdayEmployee.firstName,
                lastName: workdayEmployee.lastName,
                email: workdayEmployee.email,
                phone: workdayEmployee.phone,
                position: workdayEmployee.position,
                department: workdayEmployee.department,
                location: workdayEmployee.location,
                hireDate: workdayEmployee.hireDate ? new Date(workdayEmployee.hireDate) : null,
                employmentStatus: workdayEmployee.employmentStatus as 'active' | 'inactive' | 'terminated' | 'suspended' | 'on_leave' | null,
                workSchedule: workdayEmployee.workSchedule,
                supervisorId: workdayEmployee.supervisor?.id,
                supervisorName: workdayEmployee.supervisor?.name,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(externalEmployees.id, existing.id));
            updated++;
          } else {
            // Create new employee
            await db.insert(externalEmployees).values({
              organizationId: this.config!.organizationId,
              externalId: workdayEmployee.id,
              externalProvider: 'WORKDAY',
              employeeId: workdayEmployee.employeeID,
              firstName: workdayEmployee.firstName,
              lastName: workdayEmployee.lastName,
              email: workdayEmployee.email,
              phone: workdayEmployee.phone,
              position: workdayEmployee.position,
              department: workdayEmployee.department,
              location: workdayEmployee.location,
              hireDate: workdayEmployee.hireDate ? new Date(workdayEmployee.hireDate) : null,
              employmentStatus: workdayEmployee.employmentStatus as 'active' | 'inactive' | 'terminated' | 'suspended' | 'on_leave' | null,
              workSchedule: workdayEmployee.workSchedule,
              supervisorId: workdayEmployee.supervisor?.id,
              supervisorName: workdayEmployee.supervisor?.name,
              lastSyncedAt: new Date(),
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncEmployees', error, {
            employeeId: workdayEmployee.id,
          });
          failed++;
        }
      }

      hasMore = response.data.length === this.BATCH_SIZE;
      offset += this.BATCH_SIZE;

      // For incremental sync, might want to stop early based on cursor
      if (syncType === SyncType.INCREMENTAL && !response.cursor) {
        hasMore = false;
      }
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync positions from Workday
   */
  private async syncPositions(_syncType: SyncType): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getPositions({
        limit: this.BATCH_SIZE,
        offset,
      });

      for (const workdayPosition of response.data) {
        try {
          const existing = await db.query.externalPositions.findFirst({
            where: eq(externalPositions.externalId, workdayPosition.id),
          });

          if (existing) {
            await db
              .update(externalPositions)
              .set({
                title: workdayPosition.title,
                description: workdayPosition.description,
                department: workdayPosition.department,
                jobProfile: workdayPosition.jobProfile,
                effectiveDate: workdayPosition.effectiveDate ? new Date(workdayPosition.effectiveDate) : null,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(externalPositions.id, existing.id));
            updated++;
          } else {
            await db.insert(externalPositions).values({
              organizationId: this.config!.organizationId,
              externalId: workdayPosition.id,
              externalProvider: 'WORKDAY',
              title: workdayPosition.title,
              description: workdayPosition.description,
              department: workdayPosition.department,
              jobProfile: workdayPosition.jobProfile,
              effectiveDate: workdayPosition.effectiveDate ? new Date(workdayPosition.effectiveDate) : null,
              lastSyncedAt: new Date(),
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPositions', error, {
            positionId: workdayPosition.id,
          });
          failed++;
        }
      }

      hasMore = response.data.length === this.BATCH_SIZE;
      offset += this.BATCH_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync departments from Workday
   */
  private async syncDepartments(_syncType: SyncType): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getDepartments({
        limit: this.BATCH_SIZE,
        offset,
      });

      for (const workdayDept of response.data) {
        try {
          const existing = await db.query.externalDepartments.findFirst({
            where: eq(externalDepartments.externalId, workdayDept.id),
          });

          if (existing) {
            await db
              .update(externalDepartments)
              .set({
                name: workdayDept.name,
                code: workdayDept.code,
                managerId: workdayDept.manager?.id,
                managerName: workdayDept.manager?.name,
                parentDepartmentId: workdayDept.parentDepartment,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(externalDepartments.id, existing.id));
            updated++;
          } else {
            await db.insert(externalDepartments).values({
              organizationId: this.config!.organizationId,
              externalId: workdayDept.id,
              externalProvider: 'WORKDAY',
              name: workdayDept.name,
              code: workdayDept.code,
              managerId: workdayDept.manager?.id,
              managerName: workdayDept.manager?.name,
              parentDepartmentId: workdayDept.parentDepartment,
              lastSyncedAt: new Date(),
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncDepartments', error, {
            departmentId: workdayDept.id,
          });
          failed++;
        }
      }

      hasMore = response.data.length === this.BATCH_SIZE;
      offset += this.BATCH_SIZE;
    }

    return { processed, created, updated, failed };
  }

  // ==========================================================================
  // Webhook Support (Not Available)
  // ==========================================================================

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    // Workday doesn&apos;t support webhooks in most plans
    return false;
  }

  async processWebhook(_event: WebhookEvent): Promise<void> {
    throw new Error('Workday does not support webhooks');
  }
}
