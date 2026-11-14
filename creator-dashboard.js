(function () {
    'use strict';
    var DAY = 86400000, POST_CAP = 40, SUB_CAP = 300, CACHE_MS = 300000;
    var state = { range: 30, data: null, at: 0, uid: null, loading: false, profiles: {}, loc: null };
    var lastMemberUid = '';

    function $(id) { return document.getElementById(id); }
    function cu() { return (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) || (window.auth && window.auth.currentUser) || null; }
    function fdb() { return (typeof db !== 'undefined' && db) || window.db || null; }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function ts(t) { return t && t.toMillis ? t.toMillis() : 0; }
    function fmt(n) { return Number(n || 0).toLocaleString(); }
    function snip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }
    function fdate(t) { return t ? new Date(t).toLocaleDateString() : ''; }
    function say(m) { if (typeof notice === 'function') notice(m); }

    /* ---------- 1. TRACKING (views, shares, profile visits, unfollows) ----------
       Stored in creatorEvents/{ownerUid}/events/{id}. Only the owner can read them. */
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem('af_cd_seen') || '{}'); } catch (e) { seen = {}; }
    function once(key) {
        var t = new Date().toISOString().slice(0, 10);
        if (!seen || seen.d !== t || !seen.k) seen = { d: t, k: {} };
        if (seen.k[key]) return false;
        seen.k[key] = 1;
        try { localStorage.setItem('af_cd_seen', JSON.stringify(seen)); } catch (e) { }
        return true;
    }
    function logEvent(ownerUid, type, extra) {
        var u = cu(), d = fdb();
        if (!u || !d || !ownerUid || ownerUid === u.uid) return;
        var data = { actorUid: u.uid, type: type, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (extra) for (var k in extra) data[k] = extra[k];
        d.collection('creatorEvents').doc(ownerUid).collection('events').add(data).catch(function () { });
    }
    /* A post view = a post card visible on screen for 1.5 seconds, once per viewer per post per day. */
    var timers = new WeakMap(), io = null;
    function countView(c) {
        var owner = c.dataset.authorUid, id = c.dataset.postId, u = cu();
        if (!owner || !id || !u || owner === u.uid) return;
        if (!once('v|' + id)) return;
        logEvent(owner, 'view', { postId: id });
    }
    if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                var c = en.target;
                if (en.isIntersecting) {
                    if (!timers.has(c)) timers.set(c, setTimeout(function () { timers.delete(c); countView(c); }, 1500));
                } else {
                    var t = timers.get(c);
                    if (t) { clearTimeout(t); timers.delete(c); }
                }
            });
        }, { threshold: 0.35 });
    }
    function scanCards(root) {
        if (!io) return;
        (root || document).querySelectorAll('[data-engagement="posts"]').forEach(function (c) {
            if (c.dataset.cdObs) return;
            c.dataset.cdObs = '1';
            io.observe(c);
        });
    }
    ['homeFeed', 'talentFeed', 'communityFeed'].forEach(function (id) {
        var el = $(id);
        if (!el) return;
        scanCards(el);
        if ('MutationObserver' in window) new MutationObserver(function () { scanCards(el); }).observe(el, { childList: true, subtree: true });
    });
    /* Shares */
    var prevShare = window.sharePost;
    if (typeof prevShare === 'function') {
        window.sharePost = function (kind, id) {
            try {
                if (kind === 'posts') {
                    var card = document.querySelector('[data-engagement="posts"][data-post-id="' + id + '"]');
                    if (card && card.dataset.authorUid) logEvent(card.dataset.authorUid, 'share', { postId: id });
                }
            } catch (e) { }
            return prevShare.apply(this, arguments);
        };
    }
    /* Profile visits */
    var prevOpenMember = window.openMemberProfile;
    if (typeof prevOpenMember === 'function') {
        window.openMemberProfile = function (uid) {
            lastMemberUid = uid || '';
            if (uid && cu() && once('p|' + uid)) logEvent(uid, 'profile_visit');
            return prevOpenMember.apply(this, arguments);
        };
    }
    /* Unfollows: when a "Following" button is tapped, confirm the follow record is gone, then log it. */
    document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-follow-author],#ahMemberFollow') : null;
        var u = cu(), d = fdb();
        if (!b || !u || !d || String(b.textContent).indexOf('Following') < 0) return;
        var target = b.getAttribute('data-follow-author') || lastMemberUid;
        if (!target) return;
        setTimeout(function () {
            d.collection('follows').doc(u.uid + '_' + target).get().then(function (s) {
                if (!s.exists) logEvent(target, 'unfollow');
            }).catch(function () { });
        }, 1800);
    }, true);

    /* ---------- 2. DATA LOADING (one load, cached 5 min; changing the time filter costs 0 reads) ---------- */
    function cnt(q) {
        try {
            return q.count().get().then(function (s) { return s.data().count; }).catch(function () { return q.limit(1000).get().then(function (s) { return s.size; }); });
        } catch (e) { return q.limit(1000).get().then(function (s) { return s.size; }); }
    }
    async function loadData(force) {
        var u = cu(), d = fdb();
        if (!u || !d) throw new Error('auth');
        if (!force && state.data && state.uid === u.uid && Date.now() - state.at < CACHE_MS) return state.data;
        var r = await Promise.all([
            d.collection('posts').where('uid', '==', u.uid).limit(300).get(),
            d.collection('follows').where('followingUid', '==', u.uid).limit(2000).get(),
            cnt(d.collection('follows').where('followerUid', '==', u.uid)),
            d.collection('creatorEvents').doc(u.uid).collection('events').orderBy('createdAt', 'desc').limit(3000).get()
                .then(function (s) { return s.docs.map(function (x) { var v = x.data(); return { type: v.type, postId: v.postId || '', actor: v.actorUid || '', t: ts(v.createdAt) || Date.now() }; }); })
                .catch(function () { return null; }),
            d.collection('publicProfiles').doc(u.uid).get().then(function (s) { return s.exists ? s.data() : {}; }).catch(function () { return {}; })
        ]);
        var now = Date.now();
        var posts = r[0].docs.map(function (x) {
            var v = x.data();
            return { id: x.id, text: v.text || '', title: v.title || v.linkTitle || '', type: v.type || 'text', mediaUrl: v.mediaUrl || '', isRepost: v.isRepost === true, t: ts(v.createdAt) || now, likes: [], comments: [] };
        }).sort(function (a, b) { return b.t - a.t; });
        var recent = posts.slice(0, POST_CAP);
        for (var i = 0; i < recent.length; i += 8) {
            await Promise.all(recent.slice(i, i + 8).map(async function (p) {
                var ref = d.collection('posts').doc(p.id);
                var s = await Promise.all([ref.collection('likes').limit(SUB_CAP).get().catch(function () { return null; }), ref.collection('comments').limit(SUB_CAP).get().catch(function () { return null; })]);
                var map = function (snap) { return snap ? snap.docs.map(function (x) { var v = x.data(); return { u: v.uid || x.id, t: ts(v.createdAt) }; }).filter(function (l) { return l.u !== u.uid; }) : []; };
                p.likes = map(s[0]); p.comments = map(s[1]);
            }));
        }
        state.data = {
            posts: posts, capped: posts.length > POST_CAP,
            followers: r[1].docs.map(function (x) { var v = x.data(); return { uid: v.followerUid, t: ts(v.createdAt) }; }).sort(function (a, b) { return b.t - a.t; }),
            following: r[2], events: r[3], profile: r[4]
        };
        state.uid = u.uid; state.at = Date.now(); state.loc = null;
        return state.data;
    }

    /* ---------- 3. CALCULATIONS ---------- */
    function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function buckets(range) {
        var list = [], i, now = new Date(), end = startOfDay(now.getTime()) + DAY;
        if (range === 7 || range === 30) {
            for (i = range - 1; i >= 0; i--) { var s = end - (i + 1) * DAY, dd = new Date(s); list.push({ s: s, e: s + DAY, l: dd.getDate() + '/' + (dd.getMonth() + 1) }); }
        } else if (range === 90) {
            for (i = 12; i >= 0; i--) { var s2 = end - (i + 1) * 7 * DAY, d2 = new Date(s2); list.push({ s: s2, e: s2 + 7 * DAY, l: d2.getDate() + '/' + (d2.getMonth() + 1) }); }
        } else {
            for (i = 11; i >= 0; i--) { var a = new Date(now.getFullYear(), now.getMonth() - i, 1), b = new Date(now.getFullYear(), now.getMonth() - i + 1, 1); list.push({ s: a.getTime(), e: b.getTime(), l: MON[a.getMonth()] }); }
        }
        return list;
    }
    function compute(range) {
        var D = state.data, since = range ? Date.now() - range * DAY : 0;
        var inR = function (t) { return !since || t >= since; };
        var ev = D.events || [], views = {}, shares = {}, visits = 0, unf = [], shareT = [], totalViews = 0, totalShares = 0;
        ev.forEach(function (x) {
            if (!inR(x.t)) return;
            if (x.type === 'view') { views[x.postId] = (views[x.postId] || 0) + 1; totalViews++; }
            else if (x.type === 'share') { shares[x.postId] = (shares[x.postId] || 0) + 1; shareT.push(x.t); totalShares++; }
            else if (x.type === 'profile_visit') visits++;
            else if (x.type === 'unfollow') unf.push(x);
        });
        var likeT = [], comT = [], tl = 0, tc = 0;
        D.posts.forEach(function (p) {
            var l = p.likes.filter(function (x) { return inR(x.t); }), c = p.comments.filter(function (x) { return inR(x.t); });
            p.m = { likes: l.length, comments: c.length, shares: shares[p.id] || 0, views: views[p.id] || 0 };
            p.m.eng = p.m.likes + p.m.comments + p.m.shares;
            p.m.rate = p.m.views ? Math.min(100, p.m.eng / p.m.views * 100) : null;
            l.forEach(function (x) { likeT.push(x.t); }); c.forEach(function (x) { comT.push(x.t); });
            tl += l.length; tc += c.length;
        });
        var inter = tl + tc + totalShares;
        var newF = D.followers.filter(function (f) { return inR(f.t) && f.t > 0; });
        var bk = buckets(range);
        var count = function (arr, b) { var n = 0; arr.forEach(function (t) { if (t >= b.s && t < b.e) n++; }); return n; };
        var fT = D.followers.map(function (f) { return f.t; });
        var sorted = function (key) { return D.posts.slice().sort(function (a, b) { return b.m[key] - a.m[key]; }).filter(function (p) { return p.m[key] > 0; }).slice(0, 3); };
        return {
            likes: tl, comments: tc, shares: totalShares, views: totalViews, visits: visits, unf: unf, inter: inter,
            rate: totalViews ? Math.min(100, inter / totalViews * 100) : null,
            newF: newF, bk: bk,
            interSeries: bk.map(function (b) { return count(likeT, b) + count(comT, b) + count(shareT, b); }),
            followSeries: bk.map(function (b) { var n = 0; fT.forEach(function (t) { if (t < b.e) n++; }); return n; }),
            topLiked: sorted('likes'), topCommented: sorted('comments'), topViewed: sorted('views'),
            best: D.posts.slice().sort(function (a, b) { return b.m.eng - a.m.eng; }).filter(function (p) { return p.m.eng > 0; })[0] || null,
            recent: D.posts.slice(0, 8)
        };
    }

    /* ---------- 4. CHARTS (plain SVG, no libraries) ---------- */
    function chart(vals, labels, id, bars, zero) {
        var W = 320, H = 160, pl = 30, pr = 8, pt = 10, pb = 22, n = vals.length;
        var hi = Math.max.apply(null, vals.concat([1])), lo = zero ? 0 : Math.min.apply(null, vals);
        if (hi <= lo) hi = lo + 1;
        var y = function (v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); };
        var step = (W - pl - pr) / Math.max(1, n - 1), s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chart">';
        s += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffbd19" stop-opacity=".45"/><stop offset="1" stop-color="#ffbd19" stop-opacity="0"/></linearGradient></defs>';
        [0, .5, 1].forEach(function (f) {
            var v = lo + (hi - lo) * f, yy = y(v);
            s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="#2a3243" stroke-width="1"/><text x="' + (pl - 4) + '" y="' + (yy + 3) + '" fill="#8d97ab" font-size="9" text-anchor="end">' + Math.round(v) + '</text>';
        });
        if (bars) {
            var bw = Math.max(2, (W - pl - pr) / n * 0.62);
            vals.forEach(function (v, i) { var x = pl + (W - pl - pr) / n * (i + 0.5) - bw / 2, yy = y(v); s += '<rect x="' + x + '" y="' + yy + '" width="' + bw + '" height="' + Math.max(0, H - pb - yy) + '" rx="2" fill="#ffbd19"/>'; });
        } else {
            var pts = vals.map(function (v, i) { return (pl + i * step).toFixed(1) + ',' + y(v).toFixed(1); });
            s += '<path d="M' + pl + ',' + (H - pb) + ' L' + pts.join(' L') + ' L' + (pl + (n - 1) * step).toFixed(1) + ',' + (H - pb) + ' Z" fill="url(#' + id + ')"/>';
            s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#ffbd19" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
            s += '<circle cx="' + (pl + (n - 1) * step).toFixed(1) + '" cy="' + y(vals[n - 1]).toFixed(1) + '" r="3.5" fill="#ffd46d"/>';
        }
        [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, k) {
            var x = bars ? pl + (W - pl - pr) / n * (i + 0.5) : pl + i * step;
            s += '<text x="' + x + '" y="' + (H - 6) + '" fill="#8d97ab" font-size="9" text-anchor="' + (k === 0 ? 'start' : k === 2 ? 'end' : 'middle') + '">' + esc(labels[i]) + '</text>';
        });
        return s + '</svg>';
    }

    /* ---------- 5. RENDERING ---------- */
    function stat(icon, label, val, hint, wide) { return '<div class="cd-stat' + (wide ? ' wide' : '') + '"><i aria-hidden="true">' + icon + '</i><b>' + val + '</b><small>' + label + '</small><em>' + hint + '</em></div>'; }
    function rateStr(r) { return r == null ? '—' : r.toFixed(1) + '%'; }
    function postRow(p, hl, noEv) {
        var title = snip(p.title || p.text || (p.type === 'video' ? 'Video post' : p.type === 'image' ? 'Photo post' : p.type === 'link' ? 'Video link' : 'Post'), 80);
        var icon = p.type === 'video' ? '🎬' : p.type === 'image' ? '🖼️' : p.type === 'link' ? '🔗' : '📝';
        return '<div class="cd-post"><span class="cd-pi" aria-hidden="true">' + icon + '</span><div class="cd-pb"><b>' + esc(title) + '</b><small>' + esc(fdate(p.t)) + (p.isRepost ? ' · Repost' : '') + '</small><div class="cd-chips"><span>♥ ' + fmt(p.m.likes) + '</span><span>💬 ' + fmt(p.m.comments) + '</span><span>↗ ' + (noEv ? '—' : fmt(p.m.shares)) + '</span><span>👁 ' + (noEv ? '—' : fmt(p.m.views)) + '</span></div></div>' + (hl ? '<span class="cd-hl">' + hl + '</span>' : '') + '</div>';
    }
    function topCard(title, list, key, icon, noEv) {
        var body = list.length ? list.map(function (p) { return postRow(p, icon + ' ' + fmt(p.m[key]), noEv); }).join('') : '<p class="cd-empty">' + ((noEv && key === 'views') ? 'View tracking is not enabled yet.' : 'Nothing to show for this period yet.') + '</p>';
        return '<div class="cd-card"><h3>' + title + '</h3>' + body + '</div>';
    }
    function tips(D) {
        var now = Date.now(), p = D.profile || {};
        var r7 = D.posts.filter(function (x) { return x.t >= now - 7 * DAY; }).length;
        var media30 = D.posts.filter(function (x) { return x.t >= now - 30 * DAY && x.mediaUrl; }).length;
        var complete = !!(p.bio && p.photoURL && p.location);
        return [
            { i: '🗓️', ok: r7 >= 2, t: 'Post regularly', d: r7 >= 2 ? 'You posted ' + r7 + ' times in the last 7 days. Keep it up!' : 'You posted ' + r7 + ' time(s) in the last 7 days. Aim for 2–3 posts every week so members keep seeing you.' },
            { i: '🎬', ok: media30 >= 1, t: 'Create quality content', d: media30 >= 1 ? 'Your photos and videos help you stand out. Add a clear title to each one.' : 'Share a clear photo or short video with a good title. Media posts get noticed more than text alone.' },
            { i: '💬', ok: null, t: 'Engage with your audience', d: 'Reply to comments and message members who support you. People return to creators who respond.' },
            { i: '👤', ok: complete, t: 'Complete your profile', d: complete ? 'Your photo, bio and location are filled in.' : 'Add a profile photo, a short bio and your location so visitors know who you are.' },
            { i: '🚀', ok: D.followers.length >= 100, t: 'Grow your followers', d: 'Share your profile link, join Community challenges, and follow creators in your field. You have ' + fmt(D.followers.length) + ' followers.' }
        ].map(function (x) {
            return '<div class="cd-tip"><i aria-hidden="true">' + x.i + '</i><div><b>' + x.t + '<span class="cd-tag ' + (x.ok === true ? 'ok' : x.ok === false ? 'do' : '') + '">' + (x.ok === true ? '✓ Good' : x.ok === false ? 'To do' : 'Tip') + '</span></b><small>' + esc(x.d) + '</small></div></div>';
        }).join('');
    }
    function nameOf(uid) { var p = state.profiles[uid]; return (p && p.username) || 'Afrishine Member'; }
    function paint() {
        var D = state.data, body = $('cdBody');
        if (!D || !body) return;
        var m = compute(state.range), noEv = D.events === null, dash = '—';
        var rl = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 0: 'All time' }[state.range];
        var h = '';
        if (noEv) h += '<div class="cd-warn">⚠️ Views, Shares, Profile Visits and Unfollowers are not available yet. Publish the new Firestore rules (see setup) to start tracking them.</div>';
        h += '<p class="cd-updated">Updated ' + new Date(state.at).toLocaleTimeString() + ' · Showing: ' + rl + '</p>';
        h += '<h2 class="cd-h"><span>◎</span> Account Overview</h2><div class="cd-grid">'
            + stat('👥', 'Total Followers', fmt(D.followers.length), 'all time')
            + stat('➕', 'Total Following', fmt(D.following), 'all time')
            + stat('📝', 'Total Posts', fmt(D.posts.length), 'all time')
            + stat('♥', 'Total Likes', fmt(m.likes), rl.toLowerCase())
            + stat('💬', 'Total Comments', fmt(m.comments), rl.toLowerCase())
            + stat('↗', 'Total Shares', noEv ? dash : fmt(m.shares), 'share taps · ' + rl.toLowerCase())
            + stat('👁', 'Total Views', noEv ? dash : fmt(m.views), 'counted since tracking started', true)
            + '</div>';
        if (D.capped) h += '<p class="cd-note">Likes and comments are counted on your latest ' + POST_CAP + ' posts. Your own likes and comments are not counted.</p>';

        h += '<h2 class="cd-h"><span>★</span> Content Performance</h2>';
        if (!D.posts.length) {
            h += '<div class="cd-card"><p class="cd-empty">You have not published any posts yet. Create your first post to start seeing performance here.</p><button type="button" class="gold" data-cd-create>＋ Create a post</button></div>';
        } else {
            h += '<div class="cd-card"><h3>🏆 Your best post</h3>' + (m.best ? postRow(m.best, 'Best', noEv) : '<p class="cd-empty">No interactions in this period yet.</p>') + '</div>'
                + topCard('Most Liked Posts', m.topLiked, 'likes', '♥', noEv)
                + topCard('Most Commented Posts', m.topCommented, 'comments', '💬', noEv)
                + topCard('Most Viewed Posts', m.topViewed, 'views', '👁', noEv)
                + '<div class="cd-card"><h3>Recent Posts Performance</h3>' + m.recent.map(function (p) { return postRow(p, p.m.rate == null ? '' : rateStr(p.m.rate), noEv); }).join('') + '</div>';
        }

        h += '<h2 class="cd-h"><span>⚡</span> Engagement Analytics</h2><div class="cd-grid">'
            + stat('♥', 'Likes received', fmt(m.likes), rl.toLowerCase())
            + stat('💬', 'Comments received', fmt(m.comments), rl.toLowerCase())
            + stat('↗', 'Shares received', noEv ? dash : fmt(m.shares), rl.toLowerCase())
            + stat('👤', 'Profile visits', noEv ? dash : fmt(m.visits), rl.toLowerCase())
            + '</div>'
            + '<div class="cd-card" style="margin-top:10px"><h3>Engagement Rate</h3><div class="cd-big">' + (noEv ? dash : rateStr(m.rate)) + '</div><p class="cd-note">(likes + comments + shares) ÷ views. Shown once your posts have recorded views.</p></div>'
            + '<div class="cd-card cd-chart"><h3>Interactions over time</h3>' + chart(m.interSeries, m.bk.map(function (b) { return b.l; }), 'cdg1', true, true) + '<div class="cd-legend"><span>Likes + comments + shares</span></div></div>';

        h += '<h2 class="cd-h"><span>👥</span> Audience Analytics</h2>'
            + '<div class="cd-card cd-chart"><h3>Followers Growth</h3>' + chart(m.followSeries, m.bk.map(function (b) { return b.l; }), 'cdg2', false, false) + '<div class="cd-legend"><span>Total followers at the end of each ' + (state.range === 90 ? 'week' : state.range === 0 ? 'month' : 'day') + '</span></div></div>'
            + '<div class="cd-grid"><div class="cd-stat"><i>🆕</i><b>' + fmt(m.newF.length) + '</b><small>New followers</small><em>' + rl.toLowerCase() + '</em></div><div class="cd-stat"><i>🚪</i><b>' + (noEv ? dash : fmt(m.unf.length)) + '</b><small>Unfollowers</small><em>tracked since launch</em></div></div>'
            + '<div class="cd-card" style="margin-top:10px"><h3>Newest followers</h3>' + (m.newF.length ? m.newF.slice(0, 5).map(function (f) { return '<div class="cd-row"><button type="button" data-cd-member="' + esc(f.uid) + '" data-cd-name="' + esc(f.uid) + '">' + esc(nameOf(f.uid)) + '</button><small>' + esc(fdate(f.t)) + '</small></div>'; }).join('') : '<p class="cd-empty">No new followers in this period.</p>') + '</div>';
        if (!noEv && m.unf.length) h += '<div class="cd-card"><h3>Recently unfollowed you</h3>' + m.unf.slice(0, 5).map(function (x) { return '<div class="cd-row"><button type="button" data-cd-member="' + esc(x.actor) + '" data-cd-name="' + esc(x.actor) + '">' + esc(nameOf(x.actor)) + '</button><small>' + esc(fdate(x.t)) + '</small></div>'; }).join('') + '</div>';
        h += '<div class="cd-card"><h3>Audience Location</h3><div id="cdLoc">' + locHtml() + '</div></div>';

        h += '<h2 class="cd-h"><span>💡</span> Creator Growth Tips</h2><div class="cd-card">' + tips(D) + '</div>';
        body.innerHTML = h;
        hydrateNames(m);
    }
    function locHtml() {
        if (!state.loc) return '<p class="cd-empty">See where your followers say they are from. This reads your latest 60 followers’ public profiles, so it only runs when you tap the button.</p><button type="button" class="secondary" data-cd-loc>Load audience locations</button>';
        if (!state.loc.total) return '<p class="cd-empty">You have no followers yet.</p>';
        var max = state.loc.rows[0] ? state.loc.rows[0][1] : 1;
        return state.loc.rows.map(function (r) { return '<div style="margin-bottom:10px"><div class="cd-row" style="border:0;padding:0"><span>' + esc(r[0]) + '</span><small>' + fmt(r[1]) + '</small></div><div class="cd-bar"><span style="width:' + Math.round(r[1] / max * 100) + '%"></span></div></div>'; }).join('')
            + '<p class="cd-note">Based on your latest ' + fmt(state.loc.total) + ' followers. Location is what each member typed in their own profile; “Not shared” means they left it empty.</p>';
    }
    async function fetchProfiles(uids) {
        var d = fdb(), need = uids.filter(function (id) { return id && !state.profiles[id]; });
        for (var i = 0; i < need.length; i += 20) {
            await Promise.all(need.slice(i, i + 20).map(function (id) {
                return d.collection('publicProfiles').doc(id).get().then(function (s) { state.profiles[id] = s.exists ? s.data() : {}; }).catch(function () { state.profiles[id] = {}; });
            }));
        }
    }
    function hydrateNames(m) {
        var ids = m.newF.slice(0, 5).map(function (f) { return f.uid; }).concat(m.unf.slice(0, 5).map(function (x) { return x.actor; }));
        fetchProfiles(ids).then(function () {
            document.querySelectorAll('#cdBody [data-cd-name]').forEach(function (el) { el.textContent = nameOf(el.getAttribute('data-cd-name')); });
        });
    }
    async function loadLocations() {
        var D = state.data, box = $('cdLoc');
        if (!D || !box) return;
        box.innerHTML = '<div class="cd-load"><div class="cd-spin"></div>Loading…</div>';
        var ids = D.followers.slice(0, 60).map(function (f) { return f.uid; });
        await fetchProfiles(ids);
        var counts = {};
        ids.forEach(function (id) {
            var loc = String((state.profiles[id] || {}).location || '').trim(), key = loc ? loc.split(',').pop().trim() : '';
            key = key ? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase() : 'Not shared';
            counts[key] = (counts[key] || 0) + 1;
        });
        state.loc = { total: ids.length, rows: Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8) };
        box.innerHTML = locHtml();
    }

    /* ---------- 6. PAGE, MENU ITEM, NAVIGATION ---------- */
    function buildPage() {
        if ($('creatorDashboard')) return;
        var main = document.querySelector('main');
        if (!main) return;
        var s = document.createElement('section');
        s.className = 'page'; s.id = 'creatorDashboard';
        s.innerHTML = '<button class="lp-back" type="button" data-cd-back>‹ Back to Profile</button><div class="eyebrow">ANALYTICS · INSIGHTS · GROWTH</div><div class="cd-top"><h1>Creator Dashboard</h1><button type="button" class="secondary cd-refresh" data-cd-refresh>↻ Refresh</button></div><p class="muted">See how your account is growing and how your audience reacts to your content.</p>'
            + '<div class="cd-ranges" role="tablist" aria-label="Time filter"><button type="button" data-cd-range="7">Last 7 Days</button><button type="button" class="on" data-cd-range="30">Last 30 Days</button><button type="button" data-cd-range="90">Last 90 Days</button><button type="button" data-cd-range="0">All Time</button></div><div id="cdBody"></div>';
        main.appendChild(s);
    }
    function injectMenu() {
        var menu = document.querySelector('.ah-profile-menu');
        if (!menu || menu.querySelector('[data-cd-menu]')) return;
        var anchor = null;
        menu.querySelectorAll('.ah-menu-item').forEach(function (b) { if ((b.getAttribute('onclick') || '').indexOf('Notifications') > -1) anchor = b; });
        if (!anchor) return;
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'ah-menu-item gold'; b.setAttribute('role', 'menuitem'); b.setAttribute('data-cd-menu', '1');
        b.innerHTML = '<i>📊</i><span>Creator Dashboard<small>Followers, views and growth</small></span>';
        b.addEventListener('click', openDash);
        anchor.insertAdjacentElement('afterend', b);
    }
    function openDash() {
        if (!cu()) { say('Create an account or sign in to open your Creator Dashboard.'); showPage('profile'); return; }
        showPage('creatorDashboard');
    }
    async function render(force) {
        var body = $('cdBody');
        if (!body || state.loading) return;
        var u = cu(), fresh = !force && state.data && u && state.uid === u.uid && Date.now() - state.at < CACHE_MS;
        if (!fresh) {
            state.loading = true;
            body.innerHTML = '<div class="cd-load"><div class="cd-spin"></div>Loading your analytics…</div>';
            try { await loadData(force); }
            catch (e) {
                console.warn('Creator dashboard:', e);
                body.innerHTML = '<div class="cd-card"><p class="cd-empty">' + esc(typeof firebaseErrorMessage === 'function' ? firebaseErrorMessage(e) : 'Could not load analytics.') + '</p><button type="button" class="secondary" data-cd-refresh>Try again</button></div>';
                state.loading = false; return;
            }
            state.loading = false;
        }
        paint();
    }
    document.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-cd-range],[data-cd-refresh],[data-cd-back],[data-cd-loc],[data-cd-member],[data-cd-create]') : null;
        if (!t) return;
        if (t.hasAttribute('data-cd-range')) {
            state.range = Number(t.getAttribute('data-cd-range'));
            document.querySelectorAll('#creatorDashboard [data-cd-range]').forEach(function (b) { b.classList.toggle('on', b === t); });
            if (state.data) paint();
        } else if (t.hasAttribute('data-cd-refresh')) render(true);
        else if (t.hasAttribute('data-cd-back')) showPage('profile');
        else if (t.hasAttribute('data-cd-loc')) loadLocations();
        else if (t.hasAttribute('data-cd-member')) { if (typeof openMemberProfile === 'function') openMemberProfile(t.getAttribute('data-cd-member')); }
        else if (t.hasAttribute('data-cd-create')) { if (typeof openCreateMenu === 'function') openCreateMenu('hub'); }
    });
    var prevShowPage = window.showPage;
    window.showPage = function (id) {
        if (id === 'creatorDashboard' && !cu()) { say('Create an account or sign in to open your Creator Dashboard.'); return prevShowPage.call(this, 'profile'); }
        var r = prevShowPage.apply(this, arguments);
        if (id === 'creatorDashboard') render(false);
        if (id === 'profile') setTimeout(injectMenu, 60);
        return r;
    };
    if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) {
        auth.onAuthStateChanged(function (u) {
            if (!u || state.uid !== u.uid) { state.data = null; state.uid = null; state.profiles = {}; state.loc = null; }
            setTimeout(injectMenu, 500);
        });
    }
    buildPage();
    injectMenu();
    var prof = $('profile');
    if (prof && 'MutationObserver' in window) new MutationObserver(injectMenu).observe(prof, { childList: true, subtree: true });
    window.addEventListener('load', function () { setTimeout(injectMenu, 1500); });
})();
