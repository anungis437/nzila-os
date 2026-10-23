'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

/** Page heading within the shared operational shell; the shell owns sticky navigation. */
export function MobileHeader({ title, showBack = false, backHref, rightContent, className }: MobileHeaderProps) {
  const french = useLocale() === 'fr-CA';
  const backLabel = french ? 'Retour' : 'Back';
  return (
    <header className={cn('ue-page-heading', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {showBack && (backHref ? (
          <Button asChild variant="outline" size="icon" className="shrink-0">
            <Link href={backHref} aria-label={backLabel}><ArrowLeft className="size-5" aria-hidden="true" /></Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={backLabel}
            onClick={() => window.history.back()}><ArrowLeft className="size-5" aria-hidden="true" /></Button>
        ))}
        <h1 className="min-w-0 break-words">{title}</h1>
      </div>
      {rightContent && <div className="ue-page-actions">{rightContent}</div>}
    </header>
  );
}

interface MobileHeaderSearchProps extends Omit<MobileHeaderProps, 'rightContent'> {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function MobileHeaderWithSearch({ title, showBack = false, backHref, searchValue = '',
  onSearchChange, searchPlaceholder, showSearch = true, className }: MobileHeaderSearchProps) {
  const french = useLocale() === 'fr-CA';
  const [isSearchVisible, setIsSearchVisible] = React.useState(showSearch);
  const label = searchPlaceholder ?? (french ? 'Rechercher…' : 'Search…');
  const toggle = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="space-y-3">
      <MobileHeader title={title} showBack={showBack} backHref={backHref} className={className}
        rightContent={<Button ref={toggle} type="button" variant="outline" size="icon"
          aria-label={isSearchVisible ? (french ? 'Fermer la recherche' : 'Close search') : (french ? 'Ouvrir la recherche' : 'Open search')}
          aria-expanded={isSearchVisible} onClick={() => setIsSearchVisible(value => !value)}>
          {isSearchVisible ? <X className="size-5" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}
        </Button>} />
      {isSearchVisible && <Input type="search" value={searchValue} onChange={event => onSearchChange?.(event.target.value)}
        placeholder={label} aria-label={label} className="w-full max-w-md" autoFocus
        onKeyDown={event => { if (event.key === 'Escape') { setIsSearchVisible(false); toggle.current?.focus(); } }} />}
    </div>
  );
}

export default MobileHeader;
