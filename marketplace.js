/* Afrishine Marketplace (marketplace.js)
   Public browsing, Google-authenticated selling, product cards, saved items,
   product details with seller reviews (stars), comments, report, share and delete-own-product.
   Loads AFTER app.js / love.js / feed.js / auth.js / app-features.js and BEFORE app-extras.js. */
(function () {
'use strict';

/* ---------- settings ---------- */
var SITE = 'https://afrishinegithubio.vercel.app';            // used for product share links
var marketWorker = 'https://afrishine-media.usherluckyelie.workers.dev';
var SAVED_KEY = 'afrishine_market_saved_v1', REPORTED_KEY = 'afrishine_market_reported_v1';

/* ---------- state ---------- */
var marketProducts = [], marketSavedIds = [], reportedIds = [];
var marketDetailId = null, detailToken = 0, detailTab = 'reviews', rateValue = 0;
var detailData = { reviews: [], comments: [], seller: null, reviewsError: false, commentsError: false };
var marketCondition = 'all', marketLoadedAt = 0, marketLoadPromise = null;
try { marketSavedIds = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (e) { marketSavedIds = []; }
try { reportedIds = JSON.parse(localStorage.getItem(REPORTED_KEY) || '[]'); } catch (e) { reportedIds = []; }

/* ---------- small helpers ---------- */
function $(id) { return document.getElementById(id); }
function mEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function mUser() { return window.currentFirebaseUser || currentFirebaseUser || null; }
function mDb() { return window.db || db || null; }
function mNotice(t) { if (typeof notice === 'function') notice(t); else alert(t); }
function mLogin() { pendingMarketplaceLogin = true; var el = $('marketLoginModal'); if (el) el.classList.add('open'); }
function mRequireLogin() { if (!mUser() || !isGoogleMarketplaceUser(mUser())) { mLogin(); return false; } return true; }
function mStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }
function mServerTime() { return firebase.firestore.FieldValue.serverTimestamp(); }
function mIsMine(p) { var u = mUser(); return !!(u && p && p.uid === u.uid); }
function mErr(e) { return (typeof firebaseErrorMessage === 'function') ? firebaseErrorMessage(e) : 'Something went wrong. Please try again.'; }
function mDate(ts) {
  try {
    var d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    if (!d) return '';
    var s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 2592000) return Math.floor(s / 86400) + ' d ago';
    return d.toLocaleDateString();
  } catch (e) { return ''; }
}
function mStars(n) { var r = Math.max(0, Math.min(5, Math.round(n || 0))); return '<span class="mk-stars" role="img" aria-label="' + r + ' out of 5 stars">' + '★'.repeat(r) + '<span class="off">' + '★'.repeat(5 - r) + '</span></span>'; }

/* ---------- product data helpers ---------- */
function mIsProduct(p) { return !!p && p.status !== 'deleted' && (p.product === true || Array.isArray(p.images) || p.type === 'sell'); }
function mImages(p) {
  var list = (Array.isArray(p.images) && p.images.length) ? p.images : ((Array.isArray(p.imageUrls) && p.imageUrls.length) ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []));
  return list.filter(Boolean);
}
function mImage(p) { return mImages(p)[0] || ''; }
function mTitle(p) { return String(p.title || String(p.text || '').split(/[\n.!?]/)[0] || 'Product').trim().slice(0, 90); }
function mLoc(p) { var l = String(p.location || '').trim(); if (!l) return 'Rwanda'; return /rwanda/i.test(l) ? l : 'Rwanda, ' + l; }
function mSeller(p) { return (typeof marketplacePublicName === 'function') ? marketplacePublicName(p.authorName) : (p.authorName || 'Afrishine Seller'); }
function mPrice(p) {
  var raw = p.price, f = function (n) { return new Intl.NumberFormat('en-US').format(n); };
  if (typeof raw === 'string' && raw.trim()) {
    var t = raw.trim(), m = t.match(/^(?:FRW|RWF)\s*([\d.,]+)$/i);
    if (m && Number(m[1].replace(/,/g, ''))) return f(Number(m[1].replace(/,/g, ''))) + ' Frw';
    var u = t.match(/^\$\s*([\d.,]+)$/);
    if (u && Number(u[1].replace(/,/g, ''))) return '$' + f(Number(u[1].replace(/,/g, '')));
    return t;
  }
  var n = Number(raw);
  return n ? f(n) + ' Frw' : 'Price on request';
}
function findProduct(id) { for (var i = 0; i < marketProducts.length; i++) if (marketProducts[i].id === id) return marketProducts[i]; return null; }
function removeLocal(id) { marketProducts = marketProducts.filter(function (x) { return x.id !== id; }); var i = marketSavedIds.indexOf(id); if (i >= 0) { marketSavedIds.splice(i, 1); mStore(SAVED_KEY, marketSavedIds); } }

