import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTICLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const ALLOWED_EDITOR_ROLES = new Set(['admin', 'manager', 'owner']);
const FALLBACK_FIRESTORE_DATABASE_ID = 'radio';

const getStringField = (fields, key) => fields?.[key]?.stringValue || '';
const sanitizeLine = (value, fallback) => {
  const normalized = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
};

const createHttpError = (status, message) => Object.assign(new Error(message), { status });

const parseRequestBody = (body) => {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      throw createHttpError(400, 'Invalid JSON body');
    }
  }
  return body;
};

const getBearerToken = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') return '';
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const buildOrigin = (req) => {
  const host = req.headers.host || 'localhost:3000';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
};

const resolveDatabaseId = (config) => {
  const envDatabaseId = (process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || '').trim();
  const configDatabaseId = (config.firestoreDatabaseId || '').trim();
  const selectedDatabaseId = envDatabaseId || configDatabaseId || FALLBACK_FIRESTORE_DATABASE_ID;

  if (/^ai-studio-/i.test(selectedDatabaseId)) {
    console.warn(
      `Ignoring AI Studio Firestore database ID "${selectedDatabaseId}" and using "${FALLBACK_FIRESTORE_DATABASE_ID}" instead.`
    );
    return FALLBACK_FIRESTORE_DATABASE_ID;
  }

  return selectedDatabaseId;
};

const loadFirebaseConfig = async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
  const configRaw = await readFile(configPath, 'utf8');
  const config = JSON.parse(configRaw);
  if (!config?.apiKey || !config?.projectId) {
    throw createHttpError(500, 'Firebase configuration is incomplete');
  }
  return config;
};

const lookupFirebaseUser = async (apiKey, idToken) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) {
    throw createHttpError(401, 'Invalid or expired authentication token');
  }

  const data = await response.json();
  const user = Array.isArray(data?.users) ? data.users[0] : null;
  if (!user?.localId) {
    throw createHttpError(401, 'Invalid authentication context');
  }
  return user;
};

const getFirestoreDocument = async (config, databaseId, documentPath) => {
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(databaseId)}/documents/${documentPath}?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw createHttpError(502, `Failed to read Firestore document (${response.status})`);
  }

  const data = await response.json();
  return data?.fields ? data : null;
};

const postDiscordWebhook = async (webhookUrl, content) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    throw createHttpError(502, `Discord webhook request failed (${response.status})`);
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookUrl = (process.env.DISCORD_ARTICLE_WEBHOOK_URL || '').trim();
    if (!/^https:\/\/discord\.com\/api\/webhooks\/.+/i.test(webhookUrl)) {
      throw createHttpError(500, 'Webhook is not configured');
    }

    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      throw createHttpError(401, 'Missing authorization token');
    }

    const body = parseRequestBody(req.body);
    const articleId = typeof body?.articleId === 'string' ? body.articleId.trim() : '';
    if (!ARTICLE_ID_PATTERN.test(articleId)) {
      throw createHttpError(400, 'Invalid articleId');
    }

    const firebaseConfig = await loadFirebaseConfig();
    const databaseId = resolveDatabaseId(firebaseConfig);

    const tokenUser = await lookupFirebaseUser(firebaseConfig.apiKey, token);
    const userDocumentPath = `users/${encodeURIComponent(tokenUser.localId)}`;
    const userDoc = await getFirestoreDocument(firebaseConfig, databaseId, userDocumentPath);
    const role = getStringField(userDoc?.fields, 'role');
    if (!ALLOWED_EDITOR_ROLES.has(role)) {
      throw createHttpError(403, 'Insufficient permissions');
    }

    const articleDocumentPath = `articles/${encodeURIComponent(articleId)}`;
    const articleDoc = await getFirestoreDocument(firebaseConfig, databaseId, articleDocumentPath);
    if (!articleDoc?.fields) {
      throw createHttpError(404, 'Article not found');
    }

    const articleStatus = getStringField(articleDoc.fields, 'status');
    if (articleStatus !== 'published') {
      throw createHttpError(409, 'Article must be published before notifying');
    }

    const title = sanitizeLine(getStringField(articleDoc.fields, 'title'), 'Untitled');
    const author = sanitizeLine(getStringField(articleDoc.fields, 'authorName'), 'Unknown');
    const articleLink = `${buildOrigin(req)}/share/article/${encodeURIComponent(articleId)}`;
    const content = `**NEW ARTICLE**\nTile: ${title}\nAuthor: ${author}\nLink: ${articleLink}`;

    await postDiscordWebhook(webhookUrl, content);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const message = status >= 500 ? 'Unable to send article notification' : error.message;
    console.error('notify-article-published error', error);
    return res.status(status).json({ error: message });
  }
}
