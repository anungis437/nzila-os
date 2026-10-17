import { assertCivicSlice0Authorized } from '../../../scripts/lib/civic-oci-doctrine'

export function assertRuntimeAuthorization(): void {
  assertCivicSlice0Authorized(`${__dirname}/../../..`)
}
