/** Actual route tree + navigation census. Static existence is never browser acceptance. */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getVisibleNavigationForExperience, type DashboardExperience } from '../lib/dashboard/role-experience';

const root = resolve(__dirname, '..');
const app = resolve(root, 'app');
const output = process.argv[2];
if (!output) throw new Error('Explicit output path required');
const roleMap: Record<DashboardExperience, string> = {
  member: 'member', staff: 'steward', executive: 'president', governance: 'officer', admin: 'admin',
};
const navigation = Object.entries(roleMap).flatMap(([experience, role]) =>
  [false, true].flatMap(pilot => getVisibleNavigationForExperience(experience as DashboardExperience, pilot, role)
    .map(item => ({ experience, role, pilot, ...item }))));
function walk(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(resolve(path, entry.name)) : entry.name === 'page.tsx' ? [resolve(path, entry.name)] : []);
}
const routes = walk(app).map(file => {
  const source = readFileSync(file, 'utf8');
  const route = '/' + relative(app, dirname(file)).replaceAll('\\', '/').split('/')
    .filter(segment => !/^\(.*\)$/.test(segment) && !segment.startsWith('@')).join('/');
  const guards: { sourceFile: string; predicates: string[] }[] = [];
  let parent = dirname(file);
  for (;;) {
    const layout = resolve(parent, 'layout.tsx');
    try {
      const text = readFileSync(layout, 'utf8');
      guards.push({ sourceFile: relative(root, layout).replaceAll('\\', '/'),
        predicates: text.match(/(?:hasMinRole|requireRole|requireUser|requireAuth|isSystemAdmin)\([^;\n]{0,160}/g) || [] });
    } catch { /* No layout at this directory. */ }
    if (parent === app) break;
    parent = dirname(parent);
  }
  return { route, sourceFile: relative(root, file).replaceAll('\\', '/'),
    dynamicParameters: [...route.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]).filter(name => name !== 'locale'),
    navigation: navigation.filter(item => route.replace('/[locale]', '') === item.href.split('?')[0]),
    guards, pagePredicates: source.match(/(?:hasMinRole|requireRole|requireUser|requireAuth|isSystemAdmin)\([^;\n]{0,160}/g) || [],
    containsNotFound: /\bnotFound\(/.test(source), containsRedirect: /\bredirect\(/.test(source),
    browserDisposition: 'NOT_YET_QUALIFIED',
  };
});
const report = { schemaVersion: 1, sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(), total: routes.length,
  dashboardTotal: routes.filter(route => route.route.includes('/dashboard')).length,
  navigation, routes, stagingPromotionVerdict: 'NO_GO' };
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ total: report.total, dashboardTotal: report.dashboardTotal, output }));
