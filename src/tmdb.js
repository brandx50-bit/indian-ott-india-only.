'use strict';
const { setTimeout: delay } = require('node:timers/promises');
const { MemoryCache } = require('./cache');
const indiaDate = at => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
class SourceError extends Error {
  constructor(code, path) { super(`TMDB ${code} at ${path}`); this.code = code; }
}
class Tmdb {
  constructor(config, {fetchImpl = fetch, sleep = delay, now = Date.now} = {}) {
    this.config=config; this.fetch=fetchImpl; this.sleep=sleep; this.now=now;
    this.cache=new MemoryCache({now}); this.gate=Promise.resolve(); this.next=0; this.cooldown=0;
    this.stats={requests:0, retries:0, failures:0};
  }
  async slot() {
    const p=this.gate.then(async()=>{
      if(this.cooldown-this.now()>30000) throw new SourceError(429,'/rate-limit');
      const wait=Math.max(this.next,this.cooldown)-this.now();
      if(wait>0) await this.sleep(wait);
      this.next=this.now()+this.config.intervalMs;
    });
    this.gate=p.catch(()=>{});
    await p;
  }
  async get(path, params={}, ttl=this.config.apiCacheMs) {
    const query=new URLSearchParams(Object.entries(params).sort());
    return this.cache.get(`${path}?${query}`, ttl, async()=>{
      if(!this.config.token && !this.config.key) throw new SourceError('credentials-missing',path);
      for(let attempt=0;attempt<3;attempt++) {
        await this.slot();
        const url=new URL(`https://api.themoviedb.org/3${path}`);
        for(const [k,v] of query) url.searchParams.set(k,v);
        const headers={accept:'application/json', 'User-Agent':'Personal-Indian-OTT-Catalogs/1.0'};
        if(this.config.token) headers.Authorization=`Bearer ${this.config.token}`;
        else url.searchParams.set('api_key',this.config.key);
        let response;
        try {
          this.stats.requests++;
          response=await this.fetch(url,{headers,signal:AbortSignal.timeout(this.config.timeoutMs),redirect:'error'});
          if(response.ok) return await response.json();
        }catch {
          if(attempt<2) {this.stats.retries++; await this.sleep(500*2**attempt); continue;}
          this.stats.failures++; throw new SourceError('network-or-invalid-json',path);
        }
        const retry=response.status===429 || response.status>=500;
        if(response.status===429) {
          const raw=response.headers.get('retry-after');
          const numeric=raw!==null && /^\d+(\.\d+)?$/.test(raw) ? Number(raw)*1000 : Date.parse(raw)-this.now();
          const wait=Number.isFinite(numeric)?Math.max(1000,numeric):1000*2**attempt;
          this.cooldown=Math.max(this.cooldown,this.now()+wait);
          // Respect a long Retry-After without occupying a worker for minutes.
          if(wait>30000) {this.stats.failures++; throw new SourceError(429,path);}
        }
        if(retry && attempt<2) {this.stats.retries++; await this.sleep(500*2**attempt); continue;}
        this.stats.failures++; throw new SourceError(response.status,path);
      }
    });
  }
  registry(type) { return this.get(`/watch/providers/${type}`, {watch_region:'IN',language:'en-US'},86400000); }
  async trending(type, pages) {
    const results=[];
    for(let page=1;page<=pages;page++) {
      const r=await this.get(`/trending/${type}/week`,{page,language:'en-US'});
      if(!Array.isArray(r.results)) throw new SourceError('invalid-results',`/trending/${type}/week`);
      results.push(...r.results);
      if(page>=r.total_pages) break;
    }
    return results;
  }
  async discover(type, providerId, kind, pages, now, newDays) {
    const date=type==='movie'?'primary_release_date':'first_air_date';
    const params={watch_region:'IN',with_watch_providers:String(providerId),with_watch_monetization_types:'flatrate|free|ads',include_adult:'false',language:'en-US',sort_by:kind==='new'?`${date}.desc`:'popularity.desc',[`${date}.lte`]:indiaDate(now)};
    if(kind==='new') params[`${date}.gte`]=indiaDate(now.getTime()-newDays*86400000);
    const results=[];
    for(let page=1;page<=pages;page++) {
      const r=await this.get(`/discover/${type}`,{...params,page});
      if(!Array.isArray(r.results)) throw new SourceError('invalid-results',`/discover/${type}`);
      results.push(...r.results);
      if(page>=r.total_pages) break;
    }
    return results;
  }
  async title(type,id) {
    // One cached request supplies exact IDs, full metadata, and country-specific availability.
    const r=await this.get(`/${type}/${id}`,{append_to_response:'external_ids,watch/providers',language:'en-US'});
    if(r.id!==id || !r.external_ids || !r['watch/providers']?.results || Array.isArray(r['watch/providers'].results) || typeof r['watch/providers'].results!=='object') throw new SourceError('invalid-title-payload',`/${type}/${id}`);
    return r;
  }
}
module.exports = { Tmdb, SourceError };
