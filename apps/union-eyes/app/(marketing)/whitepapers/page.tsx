import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function WhitepapersHubRedirect() {
  redirect('/en-CA/whitepapers');
}
