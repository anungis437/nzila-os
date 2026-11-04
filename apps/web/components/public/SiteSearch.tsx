'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { searchGroups, searchSite, siteSearchIndex } from '@/lib/site-search-index';

type Props = {
  open: boolean;
  onClose: () => void;
  isFr: boolean;
};

const copy = {
  en: {
    title: 'Search nzilaventures.com',
    placeholder: 'Search products, trust, company…',
    close: 'Close search',
    empty: 'No pages match that search. Try a different word, or browse the suggestions below.',
    suggested: 'Popular pages',
    results: (count: number) => `${count} result${count === 1 ? '' : 's'}`,
    hint: 'Use ↑ ↓ to move, Enter to open, Esc to close',
  },
  fr: {
    title: 'Rechercher sur nzilaventures.com',
    placeholder: 'Rechercher produits, confiance, entreprise…',
    close: 'Fermer la recherche',
    empty: 'Aucune page ne correspond. Essayez un autre mot ou consultez les suggestions ci-dessous.',
    suggested: 'Pages populaires',
    results: (count: number) => `${count} résultat${count > 1 ? 's' : ''}`,
    hint: '↑ ↓ pour naviguer, Entrée pour ouvrir, Échap pour fermer',
  },
} as const;

const suggestedHrefs = ['/union-eyes', '/public-service', '/trust', '/security', '/status', '/contact'];

export default function SiteSearch({ open, onClose, isFr }: Props) {
  const router = useRouter();
  const language = isFr ? 'fr' : 'en';
  const text = copy[language];
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-results`;

  const suggested = useMemo(
    () =>
      suggestedHrefs
        .map((href) => siteSearchIndex.find((entry) => entry.href === href))
        .filter((entry): entry is (typeof siteSearchIndex)[number] => Boolean(entry)),
    [],
  );

  const matches = useMemo(() => (query.trim().length === 0 ? [] : searchSite(query, language)), [query, language]);
  const showingSuggestions = matches.length === 0;
  const results = showingSuggestions ? suggested : matches;

  const clampedActive = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    setQuery('');
    setActive(0);
    router.push(href);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(results.length === 0 ? 0 : (clampedActive + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(results.length === 0 ? 0 : (clampedActive - 1 + results.length) % results.length);
    } else if (
      event.key === 'Enter' &&
      event.target === inputRef.current &&
      results[clampedActive] &&
      (query.trim().length === 0 || !showingSuggestions)
    ) {
      event.preventDefault();
      go(results[clampedActive].href);
    } else if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[10vh]" onKeyDown={handleKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#050914]/70 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={text.title}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#101a2c] text-white shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <MagnifyingGlassIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[clampedActive] ? `${baseId}-option-${clampedActive}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder={text.placeholder}
            aria-label={text.title}
            className="min-h-11 w-full bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={text.close}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70]"
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
          <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400" aria-live="polite">
            {showingSuggestions ? text.suggested : text.results(results.length)}
          </p>
          {showingSuggestions && query.trim().length > 0 && (
            <p className="px-3 pb-2 text-sm text-slate-300">{text.empty}</p>
          )}
          <ul id={listId} role="listbox" aria-label={text.title}>
            {results.map((entry, index) => {
              const selected = index === clampedActive;
              return (
                <li
                  key={entry.href}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(entry.href)}
                  className={`cursor-pointer rounded-xl px-3 py-3 ${selected ? 'bg-white/10' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{entry.title[language]}</span>
                    <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider text-[#dfbe70]">
                      {searchGroups[entry.group][language]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{entry.description[language]}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="hidden border-t border-white/10 px-4 py-2.5 text-xs text-slate-400 sm:block">{text.hint}</p>
      </div>
    </div>
  );
}
