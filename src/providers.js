'use strict';
// Candidate NAMES, never assumed provider IDs. No fuzzy matching or channel unions.
const PROVIDERS = [
 {slug:'jiohotstar', name:'JioHotstar', aliases:['JioHotstar']},
 {slug:'sonyliv', name:'SonyLIV', aliases:['Sony Liv','SonyLIV']},
 {slug:'zee5', name:'ZEE5', aliases:['Zee5','ZEE5']},
 {slug:'primevideo', name:'Prime Video India', aliases:['Amazon Prime Video','Prime Video']},
 {slug:'sunnxt', name:'Sun NXT', aliases:['Sun Nxt','SunNXT']},
 {slug:'hoichoi', name:'Hoichoi', aliases:['Hoichoi']},
 {slug:'erosnow', name:'Eros Now', aliases:['Eros Now']},
 {slug:'airtelxstream', name:'Airtel Xstream', aliases:['Airtel Xstream','Airtel Xstream Play']},
 {slug:'lionsgateplay', name:'Lionsgate Play', aliases:['Lionsgate Play']},
 {slug:'netflix', name:'Netflix India', aliases:['Netflix'], optional:true}
];
const normalize = s => String(s).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
function resolveProvider(provider, results) {
  if (!Array.isArray(results)) throw new Error('Invalid TMDB provider registry');
  const matches = results.filter(p => provider.aliases.some(a => normalize(a) === normalize(p.provider_name)));
  const ids = [...new Set(matches.map(p => p.provider_id))];
  if (!ids.length) return {status:'not-listed', reason:'No exact direct-provider name in the India registry'};
  if (ids.length !== 1 || !Number.isSafeInteger(ids[0]) || ids[0] <= 0) return {status:'ambiguous', reason:'Multiple or invalid direct-provider IDs; manual review required'};
  return {status:'resolved', id:ids[0], sourceName:matches[0].provider_name};
}
module.exports = { PROVIDERS, resolveProvider };
