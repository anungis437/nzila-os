/**
 * Human-Centered Callout Component
 * 
 * Purpose: Reinforce union-first values throughout the platform
 * Usage: Story pages, impact sections, ethical messaging
 * 
 * Design: Calm, trustworthy, institutional (not Silicon Valley)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
 
import { Heart, Shield, Eye, Users } from 'lucide-react';

export type CalloutVariant = 'solidarity' | 'trust' | 'transparency' | 'human';

export interface HumanCenteredCalloutProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  /** Alias for description — accepted for convenience */
  message?: string;
  variant?: CalloutVariant;
  className?: string;
  children?: React.ReactNode;
  compact?: boolean;
}

const variantStyles: Record<CalloutVariant, { bg: string; border: string; icon: string }> = {
  solidarity: {
    bg: 'bg-red-50',
    border: 'border-red-200 border-l-red-500',
    icon: 'text-red-600',
  },
  trust: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200 border-l-emerald-600',
    icon: 'text-emerald-700',
  },
  transparency: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 border-l-blue-600',
    icon: 'text-blue-700',
  },
  human: {
    bg: 'bg-amber-50',
    border: 'border-amber-200 border-l-amber-600',
    icon: 'text-amber-700',
  },
};

const defaultIcons: Record<CalloutVariant, React.ReactNode> = {
  solidarity: <Heart className="h-6 w-6" />,
  trust: <Shield className="h-6 w-6" />,
  transparency: <Eye className="h-6 w-6" />,
  human: <Users className="h-6 w-6" />,
};

export function HumanCenteredCallout({
  icon,
  title,
  description,
  message,
  variant = 'human',
  className,
  children,
  compact: _compact,
}: HumanCenteredCalloutProps) {
  const styles = variantStyles[variant];
  const displayIcon = icon || defaultIcons[variant];
  const displayDescription = description || message || '';

  return (
    <div
      className={cn(
        'border-l-4 rounded-lg p-6 shadow-sm',
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn('shrink-0', styles.icon)}>
          {displayIcon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {title}
          </h3>
          <p className="text-slate-700 leading-relaxed">
            {displayDescription}
          </p>
          {children && (
            <div className="mt-4">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact variant for inline use
 */
export function HumanCenteredCalloutCompact({
  icon,
  title,
  variant = 'human',
  className,
}: Pick<HumanCenteredCalloutProps, 'icon' | 'title' | 'variant' | 'className'>) {
  const styles = variantStyles[variant];
  const displayIcon = icon || defaultIcons[variant];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full border',
        styles.bg,
        styles.border.split(' ')[0], // Just the border color, not border-l
        className
      )}
    >
      <span className={cn('shrink-0', styles.icon)}>
        {displayIcon}
      </span>
      <span className="text-sm font-medium text-slate-900">
        {title}
      </span>
    </div>
  );
}

/**
 * Preset callouts for common messaging
 */
export const CalloutPresets = {
  BuiltWithUnions: () => (
    <HumanCenteredCallout
      variant="solidarity"
      title="Built with unions, not for unions"
      description="Every feature co-designed with union stewards who understand the real challenges of case management and member advocacy."
    />
  ),

  NoSurveillance: () => (
    <HumanCenteredCallout
      variant="trust"
      title="No surveillance, no dark patterns"
      description="We track system effectiveness, not individual behavior. No productivity scoring, no leaderboards, no weaponized metrics."
    />
  ),

  TransparencyFirst: () => (
    <HumanCenteredCallout
      variant="transparency"
      title="Transparency as infrastructure"
      description="All governance decisions, data handling practices, and system safeguards are visible and auditable. Trust through openness."
    />
  ),

  OrganizersCentral: () => (
    <HumanCenteredCallout
      variant="human"
      title="Organizers are the central actors"
      description="Technology serves people, never replaces them. Stewards make the decisions, the system provides support."
    />
  ),
};

/**
 * Example usage:
 * 
 * <HumanCenteredCallout
 *   variant="solidarity"
 *   title="Democratic by design"
 *   description="FSM enforcement means fairness protection. Rules apply equally to everyone."
 * />
 * 
 * Or use presets:
 * 
 * <CalloutPresets.BuiltWithUnions />
 */
