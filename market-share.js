/* Afrishine Marketplace - product share page (api/market-share.js)
   WhatsApp, Facebook, Telegram etc. read this page to build the link preview, so the preview shows
   the PRODUCT photo, title and price. People who tap the link are sent straight to the product. */
const SITE = 'https://afrishinegithubio.vercel.app';
const PROJECT_ID = 'afrishine-hub';
const API_KEY = 'AIzaSyBnrdoguyhUd_E3I5RHqcQxHNVLa6kIMX4';   // same public web key used in app.js
const FALLBACK_IMAGE = SITE + '/og-image.jpg';

function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function str(f, k) { return f && f[k] && f[k].stringValue ? String(f[k].stringValue) : ''; }
function money(raw) {
  var t = String(raw == null ? '' : raw).trim(); if (!t) return '';
  var fmt = function (n) { return new Intl.NumberFormat('en-US').format(n); };
  var m = t.match(/^(?:FRW|RWF)\s*([\d.,]+)$/i); if (m && Number(m[1].replace(/,/g, ''))) return fmt(Number(m[1].replace(/,/g, ''))) + ' Frw';
  var u = t.match(/^\$\s*([\d.,]+)$/); if (u && Number(u[1].replace(/,/g, ''))) return '$' + fmt(Number(u[1].replace(/,/g, '')));
  return /^[\d.,]+$/.test(t) && Number(t.replace(/,/g, '')) ? fmt(Number(t.replace(/,/g, ''))) + ' Frw' : t;
}
function firstImage(f) {
  var lists = [f && f.images, f && f.imageUrls];
  for (var i = 0; i < lists.length; i++) {
    var vals = lists[i] && lists[i].arrayValue && lists[i].arrayValue.values;
    if (vals && vals.length && vals[0].stringValue) return vals[0].stringValue;
  }
  return str(f, 'imageUrl');
}
async function loadProduct(id) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/marketplacePosts/' + encodeURIComponent(id) + '?key=' + API_KEY;
  var r = await fetch(url);
  if (!r.ok) return null;
  var doc = await r.json(), f = doc.fields || {};
  if (str(f, 'status') === 'deleted') return null;
  var title = (str(f, 'title') || str(f, 'text').split(/[\n.!?]/)[0] || 'Product').trim().slice(0, 90);
  var parts = [money(str(f, 'price')), str(f, 'condition'), str(f, 'location').trim()].filter(Boolean);
  var desc = (str(f, 'description') || str(f, 'text')).replace(/\s+/g, ' ').trim().slice(0, 160);
  return { title: title, price: money(str(f, 'price')), line: parts.join(' · '), desc: desc, image: firstImage(f) };
}

module.exports = async function handler(req, res) {
  var id = String((req.query && req.query.id) || '').trim();
  var target = SITE + '/marketplace' + (/^[A-Za-z0-9_-]{4,64}$/.test(id) ? '?product=' + encodeURIComponent(id) : '');
  var p = null;
  if (/^[A-Za-z0-9_-]{4,64}$/.test(id)) { try { p = await loadProduct(id); } catch (e) { p = null; } }

  var title = p ? p.title + (p.price ? ' — ' + p.price : '') : 'Afrishine Marketplace';
  var desc = p ? (p.line + (p.desc ? '. ' + p.desc : '')) : 'Buy and sell on Afrishine Hub. Discover products from sellers across Rwanda.';
  var image = (p && p.image) || FALLBACK_IMAGE;
  var shareUrl = SITE + '/api/market-share?id=' + encodeURIComponent(id);

  var html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + ' · Afrishine Hub</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Afrishine Marketplace">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="' + esc(image) + '"><meta property="og:image:alt" content="' + esc(p ? p.title : 'Afrishine Hub') + '">' +
    '<meta property="og:url" content="' + esc(shareUrl) + '">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + esc(image) + '">' +
    '<meta http-equiv="refresh" content="0;url=' + esc(target) + '">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080a10;color:#fff;font-family:system-ui,Arial,sans-serif;text-align:center}a{color:#ffb91f}</style></head>' +
    '<body><p>Opening Afrishine Marketplace… <br><a href="' + esc(target) + '">Tap here if it does not open</a></p>' +
    '<script>location.replace(' + JSON.stringify(target).replace(/</g, '\\u003c') + ');</script></body></html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', p ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=60');
  res.status(200).send(html);
};
