'use strict';
const express = require('express');
const path = require('node:path');
const { config:readConfig } = require('./config');
const { Tmdb } = require('./tmdb');
const { Engine } = require('./engine');
const { createRouter } = require('./addon');
function createApp(engine,config) {
 const app=express();app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.set('Access-Control-Allow-Origin','*');res.set('X-Content-Type-Options','nosniff');
  if(req.url.length>2048) return res.status(414).json({error:'URL too long'});
  if(req.method==='OPTIONS') return res.sendStatus(204);
  next();
 });
 app.get('/health',(_req,res)=>res.json({status:'ok'}));
 app.get('/ready',(_req,res)=>res.status(engine.catalogs().length?200:503).json({ready:!!engine.catalogs().length}));
 app.get('/status.json',(_req,res)=>{res.set('Cache-Control','no-store');res.json(engine.report());});
 app.get('/install.json',(_req,res)=>res.json({manifest:config.baseUrl?`${config.baseUrl}/manifest.json`:null,stremio:config.baseUrl?`${config.baseUrl.replace('https://','stremio://')}/manifest.json`:null}));
 app.use(express.static(path.join(__dirname,'..','public'),{maxAge:'1h',index:'index.html'}));
 let signature,router;
 app.use((req,res,next)=>{
  const current=JSON.stringify(engine.catalogs());
  if(current!==signature) {router=createRouter(engine);signature=current;}
  if(req.path==='/manifest.json') res.set('Cache-Control','no-store');
  router(req,res,next);
 });
 app.use((_req,res)=>res.status(404).json({error:'Not found'}));
 app.use((_err,_req,res,_next)=>res.status(500).json({error:'Internal error'}));
 return app;
}
async function start() {
 const config=readConfig();const tmdb=new Tmdb(config);const engine=new Engine(config,tmdb);
 await engine.load();const app=createApp(engine,config);
 const server=app.listen(config.port,config.host,()=>console.log(`Indian OTT Discovery listening on port ${config.port}`));
 const refresh=()=>engine.refresh().catch(()=>console.warn('refresh failed; eligible previous rows remain available'));
 let timer,stopped=false;
 const tick=async()=>{await refresh();if(!stopped){timer=setTimeout(tick,config.refreshMs);timer.unref();}};
 const previous=Date.parse(engine.lastRefresh || '');
 const due=Number.isFinite(previous)?Math.max(0,config.refreshMs-(Date.now()-previous)):0;
 timer=setTimeout(tick,due);timer.unref();
 const close=()=>{stopped=true;clearTimeout(timer);server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref();};
 process.on('SIGTERM',close);process.on('SIGINT',close);
 return {server,engine,timer};
}
if(require.main===module) start().catch(()=>{console.error('Startup failed. Check environment configuration and filesystem permissions.');process.exitCode=1;});
module.exports={createApp,start};