/* ---------- product cards ---------- */
var SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>';
function mCard(p) {
  var id = mEsc(p.id), img = mEsc(mImage(p)), saved = marketSavedIds.indexOf(p.id) >= 0, title = mEsc(mTitle(p));
  return '<article class="market-product-card">' +
    '<div class="market-product-image" data-mk-open="' + id + '">' +
      (img ? '<img src="' + img + '" alt="' + title + '" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<div style="display:grid;place-items:center;height:100%;font-size:42px">🛍️</div>') +
      '<span class="market-condition">' + mEsc(p.condition || 'New') + '</span>' +
      '<div class="mk-card-actions">' +
        '<button type="button" class="market-save ' + (saved ? 'saved' : '') + '" data-mk-save="' + id + '" aria-label="' + (saved ? 'Remove from saved' : 'Save product') + '">' + (saved ? '♥' : '♡') + '</button>' +
        '<button type="button" class="market-save mk-share" data-mk-share="' + id + '" aria-label="Share product">' + SHARE_ICON + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="market-product-info">' +
      '<strong class="market-product-price">' + mEsc(mPrice(p)) + '</strong>' +
      '<div class="market-product-title">' + title + '</div>' +
      '<div class="market-product-location">📍 ' + mEsc(mLoc(p)) + '</div>' +
      '<button type="button" class="market-open-product" data-mk-open="' + id + '">View Product →</button>' +
    '</div></article>';
}
function bindGrid(el) {
  if (!el || el.dataset.mkBound) return;
  el.dataset.mkBound = '1';
  el.addEventListener('click', function (e) {
    var s = e.target.closest('[data-mk-save]'); if (s) { e.stopPropagation(); marketToggleSaved(s.getAttribute('data-mk-save')); return; }
    var sh = e.target.closest('[data-mk-share]'); if (sh) { e.stopPropagation(); mShare(sh.getAttribute('data-mk-share')); return; }
    var o = e.target.closest('[data-mk-open]'); if (o) marketOpenDetails(o.getAttribute('data-mk-open'));
  });
}

/* ---------- navigation ---------- */
function updateLock() { var open = document.querySelector('.market-modal.open'); document.body.classList.toggle('mk-lock', !!open); }
window.canViewMarketplace = function () { return true; };
window.enterMarketplace = function () { showPage('shop'); document.body.classList.add('marketplace-active'); marketShowPanel('home'); };
window.marketGoBack = function () {
  if ($('mkOverlay')) { closeSheet(); return; }
  if ($('marketProductModal').classList.contains('open')) { marketCloseDetails(); return; }
  if ($('marketSellModal').classList.contains('open')) { marketCloseSell(); return; }
  showPage('home'); document.body.classList.remove('marketplace-active');
};
window.marketAddProduct = function (p) { if (p && p.id && !findProduct(p.id)) marketProducts.push(p); };
window.marketSetView = function (v) {
  document.querySelectorAll('.market-filter-row button').forEach(function (x) { x.classList.remove('active'); });
  var target = null;
  if (v === 'all') target = $('marketAllBtn');
  else Array.prototype.forEach.call(document.querySelectorAll('.market-filter-row button'), function (x) { if (x.textContent.trim() === v) target = x; });
  if (target) target.classList.add('active');
  marketRenderProducts(v);
};
function marketShowPanel(which) {
  var map = { home: 'marketplaceFeed', saved: 'marketSavedView', chat: 'marketChatView', profile: 'marketProfileView' };
  Object.keys(map).forEach(function (k) { var e = $(map[k]); if (e) e.style.display = (k === which) ? '' : 'none'; });
  document.querySelectorAll('.market-bottom-nav button').forEach(function (b) { b.classList.remove('active'); });
  var idx = { home: 0, saved: 1, sell: 2, chat: 3, profile: 4 }[which], nav = document.querySelectorAll('.market-bottom-nav button');
  if (nav[idx]) nav[idx].classList.add('active');
}
window.marketBottom = function (which) {
  if (which === 'home') { showPage('home'); document.body.classList.remove('marketplace-active'); return; }
  if (which === 'sell') { marketOpenSell(); return; }
  marketShowPanel(which);
  if (which === 'saved') marketRenderSaved();
  if (which === 'chat') { var c = $('marketChatContent'); if (c) c.innerHTML = mUser() ? '<p class="muted">Your conversations with buyers and sellers are in your Inbox.</p><button class="gold" onclick="showPage(\'inbox\')">Open Inbox →</button>' : '<p class="muted">Sign in with Google to view your conversations.</p><button class="gold" onclick="marketOpenLogin()">Sign in with Google</button>'; }
  if (which === 'profile') { var p = $('marketProfileContent'); if (p) p.innerHTML = mUser() ? '<b>' + mEsc(mUser().displayName || 'Afrishine Member') + '</b><p class="creator-hint">Google account signed in.</p><button class="secondary" onclick="auth.signOut()">Sign Out</button>' : '<p class="muted">You are not signed in.</p><button class="gold" onclick="marketOpenLogin()">Login with Google</button>'; }
};
window.marketOpenLogin = mLogin;
window.marketOpenSell = function () { if (!mRequireLogin()) return; $('marketSellModal').classList.add('open'); updateLock(); };
window.marketCloseSell = function () { $('marketSellModal').classList.remove('open'); updateLock(); };
window.marketCloseDetails = function () { closeSheet(); $('marketProductModal').classList.remove('open'); marketDetailId = null; detailToken++; updateLock(); };

