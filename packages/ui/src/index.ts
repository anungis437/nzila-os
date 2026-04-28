// @nzila/ui — shared component library.
// See ./UX_DESIGN_SYSTEM.md for the design contract & QA checklist.
export { Button } from './components/Button'
export { Card } from './components/Card'
export { Badge } from './components/Badge'
export { Container } from './components/Container'
export { Sidebar, SidebarItem, SidebarSection } from './components/Sidebar'

// Phase 1 additions — canonical primitives. Replace per-app duplicates.
export { Stat } from './components/Stat'
export { SectionHeader } from './components/SectionHeader'
export { EmptyState } from './components/EmptyState'
export { Skeleton } from './components/Skeleton'
export { ErrorPanel } from './components/ErrorPanel'

// Design tokens (TS surface — CSS surface lives in globals.css).
export { tokens, space, radius, elevation, motion, typography, chartPalette, productAccent } from './tokens'
export type { ProductKey, StatusRole, Tokens } from './tokens'
