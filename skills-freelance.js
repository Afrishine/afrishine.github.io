/* Afrishine Skills - FREELANCE: tabs "Jobs" and "Freelancers", categories, search.
   Only Verified members can post a job (skillsJobs) or create a freelancer profile (skillsFreelancers/{uid}).
   Any signed-in member can Apply (skillsApplications/{jobId}_{uid}) and message through the Academy chat. */
(function () {
'use strict';
var AF = window.afSkills; if (!AF) return;
var esc = AF.esc, $ = AF.$;
var CATS = [{ id: 'website', name: 'Website', icon: '🌐' }, { id: 'design', name: 'Design', icon: '🎨' }, { id: 'programming', name: 'Programming', icon: '💻' }, { id: 'video', name: 'Video editing', icon: '🎬' }, { id: 'writing', name: 'Writing', icon: '✍️' }, { id: 'social', name: 'Social media', icon: '📣' }, { id: 'other', name: 'Other', icon: '➕' }];
function cat(id) { return CATS.filter(function (c) { return c.id === id; })[0] || CATS[CATS.length - 1]; }
var S = { tab: 'jobs', cat: '', q: '', jobs: [], fls: [], prof: {}, loaded: 0, applied: {} };

function load(force) {
  if (!force && S.loaded && Date.now() - S.loaded < 45000) return Promise.resolve();
  var d = AF.db(), u = AF.piUser();
  return Promise.all([
    d.collection('skillsJobs').limit(150).get().then(function (s) { S.jobs = s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).filter(function (j) { return j.status !== 'closed'; }).sort(function (a, b) { return AF.ms(b.createdAt) - AF.ms(a.createdAt); }); }).catch(function () { }),
    d.collection('skillsFreelancers').limit(150).get().then(function (s) { S.fls = s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).sort(function (a, b) { return AF.ms(b.updatedAt) - AF.ms(a.updatedAt); }); }).catch(function () { }),
    u ? d.collection('skillsApplications').where('applicantUid', '==', u.uid).limit(100).get().then(function (s) { S.applied = {}; s.docs.forEach(function (x) { S.applied[x.data().jobId] = 1; }); }).catch(function () { }) : Promise.resolve()
  ]).then(function () {
    S.loaded = Date.now();
    return AF.profiles(S.jobs.map(function (j) { return j.uid; }).concat(S.fls.map(function (f) { return f.uid; }))).then(function (m) { S.prof = m; });
  });
}

