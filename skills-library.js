/* Afrishine Skills - E-LIBRARY: category chips, search, course details, per-member progress and certificate.
   Uses the existing academyFiles (category "elibrary"). Optional extra fields set by an admin in "Edit details":
   subject, teacher, lessons (list). Progress is saved in skillsProgress/{uid}_{itemId}. */
(function () {
'use strict';
var AF = window.afSkills, AFA = window.afAcademy; if (!AF || !AFA) return;
AF.libraryReady = true;
var esc = AF.esc, $ = AF.$;
var SUBJECTS = ['AI & Innovation', 'Trading', 'Business', 'Technology', 'Finance', 'Creative Skills', 'General'];
var S = { q: '', sub: '', prog: {}, uid: '', mem: [], memAt: 0 };

function items() {
  var a = AFA.filesOf('elibrary').slice();
  return a.concat(S.mem).sort(function (x, y) { return (AF.ms(y.createdAt) || 0) - (AF.ms(x.createdAt) || 0); });
}
function loadMembers(force) {
  if (!force && S.memAt && Date.now() - S.memAt < 30000) return Promise.resolve();
  return AF.db().collection('skillsLibrary').orderBy('createdAt', 'desc').limit(200).get().then(function (snap) {
    S.mem = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; x.member = true; x.category = 'elibrary'; return x; }); S.memAt = Date.now();
  }).catch(function () { });
}
function subjectOf(f) { return f.subject || 'General'; }
function lessonsOf(f) { return Array.isArray(f.lessons) ? f.lessons.filter(function (x) { return typeof x === 'string' && x.trim(); }).slice(0, 60) : []; }
function pid(uid, itemId) { return uid + '_' + itemId; }
function pctOf(f) { var p = S.prog[f.id]; return p ? Math.max(0, Math.min(100, Number(p.percent) || 0)) : 0; }
function done(f) { var p = S.prog[f.id]; return !!(p && p.status === 'completed'); }
function fileIcon(t) { return t === 'pdf' ? '📄' : t === 'video' ? '🎬' : '🖼️'; }

function loadProgress() {
  var u = AF.piUser();
  if (!u) { S.prog = {}; S.uid = ''; return Promise.resolve(); }
  if (S.uid === u.uid && S.loaded && Date.now() - S.loaded < 30000) return Promise.resolve();
  return AF.db().collection('skillsProgress').where('uid', '==', u.uid).limit(300).get().then(function (snap) {
    S.prog = {}; snap.docs.forEach(function (d) { var x = d.data(); if (x.itemId) S.prog[x.itemId] = x; });
    S.uid = u.uid; S.loaded = Date.now();
  }).catch(function () { });
}

function paint() {
  var box = $('acLibraryBody'); if (!box) return;
  if (!$('skLibList')) {
    box.innerHTML = '<div class="as-bar"><input id="skLibQ" type="search" placeholder="Search courses, guides, teachers…" aria-label="Search"><button type="button" class="as-sell" data-sk="lib-add">＋ Share</button></div><div id="skLibChips"></div><div id="skLibList"></div>';
    $('skLibQ').addEventListener('input', function () { S.q = this.value; paintList(); });
  }
  $('skLibList').innerHTML = '<p class="as-note">Loading…</p>';
  Promise.all([AFA.load(false), loadMembers(true), loadProgress()]).then(paintAll);
}
function paintAll() {
  var all = items(), subs = [], seen = {};
  all.forEach(function (f) { var s = subjectOf(f); if (!seen[s]) { seen[s] = 1; subs.push({ id: s, name: s }); } });
  var mine = all.filter(function (f) { return S.prog[f.id]; }).length;
  var cs = subs.slice(); if (mine) cs.unshift({ id: '__mine', name: 'My learning', icon: '🎓' });
  $('skLibChips').innerHTML = all.length ? AF.chips(cs, S.sub, 'lib-chip', 'All') : '';
  paintList();
}
function paintList() {
  var host = $('skLibList'); if (!host) return;
  var all = items(), q = S.q.toLowerCase();
  var list = all.filter(function (f) {
    if (S.sub === '__mine') { if (!S.prog[f.id]) return false; } else if (S.sub && subjectOf(f) !== S.sub) return false;
    return !q || (f.title + ' ' + (f.description || '') + ' ' + (f.teacher || '') + ' ' + subjectOf(f)).toLowerCase().indexOf(q) >= 0;
  });
  if (!all.length) { host.innerHTML = AF.empty('📖', 'Coming soon', 'Books and guides will appear here as soon as they are added. Verified members can tap ＋ Share.'); return; }
  if (!list.length) { host.innerHTML = AF.empty('🔎', 'No match', 'Try another word or category.'); return; }
  host.innerHTML = list.map(function (f) {
    var p = pctOf(f), has = !!S.prog[f.id];
    return '<button type="button" class="sk-row" data-sk="lib-open" data-id="' + esc(f.id) + '"><span class="sk-row-ico">' + fileIcon(f.fileType) + '</span><span class="sk-row-main"><b>' + esc(f.title) + '</b><small>' + esc(subjectOf(f)) + (f.teacher ? ' · ' + esc(f.teacher) : '') + '</small>' +
      (has ? '<span class="sk-bar"><i style="width:' + p + '%"></i></span>' : '<small>' + esc(AF.snip(f.description, 80)) + '</small>') + '</span>' +
      '<span class="sk-pill ' + (done(f) ? 'ok' : has ? 'go' : '') + '">' + (done(f) ? '✓ Done' : has ? p + '%' : 'Open') + '</span></button>';
  }).join('');
}
AF.on('lib-chip', function (el) { S.sub = el.getAttribute('data-id') || ''; paintAll(); });

