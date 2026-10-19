const { SignJWT } = require('jose'); const crypto=require('crypto'); const fs=require('fs');
const base='https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';
const secret = new TextEncoder().encode(process.env.ACC_SECRET);
const mint = async (uid, ttl=300, o={}) => { const now=Math.floor(Date.now()/1000)+(o.skew||0); return new SignJWT({ver:'ue-acceptance-v1',env:o.env||'staging'}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer('union-eyes-staging-acceptance').setAudience(o.aud||'union-eyes-runtime').setSubject(uid).setJti(crypto.randomUUID()).setIssuedAt(now).setExpirationTime(now+ttl).sign(o.secret||secret); };
const res=[]; const log=(id,name,pass,detail)=>{res.push({id,name,pass,detail}); console.log(`${pass?'PASS':'FAIL'} [${id}] ${name} :: ${detail}`)};
async function call(path, {tok, headers={}, method='GET'}={}) { const h={accept:'application/json',...headers}; if(tok) h['x-unioneyes-acceptance-auth']=tok; const r=await fetch(base+path,{method,headers:h,redirect:'manual'}); const t=(await r.text()).slice(0,160).replace(/\s+/g,' '); return {s:r.status,t,id:r.headers.get('x-request-id')}; }
(async()=>{
  const m=await mint('ue-qa-member-primary'), a=await mint('ue-qa-admin-primary'), s2=await mint('ue-qa-member-secondary');
  let r=await call('/api/organizations/current',{tok:m}); const primary=JSON.parse((await (await fetch(base+'/api/organizations/current',{headers:{'x-unioneyes-acceptance-auth':m}})).text())).data.id;
  log('C.1','Synthetic member resolves to its bound organization',r.s===200,`status=${r.s} org=${primary.slice(0,8)}…`);
  r=await call('/api/organizations/current',{tok:s2}); const second=JSON.parse((await (await fetch(base+'/api/organizations/current',{headers:{'x-unioneyes-acceptance-auth':s2}})).text())).data?.id;
  log('C.2','Secondary-org member resolves to a DIFFERENT organization (membership-bound)',r.s===200&&second&&second!==primary,`status=${r.s} org=${(second||'').slice(0,8)}…`);
  for (const h of [{'x-organization-id':primary},{'x-org-id':primary},{'x-tenant-id':primary}]) { r=await call('/api/organizations/current',{tok:s2,headers:h}); let got=null; try{got=JSON.parse(r.t.length<160?r.t:'{}').data?.id}catch{} const full=await (await fetch(base+'/api/organizations/current',{headers:{'x-unioneyes-acceptance-auth':s2,...h}})).text(); let gid=null; try{gid=JSON.parse(full).data?.id}catch{} log('C.3',`Forged ${Object.keys(h)[0]} does not switch secondary member into primary org`,gid!==primary,`status=${r.s} resolvedOrg=${gid?gid.slice(0,8)+'…':'none'}`); }
  r=await call('/api/org/switch',{tok:s2,method:'POST',headers:{'content-type':'application/json'}}); log('C.4','Org switch without a valid target is rejected (no fallback)',[400,401,403,404,405,422].includes(r.s),`status=${r.s} ${r.t.slice(0,60)}`);
  r=await call('/api/admin/stats/overview',{tok:m}); log('C.5','Member denied platform-admin API',[401,403].includes(r.s),`status=${r.s}`);
  r=await call('/api/admin/stats/overview',{tok:a}); log('C.6','Tenant admin (non platform-admin) denied platform-admin API (no fallback to platform administrator)',[401,403].includes(r.s),`status=${r.s}`);
  r=await call('/api/organizations/current',{tok:await mint('ue-qa-member-primary',300,{skew:-3600})}); log('C.7','Expired token rejected',[401,403].includes(r.s)||r.t.includes('Unauthorized'),`status=${r.s} ${r.t.slice(0,50)}`);
  r=await call('/api/organizations/current',{tok:await mint('ue-qa-member-primary',300,{secret:new TextEncoder().encode('wrong-secret-'+crypto.randomUUID())})}); log('C.8','Token signed with wrong key rejected',r.s===401,`status=${r.s}`);
  r=await call('/api/organizations/current',{tok:await mint('ue-qa-member-primary',300,{aud:'other-aud'})}); log('C.9','Wrong audience rejected',r.s===401,`status=${r.s}`);
  r=await call('/api/organizations/current',{tok:await mint('not-a-provisioned-user')}); log('C.10','Identity outside the allowlist rejected',r.s===401,`status=${r.s}`);
  r=await call('/api/organizations/current',{}); log('C.11','Anonymous request rejected',r.s===401,`status=${r.s}`);
  for (const [p,h,n] of [['/api/cron/deadline-reminders',{},'no credential'],['/api/cron/deadline-reminders',{'x-cron-secret':'invalid'},'invalid secret'],['/api/cron/deadline-overdue',{authorization:'Bearer invalid'},'invalid bearer']]) { r=await call(p,{headers:h}); log('D.cron',`Cron endpoint ${p} rejects ${n} (no worker execution)`,[401,403].includes(r.s),`status=${r.s}`); }
  fs.writeFileSync(process.argv[2],JSON.stringify(res,null,1));
})();
