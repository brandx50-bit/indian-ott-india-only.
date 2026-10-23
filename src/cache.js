'use strict';
class MemoryCache {
  constructor({now = Date.now, maxEntries = 10000} = {}) { this.now = now; this.max = maxEntries; this.entries = new Map(); this.pending = new Map(); }
  async get(key, ttl, load) {
    const cached = this.entries.get(key);
    if (cached && this.now() - cached.at < ttl) return cached.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = Promise.resolve().then(load).then(value => {
      this.entries.delete(key);
      this.entries.set(key, {at:this.now(), value});
      while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value);
      return value;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
module.exports = { MemoryCache };