/* ---------- course sheet ---------- */
function find(id) { return items().filter(function (f) { return f.id === id; })[0]; }
function openItem(id) {
  var f = find(id); if (!f) return;
  var ls = lessonsOf(f), p = S.prog[f.id], doneIdx = (p && p.done) || [], pc = pctOf(f), has = !!p;
  var h = '<h3>' + esc(f.title) + '</h3><div class="sk-meta"><span class="sk-tag">' + esc(subjectOf(f)) + '</span>' + (f.teacher ? '<span class="sk-tag">👤 ' + esc(f.teacher) + '</span>' : '') + (f.member && f.ownerName ? '<span class="sk-tag">✓ Shared by ' + esc(f.ownerName) + '</span>' : '') + '<span class="sk-tag">' + fileIcon(f.fileType) + ' ' + esc(f.fileType || 'file') + '</span></div>';
  h += '<p class="as-desc">' + esc(f.description || 'No description yet.') + '</p>';
  if (ls.length) h += '<div class="sk-lessons"><b>Lessons (' + ls.length + ')</b>' + ls.map(function (t, i) { var on = doneIdx.indexOf(i) >= 0; return '<button type="button" class="sk-lesson' + (on ? ' on' : '') + '" data-sk="lib-lesson" data-id="' + esc(f.id) + '" data-i="' + i + '"><span>' + (on ? '✓' : (i + 1)) + '</span>' + esc(t) + '</button>'; }).join('') + '</div>';
  if (has || ls.length) h += '<div class="sk-bar big"><i style="width:' + pc + '%"></i></div><p class="as-note" style="margin:0">' + (done(f) ? 'Completed 🎉' : pc + '% complete') + '</p>';
  h += '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="lib-start" data-id="' + esc(f.id) + '">' + (done(f) ? '▶ Open again' : has ? '▶ Continue' : '▶ Start') + '</button>' +
    (done(f) ? '<button type="button" class="as-btn ghost" data-sk="lib-cert" data-id="' + esc(f.id) + '">🏅 Certificate</button>' : '<button type="button" class="as-btn ghost" data-sk="lib-complete" data-id="' + esc(f.id) + '">Mark completed</button>') + '</div>';
  var me = AF.piUser();
  if (f.member && ((me && me.uid === f.uid) || AF.isAdmin())) h += '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="lib-del" data-id="' + esc(f.id) + '">🗑 Delete this resource</button></div>';
  if (AF.isAdmin() && !f.member) h += '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="lib-edit" data-id="' + esc(f.id) + '">✏️ Edit details (admin)</button></div>';
  h += '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Close</button></div>';
  AF.sheet(h);
}
AF.on('lib-open', function (el) { openItem(el.getAttribute('data-id')); });

