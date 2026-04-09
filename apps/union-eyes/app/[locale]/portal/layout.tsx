/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 * All child pages redirect to their dashboard equivalents.
 * This layout is retained only to wrap those server-side redirects.
 */
import { ReactNode } from "react";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
