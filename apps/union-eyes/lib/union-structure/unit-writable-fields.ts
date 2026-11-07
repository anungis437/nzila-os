/**
 * The body fields a steward may set on a bargaining unit (DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT,
 * DEF-0B12-CRUD-BARGAINING-UNIT-CERTIFICATION-AND-REPRESENTATION-FIELDS-WRITABLE-BY-ANY-STEWARD): what the unit form sends
 * (components/union-structure/BargainingUnitManagement.tsx toUnitPayload) plus the unit's job classifications.
 *
 * Never writable here: status, memberCount, the certification facts (number, date, body, expiry), the current collective agreement and
 * the representation (chief steward, bargaining chair). Those come from a certification, the roster or an appointment; no governed route
 * records them yet, so they cannot be written at all until one exists.
 */
export const UNIT_WRITABLE_FIELDS: readonly string[] = [
  'employerId', 'worksiteId', 'name', 'unitNumber', 'unitType', 'classifications', 'description', 'contractExpiryDate', 'nextBargainingDate',
];
