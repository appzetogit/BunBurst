import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';

let realtimeDb = null;
let initAttempted = false;
let initErrorLogged = false;
const FIREBASE_RW_INTERVAL_MS = 10000; // 10 seconds
const FIREBASE_READ_INTERVAL_MS = 10000; // 10 seconds

const writeThrottle = {
  deliveryPartner: new Map(),
  activeOrderLocation: new Map(),
  activeOrderRoute: new Map(),
  userLocation: new Map(),
  cafeLocation: new Map()
};

const readCache = {
  activeOrder: new Map()
};

const activeOrderCreatedAtCache = new Map();

function shouldSkipWrite(bucket, key, status = '') {
  if (!bucket || !key) return false;
  const now = Date.now();
  const previous = bucket.get(key);
  if (!previous) {
    bucket.set(key, { timestamp: now, status });
    return false;
  }

  const statusChanged = previous.status !== status;
  if (!statusChanged && (now - previous.timestamp) < FIREBASE_RW_INTERVAL_MS) {
    return true;
  }

  bucket.set(key, { timestamp: now, status });
  return false;
}

function normalizePrivateKey(privateKey) {
  if (!privateKey || typeof privateKey !== 'string') return privateKey;
  return privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
}

function resolveServiceAccountFromFile() {
  const configuredConfig = process.env.FIREBASE_CONFIG;
  if (configuredConfig) {
    try {
      const parsed = JSON.parse(configuredConfig);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: normalizePrivateKey(parsed.private_key)
        };
      }
    } catch (error) {
      console.warn(`⚠️ Failed parsing FIREBASE_CONFIG from env: ${error.message}`);
    }
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'config', 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'config', 'firebase-service-account.json'),
    path.resolve(process.cwd(), 'firebaseconfig.json')
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      const raw = fs.readFileSync(candidatePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key
        };
      }
    } catch (error) {
      console.warn(`⚠️ Failed reading Firebase service account at ${candidatePath}: ${error.message}`);
    }
  }

  return null;
}

function resolveFirebaseAdminCredentials() {
  const envCredentials = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
  };

  if (envCredentials.projectId && envCredentials.clientEmail && envCredentials.privateKey) {
    return envCredentials;
  }

  return resolveServiceAccountFromFile();
}

function defaultDatabaseUrl(projectId) {
  return projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '';
}

export function initializeFirebaseRealtime() {
  if (realtimeDb) return realtimeDb;
  if (initAttempted && !realtimeDb) return null;
  initAttempted = true;

  try {
    const credentials = resolveFirebaseAdminCredentials();
    const databaseURL = process.env.FIREBASE_DATABASE_URL || defaultDatabaseUrl(credentials?.projectId);

    if (!credentials) {
      console.warn('⚠️ Firebase Realtime Database not initialized. Missing Firebase Admin credentials.');
      return null;
    }

    if (!databaseURL) {
      console.warn('⚠️ Firebase Realtime Database not initialized. Set FIREBASE_DATABASE_URL in backend .env.');
      return null;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey
        }),
        databaseURL
      });
    }

    realtimeDb = getDatabase(admin.app());
    console.log('✅ Firebase Realtime Database initialized');
    return realtimeDb;
  } catch (error) {
    console.error(`❌ Firebase Realtime Database initialization failed: ${error.message}`);
    return null;
  }
}

export function getFirebaseRealtimeDb() {
  if (realtimeDb) return realtimeDb;
  const initializedDb = initializeFirebaseRealtime();
  if (initializedDb) return initializedDb;
  if (!initErrorLogged) {
    console.warn('⚠️ Firebase Realtime Database not available');
    initErrorLogged = true;
  }
  return null;
}

export function isFirebaseRealtimeAvailable() {
  return !!getFirebaseRealtimeDb();
}

