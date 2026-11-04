'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * New organizer field note.
 *
 * Saving would POST to /api/organizing/notes, which answers HTTP 501: no note store is open to the application (the
 * field_notes table has no authorized runtime access), so a note typed here could not be kept. The page offers no
 * form and says so.
 */
export default function NewFieldNotePage() {
  const t = useTranslations('organizingNotesNewPage');
  const locale = useLocale();

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-ORGANIZING-FIELD-NOTES" />
    </div>
  );
}
