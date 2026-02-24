/**
 * Human Explainer Service
 * 
 * Purpose: Convert FSM states into compassionate, human-readable explanations
 * Part of the "Member Wow Engine" - making the system feel human, not robotic
 * 
 * Philosophy: Technology serves people. Every status should be understandable and empathetic.
 */

import { ClaimStatus, ClaimPriority } from '@/lib/services/claim-workflow-fsm';
import { HumanExplanation } from '@/types/marketing';

export interface ExplainerContext {
  status: ClaimStatus;
  priority: ClaimPriority;
  daysInState: number;
  assignedSteward?: string;
  memberName?: string;
  caseType?: string;
}

/**
 * Get human-readable explanation for a claim status
 */
export function getHumanExplainer(context: ExplainerContext): HumanExplanation {
  const baseExplainer = statusExplainers[context.status];
  
  return {
    ...baseExplainer,
    daysInThisStage: context.daysInState,
    priorityContext: getPriorityContext(context.priority, context.daysInState),
    // Personalize if data available
    title: baseExplainer.title.replace(
      '{steward}',
      context.assignedSteward || 'a steward'
    ),
  };
}

/**
 * Status-specific explainers
 */
const statusExplainers: Record<ClaimStatus, Omit<HumanExplanation, 'daysInThisStage' | 'priorityContext'>> = {
  submitted: {
    title: 'Your grievance has been received',
    explanation:
      'Your case is now in our system and will be reviewed by a steward within 48 hours. We\'ve sent you a confirmation email with your case number.',
    nextSteps: [
      'A steward will be assigned to your case',
      'You\'ll receive an email when review begins',
      'Keep your documentation organized and accessible',
    ],
    expectedTimeline: 'Review typically starts within 1-2 business days',
    empathyMessage:
      'We take your concerns seriously and will keep you informed every step of the way.',
    resourcesAvailable: [
      {
        title: 'What to expect',
        description: 'Learn about the grievance process and your rights',
        url: '/resources/grievance-process',
      },
      {
        title: 'Contact your steward',
        description: 'You can reach out anytime if you have questions',
      },
    ],
  },

  under_review: {
    title: '{steward} is carefully reviewing your case',
    explanation:
      'A dedicated steward is examining the details of your situation, reviewing relevant policies, and gathering information to support your case.',
    nextSteps: [
      'Steward may reach out for additional details',
      'Case will move to investigation if evidence supports your claim',
      'You\'ll be notified of the decision and next steps',
    ],
    expectedTimeline: 'Review process takes 3-7 business days',
    empathyMessage:
      'We understand this is a difficult time. Your steward is your advocate throughout this process.',
    resourcesAvailable: [
      {
        title: 'Your rights during review',
        description: 'What employers can and cannot do while your case is under review',
        url: '/resources/your-rights',
      },
    ],
  },

  assigned: {
    title: 'Your case has been assigned to {steward}',
    explanation:
      'A steward with experience in cases like yours has been assigned. They will be your primary contact throughout the process.',
    nextSteps: [
      'Your steward will contact you within 24 hours',
      'They\'ll explain the process and answer your questions',
      'Together you\'ll develop a strategy for your case',
    ],
    expectedTimeline: 'Initial contact within 1 business day',
    empathyMessage:
      'You\'re not alone in this. Your steward is here to fight for your rights.',
  },

  investigation: {
    title: 'Active investigation underway',
    explanation:
      'Your steward is conducting a thorough investigation, which may include interviewing witnesses, reviewing documents, and consulting with union representatives. This is a critical phase where we build the strongest possible case.',
    nextSteps: [
      'Investigation findings will be documented',
      'Evidence will be organized to support your case',
      'You\'ll be notified when the investigation concludes',
      'Next steps will be determined based on findings',
    ],
    expectedTimeline: 'Investigations typically conclude within 2-3 weeks',
    empathyMessage:
      'This step ensures we have all the facts to support your case. Thoroughness takes time, but it\'s worth it.',
  },

  pending_documentation: {
    title: 'Additional documentation needed',
    explanation:
      'To move forward with your case, we need some additional information or documentation from you. This is normal and helps us build the strongest possible case.',
    nextSteps: [
      'Check your email for specific document requests',
      'Gather and submit the requested materials',
      'Your steward can help you understand what\'s needed',
      'Case will resume once documentation is received',
    ],
    expectedTimeline: 'Provide documentation within 7 days if possible',
    empathyMessage:
      'We know gathering paperwork can be frustrating. Your steward is here to help guide you through this.',
    resourcesAvailable: [
      {
        title: 'Document checklist',
        description: 'Common documents needed for grievance cases',
        url: '/resources/document-checklist',
      },
    ],
  },

  resolved: {
    title: 'Your case has been resolved',
    explanation:
      'After careful review and advocacy, your case has reached a resolution. This means an agreement or outcome has been achieved.',
    nextSteps: [
      'Review the resolution details sent to you',
      'Contact your steward if you have questions',
      'Any agreed-upon actions will be implemented',
    ],
    expectedTimeline: 'Resolution implementation varies by case',
    empathyMessage:
      'Thank you for trusting us with your case. Your participation in the process makes our union stronger.',
    resourcesAvailable: [
      {
        title: 'Understanding your resolution',
        description: 'What happens after a case is resolved',
        url: '/resources/post-resolution',
      },
      {
        title: 'Share feedback',
        description: 'Help us improve by sharing your experience',
      },
    ],
  },

  rejected: {
    title: 'Your case has been reviewed',
    explanation:
      'After thorough review, we were unable to proceed with your case as a formal grievance. This doesn\'t mean your concerns aren\'t valid, but we may need to explore alternative approaches.',
    nextSteps: [
      'Review the detailed explanation sent to you',
      'Discuss alternative options with your steward',
      'You may have other avenues for addressing the issue',
    ],
    expectedTimeline: 'Contact your steward within 48 hours to discuss',
    empathyMessage:
      'We understand this isn\'t the outcome you hoped for. Your steward can help you understand the decision and explore other options.',
    resourcesAvailable: [
      {
        title: 'Alternative resources',
        description: 'Other ways to address workplace concerns',
        url: '/resources/alternatives',
      },
    ],
  },

  closed: {
    title: 'Your case is closed',
    explanation:
      'This case has been completed and is now closed. All documentation has been archived and is available for your records.',
    nextSteps: [
      'Download your case documents for your records',
      'Contact your steward if you have follow-up questions',
      'We\'re here if you need support in the future',
    ],
    expectedTimeline: 'Case records retained for 7 years',
    empathyMessage:
      'Thank you for being part of our union. We\'re here whenever you need us.',
  },
};

