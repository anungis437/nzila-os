/**
 * Contract Test — Union Eyes FSM Route Enforcement
 *
 * UE-FSM-001:
 *   1. Case PATCH rejects status changes; the dedicated transition route enforces the FSM.
 *   2. Case escalate route must not directly set claim status; it must use FSM helper.
 *   3. Grievance status route must validate transitions through unified lifecycle FSM.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = join(__dirname, '..', '..')

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8')
}

describe('UE-FSM-001: Union Eyes route-level FSM enforcement', () => {
  it('cases PATCH rejects status bypass and dedicated transition route validates FSM', () => {
    const src = read('apps/union-eyes/app/api/cases/[caseId]/route.ts')
    expect(src).toContain("'assignedTo' in body || 'status' in body")
    expect(src).toContain("throw ApiError.badRequest('Use the case assignment or transition endpoint for this change')")
    const transition = read('apps/union-eyes/app/api/cases/[caseId]/transition/route.ts')
    // Follow the actual shared validator, rather than requiring each route to
    // duplicate its stored-fact hydration and lifecycle mapping.
    expect(transition).toContain('loadClaimTransitionSource(tx, orgId, claim.claimId)')
    expect(transition).toContain('validateClaimCaseTransition(stored, actor.role, targetStatus, reason)')
    expect(transition).toContain('if (!validation.allowed)')
    const policy = read('apps/union-eyes/lib/workflow/claim-transition-policy.ts')
    const tree = ts.createSourceFile('claim-transition-policy.ts', policy, ts.ScriptTarget.Latest, true)
    const lifecycleImport = tree.statements.find(statement => ts.isImportDeclaration(statement)
      && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === './case-lifecycle')
    expect(lifecycleImport && ts.isImportDeclaration(lifecycleImport)
      && lifecycleImport.importClause?.namedBindings?.getText(tree)).toContain('validateTransition')
    const validator = tree.statements.find(statement => ts.isFunctionDeclaration(statement)
      && statement.name?.text === 'validateClaimCaseTransition')
    expect(validator && ts.isFunctionDeclaration(validator) && validator.body).toBeTruthy()
    const lifecycleCalls: ts.CallExpression[] = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
          && node.expression.text === 'validateTransition') lifecycleCalls.push(node)
      ts.forEachChild(node, visit)
    }
    if (!validator) throw new Error('The shared claim validator must exist')
    visit(validator)
    expect(lifecycleCalls).toHaveLength(1)
    expect(lifecycleCalls[0]!.arguments[0]?.getText(tree)).toContain('...claimTransitionFacts(claim, notes)')
    expect(transition.indexOf('if (!validation.allowed)')).toBeLessThan(transition.indexOf('.update(claims)'))
    expect(src).not.toContain("status: 'status'")
  })

  it('cases escalate route uses FSM helper and does not hard-set resolved status', () => {
    const src = read('apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts')
    expect(src).toContain('updateClaimStatusById')

    // Inspect the actual update expression instead of assuming the resource ID
    // variable's spelling. Escalation now binds writes to the locked canonical
    // claim; a future direct status write must still fail this contract.
    const tree = ts.createSourceFile('escalate.ts', src, ts.ScriptTarget.Latest, true)
    const updates: ts.CallExpression[] = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'set') {
        const receiver = node.expression.expression
        if (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression) &&
            receiver.expression.name.text === 'update' && receiver.arguments[0]?.getText(tree) === 'claims') {
          updates.push(node)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    expect(updates).toHaveLength(1)
    const update = updates[0]!
    const values = update.arguments[0]!
    expect(ts.isObjectLiteralExpression(values)).toBe(true)
    if (!ts.isObjectLiteralExpression(values)) throw new Error('Claim update must declare its fields')
    expect(values.properties.every(ts.isPropertyAssignment)).toBe(true)
    const fields = values.properties.map((property) => property.name?.getText(tree).replace(/^['"]|['"]$/g, ''))
    expect(fields).not.toContain('status')
    expect(fields).toContain('resolutionOutcome')
    const transitionStart = src.indexOf('await updateClaimStatusById(')
    const refusalStart = src.indexOf('if (!transitionResult.success)')
    expect(transitionStart).toBeGreaterThanOrEqual(0)
    expect(refusalStart).toBeGreaterThan(transitionStart)
    expect(update.getStart(tree)).toBeGreaterThan(refusalStart)
    const where = update.parent
    expect(ts.isPropertyAccessExpression(where) && where.name.text === 'where').toBe(true)
    const filtered = where.parent
    expect(ts.isCallExpression(filtered)).toBe(true)
    if (!ts.isCallExpression(filtered)) throw new Error('Claim update must be scoped')
    expect(filtered.arguments[0]?.getText(tree)).toContain('eq(claims.claimId, lockedClaim.claimId)')
    expect(filtered.arguments[0]?.getText(tree)).toContain('eq(claims.organizationId, orgId)')
  })

  it('grievance status route validates transitions via unified lifecycle FSM', () => {
    const src = read('apps/union-eyes/app/api/grievances/[id]/status/route.ts')
    expect(src).toContain('validateTransition')
    expect(src).toContain("toLifecycleState('grievance'")
    expect(src).toContain("toLifecycleState('cupe'")
  })
})
