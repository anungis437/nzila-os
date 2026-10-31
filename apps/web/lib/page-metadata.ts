import type { Metadata } from 'next';
import type { Locale } from './locales';

const OG_LOCALE: Record<Locale, string> = { 'en-CA': 'en_CA', 'fr-CA': 'fr_CA' };

// The shared card is a generic brand graphic, so its alt text describes the graphic, not the page.
const SHARED_IMAGE_ALT = 'Nzila Ventures — Human-centered institutional software';

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  locale: Locale;
};

/**
 * Page title, description and social cards that all describe the same page.
 * The root layout's Open Graph and Twitter fields describe the homepage, and a
 * child that sets only `title` would advertise the homepage when shared.
 * `title` is the browser title, which the root layout's template suffixes;
 * social cards carry the brand explicitly because they are not templated.
 */
export function pageMetadata({ title, description, path, locale }: PageMetadataInput): Metadata {
  const socialTitle = `${title} | Nzila Ventures`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[locale] ?? OG_LOCALE['en-CA'],
      siteName: 'Nzila Ventures',
      title: socialTitle,
      description,
      url: path,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: SHARED_IMAGE_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/opengraph-image'],
    },
  };
}
