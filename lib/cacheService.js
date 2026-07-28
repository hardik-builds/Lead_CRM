import NodeCache from 'node-cache';

const ttl = parseInt(process.env.CACHE_TTL || '300', 10);
const cache = new NodeCache({ stdTTL: ttl, checkperiod: 60 });

const cacheService = {
  get: (key) => cache.get(key),
  set: (key, val, customTtl) => cache.set(key, val, customTtl || ttl),
  del: (key) => cache.del(key),
  flush: () => {
    console.log('[Cache Service]: Flushed Next.js query cache');
    cache.flushAll();
  }
};

export default cacheService;
