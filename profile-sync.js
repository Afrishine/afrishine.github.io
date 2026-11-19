/* Afrishine Hub: show members' CURRENT public name on older posts and listings.
   Posts store the author's name at the time they were written; this script replaces the visible
   name with the member's current publicProfiles.username. Load AFTER the page scripts:
   <script src="/profile-sync.js"></script> */
(function () {
  'use strict';
  try {
    var TTL = 5 * 60 * 1000, MAX_PER_ROUND = 30;
    var cache = {}, pending = {}, timer = null;
    var SEL = '[data-open-profile], button[onclick*="openMemberProfile"]';

    function dbx() { return (typeof db !== 'undefined') ? db : null; }
    function clean(raw) { raw = String(raw || '').trim(); if (raw.indexOf('@') > 0) raw = raw.split('@')[0]; return raw.slice(0, 60); }
    function uidOf(el) {
      var u = el.getAttribute('data-open-profile');
      if (u) return u;
      var m = /openMemberProfile\(\s*['"]([^'"]+)['"]/.exec(el.getAttribute('onclick') || '');
      return m ? m[1] : '';
    }
    function firstText(el) {
      for (var i = 0; i < el.childNodes.length; i++) {
        var n = el.childNodes[i];
        if (n.nodeType === 3 && n.nodeValue.trim()) return n;
      }
      return null;
    }
    function apply(el, name) {
      var node = firstText(el);
      if (!node || !name) return;
      var t = node.nodeValue, cut = t.indexOf(' · '), next = cut >= 0 ? name + t.slice(cut) : name;
      if (t !== next) node.nodeValue = next;
    }
    function fetchProfile(uid) {
      var d = dbx();
      if (!d || pending[uid]) return;
      pending[uid] = true;
      d.collection('publicProfiles').doc(uid).get().then(function (s) {
        var v = s.exists ? s.data() : {};
        cache[uid] = { t: Date.now(), name: clean(v.username) };
      }).catch(function () {
        cache[uid] = { t: Date.now(), name: '' };
      }).then(function () { pending[uid] = false; schedule(); });
    }
    function scan() {
      timer = null;
      var els = document.querySelectorAll(SEL), asked = 0;
      Array.prototype.forEach.call(els, function (el) {
        if (el.closest('#love')) return; /* Love Connection keeps its own separate username */
        var uid = uidOf(el);
        if (!uid) return;
        var c = cache[uid];
        if (c && Date.now() - c.t < TTL) { if (c.name) apply(el, c.name); return; }
        if (asked < MAX_PER_ROUND && !pending[uid]) { asked++; fetchProfile(uid); }
      });
    }
    function schedule() { if (!timer) timer = setTimeout(scan, 350); }

    /* call after a member saves their profile */
    window.afProfileSyncRefresh = function (uid) { if (uid) delete cache[uid]; else cache = {}; schedule(); };

    if ('MutationObserver' in window) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    schedule();
  } catch (err) { console.warn('Profile sync not started:', err); }
})();
