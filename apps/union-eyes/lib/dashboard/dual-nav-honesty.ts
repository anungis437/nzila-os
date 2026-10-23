/**
 * EC-G03 dual-nav honesty copy.
 *
 * Workspace is the orientation hub. `getRoleLandingPath` is the role
 * execution home. Sidebar chrome must not claim an undifferentiated
 * "Primary" alongside that hub.
 *
 * English literals: sidebar chrome is not in the message catalogs yet.
 * Localization of these strings is a follow-up. This module does not
 * claim WCAG certification.
 */

import {
  ROLE_EXECUTION_HOME_BY_EXPERIENCE,
  WORKSPACE_ORIENTATION_HUB_PATH,
  type DualNavHomes,
} from './role-experience';

/** Landmark on the desktop sidebar and the mobile drawer. */
export const ROLE_EXECUTION_CHROME_LABEL = 'Role execution navigation';

/**
 * Landmark on the destination list inside that chrome.
 * Qualified so it is not a second undifferentiated "Primary".
 */
export const ROLE_EXECUTION_DESTINATIONS_LABEL = 'Role execution destinations';

/** Explicit cue from a role execution home back to the orientation hub. */
export const ROLE_HOME_HUB_CUE_MESSAGE =
  'This menu is your role execution home. Workspace is the orientation hub.';

export const ROLE_HOME_HUB_CUE_LINK_LABEL = 'Open Workspace orientation hub';

/**
 * Shown when the role execution home is the Intelligence route.
 * Intelligence is not one of the seven Workspace tabs.
 */
export const INTELLIGENCE_NOT_WORKSPACE_TAB_NOTE =
  'The Intelligence destination is a role execution home, not a Workspace tab.';

export const WORKSPACE_HUB_QUALIFIER = 'Orientation hub';
export const WORKSPACE_HUB_AND_ROLE_HOME_QUALIFIER = 'Orientation hub and role home';
export const ROLE_EXECUTION_HOME_QUALIFIER = 'Role execution home';
export const ROLE_EXECUTION_HOME_NOT_TAB_QUALIFIER =
  'Role execution home. Not a Workspace tab.';
export const NOT_WORKSPACE_TAB_QUALIFIER = 'Not a Workspace tab';

export type DualNavItemRole = 'hub' | 'role-home' | 'legacy-side';

export type NavigationItemHonesty = {
  navRole: DualNavItemRole;
  /** Visible when the sidebar is expanded or the drawer is open. Null for ordinary legacy items. */
  visibleQualifier: string | null;
  /** Accessible name. Present even when the sidebar is collapsed. */
  accessibleName: string;
  /** Title used in the collapsed sidebar. Mirrors the accessible name, not hover-only disclosure. */
  collapsedTitle: string;
};

const INTELLIGENCE_EXECUTION_PATH = ROLE_EXECUTION_HOME_BY_EXPERIENCE.executive;

function withLabel(label: string, qualifier: string): Pick<
  NavigationItemHonesty,
  'accessibleName' | 'collapsedTitle'
> {
  return {
    accessibleName: `${label}, ${qualifier.charAt(0).toLowerCase()}${qualifier.slice(1)}`,
    collapsedTitle: `${label} — ${qualifier}`,
  };
}

/**
 * Classify one sidebar destination against the role execution home.
 * Landing path targets are an input; this function does not choose them.
 */
export function honestyForNavigationItem(
  item: { label: string; href: string },
  roleHomeHref: string,
  translate: (text: string) => string = text => text,
): NavigationItemHonesty {
  item = { ...item, label: translate(item.label) };
  const path = item.href.split('?')[0];
  const isHub = path === WORKSPACE_ORIENTATION_HUB_PATH;
  const isExactRoleHome = item.href === roleHomeHref;
  const isIntelligenceSurface = path === INTELLIGENCE_EXECUTION_PATH;

  if (isHub && roleHomeHref === WORKSPACE_ORIENTATION_HUB_PATH) {
    return {
      navRole: 'hub',
      visibleQualifier: translate(WORKSPACE_HUB_AND_ROLE_HOME_QUALIFIER),
      ...withLabel(item.label, translate(WORKSPACE_HUB_AND_ROLE_HOME_QUALIFIER)),
    };
  }

  if (isHub) {
    return {
      navRole: 'hub',
      visibleQualifier: translate(WORKSPACE_HUB_QUALIFIER),
      ...withLabel(item.label, translate(WORKSPACE_HUB_QUALIFIER)),
    };
  }

  if (isExactRoleHome && isIntelligenceSurface) {
    return {
      navRole: 'role-home',
      visibleQualifier: translate(ROLE_EXECUTION_HOME_NOT_TAB_QUALIFIER),
      ...withLabel(item.label, translate(ROLE_EXECUTION_HOME_NOT_TAB_QUALIFIER)),
    };
  }

  if (isExactRoleHome) {
    return {
      navRole: 'role-home',
      visibleQualifier: translate(ROLE_EXECUTION_HOME_QUALIFIER),
      ...withLabel(item.label, translate(ROLE_EXECUTION_HOME_QUALIFIER)),
    };
  }

  if (isIntelligenceSurface) {
    return {
      navRole: 'legacy-side',
      visibleQualifier: translate(NOT_WORKSPACE_TAB_QUALIFIER),
      ...withLabel(item.label, translate(NOT_WORKSPACE_TAB_QUALIFIER)),
    };
  }

  return {
    navRole: 'legacy-side',
    visibleQualifier: null,
    accessibleName: item.label,
    collapsedTitle: item.label,
  };
}

export type RoleHomeHubCue = {
  /** False when the role execution home is already the orientation hub (member). */
  show: boolean;
  message: string;
  linkLabel: string;
  hubHref: typeof WORKSPACE_ORIENTATION_HUB_PATH;
  /** Extra sentence for the executive Intelligence landing. Never a redirect. */
  intelligenceNote: string | null;
};

/** Explicit link copy. Callers must render an anchor, not a redirect. */
export function roleHomeHubCue(homes: DualNavHomes, translate: (text: string) => string = text => text): RoleHomeHubCue {
  const show = !homes.roleHomeIsOrientationHub;
  return {
    show,
    message: translate(ROLE_HOME_HUB_CUE_MESSAGE),
    linkLabel: translate(ROLE_HOME_HUB_CUE_LINK_LABEL),
    hubHref: WORKSPACE_ORIENTATION_HUB_PATH,
    intelligenceNote:
      homes.roleHomeHref === INTELLIGENCE_EXECUTION_PATH
        ? translate(INTELLIGENCE_NOT_WORKSPACE_TAB_NOTE)
        : null,
  };
}
