/** Every native file owns one clone; operator setup and four restricted action credentials stay on that same clone. */
import { afterAll } from 'vitest'
import { closeNativeCanonicalSessions, installNativeCloneEnvironment, openNativeCanonicalClone } from './native-canonical-fixture'

const templateUrl = process.env.UE_NATIVE_TEMPLATE_URL

if (templateUrl) {
  const fixture = await openNativeCanonicalClone(templateUrl)
  const restoreEnvironment = installNativeCloneEnvironment(fixture)
  afterAll(async () => {
    const failures: unknown[] = []
    try { await closeNativeCanonicalSessions() } catch (error) { failures.push(error) }
    try { await fixture.dispose() } catch (error) { failures.push(error) }
    finally { restoreEnvironment() }
    if (failures.length) throw new AggregateError(failures, 'Owned native clone cleanup failed')
  })
}