/**
 * Get priority-specific context
 */
function getPriorityContext(priority: ClaimPriority, _daysInState: number): string {
  const priorityMessages: Record<ClaimPriority, string> = {
    critical:
      'This case is flagged as CRITICAL and receives expedited handling. Stewards are treating this with the highest urgency.',
    high: 'This case is marked HIGH PRIORITY and is being handled with urgency.',
    medium: 'This case is progressing through the standard review process.',
    low: 'This case is in the queue and will be processed in order.',
  };

  const context = priorityMessages[priority];

  // Add time-based context
  const _thresholds: Record<ClaimStatus, number> = {
    submitted: 2,
    under_review: 7,
    assigned: 1,
    investigation: 21,
    pending_documentation: 7,
    resolved: 0,
    rejected: 0,
    closed: 0,
  };

  // Note: We&apos;d need the current status to check against thresholds
  // This is simplified for the example

  return context;
}

/**
 * Get encouragement message based on time in state
 */
export function getEncouragementMessage(
  status: ClaimStatus,
  daysInState: number
): string | null {
  if (status === 'investigation' && daysInState > 14) {
    return 'We know the wait can be difficult. Your steward is working hard to ensure a thorough investigation.';
  }

  if (status === 'pending_documentation' && daysInState > 5) {
    return 'If you\'re having trouble gathering the requested documents, please reach out to your steward for assistance.';
  }

  if (status === 'under_review' && daysInState > 7) {
    return 'Your case is taking longer than usual due to its complexity. Your steward remains committed to achieving the best outcome.';
  }

  return null;
}

/**
 * Generate plain English summary of FSM rules
 */
export function explainTransitionRules(currentStatus: ClaimStatus): string {
  const explanations: Record<ClaimStatus, string> = {
    submitted:
      'Once submitted, your case will be assigned to a steward for review. In rare cases, it may be rejected if it falls outside union jurisdiction.',
    under_review:
      'During review, your steward will determine next steps: moving to investigation, requesting additional documentation, or resolving if the issue is straightforward.',
    assigned:
      'Now that a steward is assigned, they\'ll begin their review and decide whether to investigate further or request additional information.',
    investigation:
      'The investigation can lead to resolution if findings are clear, or may require additional documentation to strengthen the case.',
    pending_documentation:
      'Once you provide the requested documents, your steward will resume the investigation or move toward resolution.',
    resolved:
      'Your case is complete. It will be archived with all supporting documentation.',
    rejected:
      'This decision can be discussed with your steward to explore other options.',
    closed:
      'Closed cases are archived but remain accessible for your records.',
  };

  return explanations[currentStatus];
}

/**
 * Example usage:
 * 
 * const explanation = getHumanExplainer({
 *   status: 'investigation',
 *   priority: 'high',
 *   daysInState: 12,
 *   assignedSteward: 'Maria Rodriguez',
 *   memberName: 'John Smith',
 * });
 * 
 * // Display to member:
 * <div>
 *   <h3>{explanation.title}</h3>
 *   <p>{explanation.explanation}</p>
 *   <p className="empathy">{explanation.empathyMessage}</p>
 *   <ul>
 *     {explanation.nextSteps.map(step => <li>{step}</li>)}
 *   </ul>
 * </div>
 */
