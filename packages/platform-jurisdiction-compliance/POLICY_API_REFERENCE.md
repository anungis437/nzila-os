# Policy API Reference

> API reference for the jurisdiction compliance policy engine.

## Endpoints

### `POST /api/compliance/check`

Check a transaction or entity against jurisdiction-specific policies.

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| `entityId` | `string` | Entity or org UUID |
| `jurisdiction` | `string` | ISO 3166-1 jurisdiction code |
| `action` | `string` | Action to validate |
| `context` | `object` | Additional context for policy evaluation |

**Response:**
| Field | Type | Description |
|-------|------|-------------|
| `allowed` | `boolean` | Whether the action is permitted |
| `violations` | `array` | List of policy violations, if any |
| `appliedPolicies` | `array` | Policies that were evaluated |

### `GET /api/compliance/policies`

List all active policies for a jurisdiction.

### `GET /api/compliance/audit-log`

Retrieve compliance check audit trail.

## Related

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- [Capacity Planning](../../docs/plans/LOAD_PROJECTION_CAPACITY_PLAN.md)
