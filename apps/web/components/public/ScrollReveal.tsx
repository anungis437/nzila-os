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
}: ScrollRevealProps) {
  const transformByDirection: Record<NonNullable<ScrollRevealProps['direction']>, string> = {
    up: 'translate3d(0, 12px, 0)',
    down: 'translate3d(0, -12px, 0)',
    left: 'translate3d(-12px, 0, 0)',
    right: 'translate3d(12px, 0, 0)',
    none: 'translate3d(0, 0, 0)',
  };

  const style: CSSProperties = {
    animationDelay: `${delay}s`,
    transform: transformByDirection[direction],
  };

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
