'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Organizer field notes.
 *
 * The route behind it, /api/organizing/notes, answers HTTP 501: no note store is open to the application (the
 * field_notes table has no authorized runtime access), so no note can be read or kept. The page says so instead of
 * listing nothing, and offers no way to start a note.
 */
export default function FieldNotesPage() {
  const t = useTranslations('organizingNotesPage');
  const locale = useLocale();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-ORGANIZING-FIELD-NOTES" />
    </div>
  );
}
