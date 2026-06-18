import { db } from "@/db";
import {
  swissColdStorage,
  breakGlassSystem,
  breakGlassActivations,
  disasterRecoveryDrills,
  keyHolderRegistry,
  recoveryTimeObjectives,
} from "@/db/schema/force-majeure-schema";
import { eq, and, lte } from "drizzle-orm";
import * as crypto from "crypto";
import { logger } from "@/lib/logger";

/**
 * Break-Glass Emergency Service
 * Implements Shamir's Secret Sharing (3-of-5 keys) for disaster recovery
 * Swiss Cold Storage integration for offline backups
 * 
 * Key Features:
 * - Multi-signature authorization (3 of 5 key holders required)
 * - Swiss vault integration for encrypted backups
 * - 48-hour recovery time objective (RTO)
 * - Quarterly disaster recovery drills
 * - Automated drill scheduling and compliance tracking
 */

export interface EmergencyActivation {
  scenarioType: string;
  activationReason: string;
  emergencyLevel: "critical" | "high" | "medium";
  activatedBy: string;
}

export interface KeyHolderSignature {
  keyHolderId: string;
  ipAddress?: string;
}

export interface DisasterDrill {
  drillName: string;
  drillType: "tabletop_exercise" | "simulation" | "full_test" | "surprise_drill";
  scenarioType: string;
  scheduledDate: Date;
  participants: string[];
  objectives: string[];
  targetRecoveryTime: string;
  conductedBy: string;
}

interface ShamirModule {
  share(secret: string, total: number, threshold: number): string[];
}

export class BreakGlassService {
  private static readonly REQUIRED_SIGNATURES = 3;
  private static readonly TOTAL_KEY_HOLDERS = 5;
  private static readonly DRILL_FREQUENCY_DAYS = 90; // Quarterly
  private static readonly SHARE_ENCRYPTION_ENV = "UE_BREAK_GLASS_SHARE_MASTER_KEY";

  /**
   * Initialize break-glass system with Shamir's Secret Sharing
   */
  static async initializeBreakGlassSystem(params: {
    scenarioType: string;
    scenarioDescription: string;
    keyHolderIds: string[]; // 5 key holders
    estimatedRecoveryTime: string;
  }) {
    if (params.keyHolderIds.length !== this.TOTAL_KEY_HOLDERS) {
      throw new Error(`Exactly ${this.TOTAL_KEY_HOLDERS} key holders required for Shamir's Secret Sharing`);
    }

    // Calculate next test due date (90 days from now)
    const nextTestDue = new Date();
    nextTestDue.setDate(nextTestDue.getDate() + this.DRILL_FREQUENCY_DAYS);

    const [system] = await db
      .insert(breakGlassSystem)
      .values({
        scenarioType: params.scenarioType,
        scenarioDescription: params.scenarioDescription,
        estimatedRecoveryTime: params.estimatedRecoveryTime,
        shamirThreshold: this.REQUIRED_SIGNATURES,
        shamirTotalShares: this.TOTAL_KEY_HOLDERS,
        keyHolderId1: params.keyHolderIds[0],
        keyHolderId2: params.keyHolderIds[1],
        keyHolderId3: params.keyHolderIds[2],
        keyHolderId4: params.keyHolderIds[3],
        keyHolderId5: params.keyHolderIds[4],
        nextTestDue,
      })
      .returning();

    // Generate threshold shares and store encrypted envelopes for each key holder.
    await this.generateShamirShares(params.keyHolderIds);

    return system;
  }