/* ---------- saved items ---------- */
window.marketToggleSaved = function (id) {
  var i = marketSavedIds.indexOf(id);
  if (i >= 0) marketSavedIds.splice(i, 1); else marketSavedIds.push(id);
  mStore(SAVED_KEY, marketSavedIds);
  marketRenderProducts();
  var sv = $('marketSavedView'); if (sv && sv.style.display !== 'none') marketRenderSaved();
  var btn = document.querySelector('#marketProductDetails [data-mk="save"]');
  if (btn && marketDetailId === id) { var on = marketSavedIds.indexOf(id) >= 0; btn.textContent = on ? '♥ Saved' : '♡ Save'; }
};
function marketRenderSaved() {
  var feed = $('marketSavedFeed'); if (!feed) return; bindGrid(feed);
  var list = marketProducts.filter(function (p) { return marketSavedIds.indexOf(p.id) >= 0; });
  feed.innerHTML = list.map(mCard).join('') || '<p class="empty-feed" style="grid-column:1/-1">You have no saved products yet.</p>';
}
window.marketRenderSaved = marketRenderSaved;

/* ---------- product list ---------- */
window.marketRenderProducts = function (condition) {
  var feed = $('marketplaceFeed'); if (!feed) return; bindGrid(feed);
  if (typeof condition === 'string') marketCondition = condition;
  condition = marketCondition;
  var q = (($('marketSearchInput') || {}).value || '').trim().toLowerCase();
  var filtered = marketProducts.filter(function (p) {
    var text = [p.title, p.description, p.text, p.category, p.location].join(' ').toLowerCase();
    return (!q || text.indexOf(q) >= 0) && (!condition || condition === 'all' || (p.condition || '').toLowerCase() === condition.toLowerCase());
  });
  $('marketProductCount').textContent = filtered.length + (filtered.length === 1 ? ' product' : ' products');
  feed.innerHTML = filtered.map(mCard).join('') || '<div class="empty-feed" style="grid-column:1/-1">No products match your search. Try another keyword.</div>';
};
window.marketLoadProducts = function (force) {
  var feed = $('marketplaceFeed'); if (!feed) return Promise.resolve();
  if (marketLoadPromise) return marketLoadPromise;
  if (!force && marketProducts.length && Date.now() - marketLoadedAt < 60000) { marketRenderProducts(); return Promise.resolve(); }
  if (!mDb()) { feed.innerHTML = '<p class="empty-feed">We could not connect to Afrishine Hub services. Please check your connection and reload the page.</p>'; return Promise.resolve(); }
  feed.innerHTML = '<p class="empty-feed" style="grid-column:1/-1">Loading products…</p>';
  marketLoadPromise = (async function () {
    try {
      var snap = await mDb().collection('marketplacePosts').orderBy('createdAt', 'desc').limit(100).get();
      marketProducts = snap.docs.map(function (d) { var p = d.data(); p.id = d.id; return p; }).filter(mIsProduct);
      marketLoadedAt = Date.now(); marketRenderProducts();
    } catch (e) {
      console.error('Marketplace read:', e);
      feed.innerHTML = '<div class="empty-feed" style="grid-column:1/-1">Could not load products. Please check your connection and try again.<br><button class="secondary" style="margin-top:10px" onclick="marketLoadProducts(true)">Try again</button></div>';
    } finally { marketLoadPromise = null; }
  })();
  return marketLoadPromise;
};
window.loadMarketplacePosts = window.marketLoadProducts;   // other files call this name

/* ---------- bottom sheets (report, confirm) ---------- */
function closeSheet() { var o = $('mkOverlay'); if (o && o.parentNode) o.parentNode.removeChild(o); }
function openSheet(html) {
  closeSheet();
  var o = document.createElement('div'); o.id = 'mkOverlay'; o.className = 'mk-overlay';
  o.innerHTML = '<div class="mk-sheet" role="dialog" aria-modal="true">' + html + '</div>';
  o.addEventListener('click', function (e) { if (e.target === o) closeSheet(); });
  document.body.appendChild(o);
  return o;
}
function mConfirm(opt) {
  return new Promise(function (resolve) {
    var o = openSheet('<h3 class="mk-sheet-title">' + mEsc(opt.title) + '</h3><p class="mk-sheet-text">' + mEsc(opt.text) + '</p>' +
      '<div class="mk-sheet-actions"><button type="button" class="secondary" data-c="no">Cancel</button><button type="button" class="' + (opt.danger ? 'mk-danger' : 'gold') + '" data-c="yes">' + mEsc(opt.ok) + '</button></div>');
    var done = false;
    function end(v) { if (done) return; done = true; closeSheet(); resolve(v); }
    o.querySelector('[data-c="no"]').onclick = function () { end(false); };
    o.querySelector('[data-c="yes"]').onclick = function () { end(true); };
    o.addEventListener('click', function (e) { if (e.target === o) end(false); });
  });
}

