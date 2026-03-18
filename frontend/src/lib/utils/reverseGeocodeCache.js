import { locationAPI } from "@/lib/api";

const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map();
const inflightRequests = new Map();

function buildCacheKey(lat, lng, precision = 5) {
  return `${Number(lat).toFixed(precision)},${Number(lng).toFixed(precision)}`;
}

export async function reverseGeocodeWithCache(lat, lng, options = {}) {
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
      responseCache.set(cacheKey, {
        response,
        timestamp: Date.now(),
      });
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
}