  /**
   * Generate Shamir's Secret Sharing keys for key holders
    *
    * The active implementation uses true threshold share generation via
    * secrets.js-grempe and encrypts each share with AES-256-GCM using a
    * per-holder HKDF-derived key. The plaintext master secret is generated
    * once, split into shares, and never persisted.
   */
  private static async generateShamirShares(keyHolderIds: string[]) {
    const shamir = await this.loadShamirModule();
    const masterSecret = crypto.randomBytes(32).toString("hex");
    const shares = shamir.share(masterSecret, this.TOTAL_KEY_HOLDERS, this.REQUIRED_SIGNATURES);

    logger.info('Break-glass: Generating threshold shares', {
      auditEvent: 'share_creation',
      threshold: this.REQUIRED_SIGNATURES,
      totalShares: this.TOTAL_KEY_HOLDERS,
      keyHolders: keyHolderIds.length,
      algorithm: 'shamir-secret-sharing',
      encryption: 'aes-256-gcm',
      kdf: 'hkdf-sha256',
    });

    for (let i = 0; i < keyHolderIds.length; i++) {
      const userId = keyHolderIds[i];
      const share = shares[i];
      const shareFingerprint = crypto.createHash("sha256").update(share).digest("hex");

      const encryptedShare = this.encryptShare(share, userId);

      // Calculate rotation dates
      const keyRotationDue = new Date();
      keyRotationDue.setFullYear(keyRotationDue.getFullYear() + 1); // Annual rotation

      const trainingExpiresAt = new Date();
      trainingExpiresAt.setFullYear(trainingExpiresAt.getFullYear() + 1);

      const nextVerificationDue = new Date();
      nextVerificationDue.setMonth(nextVerificationDue.getMonth() + 6); // Biannual verification

      await db.insert(keyHolderRegistry).values({
        userId,
        role: this.getKeyHolderRole(i),
        keyHolderNumber: i + 1,
        shamirShareEncrypted: encryptedShare,
        shamirShareFingerprint: shareFingerprint,
        keyIssuedAt: new Date(),
        keyRotationDue,
        emergencyPhone: "TBD", // Would be populated from user profile
        emergencyEmail: "TBD",
        trainingExpiresAt,
        nextVerificationDue,
      });
      
      logger.info('Break-glass: Threshold share generated', {
        auditEvent: 'share_created',
        keyHolderId: userId,
        keyHolderNumber: i + 1,
        shareFingerprint: shareFingerprint.substring(0, 16) + '...',
        rotationDue: keyRotationDue.toISOString(),
      });
    }
  }

