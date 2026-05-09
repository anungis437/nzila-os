/**
 * Shared Navigation Grammar
 *
 * Builds the canonical sidebar shape every Nzila app composes from.
 * Doctrine: docs/nzila-operational-convergence/shared-navigation-grammar.md
 */
import { CANONICAL_GROUPS, getCanonicalIATree, type CanonicalGroup } from './ia'
import { getRoleExperience, type CanonicalRole } from './roles'

export interface SidebarChild {
  readonly label: string
  readonly href: string
}

export interface SidebarGroup {
  readonly group: CanonicalGroup
  readonly label: string
  readonly description: string
  readonly children: readonly SidebarChild[]
}

export type ProductOverlay = Partial<Record<CanonicalGroup, readonly SidebarChild[]>>

/**
 * Compose a canonical sidebar for the given role. Apps MAY pass a
 * `productOverlay` mapping a canonical group → product-specific
 * children. Overlay children appear inside the canonical group, never
 * as a new top-level group.
 */
export function buildCanonicalSidebar(
  role: CanonicalRole,
  productOverlay: ProductOverlay = {},
): readonly SidebarGroup[] {
  const experience = getRoleExperience(role)
  const visible = new Set<CanonicalGroup>(experience.visibleGroups)
  const tree = getCanonicalIATree()
  return tree
    .filter((node) => visible.has(node.group))
    .map((node) => {
      const overlayChildren = productOverlay[node.group] ?? []
      const defaultChildren: readonly SidebarChild[] = node.routes.map((href) => ({
        label: hrefToLabel(href, node.label),
        href,
      }))
      return {
        group: node.group,
        label: node.label,
        description: node.description,
        children: defaultChildren.concat(overlayChildren),
      }
    })
}

function hrefToLabel(href: string, fallback: string): string {
  const tail = href.split('/').filter(Boolean).pop()
  if (!tail) return fallback
  return tail.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Returns true when the supplied label belongs to a canonical group.
 * Apps SHOULD use this to refuse non-canonical top-level groups during
 * sidebar composition.
 */
export function isCanonicalGroupLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return CANONICAL_GROUPS.some((g) => g === lower)
}