function paint() {
  var box = AF.body('acFreelance', 'skFlBody'); if (!box) return;
  if (!$('skFlList')) box.innerHTML = '<div class="sk-tabs" id="skFlTabs"></div><div class="as-bar"><input id="skFlQ" type="search" placeholder="Search jobs or freelancers…" aria-label="Search"><button type="button" class="as-sell" data-sk="fl-new" id="skFlNew"></button></div><div id="skFlChips"></div><div id="skFlList"></div>';
  if (!$('skFlQ').getAttribute('data-b')) { $('skFlQ').setAttribute('data-b', '1'); $('skFlQ').addEventListener('input', function () { S.q = this.value; paintList(); }); }
  $('skFlList').innerHTML = '<p class="as-note">Loading…</p>';
  load(false).then(paintList);
}
function paintList() {
  var host = $('skFlList'); if (!host) return;
  $('skFlTabs').innerHTML = '<button type="button" class="' + (S.tab === 'jobs' ? 'on' : '') + '" data-sk="fl-tab" data-id="jobs">💼 Jobs</button><button type="button" class="' + (S.tab === 'fls' ? 'on' : '') + '" data-sk="fl-tab" data-id="fls">🧑‍💻 Freelancers</button>';
  $('skFlNew').textContent = S.tab === 'jobs' ? '＋ Post job' : '＋ My profile';
  $('skFlChips').innerHTML = AF.chips(CATS, S.cat, 'fl-chip', 'All');
  var q = S.q.toLowerCase();
  if (S.tab === 'jobs') {
    var jl = S.jobs.filter(function (j) { return (!S.cat || j.category === S.cat) && (!q || (j.title + ' ' + (j.description || '') + ' ' + (j.location || '')).toLowerCase().indexOf(q) >= 0); });
    host.innerHTML = jl.length ? jl.map(function (j) {
      return '<button type="button" class="sk-row sk-job" data-sk="fl-job" data-id="' + esc(j.id) + '"><span class="sk-row-ico">' + cat(j.category).icon + '</span><span class="sk-row-main"><b>' + esc(j.title) + '</b><small>' + esc(cat(j.category).name) + (j.location ? ' · 📍 ' + esc(j.location) : '') + ' · ' + esc(AF.fmtDate(AF.ms(j.createdAt))) + '</small><small>' + esc(j.posterName || 'Member') + ' ' + AF.vchip(S.prof[j.uid] && S.prof[j.uid].verified) + '</small></span><span class="sk-pill go">' + esc(j.budget || '—') + '</span></button>';
    }).join('') : AF.empty('💼', S.jobs.length ? 'No match' : 'No jobs yet', S.jobs.length ? 'Try another category or word.' : 'Verified members can post work with “＋ Post job”.');
  } else {
    var fl = S.fls.filter(function (f) { return (!S.cat || f.category === S.cat) && (!q || (f.name + ' ' + (f.skills || '') + ' ' + (f.about || '')).toLowerCase().indexOf(q) >= 0); });
    host.innerHTML = fl.length ? fl.map(function (f) {
      return '<button type="button" class="sk-pro" data-sk="fl-open" data-id="' + esc(f.uid) + '">' + AF.avatar(f.name, f.photo, 'lg') + '<span class="sk-pro-main"><b>' + esc(f.name) + ' ' + AF.vchip(S.prof[f.uid] && S.prof[f.uid].verified) + '</b><small>' + esc(cat(f.category).icon + ' ' + cat(f.category).name) + (f.city ? ' · 📍 ' + esc(f.city) : '') + '</small><small>' + esc(AF.snip(f.skills, 60)) + '</small></span><span class="sk-pro-price">' + esc(f.rate || '') + '</span></button>';
    }).join('') : AF.empty('🧑‍💻', S.fls.length ? 'No match' : 'No freelancers yet', S.fls.length ? 'Try another category or word.' : 'Verified freelancers can add their profile with “＋ My profile”.');
  }
}
AF.on('fl-tab', function (el) { S.tab = el.getAttribute('data-id'); paintList(); });
AF.on('fl-chip', function (el) { S.cat = el.getAttribute('data-id') || ''; paintList(); });

/* ---------- need Verified ---------- */
function gate(then) {
  AF.needPi().then(function (u) {
    if (!u) return;
    AF.verified(u.uid).then(function (ok) {
      if (!ok) { AF.sheet('<h3>Verified members only</h3><p class="as-desc">Only members with a Verified badge can post jobs or create a freelancer profile. Get your badge from Profile → Verified Badge, then come back.</p><div class="as-actions static"><button type="button" class="as-btn main" data-sk="close-sheet">OK</button></div>'); return; }
      then(u);
    });
  });
}
function catSelect(id, cur) { return '<select class="as-input" id="' + id + '">' + CATS.map(function (c) { return '<option value="' + c.id + '"' + (cur === c.id ? ' selected' : '') + '>' + esc(c.icon + ' ' + c.name) + '</option>'; }).join('') + '</select>'; }

