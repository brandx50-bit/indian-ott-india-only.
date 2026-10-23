'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const {config}=require('../src/config');const {Tmdb}=require('../src/tmdb');const {Engine}=require('../src/engine');const {createApp}=require('../src/server');
const {PROVIDERS,resolveProvider}=require('../src/providers');const {lintManifest}=require('stremio-addon-linter');
const {setTimeout:delay}=require('node:timers/promises');
const getJson=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});assert.equal(r.status,200);return r.json();};
async function main() {
 const c=config();const report={checkedAt:new Date().toISOString(),mode:'authenticated-live',result:'blocked',checks:[],stremioClientAcceptance:'not-tested',publicHttps:'not-tested',providers:PROVIDERS.filter(p=>c.providers.includes(p.slug)).map(p=>({provider:p.name,status:'unverified'}))};
 const save=async()=>{await fs.mkdir('reports',{recursive:true});await fs.writeFile(path.join('reports','live-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));};
 if(!c.key&&!c.token){report.reason='No TMDB credential configured. Set .env locally or hosting secrets; never send it in chat.';await save();process.exitCode=2;return;}
 let server;
 try {
  const api=new Tmdb(c);let engine;let base;const index=process.argv.indexOf('--url');
  if(index>=0){const u=new URL(process.argv[index+1]);assert.equal(u.protocol,'https:');assert.equal(u.pathname,'/');assert.equal(u.search,'');assert.equal(u.username,'');assert.equal(u.password,'');base=u.origin;report.publicHttps=base;}
  else {engine=new Engine(c,api);await engine.refresh();server=createApp(engine,c).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;}
  const manifest=await getJson(base+'/manifest.json');assert.equal(lintManifest(manifest).valid,true);assert.deepEqual(manifest.resources,['catalog']);assert.ok(manifest.catalogs.length>0,'No verified nonempty rows');
  report.checks.push({name:'manifest-schema-and-catalog-only',result:'pass',catalogs:manifest.catalogs.length});
  const status=await getJson(base+'/status.json');report.providers=status.providers;report.rows=status.rows;report.api=api.stats;
  let count=0;const posters=new Set();
  for(const row of manifest.catalogs) {
   const rowStatus=status.rows.find(r=>r.id===row.id && r.type===row.type);assert.ok(rowStatus);
   const provider=status.providers.find(p=>p.types.some(t=>t.providerId===rowStatus.providerId && (t.type==='tv'?'series':'movie')===row.type));assert.ok(provider);
   const definition=PROVIDERS.find(p=>p.slug===provider.slug);const media=row.type==='series'?'tv':'movie';
   const registry=await api.registry(media);assert.equal(resolveProvider(definition,registry.results).id,rowStatus.providerId);
   const all=[];for(let skip=0;skip<=c.rowLimit+100;skip+=100) {
    const suffix=skip?`/skip=${skip}.json`:'.json';const r=await getJson(`${base}/catalog/${row.type}/${row.id}${suffix}`);
    assert.ok(Array.isArray(r.metas));all.push(...r.metas);if(!r.metas.length)break;
   }
   assert.ok(all.length>0);assert.equal(new Set(all.map(m=>m.id)).size,all.length);
   for(const m of all) {
    assert.equal(m.type,row.type);assert.match(m.id,/^tt\d{7,12}$/);assert.ok(m.name);
    let tmdbId=engine?.activeRows().find(r=>r.catalog.id===row.id && r.catalog.type===row.type)?.evidence.find(e=>e.id===m.id)?.tmdbId;
    if(!tmdbId){const found=await api.get(`/find/${m.id}`,{external_source:'imdb_id'});tmdbId=found[`${media==='tv'?'tv':'movie'}_results`]?.[0]?.id;}
    assert.ok(tmdbId);const detail=await api.title(media,tmdbId);assert.equal(detail.external_ids.imdb_id,m.id);
    const india=detail['watch/providers'].results.IN;
    assert.ok(['flatrate','free','ads'].some(k=>india?.[k]?.some(p=>p.provider_id===rowStatus.providerId)),`${row.id}: India availability mismatch`);
    if(m.poster && (process.argv.includes('--all-posters') || !posters.has(row.id+row.type))) {
     assert.match(m.poster,/^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[a-zA-Z0-9._-]+$/);
     await delay(c.intervalMs);const poster=await fetch(m.poster,{method:'HEAD',signal:AbortSignal.timeout(15000),redirect:'error'});assert.equal(poster.status,200);assert.match(poster.headers.get('content-type')||'',/^image\//);posters.add(row.id+row.type);
    }
   }
   const repeat=await getJson(`${base}/catalog/${row.type}/${row.id}.json`);assert.deepEqual(repeat.metas,all.slice(0,100));
   count+=all.length;report.checks.push({name:row.name,result:'pass',items:all.length,availability:'all returned titles checked against TMDB IN offer data'});
  }
  report.checks.push({name:'poster-urls',result:'pass',coverage:process.argv.includes('--all-posters')?'all returned posters':'one poster per row; full check available with --all-posters'});
  report.result='pass';report.itemsChecked=count;report.limitations=['Actual Stremio installation and device display require separate user/client verification.','URL persistence across a real redeploy must be verified separately.'];
 }catch(e){report.result='fail';report.reason=e.code?`Source error ${e.code}`:'A live acceptance assertion or request failed; check service status and retry.';process.exitCode=1;}
 finally{if(server)await new Promise(r=>server.close(r));await save();}
}
main().catch(()=>{console.error('Live verification could not start. Check environment configuration.');process.exitCode=1;});