export async function syncDeliveryPartnerPresence({
  deliveryPartnerId,
  isOnline,
  latitude,
  longitude
}) {
  const db = getFirebaseRealtimeDb();
  if (!db || !deliveryPartnerId) return false;
  if (shouldSkipWrite(writeThrottle.deliveryPartner, deliveryPartnerId, isOnline ? 'online' : 'offline')) {
    return true;
  }

  const payload = {
    status: isOnline ? 'online' : 'offline',
    last_updated: Date.now()
  };

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    payload.lat = latitude;
    payload.lng = longitude;
  }

  await db.ref(`delivery_boys/${deliveryPartnerId}`).update(payload);
  return true;
}

export async function syncActiveOrderRoute({
  orderId,
  deliveryPartnerId,
  polyline,
  cafeLat,
  cafeLng,
  customerLat,
  customerLng,
  distance,
  duration
}) {
  const db = getFirebaseRealtimeDb();
  if (!db || !orderId) return false;
  if (shouldSkipWrite(writeThrottle.activeOrderRoute, orderId, 'assigned')) {
    return true;
  }

  const orderRef = db.ref(`active_orders/${orderId}`);
  const now = Date.now();
  const createdAt = activeOrderCreatedAtCache.get(orderId) || now;
  activeOrderCreatedAtCache.set(orderId, createdAt);

  const payload = {
    status: 'assigned',
    created_at: createdAt,
    last_updated: now
  };

  if (deliveryPartnerId) payload.boy_id = deliveryPartnerId;
  if (polyline) payload.polyline = polyline;
  if (typeof cafeLat === 'number') payload.cafe_lat = cafeLat;
  if (typeof cafeLng === 'number') payload.cafe_lng = cafeLng;
  if (typeof customerLat === 'number') payload.customer_lat = customerLat;
  if (typeof customerLng === 'number') payload.customer_lng = customerLng;
  if (typeof distance === 'number' && Number.isFinite(distance)) payload.distance = distance;
  if (typeof duration === 'number' && Number.isFinite(duration)) payload.duration = duration;

  await orderRef.update(payload);

  // Maintain route_cache format expected by export snapshots.
  if (
    polyline &&
    typeof cafeLat === 'number' &&
    typeof cafeLng === 'number' &&
    typeof customerLat === 'number' &&
    typeof customerLng === 'number'
  ) {
    const normalizePart = (value) => {
      const rounded = Math.round(value * 10000) / 10000;
      return String(rounded).replace(/\./g, '_').replace(/-/g, 'm');
    };
    const cacheKey = `${normalizePart(cafeLat)}_${normalizePart(cafeLng)}_${normalizePart(customerLat)}_${normalizePart(customerLng)}`;
    const routeCachePayload = {
      cached_at: now,
      expires_at: now + (7 * 24 * 60 * 60 * 1000),
      polyline
    };
    if (typeof distance === 'number' && Number.isFinite(distance)) routeCachePayload.distance = distance;
    if (typeof duration === 'number' && Number.isFinite(duration)) routeCachePayload.duration = duration;
    await db.ref(`route_cache/${cacheKey}`).update(routeCachePayload);
  }

  return true;
}

export async function syncActiveOrderLocation({
  orderId,
  deliveryPartnerId,
  latitude,
  longitude,
  status = 'on_the_way'
}) {
  const db = getFirebaseRealtimeDb();
  if (!db || !orderId) return false;
  if (shouldSkipWrite(writeThrottle.activeOrderLocation, orderId, status)) {
    return true;
  }

  const orderRef = db.ref(`active_orders/${orderId}`);
  const now = Date.now();
  const createdAt = activeOrderCreatedAtCache.get(orderId) || now;
  activeOrderCreatedAtCache.set(orderId, createdAt);

  const payload = {
    status,
    created_at: createdAt,
    last_updated: now
  };

  if (deliveryPartnerId) payload.boy_id = deliveryPartnerId;
  if (typeof latitude === 'number') payload.boy_lat = latitude;
  if (typeof longitude === 'number') payload.boy_lng = longitude;

  await orderRef.update(payload);
  return true;
}

