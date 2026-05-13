/**
 * ScrollReveal — Directional scroll-triggered reveal animation
 * Shared with apps/web for design cohesion across the Nzila portfolio.
 */
'use client';

import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  distance?: number;
  amount?: number;
  once?: boolean;
  tempo?: 'default' | 'conference';
}

export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 0.85,
  distance = 24,
  amount = 0.2,
  once = true,
  tempo = 'default',
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const pace =
    tempo === 'conference'
      ? {
          durationMultiplier: 1.2,
          delayMultiplier: 1.2,
          distanceMultiplier: 0.85,
          easing: [0.2, 0.92, 0.28, 1] as const,
        }
      : {
          durationMultiplier: 1,
          delayMultiplier: 1,
          distanceMultiplier: 1,
          easing: [0.16, 1, 0.3, 1] as const,
        };

  const resolvedDistance = prefersReducedMotion
    ? 0
    : Math.max(0, Math.round(distance * pace.distanceMultiplier));
  const resolvedDuration = prefersReducedMotion ? 0.01 : duration * pace.durationMultiplier;
  const resolvedDelay = prefersReducedMotion ? 0 : delay * pace.delayMultiplier;

  const offsets = {
    up: { y: resolvedDistance, x: 0 },
    down: { y: -resolvedDistance, x: 0 },
    left: { y: 0, x: -resolvedDistance },
    right: { y: 0, x: resolvedDistance },
    none: { y: 0, x: 0 },
  };

  const offset = offsets[direction];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: offset.y, x: offset.x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, margin: '-64px', amount }}
      transition={{
        duration: resolvedDuration,
        delay: resolvedDelay,
        ease: pace.easing,
      }}
    >
      {children}
    </motion.div>
  );
}
