const { SignJWT } = require('jose'); const fs=require('fs'); const crypto=require('crypto');
const base='https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';
const secret = new TextEncoder().encode(process.env.ACC_SECRET);
const nav = JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const persona = { member:'ue-qa-member-primary', staff:'ue-qa-steward-primary', executive:'ue-qa-executive-primary', governance:'ue-qa-auditor-readonly', admin:'ue-qa-admin-primary' };
async function mint(uid){ const now=Math.floor(Date.now()/1000); return new SignJWT({ver:'ue-acceptance-v1',env:'staging'}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer('union-eyes-staging-acceptance').setAudience('union-eyes-runtime').setSubject(uid).setJti(crypto.randomUUID()).setIssuedAt(now).setExpirationTime(now+600).sign(secret); }
async function get(path, tok){ const t0=Date.now(); try{ const r=await fetch(base+path,{headers:tok?{'x-unioneyes-acceptance-auth':tok}:{},redirect:'manual'}); const txt=await r.text(); return {status:r.status, loc:r.headers.get('location'), ms:Date.now()-t0, len:txt.length, rid:r.headers.get('x-request-id')||r.headers.get('x-correlation-id')||r.headers.get('traceparent'), err:/Application error|Internal Server Error|digest/i.test(txt)&&r.status>=500, snippet: r.status>=400?txt.slice(0,80).replace(/\s+/g,' '):''}; }catch(e){ return {status:'ERR',msg:e.message}; } }
(async()=>{
  const res=[]; const toks={}; for(const [p,u] of Object.entries(persona)) toks[p]=await mint(u);
  for(const n of nav){ const a=await get('/en-CA'+n.href,toks[n.persona]); const u=await get('/en-CA'+n.href,null); res.push({persona:n.persona,label:n.label,href:n.href,auth:a,anon:{status:u.status,loc:u.loc}}); }
  fs.writeFileSync(process.argv[3], JSON.stringify(res,null,1));
  for(const r of res) console.log(`${r.persona.padEnd(10)} ${r.href.padEnd(52)} auth=${r.auth.status}${r.auth.loc?'->'+r.auth.loc.slice(0,40):''} ${r.auth.ms}ms | anon=${r.anon.status}${r.anon.loc?'->'+r.anon.loc.slice(0,30):''} rid=${r.auth.rid?'Y':'N'}`);
})();

