import { redirect } from 'next/navigation'

/**
 * Legacy Console home.
 *
 * Per the Workspace Doctrine (docs/doctrine/NZILA_CONSOLE_WORKSPACE_DOCTRINE.md),
 * Console's front door is the six-workspace surface and **Overview** is the
 * "morning screen". This route no longer renders a separate tile launcher — it
 * forwards to the doctrine front door so every entry point is consistent.
 *
 * The external app launcher remains available in the sidebar ("Launch App").
 */
export const dynamic = 'force-dynamic'

export default function ConsoleHome() {
  redirect('/workspace/overview')
}
