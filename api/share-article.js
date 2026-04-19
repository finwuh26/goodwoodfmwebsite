import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_OG_DESCRIPTION_LENGTH = 280;

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim();
const truncateAtWordBoundary = (value = '', maxLength = MAX_OG_DESCRIPTION_LENGTH) => {
  if (value.length <= maxLength) {
    return value;
  }
  const truncated = value.slice(0, maxLength + 1);
  const boundaryIndex = truncated.lastIndexOf(' ');
  const safeTruncation = boundaryIndex > 0 ? truncated.slice(0, boundaryIndex) : value.slice(0, maxLength);
  return `${safeTruncation}…`;
};

const stripMarkdown = (value = '') =>
  normalizeWhitespace(
    value
      .replace(/!\[[^\]]*]\([^)]+\)/g, '')
      .replace(/\[[^\]]+]\(([^)]+)\)/g, '$1')
      .replace(/[`*_>#~-]/g, '')
  );

const getString = (fields, key) => fields?.[key]?.stringValue || '';

const buildOrigin = (req) => {
  const host = req.headers.host || 'localhost:3000';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
};

const resolveImageUrl = (origin, imageUrl) => {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return '';
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  return `${origin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
};

const getFirestoreDocument = async (articleId) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
  const configRaw = await readFile(configPath, 'utf8');
  const config = JSON.parse(configRaw);

  const envDatabaseId = (
    process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || ''
  ).trim();
  const configDatabaseId = (config.firestoreDatabaseId || '').trim();
  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';
  const bypassAiStudio = isProduction && !envDatabaseId && /^ai-studio-/i.test(configDatabaseId);
  const databaseId = bypassAiStudio ? '(default)' : (envDatabaseId || configDatabaseId || '(default)');

  const encodedArticleId = encodeURIComponent(articleId);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(databaseId)}/documents/articles/${encodedArticleId}?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Firestore request failed (${response.status})`);
  }

  const data = await response.json();
  return data?.fields ? data : null;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const articleIdParam = Array.isArray(req.query?.id)
    ? req.query.id.find((idPart) => typeof idPart === 'string')
    : req.query?.id;
  const articleId = typeof articleIdParam === 'string' ? articleIdParam.trim() : '';
  const origin = buildOrigin(req);
  const fallbackTarget = `${origin}/#/content`;

  if (!articleId) {
    return res.redirect(302, fallbackTarget);
  }

  try {
    const document = await getFirestoreDocument(articleId);
    const fields = document?.fields || {};
    const status = getString(fields, 'status');

    if (!document || status !== 'published') {
      return res.redirect(302, fallbackTarget);
    }

    const title = normalizeWhitespace(getString(fields, 'title')) || 'Goodwood FM Article';
    const summary = normalizeWhitespace(getString(fields, 'summary'));
    const content = stripMarkdown(getString(fields, 'content'));
    const description = truncateAtWordBoundary(summary || content || 'Read this article on Goodwood FM.');
    const image = resolveImageUrl(origin, getString(fields, 'image'));
    const canonicalUrl = `${origin}/share/article/${encodeURIComponent(articleId)}`;
    const redirectTarget = `${origin}/#/article/${encodeURIComponent(articleId)}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} | Goodwood FM</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Goodwood FM" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectTarget)}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(redirectTarget)});</script>
  <p>Redirecting to <a href="${escapeHtml(redirectTarget)}">article</a>…</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('share-article error', error);
    return res.redirect(302, fallbackTarget);
  }
}
