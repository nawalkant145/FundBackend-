                                                                               
                                                           

let client;

const inMemoryStore = new Map();
const inMemoryExpiries = new Map();

const cleanExpired = (key) => {
  const exp = inMemoryExpiries.get(key);
  if (exp && exp < Date.now()) {
    inMemoryStore.delete(key);
    inMemoryExpiries.delete(key);
    return true;
  }
  return false;
};

const memoryClient = {
  async get(key) {
    if (cleanExpired(key)) return null;
    return inMemoryStore.get(key) ?? null;
  },
  async set(key, value, ...args) {
    inMemoryStore.set(key, String(value));
                            
    const exIdx = args.indexOf("EX");
    if (exIdx !== -1 && args[exIdx + 1]) {
      const seconds = Number(args[exIdx + 1]);
      inMemoryExpiries.set(key, Date.now() + seconds * 1000);
    }
    return "OK";
  },
  async del(...keys) {
    let n = 0;
    for (const k of keys) {
      if (inMemoryStore.delete(k)) n++;
      inMemoryExpiries.delete(k);
    }
    return n;
  },
  async incr(key) {
    cleanExpired(key);
    const cur = Number(inMemoryStore.get(key) || 0) + 1;
    inMemoryStore.set(key, String(cur));
    return cur;
  },
  async expire(key, seconds) {
    if (!inMemoryStore.has(key)) return 0;
    inMemoryExpiries.set(key, Date.now() + seconds * 1000);
    return 1;
  },
  async keys(pattern) {
                               
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return [...inMemoryStore.keys()].filter((k) => k.startsWith(prefix));
    }
    return inMemoryStore.has(pattern) ? [pattern] : [];
  },
  on() {},
};

const initRedis = () => {
  if (process.env.UPSTASH_REDIS_URL) {
    const Redis = require("ioredis");
    client = new Redis(process.env.UPSTASH_REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    client.on("connect", () => console.log("✅ Redis connected"));
    client.on("error", (err) => console.error("❌ Redis error:", err.message));
  } else {
    console.warn("⚠️  No UPSTASH_REDIS_URL — using in-memory cache (dev only)");
    client = memoryClient;
  }
  return client;
};

module.exports = { initRedis, getClient: () => client || initRedis() };
