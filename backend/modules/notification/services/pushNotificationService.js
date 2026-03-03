import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import User from '../../auth/models/User.js';
import Delivery from '../../delivery/models/Delivery.js';
import { getFirebaseCredentials } from '../../../shared/utils/envService.js';

function normalizePrivateKey(privateKey) {
  if (!privateKey || typeof privateKey !== 'string') return privateKey;
  return privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
}

function dedupeTokens(tokens = []) {
  const seen = new Set();
  return tokens
    .map((token) => (typeof token === 'string' ? token.trim() : ''))
    .filter((token) => token && !seen.has(token) && seen.add(token));
}

function stringifyData(data = {}) {
  return Object.fromEntries(
    Object.entries(data || {}).map(([k, v]) => [String(k), String(v ?? '')])
  );
}

function buildPushPayload({ title, body, data = {} }) {
  const safeData = stringifyData(data);
  const link = safeData.link || process.env.PUSH_DEFAULT_LINK || 'http://localhost:5173/';

  return {
    notification: { title, body },
    data: safeData,
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        title,
        body,
        icon: '/bunburst-icon.png'
      },
      fcmOptions: {
        link
      }
    }
  };
}

function extractInvalidTokens(tokens = [], response) {
  const invalidCodes = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument'
  ]);

  const invalid = [];
  response?.responses?.forEach((result, index) => {
    const code = result?.error?.code;
    if (result?.success === false && invalidCodes.has(code)) {
      invalid.push(tokens[index]);
    }
  });
  return dedupeTokens(invalid);
}

async function removeInvalidTokensFromDatabase(invalidTokens = []) {
  if (!invalidTokens.length) return;

  await Promise.all([
    User.updateMany(
      { fcmTokenWeb: { $in: invalidTokens } },
      { $unset: { fcmTokenWeb: '' } }
    ),
    User.updateMany(
      { fcmTokenMobile: { $in: invalidTokens } },
      { $unset: { fcmTokenMobile: '' } }
    ),
    Delivery.updateMany(
      { fcmTokenWeb: { $in: invalidTokens } },
      { $unset: { fcmTokenWeb: '' } }
    ),
    Delivery.updateMany(
      { fcmTokenMobile: { $in: invalidTokens } },
      { $unset: { fcmTokenMobile: '' } }
    )
  ]);
}

async function tryInitializeFirebaseFromEnvOrFile() {
  if (admin.apps.length > 0) return true;

  const credentials = await getFirebaseCredentials();
  let projectId = credentials.projectId || process.env.FIREBASE_PROJECT_ID;
  let clientEmail = credentials.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = normalizePrivateKey(credentials.privateKey || process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    const candidates = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        : null,
      path.resolve(process.cwd(), 'config', 'firebase-service-account.json'),
      path.resolve(process.cwd(), 'config', 'zomato-607fa-firebase-adminsdk-fbsvc-f5f782c2cc.json'),
      path.resolve(process.cwd(), 'firebaseconfig.json')
    ].filter(Boolean);

    for (const candidatePath of candidates) {
      try {
        if (!fs.existsSync(candidatePath)) continue;
        const raw = fs.readFileSync(candidatePath, 'utf-8');
        const json = JSON.parse(raw);
        projectId = projectId || json.project_id;
        clientEmail = clientEmail || json.client_email;
        privateKey = privateKey || normalizePrivateKey(json.private_key);
        if (projectId && clientEmail && privateKey) break;
      } catch {
        // Continue trying next candidate file.
      }
    }
  }

  if (!projectId || !clientEmail || !privateKey) return false;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
  return true;
}

export async function ensureFirebaseMessagingReady() {
  try {
    if (admin.apps.length > 0) return true;
    return await tryInitializeFirebaseFromEnvOrFile();
  } catch (error) {
    if (error?.code === 'app/duplicate-app') return true;
    return false;
  }
}

export async function sendPushNotificationToAudience({
  audience,
  title,
  body,
  data = {}
}) {
  const isReady = await ensureFirebaseMessagingReady();
  if (!isReady) {
    return {
      success: false,
      message: 'Firebase Admin is not configured for messaging.',
      sentCount: 0,
      totalTokens: 0,
      failedTokens: []
    };
  }

  let docs = [];
  if (audience === 'delivery') {
    docs = await Delivery.find({}, { fcmTokenWeb: 1, fcmTokenMobile: 1 }).lean();
  } else {
    docs = await User.find({ role: 'user' }, { fcmTokenWeb: 1, fcmTokenMobile: 1 }).lean();
  }

  const allTokens = dedupeTokens(
    docs.flatMap((doc) => [doc.fcmTokenWeb, doc.fcmTokenMobile])
  );

  console.log('[Push] Audience:', audience, 'Total docs:', docs.length, 'Unique tokens:', allTokens.length);

  if (allTokens.length === 0) {
    return {
      success: true,
      message: `No ${audience} FCM tokens found.`,
      sentCount: 0,
      totalTokens: 0,
      failedTokens: []
    };
  }

  const message = {
    tokens: allTokens,
    ...buildPushPayload({ title, body, data })
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log('[Push] Multicast result:', {
    successCount: response.successCount,
    failureCount: response.failureCount
  });

  const failedTokens = [];
  response.responses.forEach((r, i) => {
    if (!r.success) failedTokens.push(allTokens[i]);
  });

  const invalidTokens = extractInvalidTokens(allTokens, response);
  if (invalidTokens.length > 0) {
    await removeInvalidTokensFromDatabase(invalidTokens);
    console.log('[Push] Removed invalid tokens from DB:', invalidTokens.length);
  }

  return {
    success: response.successCount > 0,
    sentCount: response.successCount,
    failedCount: response.failureCount,
    totalTokens: allTokens.length,
    failedTokens,
    invalidTokensRemoved: invalidTokens.length
  };
}

export async function sendPushNotificationToSingleToken({
  token,
  title,
  body,
  data = {}
}) {
  const isReady = await ensureFirebaseMessagingReady();
  if (!isReady) {
    return {
      success: false,
      message: 'Firebase Admin is not configured for messaging.'
    };
  }

  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) {
    return {
      success: false,
      message: 'Valid token is required'
    };
  }

  const response = await admin.messaging().send({
    token: cleanToken,
    ...buildPushPayload({ title, body, data })
  });

  console.log('[Push] Single token notification sent:', {
    tokenPreview: `${cleanToken.slice(0, 12)}...`,
    responseId: response
  });

  return {
    success: true,
    responseId: response
  };
}
