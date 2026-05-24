/**
 * Learning & Feedback System
 * 
 * Enables continuous improvement through:
 * - User feedback collection
 * - Correction tracking
 * - Pattern detection
 * - Auto-improvement triggers
 */

import { logger } from '@/lib/logger';

// Feedback types
export type FeedbackType = 
  | 'correction'      // User corrected AI response
  | 'upvote'          // User liked response
  | 'downvote'        // User disliked response
  | 'completion'       // User completed task successfully
  | 'abandonment'     // User gave up
  | 'escalation';     // User needed human help

export interface UserFeedback {
  id: string;
  type: FeedbackType;
  query: string;
  response?: string;
  correction?: string;
  rating?: 'positive' | 'negative' | 'neutral';
  userId: string;
  organizationId: string;
  sessionId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  resolved?: boolean;
}

// Pattern detection
export interface DetectedPattern {
  id: string;
  type: 'query_pattern' | 'response_issue' | 'missing_knowledge';
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  description: string;
  affectedQueries: number;
  suggestedFix?: string;
  autoFixable: boolean;
}

// Learning events
export interface LearningEvent {
  id: string;
  type: 'correction_made' | 'pattern_detected' | 'knowledge_gap' | 'template_updated';
  payload: Record<string, unknown>;
  timestamp: Date;
  organizationId?: string;
}

// Stats
export interface LearningStats {
  totalFeedback: number;
  correctionsByType: Record<string, number>;
  patternsDetected: number;
  autoFixesApplied: number;
  knowledgeGapsIdentified: number;
  averageResponseQuality: number;
}

/**
 * Learning Service
 */
class LearningService {
  private feedback: Map<string, UserFeedback> = new Map();
  private patterns: Map<string, DetectedPattern> = new Map();
  private events: LearningEvent[] = [];
  
  // Thresholds
  private readonly PATTERN_THRESHOLD = 5; // detections before pattern
  private readonly CORRECTION_WEIGHT = 3;
  private readonly DOWNVOTE_WEIGHT = 1;

