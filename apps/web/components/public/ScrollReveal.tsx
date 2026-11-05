import type { CSSProperties, ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
}

export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 0.6,
}: ScrollRevealProps) {
  const transformByDirection: Record<NonNullable<ScrollRevealProps['direction']>, string> = {
    up: 'translate3d(0, 12px, 0)',
    down: 'translate3d(0, -12px, 0)',
    left: 'translate3d(-12px, 0, 0)',
    right: 'translate3d(12px, 0, 0)',
    none: 'translate3d(0, 0, 0)',
  };

  const style = {
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    '--nzila-reveal-from': transformByDirection[direction],
  } as CSSProperties;

  return (
    <div className={`nzila-reveal ${className}`} style={style}>
      {children}
    </div>
  );
}