function save(f, patch) {
  return AF.needPi().then(function (u) {
    if (!u) return null;
    var ls = lessonsOf(f), old = S.prog[f.id], doc = { uid: u.uid, itemId: f.id, title: String(f.title).slice(0, 150), total: ls.length, done: patch.done != null ? patch.done : ((old && old.done) || []), status: patch.status || (old && old.status) || 'started', studentName: AF.myName(), updatedAt: AF.ts() };
    doc.percent = doc.status === 'completed' ? 100 : (ls.length ? Math.round(doc.done.length * 100 / ls.length) : (old && old.percent) || 0);
    if (!old) doc.startedAt = AF.ts();
    if (doc.status === 'completed' && !(old && old.completedAt)) doc.completedAt = AF.ts();
    return AF.db().collection('skillsProgress').doc(pid(u.uid, f.id)).set(doc, { merge: true }).then(function () {
      var merged = Object.assign({}, old || {}, doc); if (doc.completedAt && doc.completedAt._server !== undefined) merged.completedAt = { toMillis: function () { return Date.now(); } };
      S.prog[f.id] = merged; S.uid = u.uid; S.loaded = Date.now(); return merged;
    });
  }).catch(function () { AF.say('Could not save your progress. Please try again.'); return null; });
}
AF.on('lib-start', function (el) {
  var f = find(el.getAttribute('data-id')); if (!f) return;
  (S.prog[f.id] ? Promise.resolve(S.prog[f.id]) : save(f, { status: 'started' })).then(function (p) {
    if (!p) return; AF.closeSheet(); AFA.open(f); paintAll();
  });
});
AF.on('lib-lesson', function (el) {
  var f = find(el.getAttribute('data-id')), i = Number(el.getAttribute('data-i')); if (!f) return;
  var cur = ((S.prog[f.id] && S.prog[f.id].done) || []).slice(), k = cur.indexOf(i);
  if (k >= 0) cur.splice(k, 1); else cur.push(i);
  var all = cur.length >= lessonsOf(f).length;
  save(f, { done: cur, status: all ? 'completed' : 'started' }).then(function (p) { if (!p) return; openItem(f.id); paintAll(); if (all) AF.say('Course completed! Your certificate is ready.'); });
});
AF.on('lib-complete', function (el) {
  var f = find(el.getAttribute('data-id')); if (!f) return;
  var ls = lessonsOf(f); if (ls.length && !confirm('Mark every lesson as done and complete this course?')) return;
  var all = ls.map(function (x, i) { return i; });
  save(f, { done: all, status: 'completed' }).then(function (p) { if (!p) return; openItem(f.id); paintAll(); AF.say('Well done! Your certificate is ready.'); });
});

/* ---------- certificate ---------- */
function certNo(f, p) { return 'AFS-' + String(f.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() + '-' + String(p.uid || S.uid || '').replace(/[^A-Za-z0-9]/g, '').slice(-5).toUpperCase(); }
function openCert(id) {
  var f = find(id), p = f && S.prog[f.id]; if (!f || !p || p.status !== 'completed') return;
  var when = AF.ms(p.completedAt) || Date.now(), name = p.studentName || AF.myName();
  AF.closeSheet();
  var o = AF.screen('Certificate', '<div class="sk-cert" id="skCert"><div class="sk-cert-in"><small>AFRISHINE SKILLS</small><h2>Certificate of Completion</h2><p>This certifies that</p><h3>' + esc(name) + '</h3><p>has successfully completed the course</p><h4>' + esc(f.title) + '</h4><p class="sk-cert-date">' + esc(AF.fmtDate(when)) + '</p><div class="sk-cert-seal">🏅</div><small>Certificate no. ' + esc(certNo(f, p)) + '</small></div></div>' +
    '<div class="as-actions static sk-noprint"><button type="button" class="as-btn main" data-sk="cert-print">🖨️ Print / Save as PDF</button><button type="button" class="as-btn ghost" data-sk="cert-share" data-id="' + esc(f.id) + '">🔗 Share</button></div>');
  o.setAttribute('data-cert', f.id);
}
AF.on('lib-cert', function (el) { openCert(el.getAttribute('data-id')); });
AF.on('cert-print', function () { try { window.print(); } catch (e) { AF.say('Printing is not available here. Take a screenshot of the certificate.'); } });
AF.on('cert-share', function (el) {
  var f = find(el.getAttribute('data-id')), p = f && S.prog[f.id]; if (!f || !p) return;
  var text = 'I completed "' + f.title + '" on Afrishine Skills 🏅 (certificate ' + certNo(f, p) + ')', url = 'https://afrishine-skills.vercel.app';
  if (navigator.share) navigator.share({ title: 'Afrishine Skills certificate', text: text, url: url }).catch(function () { });
  else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text + ' ' + url).then(function () { AF.say('Copied. Paste it to share.'); });
  else prompt('Copy this', text + ' ' + url);
});

