'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const { PROVIDERS } = require('./providers');
function config(env = process.env) {
  const number = (key, fallback, min, max) => {
    const n = Number(env[key] || fallback);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${key}`);
    return n;
  };
  const enabled = (env.PROVIDERS || PROVIDERS.filter(p => !p.optional).map(p => p.slug).join(',')).split(',').map(s => s.trim()).filter(Boolean);
  if (!enabled.length || enabled.some(s => !PROVIDERS.some(p => p.slug === s))) throw new Error('Unknown or empty PROVIDERS');
  const baseUrl = (env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (baseUrl) {
    const u = new URL(baseUrl);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('PUBLIC_BASE_URL must be an HTTPS origin');
  }
  const c = {
    key: (env.TMDB_API_KEY || '').trim(), token: (env.TMDB_READ_ACCESS_TOKEN || '').trim(),
    host: env.HOST || '0.0.0.0', port: number('PORT', 7000, 1, 65535), baseUrl,
    providers: [...new Set(enabled)], rowLimit: number('ROW_LIMIT', 40, 20, 200),
    trendingPages: number('TRENDING_PAGES', 3, 1, 10), scanPages: number('DISCOVER_SCAN_PAGES', 8, 1, 20), newDays: number('NEW_RELEASE_DAYS', 90, 1, 365),
    refreshMs: number('REFRESH_HOURS', 12, 1, 168) * 3600000,
    staleMs: number('STALE_HOURS', 48, 1, 168) * 3600000,
    apiCacheMs: number('TMDB_CACHE_HOURS', 6, 1, 24) * 3600000,
    intervalMs: number('REQUEST_INTERVAL_MS', 250, 100, 10000), timeoutMs: number('REQUEST_TIMEOUT_MS', 10000, 1000, 30000),
    cacheDir: path.resolve(env.CACHE_DIR || '.cache')
  };
  if(c.scanPages < Math.ceil(c.rowLimit/20)) throw new Error('DISCOVER_SCAN_PAGES must cover ROW_LIMIT');
  if (c.staleMs < c.refreshMs) throw new Error('STALE_HOURS must be at least REFRESH_HOURS');
  c.signature = crypto.createHash('sha256').update(JSON.stringify({schema: 1, providers: c.providers, rowLimit: c.rowLimit, trendingPages: c.trendingPages, scanPages: c.scanPages, newDays: c.newDays})).digest('hex');
  return c;
}
module.exports = { config };
