'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');
const {config}=require('../src/config');const {PROVIDERS,resolveProvider}=require('../src/providers');
const {MemoryCache}=require('../src/cache');const {Engine,catalog,rowId,indiaDate}=require('../src/engine');
const {Tmdb,SourceError}=require('../src/tmdb');const {createAddon}=require('../src/addon');const {createApp}=require('../src/server');
const quiet={warn(){}};const at=Date.parse('2026-10-24T07:00:00Z');
async function setup(t,overrides={}) {
 const parent=path.join(__dirname,'..','.cache','test');await fs.mkdir(parent,{recursive:true});
 const dir=await fs.mkdtemp(path.join(parent,'iott-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const c={...config({CACHE_DIR:dir,PROVIDERS:'sonyliv',TMDB_API_KEY:'fixture-only',INDIAN_ONLY:'false'}),...overrides};
 const calls=[];
 const title=(type,id)=>({id,title:`Fixture movie ${id}`,name:`Fixture series ${id}`,release_date:'2026-10-01',first_air_date:'2026-10-02',poster_path:'/fixture.jpg',external_ids:{imdb_id:`tt${String(id).padStart(7,'0')}`},'watch/providers':{results:{IN:{flatrate:[{provider_id:97531}]}}}});
 const source={stats:{requests:0},async registry(type){calls.push(['registry',type]);return {results:[{provider_name:'Sony Liv',provider_id:97531}]};},async trending(type){calls.push(['trend',type]);return [{id:2},{id:1}];},async discover(type,id,kind){calls.push(['discover',type,id,kind]);return kind==='new'?[{id:3}]:[{id:1},{id:2}];},async title(type,id){calls.push(['title',type,id]);return title(type,id);}};
 return {c,source,title,calls,engine:new Engine(c,source,{now:()=>at,log:quiet})};
}
test('exact live provider names resolve without hardcoded IDs or reseller channels',()=>{
 const p=PROVIDERS.find(p=>p.slug==='sonyliv');
 assert.equal(resolveProvider(p,[{provider_name:'Sony LIV Amazon Channel',provider_id:1}]).status,'not-listed');
 assert.equal(resolveProvider(p,[{provider_name:'Sony Liv',provider_id:97531}]).id,97531);
 assert.equal(resolveProvider(p,[{provider_name:'Sony Liv',provider_id:3},{provider_name:'SonyLIV',provider_id:4}]).status,'ambiguous');
});
test('configuration rejects invalid provider names, insecure origins and invalid intervals',()=>{
 for(const env of [{PROVIDERS:'fake'},{PUBLIC_BASE_URL:'http://example.com'},{PUBLIC_BASE_URL:'https://a.test/path'},{REQUEST_INTERVAL_MS:'0'},{REFRESH_HOURS:'50',STALE_HOURS:'24'}]) assert.throws(()=>config(env));
 assert.deepEqual(config({}).providers.length,9);
});
test('India dates include a release after UTC midnight boundary correctly',()=>assert.equal(indiaDate(Date.parse('2026-10-23T20:00:00Z')),'2026-10-24'));
test('cache coalesces requests, expires, bounds entries and never caches failures',async()=>{
 let now=1,n=0;const cache=new MemoryCache({now:()=>now,maxEntries:2});
 await Promise.all(Array.from({length:8},()=>cache.get('a',10,async()=>++n)));assert.equal(n,1);
 now=12;assert.equal(await cache.get('a',10,async()=>++n),2);
 await assert.rejects(cache.get('bad',10,async()=>{throw Error('source');}));
 assert.equal(await cache.get('bad',10,async()=>3),3);await cache.get('c',10,async()=>4);assert.equal(cache.entries.size,2);
});
test('fixture verification creates six typed named rows and a valid SDK interface',async t=>{
 const {engine}=await setup(t);await engine.refresh();const api=createAddon(engine);
 assert.equal(api.manifest.catalogs.length,6);assert.deepEqual(api.manifest.resources,['catalog']);
 const r=await api.get('catalog','movie',rowId('sonyliv','popular'));assert.equal(r.metas.length,2);assert.equal(r.metas[0].type,'movie');
 assert.match(r.metas[0].description,/Not an official/);assert.equal(r.metas[0].imdbRating,undefined);
});
test('all sixty possible catalog declarations fit the official SDK manifest size limit',()=>{
 const rows=PROVIDERS.flatMap(p=>['movie','tv'].flatMap(type=>['popular','new','trending'].map(kind=>catalog(p,type,kind))));
 const api=createAddon({catalogs:()=>rows,response:()=>({metas:[]})});assert.ok(JSON.stringify(api.manifest).length<=8192);
});
test('India subscription/free/ads checks reject unrelated provider, US-only, reseller and rental-only titles',async t=>{
 const {engine,source,title}=await setup(t);
 source.title=async(type,id)=>{
  const d=title(type,id);
  if(id===1)d['watch/providers'].results.IN.flatrate=[{provider_id:999}];
  if(id===2)d['watch/providers'].results={US:{flatrate:[{provider_id:97531}]}};
  if(id===3)d['watch/providers'].results.IN={rent:[{provider_id:97531}]};
  return d;
 };
 await engine.refresh();assert.equal(engine.catalogs().length,0);assert.equal(engine.report().providers[0].types[0].status,'unavailable');
});
test('free and ads availability qualify while missing posters do not drop valid IDs',async t=>{
 const {engine,source,title}=await setup(t);
 source.title=async(type,id)=>{const d=title(type,id);delete d.poster_path;d['watch/providers'].results.IN={ads:[{provider_id:97531}]};return d;};
 await engine.refresh();assert.equal(engine.catalogs().length,6);assert.equal(engine.response({type:'movie',id:rowId('sonyliv','popular')}).metas[0].poster,undefined);
});
test('adult, unreleased, missing IMDb or invalid IDs and duplicate candidates are excluded',async t=>{
 const {engine,source,title}=await setup(t);
 source.discover=async()=>[{id:1},{id:1},{id:2},{id:3},{id:-1},{id:4},{id:5}];source.trending=source.discover;
 source.title=async(type,id)=>{const d=title(type,id);if(id===1)d.adult=true;if(id===2){d.release_date='2099-01-01';d.first_air_date='2099-01-01';}if(id===3)d.external_ids.imdb_id=null;if(id===4)d.external_ids.imdb_id='invalid';return d;};
 await engine.refresh();for(const r of engine.activeRows()) assert.deepEqual(r.evidence.map(e=>e.tmdbId),[5]);
});
test('transient source failure preserves each good snapshot while other providers/types continue',async t=>{
 const {engine,source}=await setup(t);await engine.refresh();const before=engine.rows.size;
 source.discover=async()=>{throw new SourceError(503,'/discover/movie');};source.trending=source.discover;
 await engine.refresh();assert.equal(engine.rows.size,before);assert.equal(engine.report().providers[0].types[0].status,'unavailable');assert.equal(engine.report().rows.length,6);
});
test('successful empty response removes old rows rather than retaining fabricated availability',async t=>{
 const {engine,source}=await setup(t);await engine.refresh();source.discover=async()=>[];source.trending=async()=>[];
 await engine.refresh();assert.equal(engine.catalogs().length,0);
});
test('no exact India registry mapping removes old provider rows',async t=>{
 const {engine,source}=await setup(t);await engine.refresh();source.registry=async()=>({results:[]});
 await engine.refresh();assert.equal(engine.catalogs().length,0);
});
test('404 title removal is graceful, transient metadata errors retain snapshots',async t=>{
 const {engine,source,title}=await setup(t);source.title=async(type,id)=>{if(id===1)throw new SourceError(404,'/movie/1');return title(type,id);};
 await engine.refresh();assert.equal(engine.response({type:'movie',id:rowId('sonyliv','popular')}).metas.length,1);
 source.title=async()=>{throw new SourceError(500,'/movie/2');};await engine.refresh();assert.equal(engine.response({type:'movie',id:rowId('sonyliv','popular')}).metas.length,1);
});
test('new releases use premiere date window, popular can contain old releases',async t=>{
 const {engine,source,title}=await setup(t);source.title=async(type,id)=>{const d=title(type,id);d.release_date='2001-01-01';d.first_air_date='2001-01-01';return d;};
 await engine.refresh();assert.equal(engine.catalogs().filter(r=>r.id.endsWith('.new')).length,0);assert.equal(engine.catalogs().length,4);
});
test('snapshot pagination has no repeated slices or upstream requests and rejects malformed offsets',async t=>{
 const {engine,source,calls}=await setup(t,{rowLimit:200,scanPages:10});source.discover=async()=>Array.from({length:200},(_,i)=>({id:i+1}));await engine.refresh();
 const before=calls.length;const args={type:'movie',id:rowId('sonyliv','popular')};
 const a=engine.response(args).metas,b=engine.response({...args,extra:{skip:'100'}}).metas;
 assert.equal(a.length,100);assert.equal(b.length,100);assert.equal(new Set([...a,...b].map(m=>m.id)).size,200);
 for(const skip of ['200','999999','-1','NaN','1e1']) assert.equal(engine.response({...args,extra:{skip}}).metas.length,0);
 assert.equal(calls.length,before);
});
test('snapshot persistence survives restart and rejects corrupt, incompatible or expired data',async t=>{
 const {engine,c,source}=await setup(t);await engine.refresh();await engine.save();const again=new Engine(c,source,{now:()=>at,log:quiet});assert.equal(await again.load(),true);assert.equal(again.catalogs().length,6);
 const changed=new Engine({...c,signature:'changed'},source,{now:()=>at,log:quiet});assert.equal(await changed.load(),false);
 const expired=new Engine(c,source,{now:()=>at+c.staleMs,log:quiet});assert.equal(await expired.load(),false);
 await fs.writeFile(path.join(c.cacheDir,'snapshot.json'),'{bad');assert.equal(await again.load(),false);
});
test('expired rows leave manifest and handler and limit cache headers before expiry',async t=>{
 const {engine,c}=await setup(t);await engine.refresh();engine.now=()=>at+c.staleMs-1000;
 assert.equal(engine.response({type:'movie',id:rowId('sonyliv','popular')}).cacheMaxAge,1);
 engine.now=()=>at+c.staleMs;assert.equal(engine.catalogs().length,0);assert.equal(engine.response({type:'movie',id:rowId('sonyliv','popular')}).metas.length,0);
});
test('missing credentials yields no advertised rows and never contacts upstream',async t=>{
 const {engine,source,calls}=await setup(t,{key:'',token:''});await engine.refresh();assert.equal(calls.length,0);assert.equal(engine.catalogs().length,0);assert.equal(createAddon(engine).manifest.catalogs.length,0);
});
test('HTTP SDK routes have CORS, typed metadata, encoded pagination, no streams or secrets',async t=>{
 const {engine,c}=await setup(t);await engine.refresh();const server=createApp(engine,c).listen(0,'127.0.0.1');t.after(()=>new Promise(r=>server.close(r)));await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const manifest=await fetch(base+'/manifest.json');assert.equal(manifest.headers.get('access-control-allow-origin'),'*');assert.equal(manifest.headers.get('cache-control'),'no-store');assert.equal((await manifest.json()).catalogs.length,6);
 const first=await fetch(base+'/catalog/movie/in.sl.pop.json');assert.equal(first.status,200);assert.equal((await first.json()).metas.length,2);
 const next=await fetch(base+'/catalog/movie/in.sl.pop/skip=100.json');assert.deepEqual((await next.json()).metas,[]);
 assert.equal((await fetch(base+'/stream/movie/tt0000001.json')).status,404);
 assert.equal((await fetch(base+'/.env')).status,404);
 const status=await(await fetch(base+'/status.json')).text();assert.ok(!status.includes('fixture-only'));assert.equal((await fetch(base+'/ready')).status,200);
});
test('TMDB uses bearer auth without query credentials, caches calls and requests India filters',async()=>{
 const calls=[];const c=config({TMDB_READ_ACCESS_TOKEN:'private-fixture',REQUEST_INTERVAL_MS:'100'});
 const api=new Tmdb(c,{sleep:async()=>{},fetchImpl:async(url,opts)=>{calls.push({url:new URL(url),opts});return new Response(JSON.stringify({results:[],total_pages:1}),{status:200});}});
 await api.discover('tv',97531,'new',1,new Date(at),90);await api.discover('tv',97531,'new',1,new Date(at),90);
 assert.equal(calls.length,1);assert.equal(calls[0].url.searchParams.get('watch_region'),'IN');assert.equal(calls[0].url.searchParams.get('with_watch_providers'),'97531');assert.equal(calls[0].url.searchParams.get('sort_by'),'first_air_date.desc');assert.equal(calls[0].url.searchParams.has('api_key'),false);assert.equal(calls[0].opts.headers.Authorization,'Bearer private-fixture');
});
test('TMDB retries rate limits, respects Retry-After, and redacts authentication errors',async()=>{
 let count=0,now=at;const sleeps=[];const c=config({TMDB_API_KEY:'do-not-log'});
 const api=new Tmdb(c,{now:()=>now,sleep:async ms=>{sleeps.push(ms);now+=ms;},fetchImpl:async()=>++count===1?new Response('{}',{status:429,headers:{'retry-after':'2'}}):new Response('{"results":[]}',{status:200})});
 await api.registry('movie');assert.equal(count,2);assert.ok(sleeps.reduce((a,b)=>a+b,0)>=2000);
 api.fetch=async()=>new Response('{"private":"do-not-log"}',{status:401});
 await assert.rejects(api.registry('tv'),e=>!e.message.includes('do-not-log') && e.code===401);assert.equal(count,2);
});
test('TMDB timeout failures are bounded; long Retry-After aborts this refresh and blocks subsequent calls',async()=>{
 const c=config({TMDB_API_KEY:'secret'});let n=0;
 const api=new Tmdb(c,{sleep:async()=>{},fetchImpl:async()=>{n++;throw Error('https://private-secret');}});
 await assert.rejects(api.registry('tv'),e=>!e.message.includes('secret'));assert.equal(n,3);
 const rate=new Tmdb(c,{now:()=>at,sleep:async()=>{},fetchImpl:async()=>new Response('{}',{status:429,headers:{'retry-after':'3600'}})});
 await assert.rejects(rate.registry('movie'));assert.equal(rate.cooldown,at+3600000);
});
test('identical ordered rows for a provider/type are suppressed',async t=>{
 const {engine,source}=await setup(t);source.discover=async()=>[{id:1}];source.trending=source.discover;await engine.refresh();assert.equal(engine.catalogs().length,2);
});
test('one provider discovery failure leaves a separately verified provider available',async t=>{
 const {engine,source,title}=await setup(t);engine.config.providers=['sonyliv','zee5'];
 source.registry=async()=>({results:[{provider_name:'Sony Liv',provider_id:97531},{provider_name:'Zee5',provider_id:86420}]});
 source.discover=async(type,providerId)=>{if(providerId===97531)throw new SourceError(503,'/discover');return[{id:1},{id:2}];};
 source.title=async(type,id)=>{const d=title(type,id);d['watch/providers'].results.IN.flatrate=[{provider_id:86420}];return d;};
 await engine.refresh();assert.ok(engine.catalogs().some(r=>r.id==='in.z5.pop'));assert.ok(!engine.catalogs().some(r=>r.id==='in.sl.pop'));
});
test('concurrent refresh requests share a single build',async t=>{
 const {engine,calls}=await setup(t);const a=engine.refresh(),b=engine.refresh();assert.equal(a,b);await Promise.all([a,b]);assert.equal(calls.filter(c=>c[0]==='registry').length,2);
});
test('long Retry-After rejects subsequent requests promptly without a multi-minute sleep',async()=>{
 let slept=0;const c=config({TMDB_API_KEY:'fixture'});const api=new Tmdb(c,{now:()=>at,sleep:async ms=>{slept+=ms;},fetchImpl:async()=>new Response('{}',{status:429,headers:{'retry-after':'3600'}})});
 await assert.rejects(api.registry('movie'));await assert.rejects(api.registry('tv'));assert.equal(slept,0);assert.equal(api.stats.requests,1);
});
test('Discover scans further to refill rows after unrelated or rental-only candidates',async t=>{
 const {engine,source,title}=await setup(t,{rowLimit:20,scanPages:2});
 source.discover=async(type,id,kind,pages)=>Array.from({length:pages*20},(_,i)=>({id:i+1}));
 source.title=async(type,id)=>{const d=title(type,id);if(id<=20)d['watch/providers'].results.IN={rent:[{provider_id:97531}]};return d;};
 await engine.refresh();const row=engine.activeRows().find(r=>r.catalog.id==='in.sl.pop' && r.catalog.type==='movie');assert.equal(row.metas.length,20);assert.equal(row.scanPages,2);assert.equal(row.candidateCount,40);
});

test('Indian-only mode is the default and can be switched off or rejected when invalid',()=>{
 assert.equal(config({}).indianOnly,true);assert.equal(config({INDIAN_ONLY:'false'}).indianOnly,false);
 assert.ok(config({}).indianLanguages.includes('ta'));
 assert.throws(()=>config({INDIAN_ONLY:'maybe'}));assert.throws(()=>config({INDIAN_LANGUAGES:'hindi'}));
 assert.notEqual(config({}).signature,config({INDIAN_ONLY:'false'}).signature);
});
test('Indian-only rows keep Indian-language/origin titles and drop English ones, in discover and in the detail check',async t=>{
 const {engine,source,title,c}=await setup(t,{indianOnly:true,indianLanguages:['hi','ta']});
 const items=[{id:1,original_language:'en'},{id:2,original_language:'hi'},{id:3,original_language:'ta'},{id:4,original_language:'en',origin_country:['IN']},{id:5,original_language:'hi'}];
 source.discoverIndian=async()=>items;
 source.title=async(type,id)=>{const d=title(type,id);d.original_language=({1:'en',2:'hi',3:'ta',4:'en',5:'en'})[id];if(id===4)d.origin_country=['IN'];return d;};
 await engine.refresh();
 const ids=engine.response({type:'movie',id:rowId('sonyliv','popular')}).metas.map(m=>m.id);
 // 1: English (dropped), 5: discover says hi but the title detail says English (dropped by the detail check)
 assert.deepEqual(ids,['tt0000002','tt0000003','tt0000004']);
 assert.match(engine.response({type:'movie',id:rowId('sonyliv','popular')}).metas[0].description,/Indian-language/);
 assert.match(engine.report().limitations.join(' '),/Indian-language or Indian-origin/);
});
test('Indian-only trending row comes from recent popular Indian titles, not the global trending list',async t=>{
 const {engine,source,calls}=await setup(t,{indianOnly:true,indianLanguages:['hi']});
 source.trending=async()=>{throw new Error('global trending must not be used in Indian-only mode');};
 source.discoverIndian=async(type,id,kind,pages,now,newDays,langs,windowDays)=>{calls.push(['indian',type,kind,windowDays]);return [{id:kind==='trending'?7:kind==='new'?8:9,original_language:'hi'}];};
 source.title=async(type,id)=>({id,title:'T',name:'T',release_date:'2026-09-01',first_air_date:'2026-09-01',original_language:'hi',external_ids:{imdb_id:`tt${String(id).padStart(7,'0')}`},'watch/providers':{results:{IN:{flatrate:[{provider_id:97531}]}}}});
 await engine.refresh();
 assert.ok(calls.some(x=>x[0]==='indian' && x[2]==='trending' && x[3]===365));
 assert.equal(engine.response({type:'movie',id:rowId('sonyliv','trending')}).metas.length,1);
});
test('discoverIndian queries Indian origin country and every Indian language, merges and sorts without duplicates',async t=>{
 const urls=[];
 const pages={IN:[{id:1,popularity:5,original_language:'en'},{id:2,popularity:50,original_language:'hi'}],ta:[{id:2,popularity:50,original_language:'hi'},{id:3,popularity:70,original_language:'ta'}],hi:[{id:4,popularity:1,original_language:'hi'}]};
 const fetchImpl=async url=>{
  urls.push(url);const p=url.searchParams;
  const key=p.get('with_origin_country')?'IN':p.get('with_original_language');
  return {ok:true,json:async()=>({results:pages[key]||[],total_pages:1})};
 };
 const tmdb=new Tmdb({key:'fixture-only',intervalMs:100,timeoutMs:1000,apiCacheMs:1000},{fetchImpl,sleep:async()=>{},now:()=>at});
 const list=await tmdb.discoverIndian('movie',97531,'popular',2,new Date(at),90,['hi','ta'],365);
 assert.deepEqual(list.map(x=>x.id),[3,2,1,4]);
 assert.equal(urls.length,3);
 assert.ok(urls.some(u=>u.searchParams.get('with_origin_country')==='IN'));
 assert.deepEqual(urls.map(u=>u.searchParams.get('with_original_language')).filter(Boolean).sort(),['hi','ta']);
 for(const u of urls){assert.equal(u.searchParams.get('watch_region'),'IN');assert.equal(u.searchParams.get('with_watch_providers'),'97531');assert.equal(u.searchParams.get('sort_by'),'popularity.desc');}
 const fresh=await tmdb.discoverIndian('tv',97531,'new',1,new Date(at),30,['hi'],365);
 assert.ok(Array.isArray(fresh));
});
