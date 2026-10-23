// ============================================================================
// REPRESENTATION PROTOCOL — PUBLIC API
// ============================================================================

// Types & presets
export {
  type RepresentativeType,
  type StewardPermissions,
  type RepresentationProtocol,
  type ProtocolApproval,
  type ProtocolResolution,
  type ProtocolExecutionStatus,
  resolveStoredProtocol,
  parseStoredProtocol,
  PROTOCOL_STEWARD_LED,
  PROTOCOL_LRO_LED,
  PROTOCOL_NATIONAL_REP_LED,
  PROTOCOL_OFFICER_LED,
  PROTOCOL_PRESETS,
  canStewardFile,
  canStewardRepresent,
  getAssignActionLabel,
  getAssignActionDescription,
  getPrimaryAssignmentRole,
} from "./protocol-types";

// Service (server-only)
export {
  getRepresentationProtocol,
  resolveRepresentationProtocol,
  requireExecutableRepresentationProtocol,
  RepresentationProtocolNotExecutableError,
  approveRepresentationProtocol,
  saveRepresentationProtocol,
  resetRepresentationProtocol,
} from "./protocol-service";
