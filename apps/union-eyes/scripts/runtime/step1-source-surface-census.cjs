#!/usr/bin/env node
'use strict'

/*
 * Read-only independent source surface census for UE Step 1.
 * Counts declarations, not authorization or runtime acceptance. Does not rewrite
 * the historical convergence manifest, build the application or deploy anything.
 * Run from a clean, pinned repository checkout:
 *   node apps/union-eyes/scripts/runtime/step1-source-surface-census.cjs --self-test
 *   node apps/union-eyes/scripts/runtime/step1-source-surface-census.cjs --out /tmp/ue-step1-source.json
 * Add --strict to fail on unexplained manifest method/file differences, wildcard
 * reexports, unsupported route extensions, or parse ambiguities.
 */
const ts = require('typescript')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const crypto = require('node:crypto')
const APP = 'apps/union-eyes/'
const MANIFEST = 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const sort = values => [...values].sort()
const difference = (a,b) => sort([...a].filter(v => !b.has(v)))
const sourceExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/
const routeName = /(?:^|\/)route\.(?:[cm]?[jt]s|[jt]sx)$/
const testsOrFixtures = /(?:^|\/)(?:node_modules|\.next|dist|coverage|__tests__|__mocks__|__fixtures__|tests|e2e)(?:\/|$)|\.(?:test|spec|stories)\.[^.]+$/
const exportModifier = node => !!(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
const defaultModifier = node => !!(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))
const hasServerDirective = statements => {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false
    if (statement.expression.text === 'use server') return true
  }
  return false
}
function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text]
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap(element => ts.isBindingElement(element) ? bindingNames(element.name) : [])
  }
  return []
}
function analyze(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const exports = new Set()
  const exportDetails = []
  const unresolved = []
  const inlineServerActions = []
  const moduleServer = hasServerDirective(sf.statements)
  const lineOf = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const add = (name, kind, node) => {
    exports.add(name)
    exportDetails.push({ name, kind, line:lineOf(node) })
  }
  for (const node of sf.statements) {
    if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) continue
      if (!node.exportClause) {
        unresolved.push({kind:'wildcard_reexport', line:lineOf(node)})
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const item of node.exportClause.elements) {
          if (!item.isTypeOnly) add(item.name.text,node.moduleSpecifier?'named_reexport':'named_export',item)
        }
      } else if (ts.isNamespaceExport(node.exportClause)) {
        add(node.exportClause.name.text,'namespace_export',node)
      }
    } else if (ts.isExportAssignment(node)) {
      add('default','export_assignment',node)
    } else if (exportModifier(node)) {
      if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) {
        if (defaultModifier(node)) add('default','default_declaration',node)
        else if (node.name) add(node.name.text,'declaration',node)
      } else if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          for (const name of bindingNames(declaration.name)) add(name,ts.isIdentifier(declaration.name)?'variable':'binding_pattern',declaration)
        }
      }
    }
  }
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body && ts.isBlock(node.body) && hasServerDirective(node.body.statements)) {
      const identifier = node.name?.getText(sf) ?? (ts.isVariableDeclaration(node.parent)?node.parent.name.getText(sf):null)
      inlineServerActions.push({name:identifier??'<anonymous>',line:lineOf(node),position:node.getStart(sf)})
    }
    ts.forEachChild(node,visit)
  }
  visit(sf)
  return {
    methods:sort([...exports].filter(name=>METHODS.has(name))),
    exportDetails,
    moduleServer,
    serverModuleExports:moduleServer?sort(exports):[],
    inlineServerActions,
    unresolved,
    parseErrors:(sf.parseDiagnostics??[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),
  }
}
function selfTest() {
  const cases = [
    ["export const { GET, POST } = handlers",['GET','POST']],
    ["export const { get: GET, nested: { POST }, ...rest } = handlers",['GET','POST']],
    ["export const [GET, , POST] = handlers",['GET','POST']],
    ["export async function GET(){}; export const DELETE = handler;",['DELETE','GET']],
    ["export { foo as PATCH, GET } from './delegate'",['GET','PATCH']],
    ["export const OPTIONS=fn, HEAD=fn; export function PUT(){}",['HEAD','OPTIONS','PUT']],
    ["// export const GET = fake\nconst s='export const POST=x'; export type { GET }; export { type DELETE };",[]],
    ["function GET(){}; export {GET as helper}; export default function POST(){}",[]],
  ]
  for(const [src,want] of cases) assert.deepEqual(analyze('route.ts',src).methods,want)
  assert.equal(analyze('route.ts',"export * from './ambiguous'").unresolved[0].kind,'wildcard_reexport')
  assert.ok(analyze('route.ts','export const GET = {').parseErrors.length)
  const mod = analyze('actions.ts',"'use strict'; 'use server'; export async function action(){}; export type X=string; export {handler as delegated} from './helper'")
  assert.deepEqual(mod.serverModuleExports,['action','delegated'])
  assert.equal(analyze('actions.ts',"const marker='use server'; export async function action(){}").moduleServer,false)
  assert.equal(analyze('page.tsx',"export default function Page(){async function action(){'use server';}; return null}").inlineServerActions.length,1)
  assert.equal(analyze('page.tsx',"const actions=()=>{'use server';}; const b=()=>{'use strict';'use server';}").inlineServerActions.length,2)
  assert.equal(analyze('page.tsx',"function notAction(){let a=1; 'use server';}").inlineServerActions.length,0)
  console.log(JSON.stringify({selfTests:15,result:'PASS'}))
}
function main() {
  const args=process.argv.slice(2)
  if(args.includes('--self-test')) return selfTest()
  function option(name){const at=args.indexOf(name);return at<0?null:args[at+1]}
  const cwd=option('--root')??process.cwd()
  const run=(...argv)=>cp.execFileSync('git',argv,{cwd,encoding:'utf8',maxBuffer:64*1024*1024})
  const root=run('rev-parse','--show-toplevel').trim()
  const git=(...argv)=>cp.execFileSync('git',argv,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024})
  const revision=git('rev-parse','HEAD').trim()
  const status=git('status','--porcelain','--untracked-files=all','--',APP,MANIFEST)
  if(status.trim()) throw new Error('Source scope is dirty; use an exact committed checkout')
  const tracked=git('ls-files','-z','--',APP).split('\0').filter(Boolean).sort()
  const prod=tracked.filter(name=>sourceExtension.test(name)&&!testsOrFixtures.test(name)&&!name.endsWith('.d.ts'))
  const routeFiles=tracked.filter(name=>name.startsWith(APP+'app/')&&routeName.test(name))
  const routeSet=new Set(routeFiles)
  const routes=[], serverModules=[], inline=[], unresolved=[]
  const read=name=>fs.readFileSync(path.join(root,name),'utf8')
  for(const name of sort(new Set([...prod,...routeFiles]))) {
    const source=read(name)
    // Scan all tracked runtime source, not just filenames named actions. Other
    // sources need parse only if they can carry the literal server directive.
    if(!routeSet.has(name)&&!source.includes('use server')) continue
    const parsed=analyze(name,source)
    const digest=sha256(source)
    if(routeSet.has(name)) {
      routes.push({path:name,sha256:digest,methods:parsed.methods,methodExports:parsed.exportDetails.filter(x=>METHODS.has(x.name)),frameworkMethodCandidates:[...(!parsed.methods.includes('HEAD')&&parsed.methods.includes('GET')?['HEAD']:[]),...(!parsed.methods.includes('OPTIONS')?['OPTIONS']:[])],routeScope:name.startsWith(APP+'app/api/')?'API':'NON_API_APP_ROUTE'})
      if(!parsed.methods.length)unresolved.push({path:name,kind:'no_explicit_method'})
      if(!/\/route\.(?:ts|js)$/.test(name))unresolved.push({path:name,kind:'route_extension_requires_framework_config_review'})
    }
    if(parsed.moduleServer)serverModules.push({path:name,sha256:digest,exports:parsed.serverModuleExports})
    for(const action of parsed.inlineServerActions)inline.push({path:name,sha256:digest,...action})
    if(routeSet.has(name)||parsed.moduleServer||parsed.inlineServerActions.length) {
      for(const problem of parsed.unresolved)unresolved.push({path:name,...problem})
      for(const message of parsed.parseErrors)unresolved.push({path:name,kind:'syntax_diagnostic',message})
    }
  }
  const text=read(MANIFEST),manifest=JSON.parse(text)
  const manifestFiles=new Set(manifest.routes.map(r=>APP+'app/api/'+r.route))
  const api=routes.filter(r=>r.routeScope==='API')
  const actualApiFiles=new Set(api.map(r=>r.path))
  const historical=new Set(manifest.routes.flatMap(r=>r.methods.map(m=>m+' '+APP+'app/api/'+r.route)))
  const currentApi=new Set(api.flatMap(r=>r.methods.map(m=>m+' '+r.path)))
  const currentAll=new Set(routes.flatMap(r=>r.methods.map(m=>m+' '+r.path)))
  const result={
    schemaVersion:1,record:'UE_STEP1_SOURCE_SURFACE_CENSUS',
    anchorCommit:revision,sourceScope:APP,manifest:{path:MANIFEST,sha256:sha256(text)},
    decision:'STEP1_OPEN_STEP2_HELD',
    counts:{trackedSourceFiles:prod.length,allAppRoutes:routes.length,apiRouteFiles:api.length,explicitMethods:currentAll.size,apiExplicitMethods:currentApi.size,serverActionModules:serverModules.length,serverModuleExportCandidates:serverModules.reduce((n,x)=>n+x.exports.length,0),inlineDirectiveCandidates:inline.length,unresolved:unresolved.length},
    delta:{sourceOnlyApiFiles:difference(actualApiFiles,manifestFiles),manifestOnlyApiFiles:difference(manifestFiles,actualApiFiles),sourceOnlyApiMethods:difference(currentApi,historical),manifestOnlyApiMethods:difference(historical,currentApi),nonApiMethods:difference(currentAll,currentApi)},
    routes,serverModules,inlineServerActions:inline,unresolved,
    limitations:['File/export discovery only; named reexports require implementation and authority tracing.','Framework-generated HEAD/OPTIONS listed as candidates, not proven endpoints.','Source scan is UE-app scoped; shared packages, provider callbacks, Python tasks, middleware/proxy and transitive service callers require separate reachability census.','Source declarations do not prove enabled scope, durable effects or runtime execution.']
  }
  const output=JSON.stringify(result,null,2)+'\n'
  const out=option('--out')
  if(out){
    const dest=path.resolve(root,out)
    if(dest===root||dest.startsWith(root+path.sep))throw new Error('Output must be outside checkout to preserve source evidence')
    fs.writeFileSync(dest,output)
  }else process.stdout.write(output)
  if(args.includes('--strict')&&(unresolved.length||result.delta.sourceOnlyApiFiles.length||result.delta.manifestOnlyApiFiles.length||result.delta.sourceOnlyApiMethods.length||result.delta.manifestOnlyApiMethods.length))process.exitCode=1
}
if(require.main===module)main()
module.exports={analyze,selfTest}