/* ---------- jobs ---------- */
AF.on('fl-new', function () {
  if (S.tab === 'jobs') gate(function () {
    AF.sheet('<h3>Post a job</h3><input class="as-input" id="skJTitle" maxlength="90" placeholder="Job title (e.g. Build a website for my shop)">' + catSelect('skJCat', '') + '<input class="as-input" id="skJBudget" maxlength="40" placeholder="Budget (e.g. 50,000 RWF)"><input class="as-input" id="skJLoc" maxlength="60" placeholder="Place or “Remote”"><textarea class="as-input" id="skJDesc" rows="5" maxlength="1200" placeholder="Describe the work and what you expect…"></textarea><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="fl-job-save">Publish</button></div>');
  }); else gate(function (u) { form(S.fls.filter(function (f) { return f.uid === u.uid; })[0]); });
});
AF.on('fl-job-save', function (el) {
  var u = AF.piUser(); if (!u) return;
  var title = AF.val('skJTitle'), desc = AF.val('skJDesc');
  if (title.length < 5) { AF.say('Write the job title.'); return; }
  if (desc.length < 15) { AF.say('Describe the work (at least 15 characters).'); return; }
  AF.busy(el, true, 'Publishing…');
  AF.db().collection('skillsJobs').add({ uid: u.uid, posterName: AF.myName(), title: title.slice(0, 90), category: AF.val('skJCat'), budget: AF.val('skJBudget').slice(0, 40), location: AF.val('skJLoc').slice(0, 60), description: desc.slice(0, 1200), status: 'open', createdAt: AF.ts() })
    .then(function () { AF.closeSheet(); AF.say('Job published.'); return load(true); }).then(paintList)
    .catch(function () { AF.busy(el, false); AF.say('Could not publish. Check that your Verified badge is active.'); });
});
function findJob(id) { return S.jobs.filter(function (j) { return j.id === id; })[0]; }
AF.on('fl-job', function (el) {
  var j = findJob(el.getAttribute('data-id')); if (!j) return;
  var u = AF.piUser(), own = u && u.uid === j.uid, applied = !!S.applied[j.id];
  AF.sheet('<h3>' + esc(j.title) + '</h3><div class="sk-meta"><span class="sk-tag">' + esc(cat(j.category).icon + ' ' + cat(j.category).name) + '</span>' + (j.budget ? '<span class="sk-tag">💰 ' + esc(j.budget) + '</span>' : '') + (j.location ? '<span class="sk-tag">📍 ' + esc(j.location) + '</span>' : '') + '</div>' +
    '<p class="as-note" style="text-align:left">Posted by <b>' + esc(j.posterName || 'Member') + '</b> ' + AF.vchip(S.prof[j.uid] && S.prof[j.uid].verified) + ' · ' + esc(AF.fmtDate(AF.ms(j.createdAt))) + '</p><p class="as-desc">' + esc(j.description) + '</p>' +
    (own ? '<div id="skApps"><p class="as-note">Loading applicants…</p></div><div class="as-actions static"><button type="button" class="as-btn danger" data-sk="fl-job-close" data-id="' + esc(j.id) + '">Close this job</button></div>'
      : applied ? '<p class="as-note">✓ You applied. Your conversation is in Inbox.</p><div class="as-actions static"><button type="button" class="as-btn main" data-sk="fl-msg-job" data-id="' + esc(j.id) + '">💬 Open chat</button></div>'
        : '<textarea class="as-input" id="skApplyMsg" rows="3" maxlength="600" placeholder="Introduce yourself and say why you are the right person…"></textarea><div class="as-actions static"><button type="button" class="as-btn main" data-sk="fl-apply" data-id="' + esc(j.id) + '">Apply now</button></div>') +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Close</button></div>' + (AF.isAdmin() && !own ? '<div class="as-actions static"><button type="button" class="as-btn danger" data-sk="fl-job-del" data-id="' + esc(j.id) + '">Remove (admin)</button></div>' : ''));
  if (own) AF.db().collection('skillsApplications').where('jobId', '==', j.id).where('jobOwnerUid', '==', u.uid).limit(50).get().then(function (snap) {
    var host = $('skApps'); if (!host) return;
    var rows = snap.docs.map(function (d) { return d.data(); });
    host.innerHTML = rows.length ? '<b>Applicants (' + rows.length + ')</b>' + rows.map(function (a) { return '<div class="sk-review"><b>' + esc(a.name || 'Member') + '</b><small>' + esc(AF.fmtDate(AF.ms(a.createdAt))) + '</small><p>' + esc(a.message || '') + '</p><button type="button" class="as-btn ghost" data-sk="fl-open-chat" data-cid="job_' + esc(j.id) + '_' + esc(a.applicantUid) + '" data-t="' + esc(j.title) + '">💬 Chat</button></div>'; }).join('') : '<p class="as-note">No applicants yet.</p>';
  }).catch(function () { var h = $('skApps'); if (h) h.innerHTML = ''; });
});
AF.on('fl-open-chat', function (el) { if (window.afAcademy && window.afAcademy.openChat) window.afAcademy.openChat(el.getAttribute('data-cid'), el.getAttribute('data-t')); });
AF.on('fl-msg-job', function (el) { var j = findJob(el.getAttribute('data-id')); if (j) AF.chat('job_' + j.id, j.uid, j.posterName, j.title); });
AF.on('fl-apply', function (el) {
  var j = findJob(el.getAttribute('data-id')); if (!j) return;
  var msg = AF.val('skApplyMsg'); if (msg.length < 10) { AF.say('Write a short message (at least 10 characters).'); return; }
  AF.needPi().then(function (u) {
    if (!u) return;
    if (u.uid === j.uid) { AF.say('This is your own job.'); return; }
    AF.busy(el, true, 'Sending…');
    return AF.db().collection('skillsApplications').doc(j.id + '_' + u.uid).set({ jobId: j.id, jobOwnerUid: j.uid, applicantUid: u.uid, name: AF.myName(), message: msg.slice(0, 600), createdAt: AF.ts() }).then(function () {
      S.applied[j.id] = 1; AF.closeSheet(); AF.say('Application sent!');
      return AF.chat('job_' + j.id, j.uid, j.posterName, j.title, msg);
    }).catch(function () { AF.busy(el, false); AF.say('Could not send your application (you may have applied already).'); });
  });
});
AF.on('fl-job-close', function (el) {
  if (!confirm('Close this job? It will disappear from the list.')) return;
  AF.db().collection('skillsJobs').doc(el.getAttribute('data-id')).update({ status: 'closed' }).then(function () { AF.closeSheet(); return load(true); }).then(paintList).catch(function () { AF.say('Could not close the job.'); });
});
AF.on('fl-job-del', function (el) {
  if (!AF.isAdmin() || !confirm('Remove this job?')) return;
  AF.db().collection('skillsJobs').doc(el.getAttribute('data-id')).delete().then(function () { AF.closeSheet(); return load(true); }).then(paintList).catch(function () { AF.say('Could not remove.'); });
});

/* ---------- freelancer profiles ---------- */
function findFl(uid) { return S.fls.filter(function (f) { return f.uid === uid; })[0]; }
AF.on('fl-open', function (el) {
  var f = findFl(el.getAttribute('data-id')); if (!f) return;
  var u = AF.piUser(), own = u && u.uid === f.uid;
  AF.sheet('<div class="sk-pro-head">' + AF.avatar(f.name, f.photo, 'xl') + '<div><h3>' + esc(f.name) + '</h3>' + AF.vchip(S.prof[f.uid] && S.prof[f.uid].verified) + '<small>' + esc(cat(f.category).icon + ' ' + cat(f.category).name) + '</small></div></div>' +
    '<div class="sk-meta">' + (f.rate ? '<span class="sk-tag">💰 ' + esc(f.rate) + '</span>' : '') + (f.city ? '<span class="sk-tag">📍 ' + esc(f.city) + '</span>' : '') + '</div>' + (f.skills ? '<p class="as-desc"><b>Skills:</b> ' + esc(f.skills) + '</p>' : '') + '<p class="as-desc">' + esc(f.about || '') + '</p>' +
    (/^https?:\/\//i.test(f.link || '') ? '<p class="as-desc"><a href="' + esc(f.link) + '" target="_blank" rel="noopener noreferrer">🔗 Portfolio</a></p>' : '') +
    (own ? '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="fl-edit">✏️ Edit my profile</button><button type="button" class="as-btn danger" data-sk="fl-remove">Remove</button></div>' : '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="fl-msg" data-id="' + esc(f.uid) + '">💬 Message</button></div>') +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Close</button></div>' + (AF.isAdmin() && !own ? '<div class="as-actions static"><button type="button" class="as-btn danger" data-sk="fl-admin-del" data-id="' + esc(f.uid) + '">Remove (admin)</button></div>' : ''));
});
AF.on('fl-msg', function (el) { var f = findFl(el.getAttribute('data-id')); if (f) AF.chat('fl_' + f.uid, f.uid, f.name, 'Freelance · ' + cat(f.category).name); });
AF.on('fl-admin-del', function (el) { if (!AF.isAdmin() || !confirm('Remove this profile?')) return; AF.db().collection('skillsFreelancers').doc(el.getAttribute('data-id')).delete().then(function () { AF.closeSheet(); return load(true); }).then(paintList).catch(function () { AF.say('Could not remove.'); }); });
AF.on('fl-edit', function () { var u = AF.piUser(); if (u) form(findFl(u.uid)); });
AF.on('fl-remove', function () {
  var u = AF.piUser(); if (!u || !confirm('Remove your freelancer profile?')) return;
  AF.db().collection('skillsFreelancers').doc(u.uid).delete().then(function () { AF.closeSheet(); return load(true); }).then(paintList).catch(function () { AF.say('Could not remove.'); });
});
function form(old) {
  var p = old || {}, file = null;
  var o = AF.sheet('<h3>' + (old ? 'Edit' : 'Create') + ' my freelancer profile</h3><input class="as-input" id="skFName" maxlength="60" placeholder="Your name" value="' + esc(p.name || AF.myName()) + '">' + catSelect('skFCat', p.category) +
    '<input class="as-input" id="skFSkills" maxlength="120" placeholder="Skills (e.g. React, Logo design, Premiere)" value="' + esc(p.skills || '') + '"><input class="as-input" id="skFRate" maxlength="40" placeholder="Rate (e.g. 10,000 RWF / hour)" value="' + esc(p.rate || '') + '"><input class="as-input" id="skFCity" maxlength="60" placeholder="Place or “Remote”" value="' + esc(p.city || '') + '"><input class="as-input" id="skFLink" maxlength="200" placeholder="Portfolio link (optional, https://…)" value="' + esc(p.link || '') + '">' +
    '<textarea class="as-input" id="skFAbout" rows="4" maxlength="800" placeholder="About you and your experience…">' + esc(p.about || '') + '</textarea><label class="as-file">📷 ' + (p.photo ? 'Change photo' : 'Add photo') + '<input id="skFPhoto" type="file" accept="image/*" hidden></label><div class="as-prev" id="skFPrev">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : '') + '</div>' +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="fl-save">Save profile</button></div>');
  o.querySelector('#skFPhoto').addEventListener('change', function () { file = (this.files || [])[0] || null; if (file) $('skFPrev').innerHTML = '<img src="' + URL.createObjectURL(file) + '" alt="">'; });
  S.fFile = function () { return file; }; S.fOld = old || null;
}
AF.on('fl-save', function (el) {
  var u = AF.piUser(); if (!u) return;
  var name = AF.val('skFName'), about = AF.val('skFAbout'), link = AF.val('skFLink');
  if (name.length < 2) { AF.say('Write your name.'); return; }
  if (about.length < 10) { AF.say('Tell clients about yourself (at least 10 characters).'); return; }
  if (link && !/^https:\/\//i.test(link)) { AF.say('The portfolio link must start with https://'); return; }
  AF.busy(el, true, 'Saving…');
  var f = S.fFile && S.fFile(), old = S.fOld;
  (f ? AF.upload(f, 8).then(function (d) { return d.url; }) : Promise.resolve((old && old.photo) || '')).then(function (photo) {
    var doc = { uid: u.uid, name: name.slice(0, 60), category: AF.val('skFCat'), skills: AF.val('skFSkills').slice(0, 120), rate: AF.val('skFRate').slice(0, 40), city: AF.val('skFCity').slice(0, 60), link: link.slice(0, 200), about: about.slice(0, 800), photo: photo || '', updatedAt: AF.ts() };
    if (!old) doc.createdAt = AF.ts();
    return AF.db().collection('skillsFreelancers').doc(u.uid).set(doc, { merge: true });
  }).then(function () { AF.closeSheet(); AF.say('Profile saved.'); return load(true); }).then(paintList)
    .catch(function (e) { AF.busy(el, false); AF.say(e && e.message && !e.code ? e.message : 'Could not save. Check that your Verified badge is active.'); });
});

AF.mount('acFreelance', paint);
})();
