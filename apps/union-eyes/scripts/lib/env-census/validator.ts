/**
 * The variables the startup validator declares (UE-CONV-H-024): the keys of the Zod object schema in `lib/config/env-validation.ts`.
 *
 * That schema is a second list of what the application is configured with, written long before the registry. Every key in it must be a variable the registry
 * names (and therefore one the code reads), or the validator is checking configuration nothing uses.
 */
import ts from 'typescript'

/** The property names of every `z.object({ ... })` literal assigned to a top-level constant whose name ends in `Schema`. */
export function validatorKeys(text: string): string[] {
  const source = ts.createSourceFile('env-validation.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const keys: string[] = []
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !/Schema$/.test(declaration.name.text) || !declaration.initializer) continue
      const call = declaration.initializer
      if (!ts.isCallExpression(call) || !call.expression.getText(source).endsWith('.object') || !call.arguments[0] || !ts.isObjectLiteralExpression(call.arguments[0])) continue
      for (const property of call.arguments[0].properties) if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) keys.push(property.name.text)
    }
  }
  return keys
}
