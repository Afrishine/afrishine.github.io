/* Afrishine Hub: Inbox add-on (Photo + Voice + Delete chat).
   Load AFTER inbox-ui.js:  <script src="/inbox-media.js"></script>
   Files are stored in Cloudflare R2 through the Afrishine media Worker. */
(function () {
  'use strict';
  try {
    var page = document.getElementById('inbox');
    if (!page || window.__ahMediaLoaded) return;
    window.__ahMediaLoaded = true;

    var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    function dbx() { return (typeof db !== 'undefined') ? db : null; }
    function me() { return (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null; }
    var MEDIA_RE = /\[\[(img|aud):(https:\/\/[^|\]\s]+)\|([^\]]*)\]\]/;

    var cur = '', rec = null, chunks = [], stream = null, timer = null, secs = 0, cancelled = false;
    var pend = {}; /* messages still sending / failed, per conversation */
    var ui = $('ahInboxUI');

    /* ---------- styles ---------- */
    var st = document.createElement('style');
    st.textContent = [
      '#ahInboxUI.in-chat{position:fixed;left:0;right:0;top:0;height:100vh;height:100dvh;z-index:9999;display:flex;flex-direction:column;max-width:none;margin:0;padding:0;background:#0a0b14}',
      '#ahInboxUI.in-chat #ahPaneMsg,#ahInboxUI.in-chat #ahMsgSlot,#ahInboxUI.in-chat #inboxList{flex:1;min-height:0;display:flex;flex-direction:column}',
      '#ahInboxUI.in-chat .conversation-view{flex:1;min-height:0;display:flex;flex-direction:column;width:100%;max-width:640px;margin:0 auto;padding:0 12px;box-sizing:border-box}',
      '#ahInboxUI.in-chat .ah-chat-head{flex-shrink:0;padding-top:calc(8px + env(safe-area-inset-top,0px))}',
      '#ahInboxUI.in-chat .message-list{flex:1;max-height:none!important;min-height:0!important;overflow-y:auto;overscroll-behavior:contain}',
      '.ah-composer{flex-shrink:0;margin:0!important;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #2c3659;background:#0a0b14}',
      '.ah-cbtn{width:42px;height:42px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:#12172b;color:#fff;border:1px solid #2c3659;padding:0}',
      '.ah-cbtn svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.ah-cbtn.mic{background:#1f9d55;border-color:#1f9d55}',
      '.ah-recbar{display:none;align-items:center;gap:10px;margin:8px 0}',
      '.ah-recbar button{height:44px;padding:0 16px;border-radius:22px;border:0;color:#fff;font-size:15px;font-weight:700}',
      '.ah-recbar .x{background:#e5242f}.ah-recbar .ok{background:#1f9d55}',
      '.ah-recbar .ah-info{flex:1;color:#ffb91f;font-size:15px;font-weight:700}',
      '.ah-del{width:40px;height:40px;flex-shrink:0;border-radius:50%;border:1px solid #2c3659;background:#12172b;font-size:18px;line-height:1;color:#fff}',
      '.ah-media img{display:block;max-width:100%;max-height:300px;border-radius:12px;margin:6px 0;cursor:pointer}',
      '.ah-media audio{display:block;width:100%;min-width:200px;max-width:260px;margin:6px 0}',
      '.ah-pending .ah-media img{opacity:.6}',
      '.ah-pstat{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12.5px;color:#aab4e8}',
      '.ah-pending.failed .ah-pstat{color:#ff8a8a}',
      '.ah-pstat button{height:30px;padding:0 12px;border-radius:15px;border:1px solid #5b3fd0;background:#2a2150;color:#fff;font-size:12.5px;font-weight:700}',
      '.ah-prev{position:absolute;left:0;right:0;top:0;bottom:0;z-index:10;display:flex;flex-direction:column;background:#000}',
      '.ah-prev-top{padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px}',
      '.ah-prev-top button{width:42px;height:42px;border-radius:50%;border:0;background:#222;color:#fff;font-size:20px}',
      '.ah-prev-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 8px}',
      '.ah-prev-img img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}',
      '.ah-prev-bar{display:flex;gap:10px;align-items:center;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#0a0b14;border-top:1px solid #2c3659}',
      '.ah-prev-bar input{flex:1;min-width:0;height:46px;padding:0 16px;border-radius:23px;border:1px solid #2c3659;background:#12172b;color:#fff;font-size:15px;outline:0}',
      '.ah-prev-bar button{height:46px;padding:0 22px;border-radius:23px;border:0;background:#1f9d55;color:#fff;font-size:15px;font-weight:800}'
    ].join('\n');
    document.head.appendChild(st);

    /* ---------- upload to Cloudflare R2 (Worker) ---------- */
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
      if (!u) return Promise.reject({ userMsg: 'Please sign in first.' });
      var base = String(type || '').split(';')[0] || 'application/octet-stream';
      return Promise.all([u.getIdToken(), appCheckHeader()]).then(function (r) {
        var headers = Object.assign({ Authorization: 'Bearer ' + r[0], 'Content-Type': base }, r[1]);
        return fetch(WORKER + '/upload?filename=' + encodeURIComponent('chat.' + ext), { method: 'POST', headers: headers, body: blob });
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || !j.success || !j.url) { throw { userMsg: j.message || ('Upload failed (' + res.status + ').'), code: j.code }; }
          return { url: j.url, key: j.key };
        });
      });
    }
    function parseMedia(v) {
      var m = MEDIA_RE.exec(String((v && v.text) || ''));
      if (m) return { kind: m[1] === 'img' ? 'image' : 'audio', url: m[2], key: m[3] };
      if (v && v.mediaURL) return { kind: v.mediaType === 'image' ? 'image' : 'audio', url: v.mediaURL, key: v.mediaKey || '' };
      return null;
    }
    function removeMedia(docs) {
      var u = me();
      if (!u) return Promise.resolve();
      return u.getIdToken().then(function (tok) {
        return Promise.all(docs.map(function (x) { return x.data(); }).filter(function (v) { return v.senderUid === u.uid; }).map(function (v) {
          var m = parseMedia(v);
          if (!m || !m.key) return null;
          return fetch(WORKER + '/delete', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: m.key }) }).catch(function () { });
        }));
      }).catch(function () { });
    }
    function reason(e) {
      if (e && e.userMsg) return e.userMsg;
      if (e && e.code === 'permission-denied') return 'Permission denied by Firestore rules.';
      if (e instanceof TypeError || !navigator.onLine) return 'No connection.';
      return (e && (e.code || e.message)) || 'Unknown error.';
    }

    /* ---------- sending queue (WhatsApp style: shows in chat right away, retry on failure) ---------- */
    function reopen() {
      var nm = document.querySelector('#ahInboxUI .ah-chat-who .ah-name');
      if (typeof window.openConversation === 'function') window.openConversation(cur, nm ? nm.textContent : 'Conversation');
    }
    function saveMessage(it) {
      var d = dbx(), u = me();
      if (!d || !u) return Promise.reject({ userMsg: 'Please sign in first.' });
      var ref = d.collection('conversations').doc(it.conv);
      var marker = '[[' + (it.kind === 'image' ? 'img' : 'aud') + ':' + it.up.url + '|' + (it.up.key || '') + ']]';
      var text = (it.caption ? it.caption + '\n' : '') + marker;
      var last = it.caption || (it.kind === 'image' ? '📷 Photo' : '🎤 Voice message');
      var ts = firebase.firestore.FieldValue.serverTimestamp();
      var step = it.saved ? Promise.resolve() : ref.collection('messages').add({
        senderUid: u.uid,
        senderName: u.displayName || (u.email || '').split('@')[0] || 'Member',
        text: text,
        createdAt: ts
      }).then(function () { it.saved = true; });
      return step.then(function () { return ref.update({ lastMessage: last, updatedAt: ts }); });
    }
    function processItem(it) {
      it.state = 'sending'; it.err = ''; paintPending();
      var step = it.up ? Promise.resolve(it.up) : upload(it.blob, it.ext, it.type).then(function (up) { it.up = up; return up; });
      step.then(function () { return saveMessage(it); }).then(function () {
        it.state = 'done';
        dropItem(it);
        if (cur === it.conv) reopen();
      }).catch(function (e) {
        console.warn('Inbox media send failed:', e);
        it.state = 'failed'; it.err = reason(e); paintPending();
      });
    }
    function enqueue(kind, blob, ext, type, caption) {
      if (!cur) return;
      var it = { id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), conv: cur, kind: kind, blob: blob, ext: ext, type: type, caption: caption || '', state: 'sending', err: '', preview: URL.createObjectURL(blob) };
      (pend[cur] = pend[cur] || []).push(it);
      paintPending();
      processItem(it);
    }
    function dropItem(it) {
      pend[it.conv] = (pend[it.conv] || []).filter(function (x) { return x !== it; });
      try { URL.revokeObjectURL(it.preview); } catch (_) { }
      var el = document.querySelector('[data-pid="' + it.id + '"]');
      if (el) el.remove();
    }
    function paintPending() {
      var ml = $('messageList');
      if (!ml || !cur) return;
      (pend[cur] || []).forEach(function (it) {
        var el = ml.querySelector('[data-pid="' + it.id + '"]');
        if (!el) { el = document.createElement('div'); el.className = 'message-bubble mine ah-pending'; el.setAttribute('data-pid', it.id); ml.appendChild(el); }
        el.classList.toggle('failed', it.state === 'failed');
        var media = it.kind === 'image' ? '<img src="' + it.preview + '" alt="Photo">' : '<audio controls preload="metadata" src="' + it.preview + '"></audio>';
        var stat = it.state === 'failed'
          ? '⚠ Not sent' + (it.err ? ' · ' + esc(it.err) : '') + ' <button type="button" data-act="retry">Retry</button><button type="button" data-act="del">Delete</button>'
          : '🕓 Sending…';
        el.innerHTML = '<div class="ah-media">' + media + '</div>' + (it.caption ? '<div>' + esc(it.caption) + '</div>' : '') + '<div class="ah-pstat">' + stat + '</div>';
        Array.prototype.forEach.call(el.querySelectorAll('[data-act]'), function (b) {
          b.addEventListener('click', function () { b.getAttribute('data-act') === 'retry' ? processItem(it) : dropItem(it); });
        });
      });
      ml.scrollTop = ml.scrollHeight;
    }

    /* ---------- photo: pick, preview with caption, send ---------- */
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
    function showPreview(blob) {
      var old = $('ahPrev'); if (old) old.remove();
      var url = URL.createObjectURL(blob), box = document.createElement('div');
      box.id = 'ahPrev'; box.className = 'ah-prev';
      box.innerHTML = '<div class="ah-prev-top"><button type="button" id="ahPrevX" aria-label="Cancel">✕</button></div><div class="ah-prev-img"><img src="' + url + '" alt="Preview"></div><div class="ah-prev-bar"><input id="ahPrevCap" type="text" maxlength="300" placeholder="Add a caption…" autocomplete="off"><button type="button" id="ahPrevGo">Send</button></div>';
      ui.appendChild(box);
      function close() { box.remove(); try { URL.revokeObjectURL(url); } catch (_) { } }
      $('ahPrevX').addEventListener('click', close);
      $('ahPrevGo').addEventListener('click', function () { var cap = ($('ahPrevCap').value || '').trim(); close(); enqueue('image', blob, 'jpg', 'image/jpeg', cap); });
    }
    function pickPhoto() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        compress(f).then(showPreview).catch(function () { alert('This photo could not be opened. Please choose another one.'); });
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
      if (rec) return;
      if (!navigator.mediaDevices || !window.MediaRecorder) { alert('Voice recording is not supported on this device.'); return; }
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
          enqueue('audio', blob, ext, type, '');
        };
        rec.start(); setRecUI(true); setInfo('● 0:00');
        timer = setInterval(function () {
          secs++; setInfo('● ' + Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2));
          if (secs >= 120 && rec && rec.state === 'recording') rec.stop();
        }, 1000);
      }).catch(function () { alert('Please allow microphone access to record a voice message.'); });
    }
    function stopRec(cancel) { cancelled = !!cancel; if (rec && rec.state === 'recording') rec.stop(); }

    /* ---------- delete chat ---------- */
    var deleting = false;
    function deleteChat() {
      var d = dbx(), id = cur;
      if (!d || !id || deleting) return;
      if (!confirm('Delete this chat permanently? All messages will be removed and cannot be restored.')) return;
      deleting = true;
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
        .then(function () { delete pend[id]; cur = ''; if (typeof window.loadInbox === 'function') window.loadInbox(); })
        .catch(function (e) { console.warn(e); alert('The chat could not be deleted. ' + reason(e)); })
        .then(function () { deleting = false; });
    }

    /* ---------- install into the chat screen ---------- */
    function install() {
      var list = $('inboxList'), view = list && list.querySelector('.conversation-view');
      if (!view) return;
      var head = view.querySelector('.ah-chat-head');
      if (head && !head.querySelector('.ah-del')) {
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'ah-del'; del.setAttribute('aria-label', 'Delete chat'); del.textContent = '🗑';
        del.addEventListener('click', function (e) { e.stopPropagation(); deleteChat(); });
        head.appendChild(del);
      }
      var c = composerRow();
      if (c && !c.row.querySelector('.ah-cbtn')) {
        var row = c.row;
        row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
        var plus = document.createElement('button');
        plus.type = 'button'; plus.id = 'ahPhotoBtn'; plus.className = 'ah-cbtn'; plus.setAttribute('aria-label', 'Send a photo');
        plus.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
        var mic = document.createElement('button');
        mic.type = 'button'; mic.id = 'ahMicBtn'; mic.className = 'ah-cbtn mic'; mic.setAttribute('aria-label', 'Record a voice message');
        mic.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
        row.insertBefore(plus, c.inp);
        if (c.inp.nextSibling) row.insertBefore(mic, c.inp.nextSibling); else row.appendChild(mic);
        c.inp.style.flex = '1'; c.inp.style.minWidth = '0';
        plus.addEventListener('click', pickPhoto);
        mic.addEventListener('click', startRec);
        var rb = document.createElement('div');
        rb.id = 'ahRecBar'; rb.className = 'ah-recbar';
        rb.innerHTML = '<button type="button" class="x" id="ahMicCancel" style="display:none">✕</button><span class="ah-info" id="ahBarInfo"></span><button type="button" class="ok" id="ahMicSend" style="display:none">Send</button>';
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

    /* photos / voice inside the existing bubbles (matched from the newest message backwards) */
    function decorate() {
      var d = dbx(), ml = $('messageList'), id = cur;
      if (!d || !ml || !id) return;
      paintPending();
      var bubbles = Array.prototype.slice.call(ml.querySelectorAll('.message-bubble:not(.ah-pending)'));
      if (!bubbles.length) return;
      d.collection('conversations').doc(id).collection('messages').orderBy('createdAt', 'desc').limit(bubbles.length).get().then(function (snap) {
        if (id !== cur) return;
        var docs = snap.docs.map(function (x) { return x.data(); }).reverse();
        var off = bubbles.length - docs.length;
        docs.forEach(function (v, i) {
          var b = bubbles[off + i], m = parseMedia(v);
          if (!b || !m || b.querySelector('.ah-media')) return;
          var walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, null), n;
          while ((n = walker.nextNode())) { if (MEDIA_RE.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(new RegExp(MEDIA_RE.source, 'g'), '').trim(); }
          var box = document.createElement('div');
          box.className = 'ah-media';
          if (m.kind === 'image') {
            var im = document.createElement('img');
            im.src = m.url; im.alt = 'Photo'; im.loading = 'lazy';
            im.onclick = function () { window.open(m.url, '_blank'); };
            box.appendChild(im);
          } else {
            var au = document.createElement('audio');
            au.controls = true; au.preload = 'none'; au.src = m.url;
            box.appendChild(au);
          }
          var bold = b.querySelector('b');
          if (bold && bold.nextSibling) b.insertBefore(box, bold.nextSibling); else b.insertBefore(box, b.firstChild);
        });
      }).catch(function () { });
    }

    /* chat fills the screen: header on top, composer pinned at the bottom, moves up with the keyboard */
    function fit() {
      if (!ui) return;
      var v = window.visualViewport;
      if (!ui.classList.contains('in-chat')) { ui.style.height = ''; ui.style.top = ''; document.documentElement.style.overflow = ''; return; }
      document.documentElement.style.overflow = 'hidden';
      ui.style.height = (v ? v.height : window.innerHeight) + 'px';
      ui.style.top = (v ? v.offsetTop : 0) + 'px';
      var ml = $('messageList'); if (ml) ml.scrollTop = ml.scrollHeight;
    }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
    window.addEventListener('resize', fit);
    if (ui && 'MutationObserver' in window) new MutationObserver(fit).observe(ui, { attributes: true, attributeFilter: ['class'] });

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
