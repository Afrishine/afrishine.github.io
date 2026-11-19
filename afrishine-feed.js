/* AFRISHINE HUB - Talent Hub + Community feed look (Instagram / Facebook style)
   ONLY restyles #talentFeed and #communityFeed. Every button keeps its existing
   function (like, comment, repost, share, save, follow, delete, menu).
   No ?. / ?? / flex-gap, so it works on Android 8+.
   Load AFTER all other scripts: <script src="afrishine-feed.js"></script> */
(function (w, d) {
  'use strict';
  if (w.AHFeed) return;

  var FEEDS = ['#talentFeed', '#communityFeed'];
  var PH = {};   // cached profile photos

  // ---------- icons (SVG used as masks, so they take the text colour) ----------
  function svg(inner, fill) {
    var s = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='" + (fill ? 'black' : 'none') +
      "' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" + inner + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';
  }
  var HEART = "<path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/>";
  var COMMENT = "<path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'/>";
  var REPOST = "<path d='m17 1 4 4-4 4'/><path d='M3 11V9a4 4 0 0 1 4-4h14'/><path d='m7 23-4-4 4-4'/><path d='M21 13v2a4 4 0 0 1-4 4H3'/>";
  var SHARE = "<line x1='22' y1='2' x2='11' y2='13'/><polygon points='22 2 15 22 11 13 2 9 22 2'/>";
  var SAVE = "<path d='m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'/>";

  // ---------- CSS ----------
  var C = [];
  function R(rest) {
    var out = [];
    rest.split(',').forEach(function (r) { FEEDS.forEach(function (f) { out.push(f + ' ' + r.trim()); }); });
    return out.join(',');
  }
  function add(sel, decl) { C.push(R(sel) + '{' + decl + '}'); }
  function mask(url) { return '-webkit-mask-image:' + url + ';mask-image:' + url; }

  C.push(FEEDS.join(',') + '{display:block}');
  C.push('.ah-feed-panel{padding:0!important;border:0!important;background:transparent!important}');
  C.push('.ah-feed-panel>h2,.ah-feed-panel>p,.ah-feed-panel>.actions{padding-left:4px;padding-right:4px}');

  // card
  add('.post-card', 'position:relative;display:flex;flex-direction:column;padding:0;margin:0 0 16px;border:1px solid #232a38;border-radius:16px;background:#11151d;overflow:hidden');
  add('.post-card > *', 'order:3;min-width:0');
  add('.post-card > .post-meta', 'order:1;display:flex;align-items:center;justify-content:flex-start;margin:0;padding:12px 104px 10px 12px;font-size:13px');
  add('.post-card > .creator-hint', 'order:2;margin:0;padding:0 12px 10px');
  add('.post-card > .post-actions', 'order:4;display:flex;flex-wrap:nowrap;align-items:center;margin:0;padding:4px 4px 0');
  add('.post-card > h3', 'order:5;margin:8px 12px 0!important');
  add('.post-card > .post-body', 'order:6;padding:6px 12px 0;font-size:14.5px;line-height:1.5;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden');
  add('.post-card > .post-body.ah-open', 'display:block');
  add('.post-card > .comment-area', 'order:7;display:none;margin:8px 0 0;padding:8px 12px 12px');
  add('.post-card.ah-cm-open > .comment-area', 'display:block');
  add('.post-card > .post-delete', 'order:8;margin:8px 12px 0');
  add('.post-card::after', 'content:attr(data-ahd);order:9;padding:6px 12px 12px;font-size:12px;color:#8d97ad');
  add('.post-card:not([data-ahd])::after', 'display:none');

  // header: avatar + name (+ date moved to the bottom)
  add('.ah-av', 'width:40px;height:40px;flex-shrink:0;margin-right:10px;border-radius:50%;background:#303747 center/cover no-repeat;color:#ffbf36;font-weight:800;font-size:17px;display:flex;align-items:center;justify-content:center');
  add('.post-meta .text-link', 'font-size:15px;font-weight:700;color:#fff;padding:0;background:none;border:0;text-align:left');
  add('.post-meta > span.ah-date', 'display:none');

  // media edge to edge
  add('.post-media-video, .post-media-image', 'display:block;width:100%!important;max-height:80vh!important;border-radius:0!important;background:#000!important;object-fit:contain');

  // action bar = icons
  add('.post-actions > button', 'font-size:0;line-height:0;display:inline-flex;align-items:center;min-height:44px;margin:0 2px 0 0;padding:0 10px;background:none;border:0;border-radius:10px;box-shadow:none;color:#e9edf5;-webkit-tap-highlight-color:transparent');
  add('.post-actions > button::before', 'content:"";display:block;width:26px;height:26px;background:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain');
  add('.post-actions > button::after', 'content:attr(data-ahc);margin-left:6px;font-size:15px;font-weight:600;line-height:1');
  add('.post-actions > button:active', 'opacity:.6');
  add('.post-actions > [data-like]::before', mask(svg(HEART)));
  add('.post-actions > [data-like][data-ahl="1"]', 'color:#ff3b5c');
  add('.post-actions > [data-like][data-ahl="1"]::before', mask(svg(HEART, true)));
  add('.post-actions > [data-focus-comment]::before', mask(svg(COMMENT)));
  add('.post-actions > [data-repost]::before', mask(svg(REPOST)));
  add('.post-actions > [data-share-post]::before', mask(svg(SHARE)));
  add('.post-actions > [data-save-post]', 'margin-left:auto;margin-right:0');
  add('.post-actions > [data-save-post]::before', mask(svg(SAVE)));
  add('.post-actions > [data-save-post][data-ahs="1"]', 'color:#ffb91f');
  add('.post-actions > [data-save-post][data-ahs="1"]::before', mask(svg(SAVE, true)));
  add('.post-actions > [data-message-user]', 'display:none');
  add('.post-actions > .ah-post-menu', 'margin-left:6px');

  // follow = small button in the header
  add('.post-actions > [data-follow-author]', 'position:absolute;top:14px;right:12px;min-height:0;margin:0;padding:7px 14px;font-size:13px;font-weight:700;line-height:1;color:#fff;border:1px solid rgba(255,255,255,.55);border-radius:9px');
  add('.post-actions > [data-follow-author]::before, .post-actions > [data-follow-author]::after', 'display:none');

  var style = d.createElement('style');
  style.id = 'ahFeedStyles';
  style.textContent = C.join('\n');

  // ---------- helpers ----------
  function getDB() { try { if (typeof db !== 'undefined' && db) return db; } catch (e) {} return null; }

  var io = ('IntersectionObserver' in w) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (!e.isIntersecting && e.target.pause && !e.target.paused) e.target.pause(); });
  }, { threshold: 0.2 }) : null;

  function applyPhoto(uid) {
    var url = PH[uid];
    if (!url) return;
    Array.prototype.forEach.call(d.querySelectorAll('.ah-av[data-uid="' + uid + '"]'), function (a) {
      a.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
      a.textContent = '';
    });
  }
  function loadPhoto(uid) {
    if (!uid) return;
    if (PH[uid] !== undefined) { applyPhoto(uid); return; }
    PH[uid] = '';
    var dbx = getDB();
    if (!dbx) { delete PH[uid]; return; }
    dbx.collection('publicProfiles').doc(uid).get().then(function (s) {
      PH[uid] = (s.exists && s.data().photoURL) || '';
      applyPhoto(uid);
    }).catch(function () {});
  }

  // one-time decoration of a card (adds avatar, finds the date, watches videos)
  function decorate(card) {
    if (card.getAttribute('data-ahf') === '1') return;
    card.setAttribute('data-ahf', '1');
    var meta = card.querySelector('.post-meta');
    if (meta) {
      var nameEl = meta.querySelector('.text-link, button');
      var nm = (nameEl && nameEl.textContent || '?').replace(/^\s+/, '');
      var av = d.createElement('span');
      av.className = 'ah-av';
      av.setAttribute('data-uid', card.getAttribute('data-author-uid') || '');
      av.textContent = (nm.charAt(0) || '?').toUpperCase();
      meta.insertBefore(av, meta.firstChild);
      var spans = meta.querySelectorAll(':scope > span:not(.ah-av)');
      for (var i = spans.length - 1; i >= 0; i--) {
        if (/\d/.test(spans[i].textContent) && !spans[i].querySelector('svg,img')) {
          spans[i].className += ' ah-date';
          card.setAttribute('data-ahd', spans[i].textContent);
          break;
        }
      }
      loadPhoto(card.getAttribute('data-author-uid'));
    }
    if (io) Array.prototype.forEach.call(card.querySelectorAll('video'), function (v) { io.observe(v); });
  }

  // state that the existing code only keeps as button text (liked, saved, counts)
  function sync(card) {
    var like = card.querySelector('[data-like]');
    if (like) {
      var t = like.textContent || '', m = t.match(/(\d+)/), n = m ? parseInt(m[1], 10) : 0;
      like.setAttribute('data-ahl', /\u2665|liked/i.test(t) ? '1' : '0');
      like.setAttribute('data-ahc', n > 0 ? String(n) : '');
    }
    var cm = card.querySelector('[data-focus-comment]');
    if (cm) {
      var c = card.querySelectorAll('[data-comments-list] .comment-line').length;
      cm.setAttribute('data-ahc', c > 0 ? (c >= 10 ? '10+' : String(c)) : '');
    }
    var sv = card.querySelector('[data-save-post]');
    if (sv) sv.setAttribute('data-ahs', /saved|\u2713/i.test(sv.textContent || '') ? '1' : '0');
  }

  function scan(feed) {
    Array.prototype.forEach.call(feed.querySelectorAll('.post-card'), function (card) { decorate(card); sync(card); });
  }

  function setup(sel) {
    var feed = d.querySelector(sel);
    if (!feed || feed.getAttribute('data-ahfeed')) return;
    feed.setAttribute('data-ahfeed', '1');
    feed.className += ' ah-feed';
    if (feed.parentNode && feed.parentNode.className.indexOf('panel') > -1) feed.parentNode.className += ' ah-feed-panel';
    var timer = null;
    function later() { if (timer) return; timer = setTimeout(function () { timer = null; scan(feed); }, 60); }
    if (w.MutationObserver) new MutationObserver(later).observe(feed, { childList: true, subtree: true, characterData: true });
    scan(feed);
  }

  function inFeed(el) { return el && el.closest && el.closest(FEEDS.join(',')); }

  // comments open when the comment icon is tapped (runs before the app's own handler)
  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var cm = t.closest('[data-focus-comment]');
    if (cm && inFeed(cm)) {
      var card = cm.closest('.post-card');
      if (card) card.classList.toggle('ah-cm-open');
      return;
    }
    var body = t.closest('.post-body');
    if (body && inFeed(body) && !t.closest('a,button')) body.classList.toggle('ah-open');
  }, true);

  function install() {
    d.head.appendChild(style);
    FEEDS.forEach(setup);
  }

  w.AHFeed = { refresh: function () { FEEDS.forEach(function (s) { var f = d.querySelector(s); if (f) scan(f); }); } };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', install); else install();
})(window, document);
