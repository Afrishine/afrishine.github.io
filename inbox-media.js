/* Afrishine Hub: Inbox add-on (Photo + Voice + Delete chat).
   Load AFTER inbox-ui.js:  <script src="/inbox-media.js"></script>
   Needs: firebase storage script  <script src="https://www.gstatic.com/firebasejs/<version>/firebase-storage-compat.js"></script> */
(function () {
  'use strict';
  try {
    var page = document.getElementById('inbox');
    if (!page || window.__ahMediaLoaded) return;
    window.__ahMediaLoaded = true;

    var $ = function (id) { return document.getElementById(id); };
    function dbx() { return (typeof db !== 'undefined') ? db : null; }
    function me() { return (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null; }
    function msg(t) { alert(t); }

    var cur = '', rec = null, chunks = [], stream = null, timer = null, secs = 0, cancelled = false, busy = false;

    /* ---------- styles ---------- */
    var st = document.createElement('style');
    st.textContent = [
      '#ahInboxUI.in-chat{position:fixed;left:0;right:0;top:0;height:100vh;height:100dvh;z-index:9999;display:flex;flex-direction:column;max-width:none;margin:0;padding:0;background:#0a0b14}',
      '#ahInboxUI.in-chat #ahPaneMsg,#ahInboxUI.in-chat #ahMsgSlot,#ahInboxUI.in-chat #inboxList{flex:1;min-height:0;display:flex;flex-direction:column}',
      '#ahInboxUI.in-chat .conversation-view{flex:1;min-height:0;display:flex;flex-direction:column;width:100%;max-width:640px;margin:0 auto;padding:0 12px;box-sizing:border-box}',
      '#ahInboxUI.in-chat .ah-chat-head{flex-shrink:0;padding-top:calc(8px + env(safe-area-inset-top,0px))}',
      '#ahInboxUI.in-chat .message-list{flex:1;max-height:none!important;min-height:0!important;overflow-y:auto;overscroll-behavior:contain}',
      '.ah-composer{flex-shrink:0;margin:0!important;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #2c3659;background:#0a0b14}',
      '.ah-cbtn{width:42px;height:42px;flex-shrink:0;border-radius:50%;border:0;display:grid;place-items:center;background:#12172b;color:#fff;border:1px solid #2c3659;padding:0}',
      '.ah-cbtn svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.ah-cbtn.mic{background:#1f9d55;border-color:#1f9d55}',
      '.ah-recbar{display:none;align-items:center;gap:10px;margin:8px 0}',
      '.ah-recbar button{height:44px;padding:0 16px;border-radius:22px;border:0;color:#fff;font-size:15px;font-weight:700}',
      '.ah-recbar .x{background:#e5242f}.ah-recbar .ok{background:#1f9d55}',
      '.ah-recbar .ah-info{flex:1;color:#ffb91f;font-size:15px;font-weight:700}',
      '.ah-del{width:40px;height:40px;flex-shrink:0;border-radius:50%;border:1px solid #2c3659;background:#12172b;font-size:18px;line-height:1;color:#fff}',
      '.ah-media img{display:block;max-width:100%;max-height:300px;border-radius:12px;margin-top:6px;cursor:pointer}',
      '.ah-media audio{display:block;width:100%;min-width:200px;max-width:260px;margin-top:6px}'
    ].join('\n');
    document.head.appendChild(st);

    /* ---------- storage: Cloudflare Worker (R2) ---------- */
    var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
    function appCheckHeader() {
      try {
        if (typeof firebase !== 'undefined' && typeof firebase.appCheck === 'function') {
          return firebase.appCheck().getToken().then(function (t) { return { 'X-Firebase-AppCheck': t.token }; }).catch(function () { return {}; });
        }
      } catch (_) { }
      return Promise.resolve({});
    }
    function upload(blob, ext, type) {
      var u = me();
      if (!u) return Promise.reject(new Error('no-user'));
      var base = String(type || '').split(';')[0] || 'application/octet-stream';
      return Promise.all([u.getIdToken(), appCheckHeader()]).then(function (r) {
        var headers = Object.assign({ Authorization: 'Bearer ' + r[0], 'Content-Type': base }, r[1]);
        return fetch(WORKER + '/upload?filename=' + encodeURIComponent('chat.' + ext), { method: 'POST', headers: headers, body: blob });
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || !j.success || !j.url) { var e = new Error(j.code || 'upload'); e.userMsg = j.message || ''; throw e; }
          return { url: j.url, key: j.key };
        });
      });
    }
    function removeMedia(docs) {
      var u = me();
      if (!u) return Promise.resolve();
      return u.getIdToken().then(function (tok) {
        return Promise.all(docs.map(function (x) { return x.data(); }).filter(function (v) { return v.senderUid === u.uid && v.mediaKey; }).map(function (v) {
          return fetch(WORKER + '/delete', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: v.mediaKey }) }).catch(function () { });
        }));
      }).catch(function () { });
    }
    function sendMedia(kind, up) {
      var d = dbx(), u = me(), id = cur;
      var text = kind === 'image' ? '📷 Photo' : '🎤 Voice message';
      return d.collection('conversations').doc(id).collection('messages').add({
        senderUid: u.uid,
        senderName: u.displayName || (u.email || '').split('@')[0] || 'Member',
        text: text,
        mediaType: kind,
        mediaURL: up.url,
        mediaKey: up.key,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        return d.collection('conversations').doc(id).update({ lastMessage: text, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }).then(function () { reopen(); });
    }
    function reopen() {
      var nm = document.querySelector('#ahInboxUI .ah-chat-who .ah-name');
      if (typeof window.openConversation === 'function') window.openConversation(cur, nm ? nm.textContent : 'Conversation');
    }

    /* ---------- photo ---------- */
    function compress(file) {
      return new Promise(function (res, rej) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var max = 1280, r = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { b ? res(b) : rej(new Error('compress')); }, 'image/jpeg', 0.8);
        };
        img.onerror = function () { rej(new Error('image')); };
        img.src = url;
      });
    }
    function pickPhoto() {
      if (busy) return;
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        busy = true; setInfo('Irimo koherezwa…');
        compress(f).then(function (b) { return upload(b, 'jpg', 'image/jpeg'); })
          .then(function (url) { return sendMedia('image', url); })
          .catch(function (e) { console.warn(e); msg((e && e.userMsg) || 'Ifoto ntiyoherejwe. Ongera ugerageze.'); })
          .then(function () { busy = false; setInfo(''); });
      };
      inp.click();
    }

    /* ---------- voice ---------- */
    function composerRow() {
      var inp = document.querySelector('#inboxList .conversation-view textarea, #inboxList .conversation-view input[type="text"], #inboxList .conversation-view input:not([type])');
      return inp ? { inp: inp, row: inp.parentElement } : null;
    }
    function setInfo(t) {
      var el = $('ahBarInfo'), bar = $('ahRecBar'); if (!el || !bar) return;
      el.textContent = t || '';
      bar.style.display = (t || rec) ? 'flex' : 'none';
    }
    function setRecUI(on) {
      var c = composerRow(), x = $('ahMicCancel'), o = $('ahMicSend');
      if (c) c.row.style.display = on ? 'none' : '';
      if (x) x.style.display = on ? '' : 'none';
      if (o) o.style.display = on ? '' : 'none';
    }
    function stopTracks() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } clearInterval(timer); }
    function startRec() {
      if (busy || rec) return;
      if (!navigator.mediaDevices || !window.MediaRecorder) { msg('Telefone yawe ntishyigikira gufata ijwi hano.'); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; chunks = []; cancelled = false; secs = 0;
        rec = new MediaRecorder(s);
        var type = rec.mimeType || 'audio/webm';
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          var blob = new Blob(chunks, { type: type }), was = cancelled;
          stopTracks(); rec = null; setRecUI(false); setInfo('');
          if (was || blob.size < 800) return;
          var ext = type.indexOf('mp4') >= 0 ? 'm4a' : (type.indexOf('ogg') >= 0 ? 'ogg' : 'webm');
          busy = true; setInfo('Irimo koherezwa…');
          upload(blob, ext, type).then(function (url) { return sendMedia('audio', url); })
            .catch(function (e) { console.warn(e); msg((e && e.userMsg) || 'Ijwi ntiryoherejwe. Ongera ugerageze.'); })
            .then(function () { busy = false; setInfo(''); });
        };
        rec.start(); setRecUI(true); setInfo('● 0:00');
        timer = setInterval(function () {
          secs++; setInfo('● ' + Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2));
          if (secs >= 120 && rec && rec.state === 'recording') rec.stop();
        }, 1000);
      }).catch(function () { msg('Emerera microphone kugira ngo ufate ijwi.'); });
    }
    function stopRec(cancel) { cancelled = !!cancel; if (rec && rec.state === 'recording') rec.stop(); }

    /* ---------- delete chat ---------- */
    function deleteChat() {
      var d = dbx(), id = cur;
      if (!d || !id || busy) return;
      if (!confirm('Gusiba iyi chat burundu? Ubutumwa bwose buzasibwa kandi ntibizagaruka.')) return;
      busy = true;
      var msgs = d.collection('conversations').doc(id).collection('messages');
      (function wipe() {
        return msgs.limit(400).get().then(function (snap) {
          if (snap.empty) return;
          return removeMedia(snap.docs).then(function () {
            var b = d.batch();
            snap.docs.forEach(function (x) { b.delete(x.ref); });
            return b.commit().then(wipe);
          });
        });
      })().then(function () { return d.collection('conversations').doc(id).delete(); })
        .then(function () { cur = ''; if (typeof window.loadInbox === 'function') window.loadInbox(); })
        .catch(function (e) { console.warn(e); msg('Chat ntisibwe. Ongera ugerageze.'); })
        .then(function () { busy = false; });
    }

    /* ---------- install into the chat screen ---------- */
    function install() {
      var list = $('inboxList'), view = list && list.querySelector('.conversation-view');
      if (!view) return;
      var head = view.querySelector('.ah-chat-head');
      if (head && !head.querySelector('.ah-del')) {
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'ah-del'; del.setAttribute('aria-label', 'Siba chat'); del.textContent = '🗑';
        del.addEventListener('click', function (e) { e.stopPropagation(); deleteChat(); });
        head.appendChild(del);
      }
      var c = composerRow();
      if (c && !c.row.querySelector('.ah-cbtn')) {
        var row = c.row;
        row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
        var plus = document.createElement('button');
        plus.type = 'button'; plus.id = 'ahPhotoBtn'; plus.className = 'ah-cbtn'; plus.setAttribute('aria-label', 'Ohereza ifoto');
        plus.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
        var mic = document.createElement('button');
        mic.type = 'button'; mic.id = 'ahMicBtn'; mic.className = 'ah-cbtn mic'; mic.setAttribute('aria-label', 'Fata ijwi');
        mic.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
        row.insertBefore(plus, c.inp);
        if (c.inp.nextSibling) row.insertBefore(mic, c.inp.nextSibling); else row.appendChild(mic);
        c.inp.style.flex = '1'; c.inp.style.minWidth = '0';
        plus.addEventListener('click', pickPhoto);
        mic.addEventListener('click', startRec);
        var rb = document.createElement('div');
        rb.id = 'ahRecBar'; rb.className = 'ah-recbar';
        rb.innerHTML = '<button type="button" class="x" id="ahMicCancel" style="display:none">✕</button><span class="ah-info" id="ahBarInfo"></span><button type="button" class="ok" id="ahMicSend" style="display:none">Ohereza</button>';
        row.parentNode.insertBefore(rb, row);
        $('ahMicCancel').addEventListener('click', function () { stopRec(true); });
        $('ahMicSend').addEventListener('click', function () { stopRec(false); });
      }
      var cc = composerRow();
      if (cc) { var el = cc.row; while (el.parentElement && el.parentElement !== view) el = el.parentElement; el.classList.add('ah-composer'); }
      fit();
      decorate();
      var ml2 = $('messageList');
      if (ml2 && !ml2.__ahObs && 'MutationObserver' in window) {
        ml2.__ahObs = true;
        new MutationObserver(function () { clearTimeout(ml2.__t); ml2.__t = setTimeout(decorate, 150); }).observe(ml2, { childList: true });
      }
    }

    /* show photos / audio inside the existing bubbles (matched from the newest message backwards) */
    function decorate() {
      var d = dbx(), ml = $('messageList'), id = cur;
      if (!d || !ml || !id) return;
      var bubbles = Array.prototype.slice.call(ml.querySelectorAll('.message-bubble'));
      if (!bubbles.length) return;
      d.collection('conversations').doc(id).collection('messages').orderBy('createdAt', 'desc').limit(bubbles.length).get().then(function (snap) {
        if (id !== cur) return;
        var docs = snap.docs.map(function (x) { return x.data(); }).reverse();
        var off = bubbles.length - docs.length;
        docs.forEach(function (m, i) {
          var b = bubbles[off + i];
          if (!b || !m.mediaURL || !/^https:\/\//.test(m.mediaURL) || b.querySelector('.ah-media')) return;
          Array.prototype.slice.call(b.childNodes).forEach(function (n) {
            var t = (n.textContent || '').trim();
            if (t && t === m.text && !(n.tagName === 'B')) b.removeChild(n);
          });
          var box = document.createElement('div');
          box.className = 'ah-media';
          if (m.mediaType === 'image') {
            var im = document.createElement('img');
            im.src = m.mediaURL; im.alt = 'Photo'; im.loading = 'lazy';
            im.onclick = function () { window.open(m.mediaURL, '_blank'); };
            box.appendChild(im);
          } else {
            var au = document.createElement('audio');
            au.controls = true; au.preload = 'none'; au.src = m.mediaURL;
            box.appendChild(au);
          }
          var bold = b.querySelector('b');
          if (bold && bold.nextSibling) b.insertBefore(box, bold.nextSibling); else b.appendChild(box);
        });
      }).catch(function () { });
    }

    /* chat fills the screen: header on top, composer pinned at the bottom, moves up with the keyboard */
    var uiEl = $('ahInboxUI');
    function fit() {
      if (!uiEl) return;
      var v = window.visualViewport;
      if (!uiEl.classList.contains('in-chat')) { uiEl.style.height = ''; uiEl.style.top = ''; document.documentElement.style.overflow = ''; return; }
      document.documentElement.style.overflow = 'hidden';
      uiEl.style.height = (v ? v.height : window.innerHeight) + 'px';
      uiEl.style.top = (v ? v.offsetTop : 0) + 'px';
      var ml = $('messageList'); if (ml) ml.scrollTop = ml.scrollHeight;
    }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
    window.addEventListener('resize', fit);
    if (uiEl && 'MutationObserver' in window) new MutationObserver(fit).observe(uiEl, { attributes: true, attributeFilter: ['class'] });

    /* wrap openConversation (on top of inbox-ui.js) */
    var prev = window.openConversation;
    if (typeof prev === 'function') {
      window.openConversation = function (id) {
        if (rec) stopRec(true);
        cur = id;
        return Promise.resolve(prev.apply(this, arguments)).then(function (r) { install(); return r; });
      };
    }
  } catch (err) { console.warn('Inbox media not started:', err); }
})();
