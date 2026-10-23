'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { PROVIDERS, resolveProvider } = require('./providers');
const { SourceError } = require('./tmdb');
const CODES = {jiohotstar:'jh',sonyliv:'sl',zee5:'z5',primevideo:'pv',sunnxt:'sn',hoichoi:'hc',erosnow:'en',airtelxstream:'ax',lionsgateplay:'lp',netflix:'nf'};
const METHODS = {
 popular:'TMDB popularity descending among titles with verified subscription/free/ad-supported availability on this provider in India. Not an official platform ranking.',
 trending:'Global TMDB weekly trending order intersected with verified availability on this provider in India. A bounded candidate sample, not an official platform chart.',
 new:'First movie release or series premiere within the configured recent-release window, newest first, and verified currently available on this provider in India. Not newly added to the platform; not new series seasons.'
};
// Indian-language or Indian-origin titles only (used when config.indianOnly is on).
const isIndian = (o,langs) => !!o && (langs.includes(o.original_language) || (Array.isArray(o.origin_country) && o.origin_country.includes('IN')));
const INDIAN_METHODS = {
 popular:'TMDB popularity descending among Indian-language/Indian-origin titles with verified subscription/free/ad-supported availability on this provider in India. Not an official platform ranking.',
 trending:'Most popular (TMDB) Indian-language/Indian-origin titles released in the last 12 months with verified availability on this provider in India. Not an official platform chart.',
 new:'Indian-language/Indian-origin first movie release or series premiere within the configured recent-release window, newest first, verified currently available on this provider in India. Not newly added to the platform; not new series seasons.'
};
const imdb = s => typeof s === 'string' && /^tt\d{7,12}$/.test(s);
const image = p => typeof p === 'string' && /^\/[a-zA-Z0-9._-]+$/.test(p) ? `https://image.tmdb.org/t/p/w500${p}` : undefined;
const indiaDate = at => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const rowId = (slug,kind) => `in.${CODES[slug]}.${kind==='trending'?'trend':kind==='popular'?'pop':'new'}`;
function catalog(provider,type,kind) {
 return {type:type==='tv'?'series':'movie',id:rowId(provider.slug,kind),name:`${provider.name} ${kind==='new'?'New':kind==='popular'?'Popular':'Trending'} ${type==='tv'?'Series':'Movies'}${kind==='new'?'':' (TMDB)'}`,extra:[{name:'skip'}]};
}
function toMeta(detail,type,provider,kind,methods=METHODS) {
 const id=detail.external_ids?.imdb_id || detail.imdb_id;
 const name=type==='movie'?detail.title:detail.name;
 if(!imdb(id) || typeof name!=='string' || !name.trim()) return null;
 const date=type==='movie'?detail.release_date:detail.first_air_date;
 const meta={id,type:type==='tv'?'series':'movie',name:name.trim(),posterShape:'poster',description:`${methods[kind]}\nAvailability: JustWatch via TMDB (India).\n\n${detail.overview || ''}`};
 const poster=image(detail.poster_path); if(poster) meta.poster=poster;
 if(/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {meta.releaseInfo=date.slice(0,4);meta.released=new Date(`${date}T00:00:00Z`).toISOString();}
 if(Array.isArray(detail.genres)) meta.genres=detail.genres.map(g=>g.name).filter(n=>typeof n==='string');
 return meta;
}
async function mapLimit(items,limit,fn) {
 const results=new Array(items.length);let cursor=0;let error;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(cursor<items.length && !error) {const i=cursor++;try{results[i]=await fn(items[i],i);}catch(e){error=e;}}
 }));
 if(error) throw error;
 return results;
}
class Engine {
 constructor(config,tmdb,{now=Date.now,log=console}={}) {
  this.config=config;this.tmdb=tmdb;this.now=now;this.log=log;
  this.rows=new Map();this.status=new Map();this.refreshing=null;this.lastRefresh=null;
 }
 methods() {return this.config.indianOnly?INDIAN_METHODS:METHODS;}
 key(type,id) {return `${type}:${id}`;}
 activeRows() {
  const seen=new Set();
  return [...this.rows.values()].filter(r=>{
   if(!r.metas.length || this.now()-r.verifiedAt>=this.config.staleMs) return false;
   const signature=`${r.providerId}:${r.catalog.type}:${r.metas.map(m=>m.id).join(',')}`;
   if(seen.has(signature)) return false;seen.add(signature);return true;
  });
 }
 catalogs() {return this.activeRows().map(r=>r.catalog);}
 response({type,id,extra={}}) {
  const raw=extra.skip===undefined?'0':String(extra.skip);
  if(!/^\d{1,6}$/.test(raw)) return {metas:[],cacheMaxAge:0};
  const row=this.activeRows().find(r=>r.catalog.type===type && r.catalog.id===id);
  const left=row?Math.max(0,Math.floor((this.config.staleMs-(this.now()-row.verifiedAt))/1000)):0;
  return {metas:row?row.metas.slice(Number(raw),Number(raw)+100):[],cacheMaxAge:Math.min(300,left)};
 }
 report() {
  const rows=this.activeRows();
  return {region:'IN',source:'TMDB; availability data by JustWatch',configured:!!(this.config.key||this.config.token),refreshing:!!this.refreshing,lastRefresh:this.lastRefresh,
   providers:PROVIDERS.filter(p=>this.config.providers.includes(p.slug)).map(p=>({slug:p.slug,name:p.name,types:['movie','tv'].map(type=>({type,...(this.status.get(`${p.slug}:${type}`)||{status:'unverified',reason:'Awaiting authenticated live verification'})}))})),
   rows:rows.map(r=>({id:r.catalog.id,type:r.catalog.type,name:r.catalog.name,count:r.metas.length,verifiedAt:new Date(r.verifiedAt).toISOString(),stale:this.now()-r.verifiedAt>=this.config.refreshMs,method:this.methods()[r.kind],candidateCount:r.candidateCount,scanPages:r.scanPages,providerId:r.providerId,sample:r.evidence.slice(0,3)})),
   api:this.tmdb.stats,limitations:['TMDB/JustWatch coverage may be incomplete or delayed.','Availability includes subscription, free, and ads; excludes rent/buy and separately named reseller channels.','Rows appear only after a nonempty live verification; snapshots expire after STALE_HOURS.','No verified originals/collections or official platform charts in this version.',(this.config.indianOnly?'Indian-language or Indian-origin titles only (hi, ta, te, ml, kn, bn, mr, pa, gu, or, as and Indian-origin series); coverage is limited by what TMDB/JustWatch lists for each Indian service.':'No original-language restriction: all titles verified on the Indian service qualify.'),'Rows with identical ordered title lists for the same provider and content type are suppressed.']};
 }
 async hydrate(candidates,provider,type,kind,providerId,at) {
  const seen=new Set();const unique=[];
  for(const c of candidates) if(Number.isSafeInteger(c.id) && c.id>0 && !seen.has(c.id)) {seen.add(c.id);unique.push(c);}
  const details=await mapLimit(unique,2,async c=>{
   try { return await this.tmdb.title(type,c.id); }
   catch(e) {if(e.code===404) return null;throw e;}
  });
  const metas=[];const evidence=[];const emitted=new Set();
  for(const d of details) {
   if(!d || d.adult===true) continue;
   if(this.config.indianOnly && !isIndian(d,this.config.indianLanguages)) continue;
   const date=type==='movie'?d.release_date:d.first_air_date;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'') || !Number.isFinite(Date.parse(date)) || date>indiaDate(at)) continue;
   if(kind==='new' && date<indiaDate(at-this.config.newDays*86400000)) continue;
   const india=d['watch/providers']?.results?.IN;
   if(!india || !['flatrate','free','ads'].some(mode=>Array.isArray(india[mode]) && india[mode].some(p=>p.provider_id===providerId))) continue;
   const meta=toMeta(d,type,provider,kind,this.methods());
   if(!meta || emitted.has(meta.id)) continue;
   emitted.add(meta.id);metas.push(meta);
   evidence.push({id:meta.id,tmdbId:d.id,name:meta.name,providerId,watchRegion:'IN',checkedAt:new Date(at).toISOString()});
   if(metas.length>=this.config.rowLimit) break;
  }
  return {catalog:catalog(provider,type,kind),kind,providerId,metas,evidence,verifiedAt:at};
 }
 refresh() {
  if(this.refreshing) return this.refreshing;
  this.refreshing=this.build().finally(()=>{this.refreshing=null;});
  return this.refreshing;
 }
 async build() {
  if(!this.config.key && !this.config.token) {this.log.warn('refresh skipped: TMDB credentials missing');return;}
  const at=this.now();const runTrending=new Map();
  for(const type of ['movie','tv']) {
   let registry;
   try {registry=await this.tmdb.registry(type);if(!Array.isArray(registry.results)) throw new Error('Invalid provider registry');}
   catch(e) {
    this.log.warn(`registry ${type}: ${e instanceof SourceError?e.message:'invalid or unavailable registry'}`);
    for(const p of PROVIDERS.filter(p=>this.config.providers.includes(p.slug))) this.status.set(`${p.slug}:${type}`,{status:'source-error',reason:'India provider registry request failed; eligible old snapshots retained'});
    continue;
   }
   for(const provider of PROVIDERS.filter(p=>this.config.providers.includes(p.slug))) {
    const resolved=resolveProvider(provider,registry.results);
    const statusKey=`${provider.slug}:${type}`;
    if(resolved.status!=='resolved') {
     this.status.set(statusKey,resolved);
     for(const kind of ['popular','new','trending']) this.rows.delete(this.key(type==='tv'?'series':'movie',rowId(provider.slug,kind)));
     continue;
    }
    const outcomes=[];
    for(const kind of ['popular','new','trending']) {
     const id=rowId(provider.slug,kind);const key=this.key(type==='tv'?'series':'movie',id);
     try {
      let candidates;
      if(this.config.indianOnly) {
       // Ask TMDB for Indian titles directly, then keep only Indian-language/origin candidates
       // (cheap check on the discover payload) before the per-title availability lookups.
       candidates=await this.tmdb.discoverIndian(type,resolved.id,kind,Math.min(this.config.scanPages,Math.ceil(this.config.rowLimit/20)+1),new Date(at),this.config.newDays,this.config.indianLanguages,this.config.trendingWindowDays);
       candidates=candidates.filter(c=>isIndian(c,this.config.indianLanguages)).slice(0,Math.ceil(this.config.rowLimit*1.5));
      } else if(kind==='trending') {
       if(!runTrending.has(type)) runTrending.set(type,this.tmdb.trending(type,this.config.trendingPages));
       candidates=await runTrending.get(type);
      } else candidates=await this.tmdb.discover(type,resolved.id,kind,Math.ceil(this.config.rowLimit/20),new Date(at),this.config.newDays);
      let row=await this.hydrate(candidates,provider,type,kind,resolved.id,at);
      // Discover's provider and monetization predicates can select rental offers on
      // this provider plus subscriptions elsewhere. Verify each title and scan
      // further, with an explicit bound, to refill genuine direct-provider results.
      if(kind!=='trending' && !this.config.indianOnly) {
       let pages=Math.ceil(this.config.rowLimit/20);
       while(row.metas.length<this.config.rowLimit && candidates.length===pages*20 && pages<this.config.scanPages) {
        candidates=await this.tmdb.discover(type,resolved.id,kind,++pages,new Date(at),this.config.newDays);
        row=await this.hydrate(candidates,provider,type,kind,resolved.id,at);
       }
       row.candidateCount=candidates.length;row.scanPages=pages;
      }
      if(row.metas.length) {this.rows.set(key,row);outcomes.push({kind,status:'verified',count:row.metas.length});}
      else {this.rows.delete(key);outcomes.push({kind,status:'empty',count:0});}
     }catch(e) {
      // Do not replace a good snapshot with incomplete output after transient source failures.
      outcomes.push({kind,status:'source-error',reason:'Upstream verification failed; eligible old snapshot retained'});
      this.log.warn(`catalog ${provider.slug}/${type}/${kind}: ${e instanceof SourceError?e.message:'invalid or unavailable source data'}`);
     }
    }
    this.status.set(statusKey,{status:outcomes.some(o=>o.status==='verified')?(outcomes.every(o=>o.status==='verified')?'verified':'partial'):'unavailable',providerId:resolved.id,sourceName:resolved.sourceName,checkedAt:new Date(at).toISOString(),catalogs:outcomes});
    // Save incrementally so a restart during a long first refresh needn't lose all progress.
    await this.save().catch(()=>this.log.warn('snapshot save failed; serving in-memory rows'));
   }
  }
  this.lastRefresh=new Date(this.now()).toISOString();
  await this.save().catch(()=>this.log.warn('snapshot save failed; serving in-memory rows'));
 }
 async save() {
  await fs.mkdir(this.config.cacheDir,{recursive:true});
  const file=path.join(this.config.cacheDir,'snapshot.json');
  const data={schema:1,signature:this.config.signature,lastRefresh:this.lastRefresh,rows:this.activeRows(),status:[...this.status]};
  const temp=`${file}.${process.pid}.tmp`;
  await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file);
 }
 async load() {
  try {
   const file=path.join(this.config.cacheDir,'snapshot.json');
   if((await fs.stat(file)).size>20000000) return false;
   const d=JSON.parse(await fs.readFile(file,'utf8'));
   if(d.schema!==1 || d.signature!==this.config.signature || !Array.isArray(d.rows)) return false;
   const rows=new Map();
   for(const r of d.rows) {
    const provider=PROVIDERS.find(p=>this.config.providers.includes(p.slug) && r.catalog?.id===rowId(p.slug,r.kind));
    if(!provider || !['popular','new','trending'].includes(r.kind) || !['movie','series'].includes(r.catalog.type) || !Number.isSafeInteger(r.providerId) || r.providerId<=0 || !Number.isFinite(r.verifiedAt) || r.verifiedAt>this.now() || this.now()-r.verifiedAt>=this.config.staleMs) continue;
    if(!Array.isArray(r.metas) || !r.metas.length || r.metas.length>this.config.rowLimit || !Array.isArray(r.evidence) || r.evidence.length!==r.metas.length) continue;
    if(!r.metas.every(m=>imdb(m.id) && m.type===r.catalog.type && typeof m.name==='string' && m.name)) continue;
    // Reconstruct catalog declarations from trusted code, never trust serialized names/extras.
    r.catalog=catalog(provider,r.catalog.type==='movie'?'movie':'tv',r.kind);
    rows.set(this.key(r.catalog.type,r.catalog.id),r);
   }
   this.rows=rows;this.lastRefresh=d.lastRefresh||null;
   if(Array.isArray(d.status)) this.status=new Map(d.status);
   return rows.size>0;
  }catch {return false;}
 }
}
module.exports={Engine,METHODS,INDIAN_METHODS,isIndian,catalog,rowId,toMeta,mapLimit,indiaDate};
