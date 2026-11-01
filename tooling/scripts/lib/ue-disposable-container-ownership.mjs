/**
 * Ownership rules for disposable Union Eyes QA Docker containers.
 * The container name alone is never sufficient authority to remove/reuse it.
 */
export const UE_DISPOSABLE_MISSION = 'UE_DISPOSABLE_LOCAL_RUNTIME'

export function hasOwnedContainerLabels(labels, token) {
  return Boolean(
    labels &&
    typeof labels === 'object' &&
    typeof token === 'string' &&
    /^[a-f0-9]{32}$/.test(token) &&
    labels['nzila.mission'] === UE_DISPOSABLE_MISSION &&
    labels['nzila.qualification-owner'] === token,
  )
}
