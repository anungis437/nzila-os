/**
 * StandaloneBrandedHeader — minimal branded top bar used by ICRA standalone surfaces.
 *
 * Renders only a centered home-link logo and a locale switcher, anchored to the
 * outer edges of the viewport so it never collides with content containers.
 * Used by routes that deliberately escape the marketing site chrome (landing
 * page, assessment flow) but must still carry the UnionEyes brand.
 *
 * Variants:
 *  - "overlay" (default): absolutely positioned over a hero background, white
 *    glassy chip styling intended for dark imagery.
 *  - "solid": sits inline above the page content, light chip styling intended
 *    for pages with a plain background (e.g. the assessment flow).
 */
import Image from 'next/image';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';

interface Props {
  locale: string;
  variant?: 'overlay' | 'solid';
}

export default function StandaloneBrandedHeader({ locale, variant = 'overlay' }: Props) {
  const isOverlay = variant === 'overlay';
  return (
    <header
      className={
        isOverlay
          ? 'absolute top-0 left-0 right-0 z-20'
          : 'relative z-20 border-b border-stone-200/60 bg-white'
      }
    >
      <div className="flex items-center justify-between px-4 py-5 sm:px-8 lg:px-12">
        <Link
          href={`/${locale}`}
          aria-label="UnionEyes home"
          className={
            isOverlay
              ? 'flex items-center rounded-md bg-white/10 p-1.5 backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/15'
              : 'flex items-center rounded-md p-1.5 transition hover:bg-stone-100'
          }
        >
          <Image
            src="/images/brand/icon.png"
            alt="UnionEyes"
            width={64}
            height={64}
            className="h-14 w-14 object-contain"
            priority
          />
        </Link>
        <div
          className={
            isOverlay
              ? 'rounded-md bg-white/10 px-2 py-1 backdrop-blur-md ring-1 ring-white/20'
              : 'rounded-md px-2 py-1'
          }
        >
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
