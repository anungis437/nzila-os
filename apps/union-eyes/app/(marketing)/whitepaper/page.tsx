import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function WhitepaperPage() {
  redirect('/en-CA/whitepaper');
}