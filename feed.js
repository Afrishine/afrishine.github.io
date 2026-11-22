/* Afrishine Hub - Feed (feed.js): posts, likes, comments, share, repost, member profiles, inbox and messages. */

/* FIRESTORE POSTS FEED: rendered as text, escaped before HTML insertion */
function safeText(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function postDate(ts) { try {
    return ts && ts.toDate ? ts.toDate().toLocaleString() : 'Just now';
}
catch (e) {
    return 'Recently';
} }
var engagementObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { engagementObserver.unobserve(en.target); loadPostEngagement(en.target); } }); }, { rootMargin: '250px' }) : null;
function queueEngagement(card) { if (engagementObserver) engagementObserver.observe(card); else loadPostEngagement(card); }
function renderPostList(elementId, posts, emptyMessage) { const el = document.getElementById(elementId); if (!el)
    return; if (el.querySelector('[data-vlink-playing="1"]')) { clearTimeout(el.__afRetry); el.__afRetry = setTimeout(function () { renderPostList(elementId, posts, emptyMessage); }, 10000); return; } posts = posts.filter(p => p.visibility !== 'private' || (currentFirebaseUser && p.uid === currentFirebaseUser.uid)); if (!posts.length) {
    el.innerHTML = '<div class="empty-feed">' + emptyMessage + '</div>';
    return;
} el.innerHTML = posts.map(p => { const mine = currentFirebaseUser && p.uid === currentFirebaseUser.uid; const mediaUrl = p.mediaUrl || p.videoUrl || p.mediaURL || p.mediaURL || ''; const mediaType = p.mediaType || (p.type === 'video' ? 'video' : (p.type === 'image' ? 'image' : '')); const mediaMarkup = mediaUrl ? (mediaType === 'video' ? '<video class="post-media-video" src="' + safeText(mediaUrl) + '" controls playsinline preload="metadata" style="width:100%;max-height:520px;border-radius:14px;background:#080a10"></video>' : '<img class="post-media-image" src="' + safeText(mediaUrl) + '" alt="Shared media" loading="lazy" style="width:100%;max-height:520px;object-fit:contain;border-radius:14px;background:#080a10">') : ''; return '<article class="post-card' + (p.type === 'link' ? ' vlink-post' : '') + '" data-engagement="posts" data-post-id="' + safeText(p.id) + '" data-author-uid="' + safeText(p.uid) + '" data-visibility="' + safeText(p.visibility || 'public') + '"><div class="post-meta"><button class="text-link" data-open-profile="' + safeText(p.uid) + '">' + safeText(marketplacePublicName(p.authorName)) + '</button><span>' + safeText(postDate(p.createdAt)) + '</span></div>' + (p.isRepost ? '<p class="creator-hint">🔁 Repost · Originally shared by ' + safeText(p.originalAuthor || 'Afrishine Member') + '</p>' : '') + '<div class="post-body">' + safeText(p.text || '') + '</div>' + (p.type === 'link' && window.afLinkCardHtml ? window.afLinkCardHtml(p) : mediaMarkup) + '<div class="actions post-actions"><button class="secondary" data-like="' + safeText(p.id) + '" data-kind="posts">♡ Like <span data-like-count>0</span></button><button class="secondary" data-focus-comment="' + safeText(p.id) + '">💬 Comment</button><button class="secondary" data-share-post="' + safeText(p.id) + '" data-kind="posts">↗ Share</button><button class="secondary" data-repost="' + safeText(p.id) + '" data-kind="posts">🔁 Repost</button>' + (mine ? '' : '<button class="secondary" data-message-user="' + safeText(p.uid) + '" data-message-name="' + safeText(marketplacePublicName(p.authorName)) + '">✉ Message</button>') + '</div><div class="comment-area"><div data-comments-list></div><div class="comment-compose"><input class="field" data-comment-input placeholder="Write a comment…" maxlength="500"><button class="gold" data-send-comment="' + safeText(p.id) + '" data-kind="posts">Send</button></div></div>' + (mine ? '<button class="post-delete" data-delete-post="' + safeText(p.id) + '">Delete my post</button>' : '') + '</article>'; }).join(''); el.querySelectorAll('[data-engagement]').forEach(queueEngagement); }
function renderPosts(posts) { window.__afLatestPosts = posts; if (typeof window.afRefreshNotifications === 'function') setTimeout(window.afRefreshNotifications, 0); const talentPosts = posts.filter(p => p.source === 'talent'); const communityPosts = posts.filter(p => p.source !== 'talent'); renderPostList('homeFeed', posts, 'No posts yet. Be the first to share something with Afrishine Hub.'); renderPostList('talentFeed', talentPosts, 'No Talent Hub posts yet. Be the first to showcase your talent.'); renderPostList('communityFeed', communityPosts, 'No Community posts yet. Be the first to share with the Community.'); }
function scrollToSharedPost(kind) { if (!window.ahSharedPostId)
    return; const card = document.querySelector('[data-engagement="' + kind + '"][data-post-id="' + window.ahSharedPostId + '"]'); if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.outline = '2px solid var(--gold)';
    window.ahSharedPostId = null;
} }
// LIKES, COMMENTS, MEMBER PROFILES AND DIRECT MESSAGES
function loadPostEngagement(card) {
    return __awaiter(this, void 0, void 0, function* () { if (!db)
        return; const kind = card.dataset.engagement, id = card.dataset.postId; try {
        const ref = db.collection(kind).doc(id), likes = yield ref.collection('likes').get();
        const count = card.querySelector('[data-like-count]');
        if (count)
            count.textContent = String(likes.size);
        const likeBtn = card.querySelector('[data-like]');
        if (currentFirebaseUser) {
            const mine = yield ref.collection('likes').doc(currentFirebaseUser.uid).get();
            if (mine.exists)
                likeBtn.textContent = '♥ Liked ' + likes.size;
        }
        const comments = yield ref.collection('comments').orderBy('createdAt', 'asc').limit(10).get();
        const box = card.querySelector('[data-comments-list]');
        if (box)
            box.innerHTML = comments.docs.map(d => { const c = d.data(); return '<p class="comment-line"><b>' + safeText(c.authorName || 'Member') + ':</b> ' + safeText(c.text || '') + '</p>'; }).join('');
    }
    catch (e) {
        console.warn('Engagement load failed:', e);
    } });
}
function togglePostLike(kind, id, btn) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to like posts.');
        showPage('profile');
        return;
    } try {
        const parentPostRef = db.collection(kind).doc(id);
        const parentPostSnap = yield parentPostRef.get();
        const postOwnerUid = parentPostSnap.exists ? parentPostSnap.data().uid : null;
        const ref = parentPostRef.collection('likes').doc(currentFirebaseUser.uid), snap = yield ref.get();
        if (snap.exists) {
            yield ref.delete();
            btn.innerHTML = '♡ Like <span data-like-count>0</span>';
        }
        else {
            yield ref.set({ uid: currentFirebaseUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            if (postOwnerUid && postOwnerUid !== currentFirebaseUser.uid && typeof window.afCreateNotification === 'function') {
                window.afCreateNotification(postOwnerUid, 'post_like', 'New like', (currentFirebaseUser.displayName || 'A member') + ' liked your post.', kind === 'love_posts' ? 'love' : 'talent');
            }
            btn.innerHTML = '♥ Liked <span data-like-count>0</span>';
        }
        const card = btn.closest('[data-engagement]');
        yield loadPostEngagement(card);
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
function addPostComment(kind, id, card) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to comment.');
        showPage('profile');
        return;
    } const input = card.querySelector('[data-comment-input]'), text = input.value.trim(); if (!text) {
        notice('Write a comment first.');
        return;
    } if (text.length > 500) {
        notice('Comment is too long.');
        return;
    } try {
        const commentPostSnap = yield db.collection(kind).doc(id).get();
        const commentOwnerUid = commentPostSnap.exists ? commentPostSnap.data().uid : null;
        yield db.collection(kind).doc(id).collection('comments').add({ uid: currentFirebaseUser.uid, authorName: currentFirebaseUser.displayName || 'Afrishine Member', text, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        if (commentOwnerUid && commentOwnerUid !== currentFirebaseUser.uid && typeof window.afCreateNotification === 'function') {
            window.afCreateNotification(commentOwnerUid, 'post_comment', 'New comment', (currentFirebaseUser.displayName || 'A member') + ' commented on your post.', kind === 'love_posts' ? 'love' : 'talent');
        }
        input.value = '';
        yield loadPostEngagement(card);
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
function sharePost(kind, id) {
    return __awaiter(this, void 0, void 0, function* () { const page = kind === 'love_posts' ? 'love' : 'home'; const url = 'https://afrishinegithubio.vercel.app/share/' + encodeURIComponent(kind) + '/' + encodeURIComponent(id); const card = document.querySelector('[data-engagement=\"' + kind + '\"][data-post-id=\"' + id + '\"]'); const postBody = card ? card.querySelector('.post-body') : null; const body = postBody ? postBody.textContent : 'Afrishine Hub post'; const shareData = { title: 'Afrishine Hub', text: body.slice(0, 220), url }; try {
        if (navigator.share) {
            yield navigator.share(shareData);
        }
        else if (navigator.clipboard && navigator.clipboard.writeText) {
            yield navigator.clipboard.writeText(url);
            notice('Post link copied. You can now share it.');
        }
        else {
            prompt('Copy this link to share the post:', url);
        }
    }
    catch (e) {
        if (e.name !== 'AbortError')
            notice('Sharing was not completed.');
    } });
}
function repostPost(kind, id) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to repost.');
        showPage('profile');
        return;
    } try {
        const ref = db.collection(kind).doc(id), snap = yield ref.get();
        if (!snap.exists) {
            notice('This post is no longer available.');
            return;
        }
        const p = snap.data(), name = currentFirebaseUser.displayName || 'Afrishine Member';
        if (kind === 'love_posts') {
            if (!currentLoveProfile || currentLoveProfile.loveEligible !== true) {
                notice('Save your 18+ Love Profile before reposting in Love Connection.');
                return;
            }
            yield db.collection('love_posts').add({ uid: currentFirebaseUser.uid, authorName: currentLoveProfile.username || name, age: currentLoveProfile.age, text: p.text || '', whatsapp: '', isRepost: true, originalPostId: id, originalAuthor: p.authorName || 'Afrishine Member', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            notice('Reposted to Love Connection.');
        }
        else {
            yield db.collection('posts').add({ uid: currentFirebaseUser.uid, authorName: name, text: p.type === 'link' ? ((p.linkTitle || 'Video') + ' ' + (p.linkUrl || '')).trim() : (p.text || ''), type: 'text', source: p.source === 'talent' ? 'talent' : 'hub', isRepost: true, originalPostId: id, originalAuthor: p.authorName || 'Afrishine Member', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            notice(p.source === 'talent' ? 'Reposted to Talent Hub and Home.' : 'Reposted to Community and Home.');
        }
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
function openMemberProfile(uid) {
    return __awaiter(this, void 0, void 0, function* () { if (!uid)
        return; if (!currentFirebaseUser) {
        notice('Sign in to view member profiles.');
        showPage('profile');
        return;
    } showPage('memberProfile'); const el = document.getElementById('memberProfileContent'); el.innerHTML = '<p class="muted">Loading profile…</p>'; try {
        const snap = yield db.collection('publicProfiles').doc(uid).get();
        if (!snap.exists) {
            el.innerHTML = '<p>This member has not published a public profile yet.</p>';
            return;
        }
        const d = snap.data();
        el.innerHTML = '<div class="profile-avatar">' + safeText((d.username || 'A').slice(0, 1).toUpperCase()) + '</div><h2>' + safeText(d.username || 'Afrishine Member') + '</h2><p>' + safeText(d.bio || 'Afrishine Hub member') + '</p><p class="creator-hint">' + safeText(d.location || '') + '</p>' + (uid === currentFirebaseUser.uid ? '<p>This is your public profile.</p>' : '<button class="gold" data-profile-message="' + safeText(uid) + '" data-profile-name="' + safeText(d.username || 'Afrishine Member') + '">✉ Send Message</button>');
    }
    catch (e) {
        console.error(e);
        el.innerHTML = '<p>' + safeText(firebaseErrorMessage(e)) + '</p>';
    } });
}
function conversationId(a, b) { return [a, b].sort().join('_'); }
function startConversation(uid, name) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to send messages.');
        showPage('profile');
        return;
    } if (!uid || uid === currentFirebaseUser.uid) {
        notice('You cannot message your own account.');
        return;
    } try {
        const id = conversationId(currentFirebaseUser.uid, uid), ref = db.collection('conversations').doc(id);
        /* Create the conversation only when it does not exist yet. Re-writing an existing one (merge) was refused by
           the security rules whenever the other member had started the chat (participants in a different order). */
        let exists = false;
        try { exists = (yield ref.get()).exists; } catch (_) { exists = false; }
        if (!exists) {
            yield ref.set({ participants: [currentFirebaseUser.uid, uid], participantNames: { [currentFirebaseUser.uid]: currentFirebaseUser.displayName || 'Member', [uid]: name || 'Afrishine Member' }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        activeConversationId = id;
        activeConversationName = name || 'Afrishine Member';
        showPage('inbox');
        yield loadInbox();
        yield openConversation(id, activeConversationName);
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
let activeConversationId = null, activeConversationName = '';
function loadInbox() {
    return __awaiter(this, void 0, void 0, function* () { const el = document.getElementById('inboxList'); if (!el)
        return; if (!currentFirebaseUser) {
        el.innerHTML = '<p class="muted">Sign in to view your messages.</p>';
        return;
    } try {
        const snap = yield db.collection('conversations').where('participants', 'array-contains', currentFirebaseUser.uid).limit(40).get();
        if (snap.empty) {
            el.innerHTML = '<p class="muted">No messages yet. Visit a member profile and tap Send Message.</p>';
            return;
        }
        el.innerHTML = snap.docs.sort((a, b) => ((b.data().updatedAt && b.data().updatedAt.toMillis) ? b.data().updatedAt.toMillis() : 0) - ((a.data().updatedAt && a.data().updatedAt.toMillis) ? a.data().updatedAt.toMillis() : 0)).map(doc => { const d = doc.data(), other = (d.participants || []).find(x => x !== currentFirebaseUser.uid), name = (d.participantNames || {})[other] || 'Afrishine Member'; return '<button class="conversation-row" data-open-conversation="' + safeText(doc.id) + '" data-conversation-name="' + safeText(name) + '"><b>' + safeText(name) + '</b><small>' + safeText(d.lastMessage || 'Start a conversation') + '</small></button>'; }).join('');
    }
    catch (e) {
        console.error(e);
        el.innerHTML = '<p>' + safeText(firebaseErrorMessage(e)) + '</p>';
    } });
}
function openConversation(id, name) {
    return __awaiter(this, void 0, void 0, function* () { activeConversationId = id; activeConversationName = name || 'Conversation'; const el = document.getElementById('inboxList'); el.innerHTML = '<div class="conversation-view"><button class="secondary" onclick="loadInbox()">← All conversations</button><h2>' + safeText(activeConversationName) + '</h2><div id="messageList" class="message-list">Loading messages…</div><div class="comment-compose"><input class="field" id="messageInput" maxlength="2000" placeholder="Write a message…"><button class="gold" onclick="sendDirectMessage()">Send</button></div></div>'; try {
        const snap = yield db.collection('conversations').doc(id).collection('messages').orderBy('createdAt', 'asc').limit(100).get();
        const list = document.getElementById('messageList');
        list.innerHTML = snap.docs.map(d => { const m = d.data(), mine = m.senderUid === currentFirebaseUser.uid; return '<div class="message-bubble ' + (mine ? 'mine' : '') + '"><b>' + safeText(m.senderName || 'Member') + '</b><p>' + safeText(m.text || '') + '</p><small>' + safeText(postDate(m.createdAt)) + '</small></div>'; }).join('') || '<p class="muted">Say hello to start chatting.</p>';
    }
    catch (e) {
        console.error(e);
        document.getElementById('messageList').textContent = firebaseErrorMessage(e);
    } });
}
function sendDirectMessage() {
    return __awaiter(this, void 0, void 0, function* () { const input = document.getElementById('messageInput'), text = input && input.value.trim(); if (!text || !activeConversationId)
        return; if (text.length > 2000) {
        notice('Message is too long.');
        return;
    } try {
        const ref = db.collection('conversations').doc(activeConversationId);
        const conversationSnap = yield ref.get();
        const participants = conversationSnap.exists ? (conversationSnap.data().participants || []) : [];
        const recipientUid = participants.find(function (uid) { return uid !== currentFirebaseUser.uid; });
        yield ref.collection('messages').add({ senderUid: currentFirebaseUser.uid, senderName: currentFirebaseUser.displayName || 'Member', text, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        yield ref.set({ lastMessage: text.slice(0, 120), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        if (recipientUid && typeof window.afCreateNotification === 'function') {
            window.afCreateNotification(recipientUid, 'message', 'New message', (currentFirebaseUser.displayName || 'A member') + ' sent you a message.', 'inbox');
        }
        input.value = '';
        yield openConversation(activeConversationId, activeConversationName);
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
document.addEventListener('click', e => { const share = e.target.closest('[data-share-post]'); if (share)
    sharePost(share.dataset.kind, share.dataset.sharePost); const repost = e.target.closest('[data-repost]'); if (repost)
    repostPost(repost.dataset.kind, repost.dataset.repost); const like = e.target.closest('[data-like]'); if (like)
    togglePostLike(like.dataset.kind, like.dataset.like, like); const send = e.target.closest('[data-send-comment]'); if (send)
    addPostComment(send.dataset.kind, send.dataset.sendComment, send.closest('[data-engagement]')); const focus = e.target.closest('[data-focus-comment]'); if (focus) {
    const input = focus.closest('[data-engagement]').querySelector('[data-comment-input]');
    if (input)
        input.focus();
} const profile = e.target.closest('[data-open-profile]'); if (profile)
    openMemberProfile(profile.dataset.openProfile); const msg = e.target.closest('[data-message-user]'); if (msg)
    startConversation(msg.dataset.messageUser, msg.dataset.messageName); const pm = e.target.closest('[data-profile-message]'); if (pm)
    startConversation(pm.dataset.profileMessage, pm.dataset.profileName); const conv = e.target.closest('[data-open-conversation]'); if (conv)
    openConversation(conv.dataset.openConversation, conv.dataset.conversationName); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-comment-input]')) {
    e.preventDefault();
    const card = e.target.closest('[data-engagement]'), btn = card.querySelector('[data-send-comment]');
    addPostComment(btn.dataset.kind, btn.dataset.sendComment, card);
} });
function deleteMyPost(id) {
    return __awaiter(this, void 0, void 0, function* () { if (!currentFirebaseUser) {
        notice('Sign in to manage your posts.');
        return;
    } if (!confirm('Delete this post permanently?'))
        return; try {
        const ref = db.collection('posts').doc(id), snap = yield ref.get();
        if (!snap.exists || snap.data().uid !== currentFirebaseUser.uid) {
            notice('You can only delete your own post.');
            return;
        }
        yield ref.delete();
        notice('Your post has been deleted.');
    }
    catch (e) {
        console.error(e);
        notice(firebaseErrorMessage(e));
    } });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-delete-post]'); if (b)
    deleteMyPost(b.getAttribute('data-delete-post')); });
var generalFeedReceived = false;
if (db) {
    db.collection('posts').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => { generalFeedReceived = true; const posts = snap.docs.map(d => (Object.assign({ id: d.id }, d.data()))); renderPosts(posts); scrollToSharedPost('posts'); }, e => { console.error('Firestore feed error:', e); const msg = e.code === 'failed-precondition' ? 'Posts could not be loaded right now. Please try again shortly.' : firebaseErrorMessage(e); ['homeFeed', 'communityFeed', 'talentFeed'].forEach(id => { const el = document.getElementById(id); if (el)
        el.innerHTML = '<p>' + safeText(msg) + '</p><button class="secondary" onclick="retryGeneralFeed()">Retry loading posts</button>'; }); });
    setTimeout(function () { if (!generalFeedReceived) {
        ['homeFeed', 'communityFeed', 'talentFeed'].forEach(id => { var el = document.getElementById(id); if (el && el.textContent.toLowerCase().indexOf('loading') !== -1)
            el.innerHTML = '<p class="muted">Connection is taking longer than expected.</p><button class="secondary" onclick="retryGeneralFeed()">Retry loading posts</button>'; });
    } }, 15000);
}
else {
    ['homeFeed', 'communityFeed', 'talentFeed'].forEach(id => { var el = document.getElementById(id); if (el)
        el.textContent = 'We could not connect to Afrishine Hub services. Please check your connection and reload the page.'; });
}
function retryGeneralFeed() {
    return __awaiter(this, void 0, void 0, function* () { var ids = ['homeFeed', 'communityFeed', 'talentFeed']; ids.forEach(function (id) { var el = document.getElementById(id); if (el)
        el.textContent = 'Loading posts…'; }); try {
        var snap = yield db.collection('posts').orderBy('createdAt', 'desc').limit(50).get();
        generalFeedReceived = true;
        renderPosts(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }));
    }
    catch (e) {
        console.error('Retry feed failed:', e);
        ids.forEach(function (id) { var el = document.getElementById(id); if (el)
            el.innerHTML = '<p>' + safeText(firebaseErrorMessage(e)) + '</p><button class="secondary" onclick="retryGeneralFeed()">Try again</button>'; });
    } });
}
