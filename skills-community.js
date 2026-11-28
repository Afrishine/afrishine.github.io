/* Afrishine COMMUNITY - Groups (join / leave, posts), Challenges (entries, votes, leaderboard, winners) and Events & Live (reminders).
   One code base, two places:  space "skills" = Afrishine Skills -> Community section;  space "hub" = the Hub's #community page
   (the Musicians / Dancers / Fashion chips, Explore Challenges, Explore Events buttons are connected here).
   Challenges and Events are created by an admin only. Only Verified members post in groups. One vote per member per entry.
   Collections: skillsGroups, skillsMembers, skillsGroupPosts, skillsChallenges, skillsEntries, skillsVotes, skillsEvents, skillsReminders. */
(function () {
'use strict';
var AF = window.afSkills; if (!AF) return;
var esc = AF.esc, $ = AF.$;
var DEFAULTS = {
  hub: [{ name: 'Musicians', emoji: '🎵', description: 'Singers, producers, bands and music lovers.' }, { name: 'Dancers', emoji: '💃', description: 'Dancers, choreographers and dance crews.' }, { name: 'Fashion', emoji: '👗', description: 'Designers, models, tailors and stylists.' }],
  skills: [{ name: 'Learners', emoji: '🎓', description: 'Share what you are learning and help each other.' }, { name: 'Tech', emoji: '💻', description: 'Programming, web, AI and cyber safety.' }, { name: 'Business & Trading', emoji: '💼', description: 'Business ideas, trading and finance.' }]
};
var NAME = { hub: 'Afrishine Hub Community', skills: 'Afrishine Skills Community' };
var X = { space: 'skills', stack: [], timer: null, cache: {} };

function d() { return AF.db(); }
function cd(msv) { var s = Math.max(0, Math.floor((msv - Date.now()) / 1000)), dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (dd ? dd + 'd ' : '') + (dd || h ? h + 'h ' : '') + m + 'm' + (!dd && !h ? ' ' + (s % 60) + 's' : ''); }
function toLocalInput(msv) { var x = new Date(msv - new Date().getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); }
function mediaOk(u) { return typeof u === 'string' && u.indexOf(AF.WORKER + '/media/') === 0; }
function mediaHtml(u, t) { if (!mediaOk(u)) return ''; return t === 'video' ? '<video src="' + esc(u) + '" controls playsinline preload="metadata"></video>' : '<img src="' + esc(u) + '" alt="" loading="lazy">'; }

/* ---------- full-screen navigation ---------- */
function go(title, render) { X.stack.push({ title: title, render: render }); show(); }
function show() {
  var top = X.stack[X.stack.length - 1]; if (!top) return;
  stopTimer();
  var o = $('skScreen');
  if (!o) { o = AF.screen(top.title, ''); o.querySelector('.sk-back').setAttribute('data-sk', 'com-back'); }
  $('skScreenTitle').textContent = top.title; $('skScreenBody').innerHTML = '<p class="as-note">Loading…</p>'; $('skScreenBody').scrollTop = 0;
  top.render($('skScreenBody'));
}
function back() { X.stack.pop(); if (X.stack.length) show(); else { stopTimer(); AF.closeScreen(); } }
function refresh() { show(); }
AF.on('com-back', back);
function stopTimer() { if (X.timer) { clearInterval(X.timer); X.timer = null; } }
function startTimer() { stopTimer(); X.timer = setInterval(function () { Array.prototype.forEach.call(document.querySelectorAll('[data-cd]'), function (e) { var t = Number(e.getAttribute('data-cd')); e.textContent = t > Date.now() ? cd(t) : 'ended'; }); }, 1000); }
function open(space, title, render) { X.space = space; X.stack = []; go(title, render); }
function errBox(host) { host.innerHTML = AF.empty('⚠️', 'Could not load', 'Check your connection and try again.', '<button type="button" class="as-btn main" data-sk="com-refresh">Try again</button>'); }
AF.on('com-refresh', refresh);

/* =============================== GROUPS =============================== */
function loadGroups() {
  return d().collection('skillsGroups').where('space', '==', X.space).limit(60).get().then(function (s) { return s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).sort(function (a, b) { return AF.ms(a.createdAt) - AF.ms(b.createdAt); }); });
}
function myMemberships() {
  var u = AF.anyUser(); if (!u) return Promise.resolve({});
  return d().collection('skillsMembers').where('uid', '==', u.uid).limit(100).get().then(function (s) { var m = {}; s.docs.forEach(function (x) { m[x.data().groupId] = 1; }); return m; }).catch(function () { return {}; });
}
function openGroups(hint) {
  open(X.space, 'Groups', function (host) {
    Promise.all([loadGroups(), myMemberships()]).then(function (r) {
      var gs = r[0], mem = r[1];
      if (hint) { var h = gs.filter(function (g) { return g.name.toLowerCase() === String(hint).toLowerCase(); })[0]; hint = null; if (h) { return go(h.name, function (hh) { renderGroup(hh, h.id); }); } }
      var admin = AF.isAdmin();
      host.innerHTML = '<p class="as-note" style="text-align:left">Find people who share your interests. Join a group to see and share posts.</p>' +
        (admin ? '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="grp-new">＋ New group</button>' + (gs.length ? '' : '<button type="button" class="as-btn ghost" data-sk="grp-seed">Create default groups</button>') + '</div>' : '') +
        (gs.length ? gs.map(function (g) { return '<div class="sk-grp"><button type="button" class="sk-grp-main" data-sk="grp-open" data-id="' + esc(g.id) + '"><span class="sk-grp-ico">' + esc(g.emoji || '👥') + '</span><span><b>' + esc(g.name) + '</b><small>' + esc(AF.snip(g.description, 70)) + '</small><small>' + (Number(g.memberCount) > 0 ? Number(g.memberCount) : 0) + ' member' + (Number(g.memberCount) === 1 ? '' : 's') + '</small></span></button><button type="button" class="sk-join' + (mem[g.id] ? ' on' : '') + '" data-sk="grp-join" data-id="' + esc(g.id) + '">' + (mem[g.id] ? 'Joined ✓' : 'Join') + '</button></div>'; }).join('') : AF.empty('👥', 'No groups yet', admin ? 'Tap “Create default groups” to start.' : 'Groups are opening soon.'));
    }).catch(function () { errBox(host); });
  });
}
function renderGroup(host, gid) {
  var u = AF.anyUser();
  Promise.all([d().collection('skillsGroups').doc(gid).get(), myMemberships(), d().collection('skillsGroupPosts').where('groupId', '==', gid).limit(60).get(), u ? AF.verified(u.uid) : Promise.resolve(false)]).then(function (r) {
    if (!r[0].exists) { host.innerHTML = AF.empty('👥', 'Group not found', ''); return; }
    var g = Object.assign({ id: gid }, r[0].data()), joined = !!r[1][gid], posts = r[2].docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).sort(function (a, b) { return AF.ms(b.createdAt) - AF.ms(a.createdAt); }), ver = r[3];
    return AF.profiles(posts.map(function (p) { return p.uid; })).then(function (pf) {
      host.innerHTML = '<div class="sk-grp-head"><span class="sk-grp-ico big">' + esc(g.emoji || '👥') + '</span><div><h3>' + esc(g.name) + '</h3><small>' + (Number(g.memberCount) || 0) + ' members</small></div><button type="button" class="sk-join' + (joined ? ' on' : '') + '" data-sk="grp-join" data-id="' + esc(gid) + '" data-in="1">' + (joined ? 'Joined ✓' : 'Join') + '</button></div><p class="as-desc">' + esc(g.description || '') + '</p>' +
        (joined && ver ? '<div class="sk-compose"><textarea class="as-input" id="skGpText" rows="3" maxlength="1000" placeholder="Share something with the group…"></textarea><label class="as-file">📷 Add photo<input id="skGpFile" type="file" accept="image/*" hidden></label><span id="skGpName" class="as-note"></span><button type="button" class="as-btn main" data-sk="grp-post" data-id="' + esc(gid) + '">Post</button></div>'
          : '<p class="as-note sk-lock">' + (!joined ? 'Join this group to post.' : 'Only members with a Verified badge can post in groups. Everyone can read.') + '</p>') +
        (posts.length ? posts.map(function (p) { var me = u && u.uid === p.uid; return '<article class="sk-post"><div class="sk-post-h">' + AF.avatar(p.name, (pf[p.uid] || {}).photo) + '<b>' + esc(p.name || 'Member') + '</b> ' + AF.vchip((pf[p.uid] || {}).verified) + '<small>' + esc(AF.fmtDate(AF.ms(p.createdAt))) + '</small>' + (me || AF.isAdmin() ? '<button type="button" class="sk-x" data-sk="grp-del" data-id="' + esc(p.id) + '" data-g="' + esc(gid) + '" aria-label="Delete">🗑</button>' : '') + '</div><p>' + esc(p.text || '') + '</p>' + (p.mediaUrl ? '<div class="sk-media">' + mediaHtml(p.mediaUrl, p.mediaType) + '</div>' : '') + '</article>'; }).join('') : AF.empty('💬', 'No posts yet', joined ? 'Be the first to post.' : 'Join the group to start the conversation.')) +
        (AF.isAdmin() ? '<div class="as-actions static"><button type="button" class="as-btn danger" data-sk="grp-remove" data-id="' + esc(gid) + '">Delete this group (admin)</button></div>' : '');
      var f = $('skGpFile'); if (f) f.addEventListener('change', function () { $('skGpName').textContent = this.files && this.files[0] ? this.files[0].name : ''; });
    });
  }).catch(function () { errBox(host); });
}
AF.on('grp-open', function (el) { var id = el.getAttribute('data-id'); go('Group', function (h) { renderGroup(h, id); }); });
AF.on('grp-join', function (el) {
  var gid = el.getAttribute('data-id'), inGroup = el.getAttribute('data-in') === '1';
  AF.needAny().then(function (u) {
    if (!u) return;
    var ref = d().collection('skillsMembers').doc(gid + '_' + u.uid), g = d().collection('skillsGroups').doc(gid), b = d().batch();
    return ref.get().then(function (s) {
      if (s.exists) { b.delete(ref); b.update(g, { memberCount: firebase.firestore.FieldValue.increment(-1) }); }
      else { b.set(ref, { groupId: gid, uid: u.uid, name: AF.myName(), createdAt: AF.ts() }); b.update(g, { memberCount: firebase.firestore.FieldValue.increment(1) }); }
      return b.commit();
    }).then(refresh);
  }).catch(function () { AF.say('Could not update. Please try again.'); });
});
AF.on('grp-post', function (el) {
  var gid = el.getAttribute('data-id'), u = AF.anyUser(), text = AF.val('skGpText'), f = $('skGpFile') && $('skGpFile').files[0];
  if (!u) return; if (text.length < 2 && !f) { AF.say('Write something or add a photo.'); return; }
  AF.busy(el, true, 'Posting…');
  (f ? AF.upload(f, 10) : Promise.resolve(null)).then(function (up) {
    var doc = { groupId: gid, uid: u.uid, name: AF.myName(), text: text.slice(0, 1000), createdAt: AF.ts() };
    if (up) { doc.mediaUrl = up.url; doc.mediaType = 'image'; }
    return d().collection('skillsGroupPosts').add(doc);
  }).then(refresh).catch(function (e) { AF.busy(el, false); AF.say(e && e.message && !e.code ? e.message : 'Could not post. Check that you joined and your Verified badge is active.'); });
});
AF.on('grp-del', function (el) { if (!confirm('Delete this post?')) return; d().collection('skillsGroupPosts').doc(el.getAttribute('data-id')).delete().then(refresh).catch(function () { AF.say('Could not delete.'); }); });
AF.on('grp-remove', function (el) { if (!AF.isAdmin() || !confirm('Delete this group?')) return; d().collection('skillsGroups').doc(el.getAttribute('data-id')).delete().then(function () { back(); }).catch(function () { AF.say('Could not delete.'); }); });
AF.on('grp-seed', function (el) {
  if (!AF.isAdmin()) return; AF.busy(el, true, 'Creating…');
  var b = d().batch(); DEFAULTS[X.space].forEach(function (g, i) { b.set(d().collection('skillsGroups').doc(), { name: g.name, emoji: g.emoji, description: g.description, space: X.space, memberCount: 0, createdAt: AF.stamp(Date.now() + i) }); });
  b.commit().then(refresh).catch(function () { AF.busy(el, false); AF.say('Could not create groups.'); });
});
AF.on('grp-new', function () {
  if (!AF.isAdmin()) return;
  AF.sheet('<h3>New group</h3><input class="as-input" id="skNgEmoji" maxlength="4" placeholder="Emoji (e.g. 🎤)"><input class="as-input" id="skNgName" maxlength="40" placeholder="Group name"><textarea class="as-input" id="skNgDesc" rows="3" maxlength="200" placeholder="What is this group about?"></textarea><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="grp-new-save">Create</button></div>');
});
AF.on('grp-new-save', function (el) {
  var name = AF.val('skNgName'); if (name.length < 2) { AF.say('Write the group name.'); return; }
  AF.busy(el, true, 'Creating…');
  d().collection('skillsGroups').add({ name: name.slice(0, 40), emoji: AF.val('skNgEmoji').slice(0, 4) || '👥', description: AF.val('skNgDesc').slice(0, 200), space: X.space, memberCount: 0, createdAt: AF.ts() }).then(function () { AF.closeSheet(); refresh(); }).catch(function () { AF.busy(el, false); AF.say('Could not create the group.'); });
});