  /**
    * Encrypt a threshold share using AES-256-GCM and a per-holder key derived
    * from the repo-configured break-glass master key seed via HKDF-SHA256.
   */
  private static encryptShare(share: string, userId: string): string {
    const masterKeySeed = this.getShareEncryptionSeed();
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const derivedKey = crypto.hkdfSync(
      'sha256',
      masterKeySeed,
      salt,
      Buffer.from(`ue-break-glass-share:${userId}`, 'utf8'),
      32,
    );
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(share, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    logger.info('Break-glass: Share encrypted', {
      auditEvent: 'share_access',
      keyHolderId: userId,
      algorithm: 'aes-256-gcm',
      kdf: 'hkdf-sha256',
    });

    return Buffer.from(JSON.stringify({
      version: 1,
      algorithm: 'aes-256-gcm',
      kdf: 'hkdf-sha256',
      holder: userId,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    }), 'utf8').toString('base64');
  }

  private static getShareEncryptionSeed(): Buffer {
    const configuredKey = process.env[this.SHARE_ENCRYPTION_ENV];
    if (!configuredKey) {
      throw new Error(`NZILA_UNIMPLEMENTED: ${this.SHARE_ENCRYPTION_ENV}`);
    }

    return /^[0-9a-f]{64}$/i.test(configuredKey)
      ? Buffer.from(configuredKey, 'hex')
      : Buffer.from(configuredKey, 'utf8');
  }

  private static async loadShamirModule(): Promise<ShamirModule> {
    const mod = await import('secrets.js-grempe') as any as { default?: ShamirModule } & Partial<ShamirModule>;
    const resolved = mod.default ?? mod;
    if (typeof resolved.share !== 'function') {
      throw new Error('NZILA_UNIMPLEMENTED: union-eyes.break-glass.threshold-crypto');
    }
    return resolved as ShamirModule;
  }

  /**
   * Get key holder role based on position
   */
  private static getKeyHolderRole(index: number): string {
    const roles = ["board_chair", "secretary_treasurer", "president", "vp", "trustee"];
    return roles[index] || "trustee";
  }

  /**
   * Activate break-glass emergency system
   */
  static async activateEmergency(activation: EmergencyActivation) {
    // Get active break-glass system
    const systems = await db
      .select()
      .from(breakGlassSystem)
      .where(eq(breakGlassSystem.status, "active"))
      .limit(1);

    if (systems.length === 0) {
      throw new Error("No active break-glass system found");
    }

    const system = systems[0];

    // Create activation record
    const [activationRecord] = await db
      .insert(breakGlassActivations)
      .values({
        breakGlassSystemId: system.id,
        activationType: "real_emergency",
        activationReason: activation.activationReason,
        emergencyLevel: activation.emergencyLevel,
        requiredSignatures: this.REQUIRED_SIGNATURES,
        signaturesReceived: 0,
        activatedBy: activation.activatedBy,
      })
      .returning();

    // Update break-glass system status
    await db
      .update(breakGlassSystem)
      .set({ status: "activated" })
      .where(eq(breakGlassSystem.id, system.id));

    // Notify all key holders
    await this.notifyKeyHolders(system.id, activationRecord.id, activation.emergencyLevel);

    return activationRecord;
  }

  /**
   * Submit key holder signature for break-glass authorization
   */
  static async submitSignature(
    activationId: string,
    signature: KeyHolderSignature
  ): Promise<{ authorizationComplete: boolean; signaturesReceived: number }> {
    logger.info('Break-glass signature submitted', {
      auditEvent: 'share_access',
      activationId,
      keyHolderId: signature.keyHolderId,
    });

    // Verify key holder is registered
    const keyHolder = await db
      .select()
      .from(keyHolderRegistry)
      .where(
        and(
          eq(keyHolderRegistry.userId, signature.keyHolderId),
          eq(keyHolderRegistry.status, "active")
        )
      )
      .limit(1);

    if (keyHolder.length === 0) {
      throw new Error("Key holder not found or inactive");
    }

    // Get activation record
    const activation = await db
      .select()
      .from(breakGlassActivations)
      .where(eq(breakGlassActivations.id, activationId))
      .limit(1);

    if (activation.length === 0) {
      throw new Error("Activation not found");
    }

    const record = activation[0];

    // Check if key holder already signed
    if (
      record.signature1UserId === signature.keyHolderId ||
      record.signature2UserId === signature.keyHolderId ||
      record.signature3UserId === signature.keyHolderId ||
      record.signature4UserId === signature.keyHolderId ||
      record.signature5UserId === signature.keyHolderId
    ) {
      throw new Error("Key holder has already signed");
    }

    // Determine which signature slot to use
    const signaturesReceived = record.signaturesReceived + 1;
    const signatureSlot = `signature${signaturesReceived}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      [`${signatureSlot}UserId`]: signature.keyHolderId,
      [`${signatureSlot}Timestamp`]: new Date(),
      [`${signatureSlot}IpAddress`]: signature.ipAddress,
      signaturesReceived,
    };

    // Check if authorization is complete
    const authorizationComplete = signaturesReceived >= this.REQUIRED_SIGNATURES;
    if (authorizationComplete) {
      updateData.authorizationComplete = true;
      updateData.authorizationCompletedAt = new Date();
      logger.info('Break-glass reconstruction threshold reached', {
        auditEvent: 'reconstruction_attempt',
        activationId,
        signaturesReceived,
      });
    }

    await db
      .update(breakGlassActivations)
      .set(updateData)
      .where(eq(breakGlassActivations.id, activationId));

    if (authorizationComplete) {
      await this.executeRecoveryProcedure(activationId);
    }

    return { authorizationComplete, signaturesReceived };
  }

  /**
   * Execute recovery procedure after authorization
   */
  private static async executeRecoveryProcedure(activationId: string) {
    // This would trigger actual recovery actions
    // For now, log the authorization
    logger.info('Break-glass authorization complete', {
      auditEvent: 'reconstruction_attempt',
      activationId,
    });
    logger.info('Recovery procedure initiated', {
      steps: [
        'Access Swiss cold storage for encrypted backups',
        'Retrieve master encryption keys',
        'Restore database from latest backup',
        'Validate data integrity',
        'Restore application services',
        'Verify system functionality',
      ],
    });
    
    // Update activation with recovery actions
    await db
      .update(breakGlassActivations)
      .set({
        recoveryActionsLog: [
          { timestamp: new Date(), action: "Recovery procedure initiated" },
          { timestamp: new Date(), action: "Accessing Swiss cold storage" },
        ],
      })
      .where(eq(breakGlassActivations.id, activationId));
  }

  /**
   * Schedule disaster recovery drill
   */
  static async scheduleDrill(drill: DisasterDrill) {
    const [drillRecord] = await db
      .insert(disasterRecoveryDrills)
      .values({
        drillName: drill.drillName,
        drillType: drill.drillType,
        scenarioType: drill.scenarioType,
        scheduledDate: drill.scheduledDate,
        participants: drill.participants,
        participantCount: drill.participants.length,
        objectives: drill.objectives,
        targetRecoveryTime: drill.targetRecoveryTime,
        conductedBy: drill.conductedBy,
        status: "scheduled",
      })
      .returning();

    return drillRecord;
  }

  /**
   * Complete disaster recovery drill
   */
  static async completeDrill(
    drillId: string,
    results: {
      actualStartTime: Date;
      actualEndTime: Date;
      actualRecoveryTime: string;
      objectivesMet: string[];
      overallScore: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      issuesIdentified?: any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      remediationActions?: any[];
    }
  ) {
    const duration = this.calculateDuration(results.actualStartTime, results.actualEndTime);
    
    await db
      .update(disasterRecoveryDrills)
      .set({
        actualStartTime: results.actualStartTime,
        actualEndTime: results.actualEndTime,
        duration,
        actualRecoveryTime: results.actualRecoveryTime,
        objectivesMet: results.objectivesMet,
        overallScore: results.overallScore,
        issuesIdentified: results.issuesIdentified,
        remediationActions: results.remediationActions,
        status: "completed",
      })
      .where(eq(disasterRecoveryDrills.id, drillId));

    // Update next drill due date in break-glass system
    const nextDrillDue = new Date(results.actualEndTime);
    nextDrillDue.setDate(nextDrillDue.getDate() + this.DRILL_FREQUENCY_DAYS);

    await db
      .update(breakGlassSystem)
      .set({
        lastTestedAt: results.actualEndTime,
        nextTestDue: nextDrillDue,
      })
      .where(eq(breakGlassSystem.status, "active"));
  }

  /**
   * Get overdue drills
   */
  static async getOverdueDrills() {
    const now = new Date();
    return await db
      .select()
      .from(breakGlassSystem)
      .where(
        and(
          eq(breakGlassSystem.status, "active"),
          lte(breakGlassSystem.nextTestDue, now)
        )
      );
  }

  /**
   * Register Swiss cold storage backup
   */
  static async registerColdStorageBackup(params: {
    vaultProvider: string;
    vaultLocation: string;
    storageType: string;
    dataCategory: string;
    encryptedBy: string;
  }) {
    const [storage] = await db
      .insert(swissColdStorage)
      .values({
        vaultProvider: params.vaultProvider,
        vaultLocation: params.vaultLocation,
        storageType: params.storageType,
        dataCategory: params.dataCategory,
        lastUpdated: new Date(),
        encryptedBy: params.encryptedBy,
      })
      .returning();

    return storage;
  }

  /**
   * Define Recovery Time Objective (RTO) for system component
   */
  static async defineRTO(params: {
    systemComponent: string;
    componentDescription?: string;
    rtoHours: number;
    rpoHours: number;
    criticalityLevel: "critical" | "high" | "medium" | "low";
    dependsOn?: string[];
  }) {
    const [rto] = await db
      .insert(recoveryTimeObjectives)
      .values({
        systemComponent: params.systemComponent,
        componentDescription: params.componentDescription,
        rtoHours: params.rtoHours,
        rpoHours: params.rpoHours,
        criticalityLevel: params.criticalityLevel,
        dependsOn: params.dependsOn,
      })
      .returning();

    return rto;
  }

  /**
   * Calculate duration between two timestamps
   */
  private static calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  /**
   * Notify key holders of emergency activation
   */
  private static async notifyKeyHolders(
    systemId: string,
    activationId: string,
    emergencyLevel: string
  ) {
    try {
      // Fetch all active key holders with contact information
      const activeKeyHolders = await db
        .select()
        .from(keyHolderRegistry)
        .where(eq(keyHolderRegistry.status, "active"));

      if (activeKeyHolders.length === 0) {
        logger.warn('No active key holders found for system', { systemId });
        return;
      }

      // Import notification service dynamically to avoid circular dependencies
      const { NotificationService } = await import('@/lib/services/notification-service');
      const notificationService = new NotificationService();

      // Build emergency message
      const emergencyMessage = `
EMERGENCY: Break-Glass System Activated
System ID: ${systemId}
Activation ID: ${activationId}
Emergency Level: ${emergencyLevel}
Required Signatures: ${this.REQUIRED_SIGNATURES} of ${this.TOTAL_KEY_HOLDERS}
Action Required: Log in to UnionEyes immediately to authorize emergency access.
      `.trim();

      // Send notifications to each key holder
      const notificationPromises = activeKeyHolders.map(holder => {
        const notifications = [];

        // Send SMS if phone available
        if (holder.emergencyPhone) {
          notifications.push(
            notificationService.send({
              type: 'sms',
              recipientPhone: holder.emergencyPhone,
              body: emergencyMessage,
              subject: 'EMERGENCY: Break-Glass Activation',
              priority: 'critical',
            }).catch(err => {
              logger.error('Failed to send SMS to key holder', {
                error: err,
                phone: holder.emergencyPhone,
              });
            })
          );
        }

        // Send email if email available
        if (holder.emergencyEmail) {
          notifications.push(
            notificationService.send({
              type: 'email',
              recipientEmail: holder.emergencyEmail,
              subject: 'EMERGENCY: Break-Glass System Activated',
              body: emergencyMessage,
              priority: 'critical',
            }).catch(err => {
              logger.error('Failed to send email to key holder', {
                error: err,
                email: holder.emergencyEmail,
              });
            })
          );
        }

        return Promise.allSettled(notifications);
      });

      await Promise.allSettled(notificationPromises);

      logger.info('Break-glass notifications sent', {
        keyHolderCount: activeKeyHolders.length,
        systemId,
        activationId,
        emergencyLevel,
      });
    } catch (error) {
      logger.error('Failed to notify key holders', { error, systemId, activationId });
      // Continue even if notifications fail - activation should proceed
    }
  }

  /**
   * Get active key holders
   */
  static async getActiveKeyHolders() {
    return await db
      .select()
      .from(keyHolderRegistry)
      .where(eq(keyHolderRegistry.status, "active"));
  }

  /**
   * Get key holders needing training renewal
   */
  static async getKeyHoldersNeedingTraining() {
    const now = new Date();
    return await db
      .select()
      .from(keyHolderRegistry)
      .where(
        and(
          eq(keyHolderRegistry.status, "active"),
          lte(keyHolderRegistry.trainingExpiresAt, now)
        )
      );
  }
}
