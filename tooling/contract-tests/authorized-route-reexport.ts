/**
 * Recognize one narrow, inert form of protected Next.js API delegation:
 * a file containing only 'force-dynamic' and an unmodified method re-export
 * to a verified, same-app API handler.
 *
 * An export alone is NOT authentication. Every delegated method must be
 * explicitly guarded by withApi({auth:{required:true}, requireOrg:true}) in
 * its actual target source. Nonexistent, cross-app, mixed-handler and
 * public re-exports fail closed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const HTTP = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function isAuthorizedRouteReexport(routeFile: string): boolean {
  if (!routeFile.endsWith('route.ts') || !existsSync(routeFile)) return false;
  const source = readFileSync(routeFile, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();
  const match = source.match(
    /^export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]\s*;\s*export\s*\{([^}]+)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"]\s*;?$/,
  );
  if (!match) return false;
  const methods = match[1].split(',').map(s => s.trim());
  if (methods.length === 0 || new Set(methods).size !== methods.length || methods.some(m => !HTTP.has(m))) return false;
  const path = routeFile.replace(/\\/g, '/');
  const marker = '/app/api/';
  const idx = path.indexOf(marker);
  if (idx < 0) return false;
  const apiRoot = resolve(path.slice(0, idx + marker.length));
  const target = resolve(dirname(routeFile), match[2] + '.ts');
  const rel = relative(apiRoot, target);
  if (rel.startsWith('..' + sep) || rel === '..' || rel.startsWith(sep) || !rel.endsWith('route.ts') || !existsSync(target)) return false;
  const canonical = readFileSync(target, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return methods.every(method => new RegExp(
    'export\\s+const\\s+' + method + '\\s*=\\s*withApi\\(\\s*\\{\\s*auth:\\s*\\{\\s*required:\\s*true,\\s*minRole:\\s*[\\x27\\x22][^\\x27\\x22]+[\\x27\\x22]\\s*\\}\\s*,\\s*requireOrg:\\s*true',
  ).test(canonical));
}