/* ============================== CHALLENGES ============================== */
function chState(c) { var n = Date.now(), s = AF.ms(c.start), e = AF.ms(c.end); return n < s ? 'upcoming' : n > e ? 'ended' : 'active'; }
function openChallenges() {
  var tab = 'active';
  open(X.space, 'Challenges', function render(host) {
    d().collection('skillsChallenges').where('space', '==', X.space).limit(60).get().then(function (snap) {
      var all = snap.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); });
      var act = all.filter(function (c) { return chState(c) === 'active'; }).sort(function (a, b) { return AF.ms(a.end) - AF.ms(b.end); });
      var week = act.filter(function (c) { return c.weekly; })[0] || act[0];
      var list = all.filter(function (c) { return chState(c) === tab; }).sort(function (a, b) { return tab === 'ended' ? AF.ms(b.end) - AF.ms(a.end) : AF.ms(a.start) - AF.ms(b.start); });
      host.innerHTML = (AF.isAdmin() ? '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="ch-new">＋ New challenge</button></div>' : '') +
        (week ? '<button type="button" class="sk-week" data-sk="ch-open" data-id="' + esc(week.id) + '"><small>🔥 CHALLENGE OF THE WEEK</small><b>' + esc(week.title) + '</b><span>🏆 ' + esc(week.prizes || 'Prizes to be won') + '</span><em>Ends in <span data-cd="' + AF.ms(week.end) + '">' + cd(AF.ms(week.end)) + '</span></em></button>' : '') +
        '<div class="sk-tabs">' + [['active', 'Active'], ['upcoming', 'Upcoming'], ['ended', 'Ended']].map(function (t) { return '<button type="button" class="' + (tab === t[0] ? 'on' : '') + '" data-sk="ch-tab" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        (list.length ? list.map(function (c) { var st = chState(c); return '<button type="button" class="sk-row" data-sk="ch-open" data-id="' + esc(c.id) + '"><span class="sk-row-ico">🔥</span><span class="sk-row-main"><b>' + esc(c.title) + '</b><small>' + esc(AF.snip(c.description, 80)) + '</small><small>' + (st === 'active' ? 'Ends in <span data-cd="' + AF.ms(c.end) + '">' + cd(AF.ms(c.end)) + '</span>' : st === 'upcoming' ? 'Starts in <span data-cd="' + AF.ms(c.start) + '">' + cd(AF.ms(c.start)) + '</span>' : 'Ended ' + esc(AF.fmtDate(AF.ms(c.end)))) + '</small></span><span class="sk-pill ' + (st === 'active' ? 'go' : st === 'ended' ? 'ok' : '') + '">' + (st === 'active' ? 'Join' : st === 'ended' ? 'Results' : 'Soon') + '</span></button>'; }).join('') : AF.empty('🔥', 'Nothing here yet', tab === 'active' ? 'No active challenge right now.' : tab === 'upcoming' ? 'No upcoming challenge yet.' : 'No finished challenge yet.'));
      startTimer(); X.tabSetter = function (t) { tab = t; render(host); };
    }).catch(function () { errBox(host); });
  });
}
AF.on('ch-tab', function (el) { if (X.tabSetter) X.tabSetter(el.getAttribute('data-id')); });
AF.on('ch-open', function (el) { var id = el.getAttribute('data-id'); go('Challenge', function (h) { renderChallenge(h, id); }); });

