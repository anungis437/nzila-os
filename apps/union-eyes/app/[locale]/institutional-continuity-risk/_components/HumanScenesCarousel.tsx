'use client';

/**
 * HumanScenesCarousel — client-side scene rotator for the ICRA landing page.
 *
 * Replaces a scroll-heavy grid of 5 "human scenes" with one calm,
 * focus-at-a-time editorial card. Keyboard-accessible (←/→), reduced-motion
 * friendly, no external animation library. Used inside the otherwise
 * server-rendered Institutional Continuity Risk page.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HumanScene {
  id: string;
  title: string;
  body: string;
}

interface Props {
  scenes: HumanScene[];
  labels: {
    previous: string;
    next: string;
    /** Template like "Scene {current} of {total}" — placeholders are substituted client-side. */
    sceneOf: string;
  };
}

function formatSceneOf(template: string, current: number, total: number): string {
  return template
    .replace('{current}', String(current))
    .replace('{total}', String(total));
}

export default function HumanScenesCarousel({ scenes, labels }: Props) {
  const [index, setIndex] = useState(0);
  const total = scenes.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + total) % total);
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (total === 0) return null;
  const scene = scenes[index];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {/* Scene panel */}
        <div
          key={scene.id}
          className="space-y-5 p-8 motion-safe:animate-[fadeIn_280ms_ease-out] sm:p-12"
          aria-live="polite"
        >
          <h3 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            {scene.title}
          </h3>
          <p className="text-base font-light leading-relaxed text-stone-600 sm:text-lg">
            {scene.body}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-4 py-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={labels.previous}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2" role="tablist">
            {scenes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={formatSceneOf(labels.sceneOf, i + 1, total)}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-stone-900' : 'w-1.5 bg-stone-300 hover:bg-stone-400'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label={labels.next}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Local keyframes (Tailwind doesn't ship a fadeIn utility by default) */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
