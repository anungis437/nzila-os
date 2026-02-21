import { redirect } from 'next/navigation'

/**
 * /partners on the public web site redirects to the Partner Portal sign-in.
 * In production this will be a separate SWA domain.
 */
export default function PartnersSignInRedirect() {
  const partnersUrl = process.env.NEXT_PUBLIC_PARTNERS_URL || 'http://localhost:3002'
  redirect(`${partnersUrl}/sign-in`)
}
