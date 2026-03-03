import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { initializeFirebaseRealtime, getFirebaseRealtimeDb } from '../config/firebaseRealtime.js';

dotenv.config();

function resolveInputPath() {
  const argPath = process.argv[2];
  if (!argPath) {
    throw new Error('Missing input json path. Usage: node scripts/seedRealtimeDb.js "<path-to-export.json>"');
  }
  return path.isAbsolute(argPath) ? argPath : path.resolve(process.cwd(), argPath);
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function seed() {
  const inputPath = resolveInputPath();
  const payload = loadJson(inputPath);

  initializeFirebaseRealtime();
  const db = getFirebaseRealtimeDb();
  if (!db) {
    throw new Error('Firebase Realtime DB not initialized. Check FIREBASE_* env vars/service account path.');
  }

  const allowedTopLevel = ['active_orders', 'delivery_boys', 'drivers', 'route_cache', 'users'];
  const updatePayload = {};
  for (const key of allowedTopLevel) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      updatePayload[key] = payload[key];
    }
  }

  if (!Object.keys(updatePayload).length) {
    throw new Error(`No supported keys found in json. Expected any of: ${allowedTopLevel.join(', ')}`);
  }

  await db.ref('/').update(updatePayload);
  console.log(`Seed complete from ${inputPath}`);
  console.log(`Updated keys: ${Object.keys(updatePayload).join(', ')}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
