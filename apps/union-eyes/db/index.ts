// Export database connection and schema
export * from "./db";
export * from "./schema";

// Export applications registry
export { applications } from "./schema-applications";

// Export only organizations table from schema-organizations to avoid conflicts
export { 
  organizations, 
  organizationsRelations,
  applicationsRelations,
  organizationTypeEnum,
  caJurisdictionEnum,
  labourSectorEnum,
  organizationStatusEnum
} from "./schema-organizations";