/* ---------- Verified members: share a resource ---------- */
var addFile = null;
AF.on('lib-add', function () {
  AF.needPi().then(function (u) {
    if (!u) return;
    AF.verified(u.uid).then(function (ok) {
      if (!ok) { AF.sheet('<h3>Verified members only</h3><p class="as-desc">Only members with a Verified badge can share books, guides and courses. Get your badge from Profile → Verified Badge, then come back.</p><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Close</button></div>'); return; }
      addFile = null;
      AF.sheet('<h3>Share a resource</h3><p class="as-note">PDF, photo or video (max 25 MB).</p>' +
        '<input class="as-input" id="skLaTitle" maxlength="100" placeholder="Title">' +
        '<textarea class="as-input" id="skLaDesc" rows="3" maxlength="600" placeholder="What will members learn?"></textarea>' +
        '<select class="as-input" id="skLaSub">' + SUBJECTS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>' +
        '<input class="as-input" id="skLaTeacher" maxlength="60" placeholder="Teacher / author" value="' + esc(AF.myName()) + '">' +
        '<textarea class="as-input" id="skLaLessons" rows="4" maxlength="3000" placeholder="Lessons, one per line (optional)"></textarea>' +
        '<label class="as-file">📎 Choose file<input id="skLaFile" type="file" accept="application/pdf,image/*,video/*" hidden></label><p class="as-note" id="skLaName" style="margin:0"></p>' +
        '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="lib-add-save">Publish</button></div>');
      var inp = $('skLaFile'); if (inp) inp.addEventListener('change', function () { addFile = inp.files && inp.files[0] || null; $('skLaName').textContent = addFile ? addFile.name : ''; });
    });
  });
});
AF.on('lib-add-save', function (el) {
  var u = AF.piUser(); if (!u) return;
  var title = AF.val('skLaTitle'), desc = AF.val('skLaDesc');
  if (title.length < 3) { AF.say('Write a title.'); return; }
  if (desc.length < 10) { AF.say('Describe the resource (at least 10 characters).'); return; }
  if (!addFile) { AF.say('Choose a file first.'); return; }
  var t = addFile.type || '', kind = t.indexOf('video/') === 0 ? 'video' : t.indexOf('image/') === 0 ? 'image' : (t === 'application/pdf' || /\.pdf$/i.test(addFile.name)) ? 'pdf' : '';
  if (!kind) { AF.say('Only PDF, photo or video files are allowed.'); return; }
  var lessons = AF.val('skLaLessons').split('\n').map(function (x) { return x.trim().slice(0, 120); }).filter(Boolean).slice(0, 60);
  AF.busy(el, true, 'Uploading…');
  AF.upload(addFile, 25).then(function (d) {
    return AF.db().collection('skillsLibrary').add({ uid: u.uid, ownerName: AF.myName().slice(0, 60), title: title.slice(0, 100), description: desc.slice(0, 600), subject: AF.val('skLaSub'), teacher: AF.val('skLaTeacher').slice(0, 60), lessons: lessons, fileUrl: d.url, fileType: kind, createdAt: AF.ts() });
  }).then(function () { addFile = null; AF.closeSheet(); AF.say('Published. Thank you for sharing!'); return loadMembers(true); }).then(paintAll)
    .catch(function (e) { AF.busy(el, false); AF.say(e && e.message && !e.code ? e.message : 'Could not publish. Check that your Verified badge is active.'); });
});
AF.on('lib-del', function (el) {
  var id = el.getAttribute('data-id'); if (!confirm('Delete this resource?')) return;
  AF.db().collection('skillsLibrary').doc(id).delete().then(function () { AF.closeSheet(); AF.say('Deleted.'); return loadMembers(true); }).then(paintAll).catch(function () { AF.say('Could not delete.'); });
});

/* ---------- admin: edit details ---------- */
AF.on('lib-edit', function (el) {
  var f = find(el.getAttribute('data-id')); if (!f || !AF.isAdmin()) return;
  AF.sheet('<h3>Edit course details</h3><select class="as-input" id="skLeSub">' + SUBJECTS.map(function (s) { return '<option' + (subjectOf(f) === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
    '<input class="as-input" id="skLeTeacher" maxlength="60" placeholder="Teacher / instructor name" value="' + esc(f.teacher || '') + '">' +
    '<textarea class="as-input" id="skLeLessons" rows="6" maxlength="3000" placeholder="Lessons, one per line (optional)">' + esc(lessonsOf(f).join('\n')) + '</textarea>' +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="lib-edit-save" data-id="' + esc(f.id) + '">Save</button></div>');
});
AF.on('lib-edit-save', function (el) {
  var id = el.getAttribute('data-id'), lessons = AF.val('skLeLessons').split('\n').map(function (x) { return x.trim().slice(0, 120); }).filter(Boolean).slice(0, 60);
  AF.busy(el, true, 'Saving…');
  AF.db().collection('academyFiles').doc(id).update({ subject: AF.val('skLeSub'), teacher: AF.val('skLeTeacher').slice(0, 60), lessons: lessons, updatedAt: AF.ts() }).then(function () {
    AFA.state.at = 0; return AFA.load(true);
  }).then(function () { AF.closeSheet(); paintAll(); AF.say('Saved.'); }).catch(function () { AF.busy(el, false); AF.say('Could not save.'); });
});

AF.mount('acLibrary', paint);
})();
