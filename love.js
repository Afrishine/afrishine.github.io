/* Afrishine Hub - Love Connection (love.js): profile, 18+ check, posts, report and block. */

/* LOVE CONNECTION: separate Firestore collection and feed */
let currentLoveProfile = null;
function refreshLoveAccess() {
    return __awaiter(this, void 0, void 0, function* () { const gate = document.getElementById('loveAgeGate'), setup = document.getElementById('loveProfileSetup'), content = document.getElementById('loveContent'); if (!gate || !setup || !content)
        return; if (!currentFirebaseUser || !db) {
        gate.style.display = 'block';
        setup.style.display = 'none';
        content.style.display = 'none';
        currentLoveProfile = null;
        return;
    } gate.style.display = 'none'; setup.style.display = 'block'; content.style.display = 'none'; try {
        const snap = yield db.collection('users').doc(currentFirebaseUser.uid).get();
        const d = snap.exists ? snap.data() : {};
        if (d.username)
            document.getElementById('loveUsername').value = d.username;
        if (Number.isInteger(d.age))
            document.getElementById('loveAge').value = d.age;
        if (d.whatsapp)
            document.getElementById('loveWhatsapp').value = d.whatsapp;
        if (Number.isInteger(d.age) && d.age >= 18 && d.age <= 100 && d.loveEligible === true) {
            currentLoveProfile = d;
            setup.style.display = 'none';
            content.style.display = 'block';
            loadLovePostsForUser();
            startLoveFeed();
        }
        else {
            currentLoveProfile = null;
            setup.style.display = 'block';
            content.style.display = 'none';
        }
    }
    catch (e) {
        console.warn('Could not verify Love Profile:', e);
        currentLoveProfile = null;
        setup.style.display = 'block';
        content.style.display = 'none';
        const status = document.getElementById('loveProfileStatus');
        if (status)
            status.textContent = firebaseErrorMessage(e);
    } });
}
function saveLoveProfile() {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Create an account or sign in first.');
        showPage('profile');
        return;
    } const username = document.getElementById('loveUsername').value.trim(), age = Number(document.getElementById('loveAge').value), whatsapp = document.getElementById('loveWhatsapp').value.trim(); if (username.length < 3) {
        notice('Enter a username with at least 3 characters.');
        return;
    } if (!Number.isInteger(age) || age < 18 || age > 100) {
        notice('Love Connection is only for people aged 18 and above. Enter a valid age.');
        return;
    } try {
        yield db.collection('users').doc(currentFirebaseUser.uid).set({ username: username, age: age, loveEligible: true, whatsapp: whatsapp, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        yield db.collection('publicProfiles').doc(currentFirebaseUser.uid).set({ username: username, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        yield currentFirebaseUser.updateProfile({ displayName: username });
        currentLoveProfile = { username, age, whatsapp, loveEligible: true };
        document.getElementById('loveProfileStatus').textContent = 'Your Love Profile has been saved.';
        yield refreshLoveAccess();
        notice('Love Profile saved. You can now publish a post.');
    }
    catch (e) {
        console.error(e);
        document.getElementById('loveProfileStatus').textContent = firebaseErrorMessage(e);
    } });
}
function loadLoveProfile() {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser || !db)
        return; try {
        const snap = yield db.collection('users').doc(currentFirebaseUser.uid).get();
        if (!snap.exists)
            return;
        const d = snap.data();
        currentLoveProfile = d;
        if (d.username)
            document.getElementById('loveUsername').value = d.username;
        if (d.age)
            document.getElementById('loveAge').value = d.age;
        if (d.whatsapp)
            document.getElementById('loveWhatsapp').value = d.whatsapp;
    }
    catch (e) {
        console.warn('Love profile load:', e);
    } });
}
function publishLovePost() {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in before publishing in Love Connection.');
        showPage('profile');
        return;
    } const text = document.getElementById('lovePostText').value.trim(), shareWhatsapp = document.getElementById('shareLoveWhatsapp').checked; let username = document.getElementById('loveUsername').value.trim(), age = Number(document.getElementById('loveAge').value), whatsapp = document.getElementById('loveWhatsapp').value.trim(); if (!currentLoveProfile || currentLoveProfile.loveEligible !== true || username.length < 3 || !Number.isInteger(age) || age < 18 || age > 100) {
        notice('Complete and save your Love Profile with a valid age of 18 or above first.');
        return;
    } if (!text) {
        notice('Write your Love Connection message first.');
        return;
    } if (text.length > 1000) {
        notice('Your post is too long.');
        return;
    } if (shareWhatsapp && !whatsapp) {
        notice('Enter your WhatsApp number or turn off the WhatsApp sharing option.');
        return;
    } try {
        yield db.collection('love_posts').add({ uid: currentFirebaseUser.uid, authorName: username, age: age, text: text, whatsapp: shareWhatsapp ? whatsapp : '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('lovePostText').value = '';
        document.getElementById('shareLoveWhatsapp').checked = false;
        document.getElementById('lovePostStatus').textContent = 'Your post has been published.';
        notice('Your post is now visible in Love Connection only.');
    }
    catch (e) {
        console.error(e);
        document.getElementById('lovePostStatus').textContent = firebaseErrorMessage(e);
    } });
}
let blockedLoveUsers = new Set();
function loadLovePostsForUser() {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser || !db)
        return; try {
        const snap = yield db.collection('users').doc(currentFirebaseUser.uid).collection('blocked_users').get();
        blockedLoveUsers = new Set(snap.docs.map(d => d.id));
        const feed = yield db.collection('love_posts').orderBy('createdAt', 'desc').limit(50).get();
        renderLovePosts(feed.docs.map(d => (Object.assign({ id: d.id }, d.data()))));
    }
    catch (e) {
        console.warn('Could not load blocked users:', e);
    } });
}
function renderLovePosts(posts) { const el = document.getElementById('loveFeed'); if (!el)
    return; if (!(currentLoveProfile && currentLoveProfile.loveEligible === true)) { el.innerHTML = ''; return; } const visible = posts.filter(p => !blockedLoveUsers.has(p.uid)); if (!visible.length) {
    el.innerHTML = '<div class="empty-feed">No Love Connection posts to show.</div>';
    return;
} el.innerHTML = visible.map(p => { const mine = currentFirebaseUser && p.uid === currentFirebaseUser.uid; const wa = p.whatsapp ? '<p class="creator-hint">WhatsApp: ' + safeText(p.whatsapp) + '</p>' : ''; const actions = mine ? '<button class="post-delete" data-delete-love-post="' + safeText(p.id) + '">Delete my post</button>' : '<div class="actions"><button class="secondary" data-report-love-post="' + safeText(p.id) + '" data-report-user="' + safeText(p.uid) + '">Report</button><button class="secondary" data-block-love-user="' + safeText(p.uid) + '">Block user</button></div>'; return '<article class="post-card" data-engagement="love_posts" data-post-id="' + safeText(p.id) + '" data-author-uid="' + safeText(p.uid) + '"><div class="post-meta"><button class="text-link" data-open-profile="' + safeText(p.uid) + '">' + safeText(marketplacePublicName(p.authorName)) + ' · ' + safeText(p.age || '') + ' years</button><span>' + safeText(postDate(p.createdAt)) + '</span></div>' + (p.isRepost ? '<p class="creator-hint">🔁 Repost · Originally shared by ' + safeText(p.originalAuthor || 'Afrishine Member') + '</p>' : '') + '<div class="post-body">' + safeText(p.text || '') + '</div>' + wa + '<div class="actions post-actions"><button class="secondary" data-like="' + safeText(p.id) + '" data-kind="love_posts">♡ Like <span data-like-count>0</span></button><button class="secondary" data-focus-comment="' + safeText(p.id) + '">💬 Comment</button><button class="secondary" data-share-post="' + safeText(p.id) + '" data-kind="love_posts">↗ Share</button><button class="secondary" data-repost="' + safeText(p.id) + '" data-kind="love_posts">🔁 Repost</button>' + (mine ? '' : '<button class="secondary" data-message-user="' + safeText(p.uid) + '" data-message-name="' + safeText(marketplacePublicName(p.authorName)) + '">✉ Message</button>') + '</div><div class="comment-area"><div data-comments-list></div><div class="comment-compose"><input class="field" data-comment-input placeholder="Write a comment…" maxlength="500"><button class="gold" data-send-comment="' + safeText(p.id) + '" data-kind="love_posts">Send</button></div></div>' + actions + '</article>'; }).join(''); el.querySelectorAll('[data-engagement]').forEach(queueEngagement); }
function reportLovePost(postId, userId) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to report a post.');
        return;
    } const reason = prompt('Why are you reporting this post? (e.g. harassment, scam, inappropriate content)'); if (!reason || !reason.trim())
        return; try {
        yield db.collection('love_reports').add({ reporterUid: currentFirebaseUser.uid, postId: postId, reportedUid: userId, reason: reason.trim().slice(0, 500), createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'new' });
        notice('Report submitted. Thank you for helping keep Love Connection safe.');
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
function blockLoveUser(userId) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to block a user.');
        return;
    } if (!userId || userId === currentFirebaseUser.uid)
        return; if (!confirm('Block this user? Their Love Connection posts will be hidden from your feed.'))
        return; try {
        yield db.collection('users').doc(currentFirebaseUser.uid).collection('blocked_users').doc(userId).set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        blockedLoveUsers.add(userId);
        yield loadLovePostsForUser();
        notice('User blocked. Their posts are now hidden from your feed.');
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
function deleteMyLovePost(id) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser)
        return; if (!confirm('Delete this Love Connection post permanently?'))
        return; try {
        const ref = db.collection('love_posts').doc(id), snap = yield ref.get();
        if (!snap.exists || snap.data().uid !== currentFirebaseUser.uid) {
            notice('You can only delete your own post.');
            return;
        }
        const lovePostData = snap.data();
        yield ref.delete();
        if (lovePostData.imageKey && typeof workerDelete === 'function') workerDelete(lovePostData.imageKey).catch(function () { });
        notice('Love Connection post deleted.');
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-delete-love-post]'); if (b)
    deleteMyLovePost(b.getAttribute('data-delete-love-post')); });
document.addEventListener('click', e => { const report = e.target.closest('[data-report-love-post]'); if (report)
    reportLovePost(report.getAttribute('data-report-love-post'), report.getAttribute('data-report-user')); const block = e.target.closest('[data-block-love-user]'); if (block)
    blockLoveUser(block.getAttribute('data-block-love-user')); });
var loveFeedStarted = false;
function startLoveFeed() {
    if (loveFeedStarted || !db) return;
    loveFeedStarted = true;
    db.collection('love_posts').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => { renderLovePosts(snap.docs.map(d => (Object.assign({ id: d.id }, d.data())))); scrollToSharedPost('love_posts'); }, e => { console.error('Love feed error:', e); loveFeedStarted = false; const el = document.getElementById('loveFeed'); if (el)
        el.textContent = firebaseErrorMessage(e); });
}
