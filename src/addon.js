'use strict';
const { addonBuilder, getRouter } = require('stremio-addon-sdk');
function createAddon(engine) {
 const manifest={id:'personal.india.ott.discovery',version:'1.0.0',name:'Indian OTT Discovery',description:'Catalogs for Indian OTT services. TMDB weekly trends, popularity and release dates; availability by JustWatch (India). This product uses the TMDB API but is not endorsed or certified by TMDB.',resources:['catalog'],types:['movie','series'],catalogs:engine.catalogs(),idPrefixes:['tt'],behaviorHints:{adult:false}};
 const builder=new addonBuilder(manifest);
 builder.defineCatalogHandler(args=>Promise.resolve(engine.response(args)));
 return builder.getInterface();
}
function createRouter(engine) {return getRouter(createAddon(engine));}
module.exports={createAddon,createRouter};