function renderChallenge(host, cid) {
  var u = AF.anyUser();
  Promise.all([d().collection('skillsChallenges').doc(cid).get(), d().collection('skillsEntries').where('challengeId', '==', cid).limit(100).get(), u ? d().collection('skillsVotes').where('uid', '==', u.uid).where('challengeId', '==', cid).limit(200).get().catch(function () { return { docs: [] }; }) : Promise.resolve({ docs: [] })]).then(function (r) {
    if (!r[0].exists) { host.innerHTML = AF.empty('🔥', 'Challenge not found', ''); return; }
    var c = Object.assign({ id: cid }, r[0].data()), st = chState(c), entries = r[1].docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).sort(function (a, b) { return (Number(b.votes) || 0) - (Number(a.votes) || 0) || AF.ms(a.createdAt) - AF.ms(b.createdAt); });
    var voted = {}; r[2].docs.forEach(function (x) { voted[x.data().entryId] = 1; });
    var mine = u && entries.filter(function (e) { return e.uid === u.uid; })[0], medals = ['🥇', '🥈', '🥉'];
    var winners = Array.isArray(c.winners) ? c.winners : [];
    host.innerHTML = '<h3>' + esc(c.title) + '</h3><div class="sk-meta"><span class="sk-tag">' + (st === 'active' ? '⏳ Ends in <span data-cd="' + AF.ms(c.end) + '">' + cd(AF.ms(c.end)) + '</span>' : st === 'upcoming' ? '🕒 Starts in <span data-cd="' + AF.ms(c.start) + '">' + cd(AF.ms(c.start)) + '</span>' : '🏁 Ended') + '</span><span class="sk-tag">' + (c.media === 'video' ? '🎬 Video' : c.media === 'photo' ? '📷 Photo' : '📷/🎬 Photo or video') + '</span></div>' +
      '<p class="as-desc">' + esc(c.description || '') + '</p>' + (c.rules ? '<div class="sk-box2"><b>📜 Rules</b><p>' + esc(c.rules).replace(/\n/g, '<br>') + '</p></div>' : '') + (c.prizes ? '<div class="sk-box2"><b>🏆 Prizes</b><p>' + esc(c.prizes).replace(/\n/g, '<br>') + '</p></div>' : '') +
      (winners.length ? '<div class="sk-box2 win"><b>🎉 Winners</b>' + winners.map(function (w, i) { return '<p>' + (medals[i] || '🏅') + ' <b>' + esc(w.name) + '</b> · ' + (Number(w.votes) || 0) + ' ♥</p>'; }).join('') + '</div>' : '') +
      (st === 'active' ? (mine ? '<p class="as-note">✓ You joined this challenge. Share it so friends can vote for you!</p>' : '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="ch-join" data-id="' + esc(cid) + '">📤 Join with my ' + (c.media === 'video' ? 'video' : c.media === 'photo' ? 'photo' : 'photo / video') + '</button></div>') : '') +
      (AF.isAdmin() ? '<div class="as-actions static">' + (st === 'ended' && !winners.length && entries.length ? '<button type="button" class="as-btn main" data-sk="ch-winners" data-id="' + esc(cid) + '">🏆 Pick winners (top 3)</button>' : '') + '<button type="button" class="as-btn danger" data-sk="ch-del" data-id="' + esc(cid) + '">Delete challenge</button></div>' : '') +
      '<h4 class="sk-h">Leaderboard</h4>' + (entries.length ? entries.map(function (e, i) {
        var own = u && e.uid === u.uid, canVote = st === 'active' && u && !own && !voted[e.id];
        return '<article class="sk-entry"><div class="sk-post-h"><span class="sk-rank">' + (medals[i] || (i + 1)) + '</span><b>' + esc(e.name || 'Member') + '</b><button type="button" class="sk-vote' + (voted[e.id] ? ' on' : '') + '" data-sk="ch-vote" data-id="' + esc(e.id) + '"' + (canVote || !u ? '' : ' disabled') + ' aria-label="Vote">♥ <span>' + (Number(e.votes) || 0) + '</span></button>' + (own && st === 'active' || AF.isAdmin() ? '<button type="button" class="sk-x" data-sk="ch-entry-del" data-id="' + esc(e.id) + '" aria-label="Delete">🗑</button>' : '') + '</div><div class="sk-media">' + mediaHtml(e.mediaUrl, e.mediaType) + '</div>' + (e.caption ? '<p>' + esc(e.caption) + '</p>' : '') + '</article>';
      }).join('') : AF.empty('📤', 'No entries yet', st === 'active' ? 'Be the first to join!' : ''));
    X.ch = c; if (st !== 'ended') startTimer();
  }).catch(function () { errBox(host); });
}
AF.on('ch-join', function (el) {
  var c = X.ch; if (!c) return;
  AF.needAny().then(function (u) {
    if (!u) return;
    var acc = c.media === 'video' ? 'video/*' : c.media === 'photo' ? 'image/*' : 'image/*,video/*';
    AF.sheet('<h3>Join: ' + esc(c.title) + '</h3><label class="as-file">📎 Choose ' + (c.media === 'video' ? 'a video' : c.media === 'photo' ? 'a photo' : 'a photo or video') + '<input id="skChFile" type="file" accept="' + acc + '" hidden></label><div class="as-prev" id="skChPrev"></div><textarea class="as-input" id="skChCap" rows="2" maxlength="200" placeholder="Say something about your entry (optional)"></textarea><p class="as-note">One entry per member. Photos up to 10 MB, videos up to 60 MB.</p><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="ch-submit">Submit entry</button></div>');
    $('skChFile').addEventListener('change', function () { var f = this.files[0]; $('skChPrev').innerHTML = f ? (f.type.indexOf('video/') === 0 ? '<p class="as-note">🎬 ' + esc(f.name) + '</p>' : '<img src="' + URL.createObjectURL(f) + '" alt="">') : ''; });
  });
});
AF.on('ch-submit', function (el) {
  var c = X.ch, u = AF.anyUser(), f = $('skChFile') && $('skChFile').files[0]; if (!c || !u) return;
  if (!f) { AF.say('Choose your photo or video.'); return; }
  var isVid = f.type.indexOf('video/') === 0, isImg = f.type.indexOf('image/') === 0;
  if (!isVid && !isImg) { AF.say('Choose a photo or a video.'); return; }
  if (c.media === 'video' && !isVid) { AF.say('This challenge needs a video.'); return; }
  if (c.media === 'photo' && !isImg) { AF.say('This challenge needs a photo.'); return; }
  AF.busy(el, true, 'Uploading…');
  AF.upload(f, isVid ? 60 : 10).then(function (up) {
    return d().collection('skillsEntries').doc(c.id + '_' + u.uid).set({ challengeId: c.id, uid: u.uid, name: AF.myName(), mediaUrl: up.url, mediaType: isVid ? 'video' : 'image', caption: AF.val('skChCap').slice(0, 200), votes: 0, createdAt: AF.ts() });
  }).then(function () { AF.closeSheet(); AF.say('Entry submitted. Good luck!'); refresh(); }).catch(function (e) { AF.busy(el, false); AF.say(e && e.message && !e.code ? e.message : 'Could not submit. You may have joined already, or the challenge ended.'); });
});
AF.on('ch-vote', function (el) {
  var eid = el.getAttribute('data-id');
  AF.needAny().then(function (u) {
    if (!u) return;
    var b = d().batch();
    b.set(d().collection('skillsVotes').doc(eid + '_' + u.uid), { entryId: eid, challengeId: X.ch.id, uid: u.uid, createdAt: AF.ts() });
    b.update(d().collection('skillsEntries').doc(eid), { votes: firebase.firestore.FieldValue.increment(1) });
    return b.commit().then(function () { AF.say('Vote counted ♥'); refresh(); });
  }).catch(function () { AF.say('Could not vote. You can vote once for each entry, and not for your own.'); });
});
AF.on('ch-entry-del', function (el) { if (!confirm('Delete this entry?')) return; d().collection('skillsEntries').doc(el.getAttribute('data-id')).delete().then(refresh).catch(function () { AF.say('Could not delete.'); }); });
AF.on('ch-del', function (el) { if (!AF.isAdmin() || !confirm('Delete this challenge?')) return; d().collection('skillsChallenges').doc(el.getAttribute('data-id')).delete().then(back).catch(function () { AF.say('Could not delete.'); }); });
AF.on('ch-winners', function (el) {
  if (!AF.isAdmin()) return; var cid = el.getAttribute('data-id'); AF.busy(el, true, '…');
  d().collection('skillsEntries').where('challengeId', '==', cid).limit(100).get().then(function (s) {
    var top = s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).sort(function (a, b) { return (Number(b.votes) || 0) - (Number(a.votes) || 0); }).slice(0, 3).map(function (e, i) { return { uid: e.uid, name: String(e.name || 'Member').slice(0, 60), votes: Number(e.votes) || 0, place: i + 1, entryId: e.id }; });
    return d().collection('skillsChallenges').doc(cid).update({ winners: top });
  }).then(refresh).catch(function () { AF.busy(el, false); AF.say('Could not pick winners.'); });
});
AF.on('ch-new', function () {
  if (!AF.isAdmin()) return; var now = Date.now();
  AF.sheet('<h3>New challenge</h3><input class="as-input" id="skCnTitle" maxlength="80" placeholder="Title"><textarea class="as-input" id="skCnDesc" rows="3" maxlength="500" placeholder="Description"></textarea><textarea class="as-input" id="skCnRules" rows="3" maxlength="800" placeholder="Rules (one per line)"></textarea><textarea class="as-input" id="skCnPrizes" rows="2" maxlength="400" placeholder="Prizes (e.g. 1st: 50 AST…)"></textarea><label class="sk-lab">Starts<input class="as-input" id="skCnStart" type="datetime-local" value="' + toLocalInput(now) + '"></label><label class="sk-lab">Ends<input class="as-input" id="skCnEnd" type="datetime-local" value="' + toLocalInput(now + 7 * 86400000) + '"></label><select class="as-input" id="skCnMedia"><option value="any">Photo or video</option><option value="photo">Photo only</option><option value="video">Video only</option></select><label class="sk-check"><input type="checkbox" id="skCnWeek"> Challenge of the Week</label><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="ch-new-save">Create</button></div>');
});
AF.on('ch-new-save', function (el) {
  var title = AF.val('skCnTitle'), s = new Date(AF.val('skCnStart')).getTime(), e = new Date(AF.val('skCnEnd')).getTime();
  if (title.length < 3) { AF.say('Write the title.'); return; } if (!(s > 0) || !(e > s)) { AF.say('Check the start and end dates.'); return; }
  AF.busy(el, true, 'Creating…');
  d().collection('skillsChallenges').add({ title: title.slice(0, 80), description: AF.val('skCnDesc').slice(0, 500), rules: AF.val('skCnRules').slice(0, 800), prizes: AF.val('skCnPrizes').slice(0, 400), start: AF.stamp(s), end: AF.stamp(e), media: AF.val('skCnMedia'), weekly: !!$('skCnWeek').checked, space: X.space, winners: [], createdAt: AF.ts() }).then(function () { AF.closeSheet(); refresh(); }).catch(function () { AF.busy(el, false); AF.say('Could not create the challenge.'); });
});