/* ---------- share ---------- */
async function mShare(id) {
  var p = findProduct(id); if (!p) return;
  var url = SITE + '/share/marketplacePosts/' + encodeURIComponent(id);   // api/share.js builds the preview: product photo, title and price
  var data = { title: mTitle(p) + ' · Afrishine Marketplace', text: mTitle(p) + ' — ' + mPrice(p) + ' · ' + mLoc(p), url: url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); mNotice('Product link copied. You can now share it.'); return; }
    prompt('Copy this link to share the product:', url);
  } catch (e) { if (e && e.name !== 'AbortError') mNotice('Sharing was not completed.'); }
}
window.marketShareProduct = mShare;

/* ---------- product details ---------- */
function fetchProduct(id) {
  if (!mDb()) return Promise.resolve(null);
  return mDb().collection('marketplacePosts').doc(id).get().then(function (snap) {
    if (!snap.exists) return null;
    var p = snap.data(); p.id = snap.id;
    return mIsProduct(p) ? p : null;
  }).catch(function () { return null; });
}
window.marketOpenDetails = function (id) {
  var p = findProduct(id);
  if (!p) { fetchProduct(id).then(function (x) { if (x) { marketAddProduct(x); marketOpenDetails(id); } else mNotice('This product is no longer available.'); }); return; }
  marketDetailId = id; detailTab = 'reviews'; rateValue = 0; detailToken++;
  detailData = { reviews: [], comments: [], seller: null, reviewsError: false, commentsError: false };
  renderDetail(p);
  $('marketProductModal').classList.add('open'); updateLock();
  var panel = document.querySelector('#marketProductModal .market-modal-panel'); if (panel) panel.scrollTop = 0; $('marketProductModal').scrollTop = 0;
  loadDetailExtras(p, detailToken);
};
function renderDetail(p) {
  var imgs = mImages(p), main = imgs[0] || '', mine = mIsMine(p), saved = marketSavedIds.indexOf(p.id) >= 0;
  var thumbs = imgs.length > 1 ? '<div class="market-detail-gallery">' + imgs.map(function (u) { return '<img src="' + mEsc(u) + '" alt="Product photo" data-mk="thumb" data-src="' + mEsc(u) + '">'; }).join('') + '</div>' : '';
  var seller = mSeller(p), initial = mEsc((seller.trim().charAt(0) || 'A').toUpperCase());
  var avatar = p.authorPhoto ? '<span class="mk-avatar"><img src="' + mEsc(p.authorPhoto) + '" alt=""></span>' : '<span class="mk-avatar">' + initial + '</span>';
  var posted = mDate(p.createdAt);
  var html =
    (main ? '<img id="marketDetailMain" class="market-detail-main" src="' + mEsc(main) + '" alt="' + mEsc(mTitle(p)) + '">' : '') + thumbs +
    '<h2 class="market-detail-title">' + mEsc(mTitle(p)) + '</h2>' +
    '<div class="market-detail-price">' + mEsc(mPrice(p)) + '</div>' +
    '<div class="mk-chips"><span class="mk-chip">' + mEsc(p.condition || 'New') + '</span>' + (p.category ? '<span class="mk-chip">' + mEsc(p.category) + '</span>' : '') + '<span class="mk-chip">📍 ' + mEsc(mLoc(p)) + '</span>' + (posted ? '<span class="mk-chip">🕒 ' + mEsc(posted) + '</span>' : '') + '</div>' +
    '<p class="market-detail-description">' + mEsc(p.description || p.text || '') + '</p>' +
    (p.videoUrl ? '<video class="market-detail-video" controls playsinline src="' + mEsc(p.videoUrl) + '"></video>' : '') +
    '<button type="button" class="mk-seller" data-mk="profile">' + avatar +
      '<span class="mk-seller-body"><span class="mk-seller-name">' + mEsc(seller) + '<span id="mkVerified"></span></span>' +
      '<small id="mkSellerRating">Seller on Afrishine Hub</small></span><span class="mk-chevron" aria-hidden="true">›</span></button>' +
    '<div class="mk-actions">' +
      (mine ? '<button type="button" class="secondary" disabled>Your product</button>' : '<button type="button" class="gold" data-mk="chat">✉ Chat to Seller</button>') +
      '<button type="button" class="secondary" data-mk="save">' + (saved ? '♥ Saved' : '♡ Save') + '</button>' +
      '<button type="button" class="secondary mk-icon-btn" data-mk="share" aria-label="Share product">' + SHARE_ICON + '</button>' +
    '</div>' +
    (mine ? '<button type="button" class="mk-danger mk-delete" data-mk="delete">🗑 Delete this product</button>' : '') +
    '<div class="mk-tabs" role="tablist"><button type="button" role="tab" class="on" data-mk="tab" data-tab="reviews" id="mkTabReviews">⭐ Reviews</button><button type="button" role="tab" data-mk="tab" data-tab="comments" id="mkTabComments">💬 Comments</button></div>' +
    '<div class="mk-pane" id="mkPaneReviews"><p class="creator-hint">Loading reviews…</p></div>' +
    '<div class="mk-pane" id="mkPaneComments" style="display:none"><p class="creator-hint">Loading comments…</p></div>' +
    (mine ? '' : '<button type="button" class="mk-report-link" data-mk="report">🚩 Report this product</button>') +
    '<p class="mk-safety">Inspect the product and meet in a safe public place before paying. Never share your PIN or private account details.</p>';
  $('marketProductDetails').innerHTML = html;
}
function loadDetailExtras(p, token) {
  var db = mDb();
  if (!db) { detailData.reviewsError = detailData.commentsError = true; renderReviews(p); renderComments(p); return; }
  db.collection('marketplaceReviews').where('sellerUid', '==', p.uid).limit(100).get().then(function (snap) {
    if (token !== detailToken) return;
    detailData.reviews = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
    detailData.reviews.sort(function (a, b) { var A = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : Date.now(), B = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : Date.now(); return B - A; });
    renderReviews(p);
  }).catch(function (e) { console.warn('Reviews:', e); if (token !== detailToken) return; detailData.reviewsError = true; renderReviews(p); });
  db.collection('marketplacePosts').doc(p.id).collection('comments').orderBy('createdAt', 'asc').limit(50).get().then(function (snap) {
    if (token !== detailToken) return;
    detailData.comments = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
    renderComments(p);
  }).catch(function (e) { console.warn('Comments:', e); if (token !== detailToken) return; detailData.commentsError = true; renderComments(p); });
  db.collection('publicProfiles').doc(p.uid).get().then(function (snap) {
    if (token !== detailToken) return;
    if (snap.exists && snap.data().verified === true) { var v = $('mkVerified'); if (v) v.innerHTML = '<span class="mk-verified">✓ Verified</span>'; }
  }).catch(function () { });
}
function reviewStats() {
  var list = detailData.reviews, n = list.length, sum = 0, dist = [0, 0, 0, 0, 0, 0];
  list.forEach(function (r) { var v = Math.max(1, Math.min(5, Number(r.rating) || 0)); sum += v; dist[v]++; });
  return { n: n, avg: n ? sum / n : 0, dist: dist };
}
function renderReviews(p) {
  var pane = $('mkPaneReviews'), tab = $('mkTabReviews'); if (!pane) return;
  var st = reviewStats(), u = mUser();
  if (tab) tab.innerHTML = '⭐ Reviews' + (st.n ? ' (' + st.n + ')' : '');
  var sr = $('mkSellerRating'); if (sr) sr.innerHTML = st.n ? mStars(st.avg) + ' <b>' + st.avg.toFixed(1) + '</b> · ' + st.n + (st.n === 1 ? ' review' : ' reviews') : 'No reviews yet · Seller on Afrishine Hub';
  if (detailData.reviewsError) { pane.innerHTML = !u ? '<p class="creator-hint">Sign in with Google to see reviews and rate this seller.</p><button type="button" class="gold" data-mk="login">Sign in with Google</button>' : '<p class="creator-hint">Reviews are not available right now. Please try again later.</p>'; return; }
  var summary = '';
  if (st.n) {
    var bars = [5, 4, 3, 2, 1].map(function (k) { var pct = Math.round(st.dist[k] / st.n * 100); return '<div class="mk-bar-row"><span>' + k + '</span><div class="mk-bar"><span style="width:' + pct + '%"></span></div></div>'; }).join('');
    summary = '<div class="mk-rate-summary"><div class="mk-rate-big"><b>' + st.avg.toFixed(1) + '</b>' + mStars(st.avg) + '<small>' + st.n + (st.n === 1 ? ' review' : ' reviews') + '</small></div><div class="mk-rate-bars">' + bars + '</div></div>';
  } else summary = '<p class="creator-hint">No reviews yet. Be the first to rate this seller.</p>';
  var mine = u && detailData.reviews.filter(function (r) { return r.reviewerUid === u.uid; })[0];
  var form;
  if (mIsMine(p)) form = '<p class="creator-hint">This is your product. Buyers can rate you here.</p>';
  else if (!u || !isGoogleMarketplaceUser(u)) form = '<div class="mk-rate-form"><b>Rate this seller</b><p class="creator-hint">Sign in with Google to leave a review.</p><button type="button" class="gold" data-mk="login">Sign in with Google</button></div>';
  else if (mine) form = '<p class="creator-hint">You rated this seller ' + mStars(mine.rating) + '</p>';
  else form = '<div class="mk-rate-form"><b>Rate this seller</b><div class="mk-star-input" id="mkStarInput">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-mk="star" data-n="' + n + '" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '">★</button>'; }).join('') + '</div>' +
    '<textarea class="field" id="mkReviewText" maxlength="300" rows="3" placeholder="Describe your experience with this seller (optional)"></textarea><button type="button" class="gold" data-mk="submit-review">Submit review</button></div>';
  var list = detailData.reviews.slice(0, 20).map(function (r) {
    return '<div class="mk-review"><div class="mk-review-head"><span class="mk-avatar sm">' + mEsc((String(r.reviewerName || 'M').trim().charAt(0) || 'M').toUpperCase()) + '</span><div><b>' + mEsc(r.reviewerName && r.reviewerName.indexOf('@') < 0 ? r.reviewerName : 'Afrishine Member') + '</b><div>' + mStars(r.rating) + ' <span class="mk-time">' + mEsc(mDate(r.createdAt || new Date())) + '</span></div></div></div>' + (r.text ? '<p>' + mEsc(r.text) + '</p>' : '') + '</div>';
  }).join('');
  pane.innerHTML = summary + form + list;
  paintStars();
}
function paintStars() { document.querySelectorAll('#mkStarInput button').forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-n')) <= rateValue); }); }
function renderComments(p) {
  var pane = $('mkPaneComments'), tab = $('mkTabComments'); if (!pane) return;
  var n = detailData.comments.length;
  if (tab) tab.innerHTML = '💬 Comments' + (n ? ' (' + n + ')' : '');
  if (detailData.commentsError) { pane.innerHTML = !mUser() ? '<p class="creator-hint">Sign in with Google to read and write comments.</p><button type="button" class="gold" data-mk="login">Sign in with Google</button>' : '<p class="creator-hint">Comments are not available right now. Please try again later.</p>'; return; }
  var keep = $('mkCommentInput') ? $('mkCommentInput').value : '';
  var items = detailData.comments.map(function (c) {
    var name = c.authorName && c.authorName.indexOf('@') < 0 ? c.authorName : 'Afrishine Member';
    return '<div class="mk-review"><div class="mk-review-head"><span class="mk-avatar sm">' + mEsc((name.trim().charAt(0) || 'A').toUpperCase()) + '</span><div><b>' + mEsc(name) + '</b>' + (c.uid === p.uid ? ' <span class="mk-verified">Seller</span>' : '') + '<div class="mk-time">' + mEsc(mDate(c.createdAt || new Date())) + '</div></div></div><p>' + mEsc(c.text) + '</p></div>';
  }).join('') || '<p class="creator-hint">No comments yet. Ask the seller a question about this product.</p>';
  pane.innerHTML = items + '<div class="mk-comment-form"><input class="field" id="mkCommentInput" maxlength="300" placeholder="Write a comment…" autocomplete="off"><button type="button" class="gold" data-mk="submit-comment">Send</button></div>';
  if (keep && $('mkCommentInput')) $('mkCommentInput').value = keep;
}
function setTab(tab) {
  detailTab = tab;
  var a = $('mkPaneReviews'), b = $('mkPaneComments'); if (a) a.style.display = tab === 'reviews' ? '' : 'none'; if (b) b.style.display = tab === 'comments' ? '' : 'none';
  document.querySelectorAll('#marketProductDetails [data-mk="tab"]').forEach(function (t) { var on = t.getAttribute('data-tab') === tab; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
}

/* ---------- review, comment, report, delete ---------- */
async function submitReview(p) {
  if (!mRequireLogin()) return;
  var u = mUser(); if (p.uid === u.uid) return;
  if (!rateValue) { mNotice('Tap a star to choose your rating.'); return; }
  var txt = (($('mkReviewText') || {}).value || '').trim().slice(0, 300);
  var btn = document.querySelector('#mkPaneReviews [data-mk="submit-review"]'); if (btn) btn.disabled = true;
  try {
    var doc = { postId: p.id, sellerUid: p.uid, reviewerUid: u.uid, reviewerName: u.displayName || 'Member', rating: rateValue, text: txt, createdAt: mServerTime() };
    var ref = await mDb().collection('marketplaceReviews').add(doc);
    detailData.reviews.unshift({ id: ref.id, postId: p.id, sellerUid: p.uid, reviewerUid: u.uid, reviewerName: doc.reviewerName, rating: rateValue, text: txt, createdAt: new Date() });
    rateValue = 0; renderReviews(p);
    mNotice('Thank you! Your review has been submitted.');
    if (typeof window.afCreateNotification === 'function') window.afCreateNotification(p.uid, 'marketplace_review', 'New seller review', (u.displayName || 'A member') + ' rated you ' + doc.rating + ' of 5 stars.', 'shop');
  } catch (e) { mNotice(mErr(e)); if (btn) btn.disabled = false; }
}
async function submitComment(p) {
  if (!mRequireLogin()) return;
  var u = mUser(), input = $('mkCommentInput'), text = input && input.value.trim(); if (!text) return;
  var btn = document.querySelector('#mkPaneComments [data-mk="submit-comment"]'); if (btn) btn.disabled = true;
  try {
    var ref = await mDb().collection('marketplacePosts').doc(p.id).collection('comments').add({ uid: u.uid, authorName: u.displayName || 'Afrishine Member', text: text.slice(0, 300), createdAt: mServerTime() });
    detailData.comments.push({ id: ref.id, uid: u.uid, authorName: u.displayName || 'Afrishine Member', text: text.slice(0, 300), createdAt: new Date() });
    input.value = ''; renderComments(p);
    if (p.uid !== u.uid && typeof window.afCreateNotification === 'function') window.afCreateNotification(p.uid, 'marketplace_comment', 'New Marketplace comment', (u.displayName || 'A member') + ' commented on your product.', 'shop');
  } catch (e) { mNotice(mErr(e)); if (btn) btn.disabled = false; }
}
var REPORT_REASONS = ['Scam or fraud', 'Fake or misleading product', 'Prohibited or illegal item', 'Wrong price or details', 'Inappropriate content', 'Other'];
function openReport(p) {
  if (!mRequireLogin()) return;
  if (mIsMine(p)) return;
  if (reportedIds.indexOf(p.id) >= 0) { mNotice('You have already reported this product. Thank you.'); return; }
  var o = openSheet('<h3 class="mk-sheet-title">Report this product</h3><p class="mk-sheet-text">Why are you reporting “' + mEsc(mTitle(p)) + '”? Our team will review it.</p>' +
    REPORT_REASONS.map(function (r, i) { return '<label class="mk-reason"><input type="radio" name="mkReason" value="' + i + '"><span>' + mEsc(r) + '</span></label>'; }).join('') +
    '<textarea class="field" id="mkReportNote" maxlength="300" rows="3" placeholder="More details (optional)"></textarea>' +
    '<div class="mk-sheet-actions"><button type="button" class="secondary" data-c="no">Cancel</button><button type="button" class="mk-danger" data-c="send">Send report</button></div>');
  o.querySelector('[data-c="no"]').onclick = closeSheet;
  o.querySelector('[data-c="send"]').onclick = async function () {
    var sel = o.querySelector('input[name="mkReason"]:checked');
    if (!sel) { mNotice('Please choose a reason.'); return; }
    var note = ($('mkReportNote').value || '').trim(), reason = REPORT_REASONS[Number(sel.value)] + (note ? ' — ' + note : '');
    this.disabled = true;
    try {
      await mDb().collection('marketplaceReports').add({ reporterUid: mUser().uid, postId: p.id, reportedUid: p.uid, reason: reason.slice(0, 500), createdAt: mServerTime(), status: 'new' });
      reportedIds.push(p.id); mStore(REPORTED_KEY, reportedIds);
      closeSheet(); mNotice('Report sent. Thank you for helping keep the Marketplace safe.');
    } catch (e) { this.disabled = false; mNotice(mErr(e)); }
  };
}
async function deleteProduct(p) {
  var u = mUser();
  if (!u || p.uid !== u.uid) { mNotice('You can only delete your own product.'); return; }
  var ok = await mConfirm({ title: 'Delete this product?', text: '“' + mTitle(p) + '” will be removed from the Marketplace for everyone. This cannot be undone.', ok: 'Delete product', danger: true });
  if (!ok) return;
  var db = mDb(); if (!db) { mNotice('We could not connect to Afrishine Hub services. Please check your connection.'); return; }
  try {
    var ref = db.collection('marketplacePosts').doc(p.id), snap = await ref.get();
    if (snap.exists) {
      var data = snap.data();
      if (data.uid !== u.uid) { mNotice('You can only delete your own product.'); return; }
      try { var cs = await ref.collection('comments').limit(100).get(); await Promise.all(cs.docs.map(function (d) { return d.ref.delete().catch(function () { }); })); } catch (e) { }
      await ref.delete();
      [].concat(data.images || [], data.imageUrls || [], data.videoUrl ? [data.videoUrl] : []).forEach(function (url) {
        if (typeof window.workerDelete === 'function') { try { var r = window.workerDelete(url); if (r && r.catch) r.catch(function () { }); } catch (e) { } }
      });
    }
    removeLocal(p.id); marketCloseDetails(); marketRenderProducts(); marketRenderSaved();
    mNotice('Your product has been deleted.');
  } catch (e) { console.error(e); mNotice(mErr(e)); }
}
window.marketContactSeller = function (uid, name) {
  if (!mRequireLogin()) return;
  if (!uid || uid === mUser().uid) { mNotice('This is your own product.'); return; }
  if (typeof startConversation === 'function') { marketCloseDetails(); startConversation(uid, name); } else mNotice('Chat is currently unavailable.');
};

/* one click handler for everything inside the product details */
(function () {
  var root = $('marketProductDetails'); if (!root) return;
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mk]'); if (!b) return;
    var p = findProduct(marketDetailId); if (!p) return;
    switch (b.getAttribute('data-mk')) {
      case 'thumb': var m = $('marketDetailMain'); if (m) m.src = b.getAttribute('data-src'); break;
      case 'tab': setTab(b.getAttribute('data-tab')); break;
      case 'star': rateValue = Number(b.getAttribute('data-n')) || 0; paintStars(); break;
      case 'submit-review': submitReview(p); break;
      case 'submit-comment': submitComment(p); break;
      case 'chat': marketContactSeller(p.uid, mSeller(p)); break;
      case 'save': marketToggleSaved(p.id); break;
      case 'share': mShare(p.id); break;
      case 'report': openReport(p); break;
      case 'delete': deleteProduct(p); break;
      case 'login': mLogin(); break;
      case 'profile': if (p.uid && typeof openMemberProfile === 'function') { marketCloseDetails(); openMemberProfile(p.uid); } break;
    }
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'mkCommentInput') { e.preventDefault(); var p = findProduct(marketDetailId); if (p) submitComment(p); }
  });
})();

