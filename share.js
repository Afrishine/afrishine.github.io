// =============================================================================
// AFRISHINE HUB - SHARE PREVIEW FUNCTION (Vercel Serverless Function)
//
// Share links look like  https://afrishinegithubio.vercel.app/share/posts/POST_ID
// (see vercel.json). WhatsApp, Facebook, Telegram and other apps read the
// Open Graph tags returned here, so every video / post shows ITS OWN thumbnail,
// title and description. People who open the link are sent straight to that
// post inside Afrishine Hub (deep link).
//
// Only public data is read (Firestore rules already allow public reads of
// "posts" and "marketplacePosts"). Private posts get the generic preview.
// =============================================================================

const PROJECT_ID = 'afrishine-hub';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBnrdoguyhUd_E3I5RHqcQxHNVLa6kIMX4'; // public web key (same as index.html)
const SITE = (process.env.SITE_URL || 'https://afrishinegithubio.vercel.app').replace(/\/$/, '');
const WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
const DEFAULT_IMAGE = SITE + '/og-image.png';
const DEFAULT_TITLE = 'Afrishine Hub';
const DEFAULT_DESC = 'Your Hub, Your Solutions. Discover talent, connect, learn, shop and explore opportunities.';
const COLLECTIONS = { posts: 'posts', marketplacePosts: 'marketplacePosts', market: 'marketplacePosts', love_posts: 'love_posts' };

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (v, n) => { const t = String(v || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const workerUrl = (u) => (typeof u === 'string' && u.indexOf(WORKER + '/media/') === 0 ? u : '');
const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : '');

function field(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(field);
  return undefined;
}
const decode = (doc) => Object.fromEntries(Object.entries((doc && doc.fields) || {}).map(([k, v]) => [k, field(v)]));

async function loadDoc(collection, id) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}?key=${API_KEY}`, { signal: ctl.signal });
    if (!r.ok) return null;
    return decode(await r.json());
  } catch (_) { return null; } finally { clearTimeout(timer); }
}

function describe(kind, p) {
  const author = clip(p.authorName || 'a member', 40);
  if (kind === 'marketplacePosts') {
    const price = p.price ? String(p.price) : '';
    return {
      title: clip(p.title || p.text || 'Marketplace listing', 80),
      description: clip([price, p.location, p.description || p.text].filter(Boolean).join(' · '), 200) || DEFAULT_DESC,
      image: httpsUrl((p.images || [])[0]) || httpsUrl((p.imageUrls || [])[0]) || DEFAULT_IMAGE,
      type: 'article'
    };
  }
  if (p.visibility === 'private') return null;
  if (p.type === 'link') {
    const yt = p.linkProvider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(p.linkId || '') ? `https://i.ytimg.com/vi/${p.linkId}/hqdefault.jpg` : '';
    return {
      title: clip(p.linkTitle || `Video shared by ${author}`, 90),
      description: clip(p.text || `Watch this ${p.linkProvider === 'tiktok' ? 'TikTok' : 'YouTube'} video on Afrishine Hub.`, 200),
      image: httpsUrl(p.linkThumb) || yt || DEFAULT_IMAGE, type: 'video.other'
    };
  }
  if (p.type === 'video') {
    return {
      title: clip(p.title || p.text || `Video by ${author}`, 90),
      description: clip(p.text || `Watch ${author}'s video on Afrishine Hub.`, 200),
      image: workerUrl(p.thumbUrl) || DEFAULT_IMAGE, type: 'video.other'
    };
  }
  if (p.type === 'image') {
    return {
      title: clip(p.title || p.text || `Photo by ${author}`, 90),
      description: clip(p.text || `See ${author}'s photo on Afrishine Hub.`, 200),
      image: workerUrl(p.thumbUrl) || workerUrl(p.mediaUrl) || DEFAULT_IMAGE, type: 'article'
    };
  }
  return {
    title: clip(p.text || `Post by ${author}`, 90),
    description: clip(p.text || `A post by ${author} on Afrishine Hub.`, 200),
    image: DEFAULT_IMAGE, type: 'article'
  };
}

function page(meta, shareUrl, appUrl) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)} · Afrishine Hub</title>
<meta name="description" content="${esc(meta.description)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${esc(shareUrl)}">
<meta property="og:site_name" content="Afrishine Hub">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:image" content="${esc(meta.image)}">
<meta property="og:image:alt" content="${esc(meta.title)}">
<meta property="og:url" content="${esc(shareUrl)}">
<meta property="og:type" content="${esc(meta.type)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${esc(meta.image)}">
<meta name="theme-color" content="#080a10">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080a10;color:#fff;font-family:system-ui,sans-serif;text-align:center}a{color:#ffb91f;font-weight:700}</style>
</head><body>
<p>Opening Afrishine Hub…<br><a href="${esc(appUrl)}">Tap here if nothing happens</a></p>
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body></html>`;
}

module.exports = async (req, res) => {
  const kind = String((req.query && req.query.kind) || 'posts');
  const id = String((req.query && req.query.id) || '');
  const collection = COLLECTIONS[kind];
  const valid = collection && /^[A-Za-z0-9_-]{6,64}$/.test(id);

  let meta = null;
  if (valid && collection !== 'love_posts') { // Love Connection posts are not public: generic preview only
    const data = await loadDoc(collection, id);
    if (data) meta = describe(collection, data);
  }
  const generic = { title: DEFAULT_TITLE, description: DEFAULT_DESC, image: DEFAULT_IMAGE, type: 'website' };
  const shareUrl = valid ? `${SITE}/share/${kind}/${id}` : SITE + '/';
  const appUrl = valid ? `/?post=${encodeURIComponent(id)}&kind=${encodeURIComponent(collection)}` : '/';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(page(meta || generic, shareUrl, appUrl));
};
module.exports.describe = describe;
