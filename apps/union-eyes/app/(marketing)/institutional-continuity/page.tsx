/**
 * Legacy slug redirect — moved to /(marketing)/organizational-continuity.
 * Kept for SEO continuity and external bookmark stability.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function InstitutionalContinuityRedirect() {
  redirect('/en-CA/organizational-continuity');
}