/* ---------- publish a product ---------- */
var photoInput = $('marketProductPhotos');
if (photoInput) photoInput.addEventListener('change', function () {
  var box = $('marketPhotoPreview'); box.innerHTML = '';
  Array.prototype.slice.call(this.files || [], 0, 8).forEach(function (f) { if (!f.type.startsWith('image/')) return; var im = document.createElement('img'); im.src = URL.createObjectURL(f); box.appendChild(im); });
});
async function marketUpload(file) {
  var u = mUser(); if (!u) throw new Error('Please sign in with Google first.');
  var token = await u.getIdToken();
  var response = await fetch(marketWorker + '/upload?filename=' + encodeURIComponent(file.name || 'market-media'), { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  var data = await response.json().catch(function () { return {}; });
  if (!response.ok || !data.success || !data.url) { if (typeof afWorkerFailure === 'function') afWorkerFailure(data, response.status); throw new Error(data.error || 'Media upload failed. Please try again.'); }
  return data.url;
}
async function marketCompress(file) {
  if (!file.type.startsWith('image/') || !window.createImageBitmap) return file;
  try {
    var im = await createImageBitmap(file), scale = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', .78); });
    if (im.close) im.close();
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}
window.marketPublishProduct = async function () {
  if (!mRequireLogin()) return;
  var photos = Array.prototype.slice.call($('marketProductPhotos').files || []).filter(function (f) { return f.type.startsWith('image/'); }).slice(0, 8);
  var video = $('marketProductVideo').files[0];
  var title = $('marketProductTitle').value.trim(), description = $('marketProductDescription').value.trim(), price = Number($('marketProductPrice').value), locationText = $('marketProductLocation').value.trim();
  if (photos.length < 3) { mNotice('Please select at least 3 product photos.'); return; }
  if (video && !/^video\//.test(video.type || '') && !/\.(mp4|mov|m4v|webm|3gp)$/i.test(video.name || '')) { mNotice('Please choose a valid video file.'); return; }
  if (!title || description.length < 8 || !price || price < 1) { mNotice('Please enter a valid title, description and price.'); return; }
  var btn = $('marketPublishButton'), status = $('marketUploadStatus'); btn.disabled = true; status.textContent = 'Uploading photos…';
  try {
    var imageUrls = [];
    for (var i = 0; i < photos.length; i++) { status.textContent = 'Uploading photo ' + (i + 1) + ' / ' + photos.length; imageUrls.push(await marketUpload(await marketCompress(photos[i]))); }
    var videoUrl = '';
    if (video) { status.textContent = 'Uploading video…'; videoUrl = await marketUpload(await afPrepareVideo(video, function (t) { status.textContent = t; })); }
    status.textContent = 'Saving product…';
    await mDb().collection('marketplacePosts').add({ uid: mUser().uid, authorName: mUser().displayName || 'Afrishine Seller', authorPhoto: mUser().photoURL || '', type: 'sell', product: true, title: title, description: description, text: description, price: ($('marketProductCurrency').value === 'USD' ? '$' : 'FRW ') + String(price), condition: $('marketProductCondition').value, category: $('marketProductCategory').value, location: locationText, images: imageUrls, videoUrl: videoUrl, createdAt: mServerTime(), status: 'active' });
    ['marketProductTitle', 'marketProductDescription', 'marketProductPrice', 'marketProductPhotos', 'marketProductVideo'].forEach(function (id) { $(id).value = ''; });
    $('marketPhotoPreview').innerHTML = ''; status.textContent = ''; marketCloseSell(); mNotice('Your product has been published successfully.'); await marketLoadProducts(true);
  } catch (e) { console.error(e); status.textContent = e.message || 'Could not publish the product.'; mNotice(status.textContent); }
  finally { btn.disabled = false; }
};

/* ---------- keyboard, header search, page hook, shared links ---------- */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if ($('mkOverlay')) { closeSheet(); return; }
  marketCloseDetails(); marketCloseSell();
});
var headerForm = $('headerSearchForm');
if (headerForm) headerForm.addEventListener('submit', function (e) {
  if (!$('shop').classList.contains('active')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  $('marketSearchInput').value = $('headerSearch').value || '';
  marketShowPanel('home'); marketRenderProducts();
}, { capture: true });
var originalShowPage = window.showPage;
if (typeof originalShowPage === 'function') {
  window.showPage = function (id) {
    originalShowPage(id);
    if (id === 'shop') { document.body.classList.add('marketplace-active'); marketShowPanel('home'); marketLoadProducts(); }
    else { document.body.classList.remove('marketplace-active'); marketCloseDetails(); }
  };
}
if ($('shop') && $('shop').classList.contains('active')) { document.body.classList.add('marketplace-active'); marketShowPanel('home'); marketLoadProducts(); }

/* A shared product link (…/marketplace?product=ID, reached from the share preview page) opens that product straight away. */
var sharedProductId = '';
try { sharedProductId = new URLSearchParams(location.search).get('product') || ''; } catch (e) { sharedProductId = ''; }
if (sharedProductId) {
  fetchProduct(sharedProductId).then(function (p) {
    if (!p) { mNotice('This product is no longer available.'); return; }
    marketAddProduct(p);
    if (!$('shop').classList.contains('active')) window.showPage('shop');
    marketOpenDetails(p.id);
  });
}
})();