  /**
   * Record user feedback
   */
  recordFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): UserFeedback {
    const id = this.generateId();
    const record: UserFeedback = {
      ...feedback,
      id,
      timestamp: new Date(),
    };

    this.feedback.set(id, record);
    this.processFeedback(record);

    logger.info('Feedback recorded', { id, type: feedback.type, userId: feedback.userId });

    return record;
  }

  /**
   * Process feedback and detect patterns
   */
  private processFeedback(feedback: UserFeedback): void {
    // Log learning event
    this.events.push({
      id: this.generateId(),
      type: this.getEventType(feedback.type),
      payload: {
        feedbackId: feedback.id,
        query: feedback.query,
        type: feedback.type,
      },
      timestamp: new Date(),
      organizationId: feedback.organizationId,
    });

    // Check for patterns in corrections
    if (feedback.type === 'correction' && feedback.correction) {
      this.detectCorrectionPattern(feedback);
    }

    // Check for repeated queries with different outcomes
    if (feedback.type === 'downvote' || feedback.type === 'abandonment') {
      this.detectQueryIssue(feedback);
    }
  }

  /**
   * Detect correction patterns
   */
  private detectCorrectionPattern(feedback: UserFeedback): void {
    const key = this.normalizeForPattern(feedback.query);
    
    let pattern = this.patterns.get(key);
    
    if (pattern) {
      pattern.frequency++;
      pattern.lastSeen = new Date();
      pattern.affectedQueries++;
    } else {
      pattern = {
        id: this.generateId(),
        type: 'response_issue',
        frequency: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        description: `Queries similar to "${feedback.query.substring(0, 50)}..." are being corrected`,
        affectedQueries: 1,
        autoFixable: false,
      };
      this.patterns.set(key, pattern);
    }

    // If pattern is frequent, suggest investigation
    if (pattern.frequency >= this.PATTERN_THRESHOLD) {
      logger.warn('Pattern detected', { 
        patternId: pattern.id, 
        frequency: pattern.frequency 
      });
    }
  }

  /**
   * Detect query issues
   */
  private detectQueryIssue(feedback: UserFeedback): void {
    const key = `issue:${this.normalizeForPattern(feedback.query)}`;
    
    let pattern = this.patterns.get(key);
    
    if (pattern) {
      pattern.frequency++;
      pattern.lastSeen = new Date();
    } else {
      pattern = {
        id: this.generateId(),
        type: 'query_pattern',
        frequency: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        description: `Queries like "${feedback.query.substring(0, 50)}..." result in negative outcomes`,
        affectedQueries: 1,
        autoFixable: false,
      };
      this.patterns.set(key, pattern);
    }
  }

  /**
   * Detect knowledge gaps
   */
  detectKnowledgeGap(query: string, results: { found: boolean; count: number }): void {
    if (!results.found || results.count === 0) {
      const key = `gap:${this.normalizeForPattern(query)}`;
      
      let pattern = this.patterns.get(key);
      
      if (pattern) {
        pattern.frequency++;
        pattern.lastSeen = new Date();
      } else {
        pattern = {
          id: this.generateId(),
          type: 'missing_knowledge',
          frequency: 1,
          firstSeen: new Date(),
          lastSeen: new Date(),
          description: `System lacks knowledge about: "${query.substring(0, 50)}..."`,
          affectedQueries: 1,
          autoFixable: true,
          suggestedFix: 'Add relevant documents to knowledge base',
        };
        this.patterns.set(key, pattern);
      }
    }
  }

  /**
   * Get patterns that need attention
   */
  getUrgentPatterns(organizationId?: string): DetectedPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => {
        if (organizationId) return true; // Filter by org if needed
        return p.frequency >= this.PATTERN_THRESHOLD;
      })
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get learning stats
   */
  getStats(organizationId?: string): LearningStats {
    const allFeedback = Array.from(this.feedback.values())
      .filter(f => !organizationId || f.organizationId === organizationId);

    const correctionsByType: Record<string, number> = {};
    let totalRating = 0;
    let ratingCount = 0;

    for (const f of allFeedback) {
      correctionsByType[f.type] = (correctionsByType[f.type] || 0) + 1;
      
      if (f.rating) {
        totalRating += f.rating === 'positive' ? 1 : f.rating === 'negative' ? -1 : 0;
        ratingCount++;
      }
    }

    const patterns = Array.from(this.patterns.values());

    return {
      totalFeedback: allFeedback.length,
      correctionsByType,
      patternsDetected: patterns.length,
      autoFixesApplied: 0, // Would be tracked
      knowledgeGapsIdentified: patterns.filter(p => p.type === 'missing_knowledge').length,
      averageResponseQuality: ratingCount > 0 ? (totalRating / ratingCount + 1) / 2 * 100 : 50,
    };
  }

  /**
   * Get feedback for model improvement
   */
  getImprovementData(limit: number = 100): {
    corrections: { query: string; original: string; corrected: string }[];
    problematicQueries: string[];
    knowledgeGaps: string[];
  } {
    const corrections: { query: string; original: string; corrected: string }[] = [];
    const problematicQueries: string[] = [];
    const knowledgeGaps: string[] = [];

    for (const feedback of this.feedback.values()) {
      if (feedback.type === 'correction' && feedback.correction) {
        corrections.push({
          query: feedback.query,
          original: feedback.response || '',
          corrected: feedback.correction,
        });
      }

      if (feedback.type === 'downvote' || feedback.type === 'abandonment') {
        problematicQueries.push(feedback.query);
      }
    }

    for (const pattern of this.patterns.values()) {
      if (pattern.type === 'missing_knowledge') {
        knowledgeGaps.push(pattern.description);
      }
    }

    return {
      corrections: corrections.slice(-limit),
      problematicQueries: [...new Set(problematicQueries)].slice(-limit),
      knowledgeGaps: [...new Set(knowledgeGaps)].slice(-limit),
    };
  }

  /**
   * Resolve feedback
   */
  resolveFeedback(feedbackId: string, resolution: string): boolean {
    const feedback = this.feedback.get(feedbackId);
    if (!feedback) return false;

    feedback.resolved = true;
    feedback.metadata.resolution = resolution;

    logger.info('Feedback resolved', { feedbackId, resolution });

    return true;
  }

  /**
   * Apply automatic fix.
   *
   * NOT IMPLEMENTED: there is no integration with the template system or
   * knowledge base yet. This method only marks the pattern as "addressed" by
   * resetting its frequency counter; no actual content change happens anywhere
   * downstream. Returns false unless the pattern is auto-fixable, so callers
   * can still gate on the return value, but a `true` return does NOT mean a
   * real fix was applied.
   */
  applyAutoFix(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern || !pattern.autoFixable) return false;

    logger.warn('learning.applyAutoFix: no real auto-fix integration is wired; only resetting the pattern frequency counter. No template or knowledge-base change has been applied.', {
      patternId,
      suggestion: pattern.suggestedFix,
    });

    // Mark pattern as addressed
    pattern.frequency = 0;

    return true;
  }

  /**
   * Get recent events
   */
  getEvents(limit: number = 50): LearningEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Normalize query for pattern detection
   */
  private normalizeForPattern(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get event type from feedback type
   */
  private getEventType(feedbackType: FeedbackType): LearningEvent['type'] {
    switch (feedbackType) {
      case 'correction':
        return 'correction_made';
      case 'upvote':
      case 'completion':
        return 'template_updated';
      case 'downvote':
      case 'abandonment':
      case 'escalation':
        return 'pattern_detected';
      default:
        return 'pattern_detected';
    }
  }

  /**
   * Clear old data (for privacy/compliance)
   */
  clearOldFeedback(olderThanDays: number = 90): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let cleared = 0;
    for (const [id, feedback] of this.feedback.entries()) {
      if (feedback.timestamp < cutoff) {
        this.feedback.delete(id);
        cleared++;
      }
    }

    logger.info('Old feedback cleared', { count: cleared, olderThanDays });

    return cleared;
  }
}

// Export singleton
export const learningService = new LearningService();

// Export types
export { LearningService };