/* ============================ EVENTS & LIVE ============================ */
function openEvents() {
  open(X.space, 'Events & Live', function (host) {
    var u = AF.anyUser();
    Promise.all([d().collection('skillsEvents').where('space', '==', X.space).limit(80).get(), u ? d().collection('skillsReminders').where('uid', '==', u.uid).limit(100).get().catch(function () { return { docs: [] }; }) : Promise.resolve({ docs: [] })]).then(function (r) {
      var evs = r[0].docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }), rem = {}; r[1].docs.forEach(function (x) { rem[x.data().eventId] = 1; });
      var now = Date.now(), endOf = function (e) { return AF.ms(e.end) || AF.ms(e.start) + 2 * 3600000; };
      var up = evs.filter(function (e) { return endOf(e) >= now; }).sort(function (a, b) { return AF.ms(a.start) - AF.ms(b.start); }), past = evs.filter(function (e) { return endOf(e) < now; }).sort(function (a, b) { return AF.ms(b.start) - AF.ms(a.start); }).slice(0, 10);
      var card = function (e, isPast) {
        var live = !isPast && AF.ms(e.start) <= now && endOf(e) >= now;
        return '<div class="sk-ev' + (live ? ' live' : '') + '"><div class="sk-ev-top"><b>' + esc(e.title) + '</b>' + (live ? '<span class="sk-live">● LIVE</span>' : '') + '</div><small>📅 ' + esc(AF.fmtDate(AF.ms(e.start), true)) + (e.place ? ' · 📍 ' + esc(e.place) : '') + '</small>' + (e.description ? '<p>' + esc(e.description) + '</p>' : '') +
          '<div class="sk-bk-acts">' + (/^https:\/\//i.test(e.link || '') && !isPast ? '<a class="as-btn main" href="' + esc(e.link) + '" target="_blank" rel="noopener noreferrer">' + (live ? '▶ Join live' : '🔗 Link') + '</a>' : '') +
          (!isPast ? '<button type="button" class="as-btn ' + (rem[e.id] ? 'ghost' : 'main') + '" data-sk="ev-remind" data-id="' + esc(e.id) + '" data-on="' + (rem[e.id] ? 1 : 0) + '">' + (rem[e.id] ? '🔔 Reminder set' : '🔔 Remind me') + '</button><button type="button" class="as-btn ghost" data-sk="ev-ics" data-id="' + esc(e.id) + '">📆 Calendar</button>' : '') + (AF.isAdmin() ? '<button type="button" class="as-btn danger" data-sk="ev-del" data-id="' + esc(e.id) + '">Delete</button>' : '') + '</div></div>';
      };
      X.events = evs;
      host.innerHTML = (AF.isAdmin() ? '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="ev-new">＋ New event</button></div>' : '') +
        (up.length ? up.map(function (e) { return card(e, false); }).join('') : AF.empty('📅', 'No upcoming events', 'New events and live sessions will appear here.')) + (past.length ? '<h4 class="sk-h">Past events</h4>' + past.map(function (e) { return card(e, true); }).join('') : '');
    }).catch(function () { errBox(host); });
  });
}
function evById(id) { return (X.events || []).filter(function (e) { return e.id === id; })[0]; }
AF.on('ev-remind', function (el) {
  var e = evById(el.getAttribute('data-id')), on = el.getAttribute('data-on') === '1'; if (!e) return;
  AF.needAny().then(function (u) {
    if (!u) return; var ref = d().collection('skillsReminders').doc(e.id + '_' + u.uid);
    return (on ? ref.delete() : ref.set({ eventId: e.id, uid: u.uid, title: String(e.title).slice(0, 80), start: AF.ms(e.start), createdAt: AF.ts() })).then(function () { AF.say(on ? 'Reminder removed.' : 'Reminder set. We will remind you when the app is open before it starts.'); refresh(); });
  }).catch(function () { AF.say('Could not save the reminder.'); });
});
AF.on('ev-ics', function (el) {
  var e = evById(el.getAttribute('data-id')); if (!e) return;
  var f = function (m) { return new Date(m).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); }, s = AF.ms(e.start), en = AF.ms(e.end) || s + 3600000;
  var ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Afrishine//EN\r\nBEGIN:VEVENT\r\nUID:' + e.id + '@afrishine\r\nDTSTAMP:' + f(Date.now()) + '\r\nDTSTART:' + f(s) + '\r\nDTEND:' + f(en) + '\r\nSUMMARY:' + String(e.title).replace(/[\r\n,;]/g, ' ') + '\r\nDESCRIPTION:' + String(e.description || '').replace(/[\r\n,;]/g, ' ').slice(0, 300) + '\r\nBEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Starting soon\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR';
  try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'event.ics'; document.body.appendChild(a); a.click(); a.remove(); } catch (er) { AF.say('Could not open the calendar on this device.'); }
});
AF.on('ev-del', function (el) { if (!AF.isAdmin() || !confirm('Delete this event?')) return; d().collection('skillsEvents').doc(el.getAttribute('data-id')).delete().then(refresh).catch(function () { AF.say('Could not delete.'); }); });
AF.on('ev-new', function () {
  if (!AF.isAdmin()) return; var now = Date.now() + 86400000;
  AF.sheet('<h3>New event / live</h3><input class="as-input" id="skEvTitle" maxlength="80" placeholder="Title"><textarea class="as-input" id="skEvDesc" rows="3" maxlength="400" placeholder="Description"></textarea><label class="sk-lab">Starts<input class="as-input" id="skEvStart" type="datetime-local" value="' + toLocalInput(now) + '"></label><label class="sk-lab">Ends<input class="as-input" id="skEvEnd" type="datetime-local" value="' + toLocalInput(now + 3600000) + '"></label><input class="as-input" id="skEvPlace" maxlength="80" placeholder="Place (optional)"><input class="as-input" id="skEvLink" maxlength="300" placeholder="Live / meeting link https://… (optional)"><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="ev-new-save">Create</button></div>');
});
AF.on('ev-new-save', function (el) {
  var title = AF.val('skEvTitle'), s = new Date(AF.val('skEvStart')).getTime(), e = new Date(AF.val('skEvEnd')).getTime(), link = AF.val('skEvLink');
  if (title.length < 3) { AF.say('Write the title.'); return; } if (!(s > 0) || !(e > s)) { AF.say('Check the start and end times.'); return; } if (link && !/^https:\/\//i.test(link)) { AF.say('The link must start with https://'); return; }
  AF.busy(el, true, 'Creating…');
  d().collection('skillsEvents').add({ title: title.slice(0, 80), description: AF.val('skEvDesc').slice(0, 400), start: AF.stamp(s), end: AF.stamp(e), place: AF.val('skEvPlace').slice(0, 80), link: link.slice(0, 300), space: X.space, createdAt: AF.ts() }).then(function () { AF.closeSheet(); refresh(); }).catch(function () { AF.busy(el, false); AF.say('Could not create the event.'); });
});
/* in-app reminder: when the app opens and a reminded event starts within the hour */
var told = {};
function checkReminders() {
  var u = AF.anyUser(); if (!u) return;
  d().collection('skillsReminders').where('uid', '==', u.uid).limit(50).get().then(function (s) {
    s.docs.forEach(function (x) { var r = x.data(), t = Number(r.start) || 0; if (t > Date.now() - 600000 && t < Date.now() + 3600000 && !told[x.id]) { told[x.id] = 1; AF.say('⏰ ' + r.title + (t > Date.now() ? ' starts in ' + cd(t) : ' is starting now')); } });
  }).catch(function () { });
}

/* ============================== ENTRY POINTS ============================== */
AF.on('com-groups', function (el) { X.space = el.getAttribute('data-space') || 'skills'; openGroups(el.getAttribute('data-hint') || ''); });
AF.on('com-challenges', function (el) { X.space = el.getAttribute('data-space') || 'skills'; openChallenges(); });
AF.on('com-events', function (el) { X.space = el.getAttribute('data-space') || 'skills'; openEvents(); });

/* Skills -> Community section */
function paintSkills() {
  var box = AF.body('acCommunity', 'skComBody'); if (!box) return;
  box.innerHTML = '<section class="sk-panel"><h3>👥 Groups</h3><p>Find people who share your interests and join the conversation.</p><button type="button" class="as-btn main" data-sk="com-groups" data-space="skills">Explore Groups</button></section>' +
    '<section class="sk-panel"><h3>🔥 Challenges</h3><p>Take part in challenges, collect votes and win prizes.</p><button type="button" class="as-btn main" data-sk="com-challenges" data-space="skills">Explore Challenges</button></section>' +
    '<section class="sk-panel"><h3>📅 Events &amp; Live</h3><p>Live sessions, workshops and events. Set a reminder.</p><button type="button" class="as-btn main" data-sk="com-events" data-space="skills">Explore Events</button></section>';
  checkReminders();
}
AF.mount('acCommunity', paintSkills);

/* Hub -> Community page: connect the existing Groups chips, Challenges and Events buttons */
function wireHub() {
  var page = $('community'); if (!page || page.getAttribute('data-sk-wired')) { checkReminders(); return; }
  page.setAttribute('data-sk-wired', '1');
  Array.prototype.forEach.call(page.querySelectorAll('section.panel'), function (p) {
    var h = (p.querySelector('h2') || {}).textContent || '';
    if (/Groups/.test(h)) {
      Array.prototype.forEach.call(p.querySelectorAll('.actions button'), function (b) { var name = b.textContent.replace(/^[^A-Za-z]+/, '').trim(); b.removeAttribute('onclick'); b.onclick = null; b.setAttribute('data-sk', 'com-groups'); b.setAttribute('data-space', 'hub'); b.setAttribute('data-hint', name); });
      var all = document.createElement('button'); all.type = 'button'; all.className = 'secondary'; all.textContent = '＋ All groups'; all.setAttribute('data-sk', 'com-groups'); all.setAttribute('data-space', 'hub'); var act = p.querySelector('.actions'); if (act) act.appendChild(all);
    } else if (/Challenges/.test(h)) { var bc = p.querySelector('button'); if (bc) { bc.removeAttribute('onclick'); bc.onclick = null; bc.setAttribute('data-sk', 'com-challenges'); bc.setAttribute('data-space', 'hub'); } }
    else if (/Events/.test(h)) { var be = p.querySelector('button'); if (be) { be.removeAttribute('onclick'); be.onclick = null; be.setAttribute('data-sk', 'com-events'); be.setAttribute('data-space', 'hub'); } }
  });
  checkReminders();
}
AF.mount('community', wireHub);
AF.community = { openGroups: function (s, h) { X.space = s || 'skills'; openGroups(h); }, openChallenges: function (s) { X.space = s || 'skills'; openChallenges(); }, openEvents: function (s) { X.space = s || 'skills'; openEvents(); } };
})();