export async function removeActiveOrderRealtime(orderId) {
  const db = getFirebaseRealtimeDb();
  if (!db || !orderId) return false;
  await db.ref(`active_orders/${orderId}`).remove();
  activeOrderCreatedAtCache.delete(orderId);
  writeThrottle.activeOrderLocation.delete(orderId);
  writeThrottle.activeOrderRoute.delete(orderId);
  readCache.activeOrder.delete(orderId);
  return true;
}

export async function syncUserLocationRealtime({
  userId,
  latitude,
  longitude,
  address,
  area,
  city,
  state,
  formattedAddress,
  accuracy,
  lastUpdated
}) {
  const db = getFirebaseRealtimeDb();
  if (!db || !userId) return false;
  if (shouldSkipWrite(writeThrottle.userLocation, userId, 'updated')) {
    return true;
  }

  const payload = {
    last_updated: typeof lastUpdated === 'number' ? lastUpdated : Date.now()
  };

  if (typeof latitude === 'number' && Number.isFinite(latitude)) payload.lat = latitude;
  if (typeof longitude === 'number' && Number.isFinite(longitude)) payload.lng = longitude;
  if (address) payload.address = address;
  if (area) payload.area = area;
  if (city) payload.city = city;
  if (state) payload.state = state;
  if (formattedAddress) payload.formatted_address = formattedAddress;
  if (typeof accuracy === 'number' && Number.isFinite(accuracy)) payload.accuracy = accuracy;

  await db.ref(`users/${userId}`).update(payload);
  return true;
}

export async function syncCafeLocationRealtime({
  cafeId,
  latitude,
  longitude,
  address,
  area,
  city,
  state,
  formattedAddress
}) {
  const db = getFirebaseRealtimeDb();
  if (!db || !cafeId) return false;
  if (shouldSkipWrite(writeThrottle.cafeLocation, cafeId, 'updated')) {
    return true;
  }

  const payload = {
    last_updated: Date.now()
  };

  if (typeof latitude === 'number' && Number.isFinite(latitude)) payload.lat = latitude;
  if (typeof longitude === 'number' && Number.isFinite(longitude)) payload.lng = longitude;
  if (address) payload.address = address;
  if (area) payload.area = area;
  if (city) payload.city = city;
  if (state) payload.state = state;
  if (formattedAddress) payload.formatted_address = formattedAddress;

  await db.ref(`cafes/${cafeId}`).update(payload);
  return true;
}

export async function getActiveOrderLocationRealtime(orderId) {
  const db = getFirebaseRealtimeDb();
  if (!db || !orderId) return null;

  const cached = readCache.activeOrder.get(orderId);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < FIREBASE_READ_INTERVAL_MS) {
    return cached.value;
  }

  const snapshot = await db.ref(`active_orders/${orderId}`).once('value');
  const value = snapshot.val() || null;
  readCache.activeOrder.set(orderId, { value, timestamp: now });
  return value;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function findNearestOnlineDeliveryPartner(cafeLat, cafeLng, maxAgeMs = 120000) {
  const db = getFirebaseRealtimeDb();
  if (!db) return null;

  const snapshot = await db.ref('delivery_boys').once('value');
  const boys = snapshot.val() || {};
  let nearest = null;

  for (const [id, boy] of Object.entries(boys)) {
    if (boy?.status !== 'online') continue;
    if (typeof boy?.lat !== 'number' || typeof boy?.lng !== 'number') continue;

    const staleness = Date.now() - (boy.last_updated || 0);
    if (staleness > maxAgeMs) continue;

    const distanceKm = haversineKm(cafeLat, cafeLng, boy.lat, boy.lng);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { deliveryPartnerId: id, distanceKm, lat: boy.lat, lng: boy.lng };
    }
  }

  return nearest;
}
