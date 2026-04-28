/**
 * Console UI primitives — barrel export.
 *
 * All primitives are local to apps/console (no new external deps) and
 * are intentionally minimal. For richer composition, layer JSX on top
 * of these — do NOT introduce parallel one-off styles in route files.
 */
export { cn } from './cn'
export { Button, type ButtonProps } from './Button'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from './Card'
export { Badge } from './Badge'
export { StatusPill } from './StatusPill'
export { KpiTile, type KpiTileProps } from './KpiTile'
export { EmptyState } from './EmptyState'
export {
  SkeletonLine,
  SkeletonBlock,
  SkeletonCard,
  SkeletonKpiStrip,
  SkeletonTable,
} from './SkeletonCard'
export { ErrorPanel, type ErrorSeverity } from './ErrorPanel'
export { PageHeader } from './PageHeader'
export { DataTable, type DataTableColumn } from './DataTable'
