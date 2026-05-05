import fs from 'fs';
import path from 'path';

const dir = 'apps/union-eyes/db/schema';
const tbs = [];
fs.readdirSync(dir).filter(f => f.endsWith('.ts')).forEach(f => {
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /pgTable\(['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(c)) !== null) tbs.push(m[1]);
});
tbs.sort();
console.log('Total schema tables:', tbs.length);
console.log(tbs.join('\n'));
