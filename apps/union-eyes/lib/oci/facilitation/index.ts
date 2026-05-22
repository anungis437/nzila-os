/**
 * OCI Facilitation — barrel.
 *
 * Re-exports the facilitation types and catalogues for consumers
 * inside the union-eyes application. The barrel does not introduce
 * new logic; it only re-exports what each catalogue defines.
 */

export type {
  ConversationCategory,
  ConversationPrompt,
  DiscoveryPrompt,
  DiscoveryPromptSection,
  DiscoverySectionId,
  FacilitationGuideEntry,
  FacilitationSessionType,
  Locale,
  LocalizedString,
  LocalizedStringList,
  WorkshopFlow,
  WorkshopStep,
} from './types';

export {
  FACILITATION_GUIDE,
  FACILITATION_GUIDE_BY_SESSION,
} from './facilitationGuide';

export {
  EXECUTIVE_WORKSHOP_FLOWS,
  EXECUTIVE_WORKSHOP_FLOWS_BY_SESSION,
} from './executiveWorkshopFlows';

export {
  INSTITUTIONAL_DISCOVERY_FRAMEWORK,
  INSTITUTIONAL_DISCOVERY_BY_SECTION,
} from './institutionalDiscoveryFramework';
