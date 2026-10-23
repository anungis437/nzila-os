import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared operational page hierarchy; capability descriptions remain page-owned. */
export function PageHeading({ title, description, actions, eyebrow, className }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; className?: string;
}) {
  return <header className={cn('ue-page-heading', className)}>
    <div className="min-w-0">
      {eyebrow && <p className="ue-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <div className="ue-page-description">{description}</div>}
    </div>
    {actions && <div className="ue-page-actions">{actions}</div>}
  </header>;
}
