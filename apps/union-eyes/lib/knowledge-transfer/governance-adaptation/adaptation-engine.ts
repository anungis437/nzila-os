/**
 * Governance Adaptation Engine
 *
 * Tracks how organizational governance reasoning evolves longitudinally.
 * Identifies recurring continuity failures, successful adaptations, and stagnation patterns.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import type {
  GovernanceAdaptationReport,
  GovernanceAdaptationEvent,
  RecurringPattern,
  GovernanceAdaptationEventType,
} from './adaptation-models';
import { randomUUID } from 'crypto';

function buildAdaptationEvents(
  store: Awaited<ReturnType<typeof loadCognitionMemory>>,
  sessions: Awaited<ReturnType<typeof listReasoningSessions>>,
): GovernanceAdaptationEvent[] {
  const events: GovernanceAdaptationEvent[] = [];

  // Events from sessions
  for (const session of sessions) {
    events.push({
      id: randomUUID(),
      eventType: 'session_created' as GovernanceAdaptationEventType,
      description: `Reasoning session started: "${session.title}" (focus: ${session.focus})`,
      resilienceScoreAtEvent: session.latestResilienceScore,
      occurredAt: session.createdAt,
      sessionId: session.id,
      memoryEntryId: null,
    });
  }

  // Events from cognition memory
  for (const entry of store.entries) {
    let eventType: GovernanceAdaptationEventType = 'memory_captured';
    if (entry.memoryType === 'governance_reasoning' || entry.memoryType === 'decision_brief') {
      eventType = 'governance_decision_made';
    } else if (entry.memoryType === 'mitigation_comparison') {
      eventType = 'mitigation_recorded';
    } else if (entry.memoryType === 'resilience_baseline') {
      eventType = 'memory_captured';
    }

    events.push({
      id: randomUUID(),
      eventType,
      description: entry.title,
      resilienceScoreAtEvent: entry.resilienceScoreAtCapture,
      occurredAt: entry.createdAt,
      sessionId: entry.sessionId,
      memoryEntryId: entry.id,
    });
  }

  // Resilience change events from timeline
  for (const point of store.resilienceTimeline) {
    if (point.changeFromPrevious === null) continue;
    const isImprovement = point.changeFromPrevious >= 5;
    const isDecline = point.changeFromPrevious <= -5;
    if (isImprovement || isDecline) {
      events.push({
        id: randomUUID(),
        eventType: isImprovement ? 'resilience_improved' : 'resilience_declined',
        description: isImprovement
          ? `Resilience improved by ${point.changeFromPrevious} points to ${point.resilienceScore}`
          : `Resilience declined by ${Math.abs(point.changeFromPrevious)} points to ${point.resilienceScore}`,
        resilienceScoreAtEvent: point.resilienceScore,
        occurredAt: point.capturedAt,
        sessionId: null,
        memoryEntryId: point.memoryEntryId,
      });
    }
  }

  // Sort chronologically
  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

function detectRecurringPatterns(
  store: Awaited<ReturnType<typeof loadCognitionMemory>>,
  events: GovernanceAdaptationEvent[],
): RecurringPattern[] {
  const patterns: RecurringPattern[] = [];

  const declineEvents = events.filter((e) => e.eventType === 'resilience_declined');
  if (declineEvents.length >= 2) {
    patterns.push({
      patternType: 'recurring_failure',
      description: `${declineEvents.length} resilience decline events detected across measurement history`,
      occurrenceCount: declineEvents.length,
      firstDetectedAt: declineEvents[0].occurredAt,
      mostRecentAt: declineEvents[declineEvents.length - 1].occurredAt,
      governanceImplication: 'Recurring resilience declines suggest continuity gains are not being institutionalized. Governance process formalization is recommended.',
    });
  }

  const improvementEvents = events.filter((e) => e.eventType === 'resilience_improved');
  if (improvementEvents.length >= 2) {
    patterns.push({
      patternType: 'successful_adaptation',
      description: `${improvementEvents.length} resilience improvement events demonstrate adaptive continuity governance`,
      occurrenceCount: improvementEvents.length,
      firstDetectedAt: improvementEvents[0].occurredAt,
      mostRecentAt: improvementEvents[improvementEvents.length - 1].occurredAt,
      governanceImplication: 'Repeated resilience improvements indicate governance interventions are working. Continue and document these practices.',
    });
  }

  // Stagnation: sessions with no improvement events nearby
  const sessionCount = events.filter((e) => e.eventType === 'session_created').length;
  if (sessionCount >= 3 && improvementEvents.length === 0) {
    patterns.push({
      patternType: 'stagnation',
      description: `${sessionCount} reasoning sessions recorded but no measurable resilience improvement detected`,
      occurrenceCount: sessionCount,
      firstDetectedAt: events[0]?.occurredAt ?? new Date().toISOString(),
      mostRecentAt: events[events.length - 1]?.occurredAt ?? new Date().toISOString(),
      governanceImplication: 'Active reasoning sessions are not translating to measurable resilience gains. Review whether session outcomes are being operationalized.',
    });
  }

  return patterns;
}

/**
 * Analyze governance reasoning evolution across sessions and memory history.
 */
export async function analyzeGovernanceAdaptation(
  orgId: string,
): Promise<GovernanceAdaptationReport> {
  const [store, sessions] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    listReasoningSessions(orgId, { limit: 50 }),
  ]);

  const events = buildAdaptationEvents(store, sessions);
  const patterns = detectRecurringPatterns(store, events);

  const improvingCount = events.filter((e) => e.eventType === 'resilience_improved').length;
  const decliningCount = events.filter((e) => e.eventType === 'resilience_declined').length;
  const totalEvents = events.length;

  let adaptationHealth: GovernanceAdaptationReport['adaptationHealth'] = 'insufficient_history';
  if (totalEvents < 3) {
    adaptationHealth = 'insufficient_history';
  } else if (improvingCount > decliningCount && improvingCount >= 2) {
    adaptationHealth = 'actively_adapting';
  } else if (improvingCount >= 1 || store.entries.length >= 5) {
    adaptationHealth = 'slowly_adapting';
  } else {
    adaptationHealth = 'stagnant';
  }

  const focusMap: Record<string, string> = {
    actively_adapting: 'Institutionalize current governance practices that are driving resilience improvements.',
    slowly_adapting: 'Accelerate governance iteration cycles to translate reasoning into measurable resilience gains.',
    stagnant: 'Conduct a governance gap review — identify why continuity reasoning is not producing measurable improvements.',
    insufficient_history: 'Build organizational memory by conducting regular governance reasoning sessions and capturing mitigation outcomes.',
  };

  const progressionNarrative = totalEvents < 3
    ? 'Insufficient governance history to establish adaptation narrative.'
    : `${totalEvents} governance events recorded across ${sessions.length} sessions and ${store.entries.length} memory entries. ${improvingCount} resilience improvements detected. ${patterns.length} governance patterns identified.`;

  const earliest = events[0]?.occurredAt ?? null;
  const latest = events[events.length - 1]?.occurredAt ?? null;

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    adaptationTimeline: {
      events: events.slice(0, 50), // cap for performance
      totalEvents,
      earliestEvent: earliest,
      latestEvent: latest,
      progressionNarrative,
    },
    recurringPatterns: patterns,
    sessionsAnalyzed: sessions.length,
    adaptationHealth,
    nextFocusRecommendation: focusMap[adaptationHealth] ?? 'Continue building governance history.',
  };
}
