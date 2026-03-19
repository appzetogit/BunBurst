import { locationAPI } from "@/lib/api";

const CACHE_TTL_MS = 30 * 60 * 1000;
const STORAGE_KEY = "reverseGeocodeCache:v1";
const MAX_CACHE_ENTRIES = 200;
const responseCache = new Map();
const inflightRequests = new Map();

let storageLoaded = false;

function buildCacheKey(lat, lng, precision = 5) {
  return `${Number(lat).toFixed(precision)},${Number(lng).toFixed(precision)}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function pruneCache(now = Date.now()) {
  for (const [key, value] of responseCache.entries()) {
    if (!value || (now - value.timestamp) >= CACHE_TTL_MS) {
      responseCache.delete(key);
    }
  }

  if (responseCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const entries = Array.from(responseCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  while (entries.length > MAX_CACHE_ENTRIES) {
    const [oldestKey] = entries.shift();
    responseCache.delete(oldestKey);
  }
}

function loadCacheFromStorage() {
  if (storageLoaded || !canUseStorage()) {
    return;
  }

  storageLoaded = true;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    for (const entry of parsed) {
      if (!entry || typeof entry.key !== "string" || !entry.value) continue;
      responseCache.set(entry.key, entry.value);
    }

    pruneCache();
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

function persistCacheToStorage() {
  if (!canUseStorage()) {
    return;
  }

  try {
    pruneCache();
    const serialized = JSON.stringify(Array.from(responseCache.entries()).map(([key, value]) => ({
      key,
      value,
    })));
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota and serialization issues.
  }
}

export async function reverseGeocodeWithCache(lat, lng, options = {}) {
  loadCacheFromStorage();

  const precision = options.precision ?? 5;
  const cacheKey = buildCacheKey(lat, lng, precision);
  const now = Date.now();

  const cached = responseCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.response;
  }

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const request = locationAPI.reverseGeocode(Number(lat), Number(lng))
    .then((response) => {
      pruneCache();
      responseCache.set(cacheKey, {
        response,
        timestamp: Date.now(),
      });
      persistCacheToStorage();
      return response;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}

export function clearReverseGeocodeCache() {
  responseCache.clear();
  inflightRequests.clear();
  if (canUseStorage()) {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}
