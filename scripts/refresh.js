'use strict';
const {config}=require('../src/config');const {Tmdb}=require('../src/tmdb');const {Engine}=require('../src/engine');
(async()=>{
 const c=config();if(!c.key&&!c.token){console.error('TMDB credential missing. Configure .env privately.');process.exitCode=2;return;}
 const engine=new Engine(c,new Tmdb(c));await engine.load();await engine.refresh();
 console.log(JSON.stringify(engine.report(),null,2));if(!engine.catalogs().length)process.exitCode=1;
})().catch(()=>{console.error('Refresh failed; inspect configuration and source status.');process.exitCode=1;});
