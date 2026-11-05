/**
 * Compatibility path for indigenous data.
 * The only pgTable declarations live in the domain module.
 * Do not add a second pgTable in this file.
 */
export {
  bandCouncils,
  bandCouncilConsent,
  indigenousMemberData,
  indigenousDataAccessLog,
  indigenousDataSharingAgreements,
  traditionalKnowledgeRegistry,
} from './domains/compliance/indigenous-data';
