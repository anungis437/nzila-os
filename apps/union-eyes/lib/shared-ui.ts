/**
 * Shared UI bridge — Union-Eyes.
 *
 * Re-exports @nzila/ui components for gradual migration away from the
 * local components/ui/ shadcn library (~61 local components).
 *
 * Usage:
 *   import { Card, Badge } from '@/lib/shared-ui'
 *
 * Migration status: 7 components bridged below. Replace local
 * components/ui imports with these as files are touched.
 */
export {
  Button as NzilaButton,
  Card as NzilaCard,
  Badge as NzilaBadge,
  Container as NzilaContainer,
  Sidebar as NzilaSidebar,
  SidebarItem as NzilaSidebarItem,
  SidebarSection as NzilaSidebarSection,
} from '@nzila/ui'
