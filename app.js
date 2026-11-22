/* Afrishine Hub - core JavaScript (app.js). Loads FIRST: Firebase setup, navigation, menus, creating posts and media upload, plus the original Marketplace code that marketplace.js later replaces. */

(function(){if(!Promise.allSettled){Promise.allSettled=function(items){return Promise.all(Array.prototype.map.call(items,function(item){return Promise.resolve(item).then(function(value){return {status:'fulfilled',value:value};},function(reason){return {status:'rejected',reason:reason};});}));};}})();
if(!window.CSS){window.CSS={};}if(!window.CSS.escape){window.CSS.escape=function(value){return String(value).replace(/[^a-zA-Z0-9_-]/g,function(ch){return '\\'+ch;});};}

/* ---------- next block ---------- */

/* Android 8+ compatibility helpers: keep older WebViews able to run page actions. */
(function () {
    if (window.Element && !Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector || function (selector) {
            var nodes = (this.document || this.ownerDocument).querySelectorAll(selector), i = 0;
            while (nodes[i] && nodes[i] !== this) {
                i++;
            }
            return !!nodes[i];
        };
    }
    if (window.Element && !Element.prototype.closest) {
        Element.prototype.closest = function (selector) {
            var node = this;
            while (node && node.nodeType === 1) {
                if (node.matches && node.matches(selector))
                    return node;
                node = node.parentElement || node.parentNode;
            }
            return null;
        };
    }
})();

/* ---------- next block ---------- */

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/* Firebase Auth + Firestore. Media files are uploaded through the Afrishine Cloudflare Worker. */
const firebaseConfig = {
    apiKey: "AIzaSyBnrdoguyhUd_E3I5RHqcQxHNVLa6kIMX4",
    authDomain: "afrishine-hub.firebaseapp.com",
    projectId: "afrishine-hub",
    storageBucket: "afrishine-hub.firebasestorage.app",
    messagingSenderId: "553901207884",
    appId: "1:553901207884:web:81d4dce86149267ae59fe9",
    measurementId: "G-WXNG0SHM9X"
};
let auth = null, db = null, currentFirebaseUser = null, cameraStream = null, cameraFacing = 'user', selectedMediaUrl = null, selectedMediaFile = null, selectedMediaType = null, createSource = 'hub', marketplaceFilter = 'all', pendingMarketplaceLogin = false;
let marketplaceLastDoc = null, marketplaceHasMore = false, marketplaceLoading = false;
const MARKETPLACE_PAGE_SIZE = 15;
try {
    if (!firebase.apps.length)
        firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
}
catch (error) {
    console.error('Firebase initialization failed:', error);
}
function isGoogleMarketplaceUser(user) { if (!user || !user.providerData)
    return false; return user.providerData.some(function (info) { return info.providerId === 'google.com'; }); }
function isPiBrowser() { var ua = (navigator && navigator.userAgent) || ''; return !!(window.Pi) || /PiBrowser/i.test(ua); }
function canViewMarketplace() { return isPiBrowser() || isGoogleMarketplaceUser(currentFirebaseUser); }
function getAfrishineRoutePage() {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    if (path === '/marketplace') return 'shop';
    if (path === '/academy') return 'academy';
    if (path === '/talent') return 'talent';
    return '';
}
function getAfrishinePageUrl(id) {
    const routes = { shop: '/marketplace', academy: '/academy', talent: '/talent', home: '/' };
    const base = routes[id] || '/';
    return base + (location.search || '') + (routes[id] ? '' : (id === 'home' ? '' : '#' + encodeURIComponent(id)));
}
function showPage(id) {
    if (id === 'shop' && !canViewMarketplace()) {
        openMarketplaceLogin();
        return;
    }
    const page = document.getElementById(id);
    if (!page) return;
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
    document.querySelectorAll('[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === id));
    const nextUrl = getAfrishinePageUrl(id);
    const currentUrl = location.pathname + (location.search || '') + (location.hash || '');
    if (currentUrl !== nextUrl && window.history && history.pushState) {
        history.pushState(null, '', nextUrl);
    } else if (currentUrl !== nextUrl && !window.history) {
        location.href = nextUrl;
    }
    closeMenu();
    closeCreateMenu();
    closeCreator();
    if (id === 'love') refreshLoveAccess();
    if (id === 'inbox') loadInbox();
    window.scrollTo(0, 0);
}
document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); showPage(el.dataset.page); }));
const headerSearchInput = document.getElementById('headerSearch');
function runHeaderSearch(e) { e.preventDefault(); const q = headerSearchInput.value.trim().toLowerCase(); if (!q) {
    headerSearchInput.focus();
    return;
} const routes = [{ w: ['talent', 'creator', 'video', 'music', 'dance', 'artist'], p: 'talent' }, { w: ['community', 'feed', 'group', 'challenge', 'events'], p: 'community' }, { w: ['shop', 'product', 'buy', 'sell', 'store'], p: 'shop' }, { w: ['wallet', 'ast', 'token', 'balance', 'transaction'], p: 'wallet' }, { w: ['academy', 'learn', 'course', 'training', 'education'], p: 'academy' }, { w: ['creator rewards', 'creator monetization', 'monetization', 'creator reward'], p: 'creatorRewards' }, { w: ['travel', 'trip', 'booking', 'destination'], p: 'travel' }, { w: ['job', 'work', 'employment'], p: 'jobs' }, { w: ['inbox', 'message', 'chat'], p: 'inbox' }, { w: ['profile', 'account', 'login', 'sign in'], p: 'profile' }, { w: ['love', 'connection'], p: 'love' }, { w: ['contact', 'support', 'help'], p: 'contact' }]; const m = routes.find(r => r.w.some(w => q.includes(w))); if (m) {
    showPage(m.p);
    headerSearchInput.blur();
}
else
    notice('No matching section found. Try Talent, Community, Shop, Wallet, Academy or Travel.'); }
function openMenu() { document.getElementById('menuDrawer').classList.add('open'); document.getElementById('menuBackdrop').classList.add('open'); }
function closeMenu() { document.getElementById('menuDrawer').classList.remove('open'); document.getElementById('menuBackdrop').classList.remove('open'); }
function openCreateMenu(source = 'hub') { createSource = source; closeMenu(); document.getElementById('createMenuTitle').textContent = source === 'talent' ? 'Create on Talent Hub' : 'Create on Afrishine Hub'; document.getElementById('createMenu').classList.add('open'); document.getElementById('createBackdrop').classList.add('open'); }
function closeCreateMenu() { document.getElementById('createMenu').classList.remove('open'); document.getElementById('createBackdrop').classList.remove('open'); }
function createAction(type) { closeCreateMenu(); openCreator(type); }
function openCreator(type) {
    closeCreateMenu();
    closeCreator(false);
    ['postEditor', 'mediaEditor'].forEach(id => document.getElementById(id).style.display = 'none');
    const titles = { post: 'Create Post', photo: 'Upload Photo', video: 'Upload Video', live: 'Go Live' };
    document.getElementById('creatorTitle').textContent = titles[type] || 'Create';
    if (type === 'post') {
        document.getElementById('postEditor').style.display = 'block';
        document.getElementById('postPreview').classList.remove('show');
    }
    if (type === 'photo' || type === 'video') {
        document.getElementById('mediaEditor').style.display = 'block';
        document.getElementById('mediaInstructions').textContent = type === 'photo' ? 'Choose a photo from your phone gallery.' : 'Choose a video from your phone gallery.';
        document.getElementById('chooseMediaButton').textContent = type === 'photo' ? 'Choose Photo from Gallery' : 'Choose Video from Gallery';
        document.getElementById('photoInput').value = '';
        document.getElementById('videoInput').value = '';
        document.getElementById('mediaPreview').classList.remove('show');
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('videoPreview').style.display = 'none';
        document.getElementById('photoInput').dataset.active = type === 'photo' ? 'yes' : 'no';
        document.getElementById('videoInput').dataset.active = type === 'video' ? 'yes' : 'no';
    }
    document.getElementById('creatorBackdrop').classList.add('open');
    document.getElementById('creatorWorkspace').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeCreator(reset = true) { document.getElementById('creatorWorkspace').classList.remove('open'); document.getElementById('creatorBackdrop').classList.remove('open'); document.body.style.overflow = ''; stopCamera(); if (reset && selectedMediaUrl) {
    URL.revokeObjectURL(selectedMediaUrl);
    selectedMediaUrl = null;
} }
function previewPost() { const text = document.getElementById('postText').value.trim(); if (!text) {
    notice('Please write something before previewing your post.');
    return;
} document.getElementById('postPreviewText').textContent = text; document.getElementById('postPreview').classList.add('show'); }
function editPost() { document.getElementById('postPreview').classList.remove('show'); document.getElementById('postText').focus(); }
function chooseMedia() { const p = document.getElementById('photoInput'), v = document.getElementById('videoInput'); if (p.dataset.active === 'yes')
    p.click();
else if (v.dataset.active === 'yes')
    v.click(); }
document.getElementById('photoInput').addEventListener('change', function () { const f = this.files && this.files[0]; if (!f)
    return; if (!f.type.startsWith('image/')) {
    notice('Please select a valid image.');
    return;
} showMediaPreview(f, 'photo'); });
document.getElementById('videoInput').addEventListener('change', function () { const f = this.files && this.files[0]; if (!f)
    return; if (!f.type.startsWith('video/')) {
    notice('Please select a valid video.');
    return;
} showMediaPreview(f, 'video'); });
function showMediaPreview(file, type) { selectedMediaFile = file; selectedMediaType = type; if (selectedMediaUrl)
    URL.revokeObjectURL(selectedMediaUrl); selectedMediaUrl = URL.createObjectURL(file); const p = document.getElementById('photoPreview'), v = document.getElementById('videoPreview'); p.style.display = 'none'; v.style.display = 'none'; v.pause(); v.removeAttribute('src'); if (type === 'photo') {
    p.src = selectedMediaUrl;
    p.style.display = 'block';
    document.getElementById('mediaPreviewTitle').textContent = 'Photo Preview';
}
else {
    v.src = selectedMediaUrl;
    v.style.display = 'block';
    document.getElementById('mediaPreviewTitle').textContent = 'Video Preview';
} document.getElementById('mediaPreview').classList.add('show'); }
function mediaUploadNotice() {
    return __awaiter(this, void 0, void 0, function* () {
        const file = selectedMediaFile;
        if (!file) {
            notice('Choose a photo or video first.');
            return;
        }
        if (!auth || !currentFirebaseUser) {
            notice('Please sign in before uploading media.');
            showPage('profile');
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            notice('This file is larger than the 100 MB limit. Choose a smaller file.');
            return;
        }
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
        if (!allowed.includes(file.type)) {
            notice('This file format is not supported. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV.');
            return;
        }
        const postButton = document.querySelector('#mediaPreview .creator-actions button.gold');
        if (postButton) {
            postButton.disabled = true;
            postButton.textContent = 'Uploading…';
        }
        try {
            const token = yield currentFirebaseUser.getIdToken();
            const endpoint = 'https://afrishine-media.usherluckyelie.workers.dev/upload?filename=' + encodeURIComponent(file.name || 'media');
            const response = yield fetch(endpoint, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': file.type }, body: file });
            const result = yield response.json().catch(() => ({}));
            if (!response.ok || !result.success)
                throw new Error(result.error || 'Media upload failed. Please try again.');
            const postTextField = document.getElementById('postText');
            const caption = (postTextField ? postTextField.value : '').trim();
            yield db.collection('posts').add({
                uid: currentFirebaseUser.uid,
                authorName: currentFirebaseUser.displayName || 'Afrishine Member',
                text: caption,
                type: selectedMediaType === 'video' ? 'video' : 'image',
                mediaType: selectedMediaType === 'video' ? 'video' : 'image',
                mediaUrl: result.url,
                mediaKey: result.key,
                source: createSource,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById('postText').value = '';
            document.getElementById('mediaPreview').classList.remove('show');
            document.getElementById('photoInput').value = '';
            document.getElementById('videoInput').value = '';
            selectedMediaFile = null;
            selectedMediaType = null;
            if (selectedMediaUrl) {
                URL.revokeObjectURL(selectedMediaUrl);
                selectedMediaUrl = null;
            }
            closeCreator();
            notice('Your media post has been published successfully.');
        }
        catch (error) {
            console.error('Afrishine media upload:', error);
            notice(error.message || 'Upload failed.');
        }
        finally {
            if (postButton) {
                postButton.disabled = false;
                postButton.textContent = 'Post';
            }
        }
    });
}
function publishTextPost() {
    return __awaiter(this, void 0, void 0, function* () {
        const text = document.getElementById('postText').value.trim();
        if (!text) {
            notice('Write something before publishing.');
            return;
        }
        if (!auth || !currentFirebaseUser) {
            notice('Please create an email account or sign in before publishing a text post.');
            showPage('profile');
            return;
        }
        const btn = document.querySelector('#postPreview button.gold');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Publishing…';
        }
        try {
            yield db.collection('posts').add({ uid: currentFirebaseUser.uid, authorName: currentFirebaseUser.displayName || 'Afrishine Member', text, type: 'text', source: createSource, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            document.getElementById('postText').value = '';
            document.getElementById('postPreview').classList.remove('show');
            closeCreator();
            notice(createSource === 'talent' ? 'Your post has been published to Talent Hub and Home.' : 'Your post has been published to Community and Home.');
        }
        catch (error) {
            console.error(error);
            notice(firebaseErrorMessage(error));
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Publish Post';
            }
        }
    });
}
function stopCamera() { if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
} const v = document.getElementById('liveVideo'); if (v)
    v.srcObject = null; const b = document.getElementById('cameraButton'); if (b)
    b.textContent = 'Start Camera Preview'; }
function notice(message) { const el = document.getElementById('notice'); el.textContent = message; el.style.display = 'block'; clearTimeout(window.ahNoticeTimer); window.ahNoticeTimer = setTimeout(() => el.style.display = 'none', 4000); }
function confirmLoveAge() { document.getElementById('loveAgeGate').style.display = 'none'; document.getElementById('loveContent').style.display = 'block'; }

/* AFRISHINE MARKETPLACE: Google-authenticated posts and community interaction */
function enterMarketplace() { if (!canViewMarketplace()) {
    openMarketplaceLogin();
    return;
} showPage('shop'); loadMarketplacePosts(); }
function openMarketplaceLogin() { pendingMarketplaceLogin = true; document.getElementById('marketLoginModal').classList.add('open'); }
function closeMarketplaceLogin() { pendingMarketplaceLogin = false; document.getElementById('marketLoginModal').classList.remove('open'); }
function marketplaceGoogleLogin() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!auth) {
            document.getElementById('marketLoginMessage').textContent = 'We could not connect to Afrishine Hub services. Please check your connection and reload the page.';
            return;
        }
        var message = document.getElementById('marketLoginMessage');
        try {
            pendingMarketplaceLogin = true;
            sessionStorage.setItem('afrishine_marketplace_google_redirect', '1');
            var provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            yield auth.signInWithRedirect(provider);
        }
        catch (e) {
            console.error('Marketplace Google redirect failed:', e);
            sessionStorage.removeItem('afrishine_marketplace_google_redirect');
            pendingMarketplaceLogin = false;
            if (message)
                message.textContent = firebaseErrorMessage(e);
        }
    });
}
function setMarketplaceFilter(filter) { if (!canViewMarketplace()) {
    openMarketplaceLogin();
    return;
} marketplaceFilter = filter; ['marketAllBtn', 'marketBuyBtn', 'marketSellBtn'].forEach(function (id) { var b = document.getElementById(id); if (b)
    b.classList.remove('active'); }); var active = document.getElementById(filter === 'all' ? 'marketAllBtn' : filter === 'buy' ? 'marketBuyBtn' : 'marketSellBtn'); if (active)
    active.classList.add('active'); loadMarketplacePosts(true); }
function publishMarketplacePost() {
    return __awaiter(this, void 0, void 0, function* () { if (!isGoogleMarketplaceUser(currentFirebaseUser)) {
        openMarketplaceLogin();
        return;
    } if (!db) {
        notice('We could not connect to Afrishine Hub services. Please check your connection and reload the page.');
        return;
    } var type = document.getElementById('marketType').value, text = document.getElementById('marketText').value.trim(), price = document.getElementById('marketPrice').value.trim(), locationText = document.getElementById('marketLocation').value.trim(); if (text.length < 8) {
        notice('Enter a detailed description before publishing your listing.');
        return;
    } if (!locationText) {
        notice('Enter your location, including country and city or district.');
        return;
    } if (text.length > 1200) {
        notice('The description is too long.');
        return;
    } var btn = document.querySelector('#shop .market-form button.gold'); var oldLabel = btn ? btn.textContent : ''; if (btn) {
        btn.disabled = true;
        btn.textContent = 'Posting…';
    } var name = (currentFirebaseUser.displayName || 'Afrishine Member').trim(); try {
        yield db.collection('marketplacePosts').add({ uid: currentFirebaseUser.uid, authorName: name, authorPhoto: currentFirebaseUser.photoURL || '', type: type, text: text, price: price, location: locationText, createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'active' });
        document.getElementById('marketText').value = '';
        document.getElementById('marketPrice').value = '';
        notice('Your Marketplace listing has been published.');
        yield loadMarketplacePosts(true);
    }
    catch (e) {
        console.error('Marketplace publish failed:', e);
        notice(firebaseErrorMessage(e));
    }
    finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = oldLabel || 'Post on Marketplace';
        }
    } });
}
function loadMarketplacePosts() {
    return __awaiter(this, arguments, void 0, function* (reset = true) {
        var feed = document.getElementById('marketplaceFeed');
        if (!feed)
            return;
        if (!canViewMarketplace()) {
            feed.innerHTML = '<p class="muted">Login with Google to view Marketplace posts.</p>';
            return;
        }
        if (!db) {
            feed.innerHTML = '<p class="muted">We could not connect to Afrishine Hub services. Please check your connection and reload the page.</p>';
            return;
        }
        if (marketplaceLoading)
            return;
        marketplaceLoading = true;
        if (reset) {
            marketplaceLastDoc = null;
            marketplaceHasMore = false;
            feed.innerHTML = '<p class="muted">Loading Marketplace…</p>';
        }
        var oldButton = document.getElementById('marketplaceLoadMore');
        if (oldButton)
            oldButton.remove();
        try {
            var query = db.collection('marketplacePosts').orderBy('createdAt', 'desc').limit(MARKETPLACE_PAGE_SIZE);
            if (marketplaceLastDoc)
                query = query.startAfter(marketplaceLastDoc);
            var snap = yield query.get();
            marketplaceLastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : marketplaceLastDoc;
            marketplaceHasMore = snap.docs.length === MARKETPLACE_PAGE_SIZE;
            var posts = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
            if (marketplaceFilter !== 'all')
                posts = posts.filter(function (p) { return p.type === marketplaceFilter; });
            if (reset) {
                if (!posts.length && !marketplaceHasMore)
                    feed.innerHTML = '<div class="empty-feed">No listings yet. Be the first to publish one.</div>';
                else
                    feed.innerHTML = '';
            }
            appendMarketplacePosts(posts);
            if (marketplaceHasMore) {
                var more = document.createElement('button');
                more.id = 'marketplaceLoadMore';
                more.className = 'secondary';
                more.style = 'display:block;width:100%;margin:16px 0';
                more.textContent = 'Load More Posts';
                more.onclick = function () { loadMarketplacePosts(false); };
                feed.appendChild(more);
            }
        }
        catch (e) {
            console.error(e);
            if (reset)
                feed.innerHTML = '<p class="muted">' + safeText(firebaseErrorMessage(e)) + '</p>';
            else
                notice(firebaseErrorMessage(e));
        }
        finally {
            marketplaceLoading = false;
        }
    });
}
function marketplacePublicName(value) { var n = String(value || '').trim(); return (!n || n.includes('@')) ? 'Afrishine Member' : n; }
function appendMarketplacePosts(posts) {
    var feed = document.getElementById('marketplaceFeed');
    if (!feed || !posts.length)
        return;
    var more = document.getElementById('marketplaceLoadMore');
    if (more)
        more.remove();
    var html = posts.map(function (p) { var mine = currentFirebaseUser && p.uid === currentFirebaseUser.uid; var label = p.type === 'buy' ? '🔎 BUY REQUEST' : '🏷️ FOR SALE'; return '<article class="market-post" data-market-post="' + safeText(p.id) + '"><div class="market-post-head"><div><b>' + label + '</b><div class="market-meta">By <button class="secondary" style="padding:3px 8px" onclick="openMemberProfile(\'' + safeText(p.uid) + '\')">' + safeText(marketplacePublicName(p.authorName)) + '</button></div><div class="market-meta">' + safeText(p.location || '') + ' · ' + safeText(postDate(p.createdAt)) + '</div></div>' + (mine ? '<button class="secondary" onclick="deleteMarketplacePost(\'' + safeText(p.id) + '\')">Delete</button>' : '') + '</div><p>' + safeText(p.text || '') + '</p>' + (p.price ? '<b>Price / Budget: ' + safeText(p.price) + '</b>' : '') + '<div class="market-meta" style="margin-top:8px">Email is private · Contact through Inbox</div><div class="actions"><button class="secondary" onclick="openMemberProfile(\'' + safeText(p.uid) + '\')">👤 Profile</button>' + (mine ? '' : '<button class="gold" onclick="startConversation(\'' + safeText(p.uid) + '\',\'' + safeText(marketplacePublicName(p.authorName)).replace(/'/g, '&#39;') + '\')">✉ Inbox</button>') + '<button class="secondary" onclick="toggleMarketplaceComments(\'' + safeText(p.id) + '\')">💬 Show Comments</button><button class="secondary" onclick="reportMarketplacePost(\'' + safeText(p.id) + '\',\'' + safeText(p.uid) + '\')">Report</button></div><div class="comment-area" id="marketCommentArea_' + safeText(p.id) + '" style="display:none"><div id="marketComments_' + safeText(p.id) + '"><span class="market-meta">Tap Show Comments to load comments.</span></div><div class="market-comment"><input class="field" id="marketComment_' + safeText(p.id) + '" maxlength="500" placeholder="Write a comment…"><button class="gold" onclick="addMarketplaceComment(\'' + safeText(p.id) + '\')">Send</button></div></div></article>'; }).join('');
    var temp = document.createElement('div');
    temp.innerHTML = html;
    while (temp.firstChild) {
        feed.appendChild(temp.firstChild);
    }
}
function toggleMarketplaceComments(id) { var area = document.getElementById('marketCommentArea_' + id); if (!area)
    return; var opening = area.style.display === 'none'; area.style.display = opening ? 'block' : 'none'; if (opening && !area.dataset.loaded) {
    loadMarketplaceComments(id);
    area.dataset.loaded = '1';
} if (opening) {
    var input = document.getElementById('marketComment_' + id);
    if (input)
        input.focus();
} }
function loadMarketplaceComments(id) {
    return __awaiter(this, void 0, void 0, function* () { if (!isGoogleMarketplaceUser(currentFirebaseUser) || !db)
        return; try {
        var snap = yield db.collection('marketplacePosts').doc(id).collection('comments').orderBy('createdAt', 'asc').limit(20).get();
        var box = document.getElementById('marketComments_' + id);
        if (!box)
            return;
        box.innerHTML = snap.docs.map(function (d) { var c = d.data(); return '<p class="comment-line"><b>' + safeText(c.authorName || 'Member') + ':</b> ' + safeText(c.text || '') + '</p>'; }).join('') || '<span class="market-meta">No comments yet.</span>';
    }
    catch (e) {
        console.warn('Marketplace comments:', e);
    } });
}
function addMarketplaceComment(id) {
    return __awaiter(this, void 0, void 0, function* () { if (!isGoogleMarketplaceUser(currentFirebaseUser)) {
        openMarketplaceLogin();
        return;
    } if (!db) {
        notice('We could not connect to Afrishine Hub services. Please check your connection and reload the page.');
        return;
    } var input = document.getElementById('marketComment_' + id), text = input && input.value.trim(); if (!text)
        return; try {
        var marketPostSnap = yield db.collection('marketplacePosts').doc(id).get();
        var marketOwnerUid = marketPostSnap.exists ? marketPostSnap.data().uid : null;
        yield db.collection('marketplacePosts').doc(id).collection('comments').add({ uid: currentFirebaseUser.uid, authorName: currentFirebaseUser.displayName || 'Afrishine Member', text: text, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        if (marketOwnerUid && marketOwnerUid !== currentFirebaseUser.uid && typeof window.afCreateNotification === 'function') {
            window.afCreateNotification(marketOwnerUid, 'marketplace_comment', 'New Marketplace comment', (currentFirebaseUser.displayName || 'A member') + ' commented on your listing.', 'shop');
        }
        input.value = '';
        loadMarketplaceComments(id);
    }
    catch (e) {
        notice(firebaseErrorMessage(e));
    } });
}
function deleteMarketplacePost(id) {
    return __awaiter(this, void 0, void 0, function* () { if (!isGoogleMarketplaceUser(currentFirebaseUser)) {
        openMarketplaceLogin();
        return;
    } if (!confirm('Delete your Marketplace post?'))
        return; if (!db) {
        notice('We could not connect to Afrishine Hub services. Please check your connection and reload the page.');
        return;
    } try {
        var ref = db.collection('marketplacePosts').doc(id), snap = yield ref.get();
        if (!snap.exists || snap.data().uid !== currentFirebaseUser.uid) {
            notice('You can only delete your own post.');
            return;
        }
        const marketPostData = snap.data();
        yield ref.delete();
        [].concat(marketPostData.images || [], marketPostData.imageUrls || [], marketPostData.videoUrl ? [marketPostData.videoUrl] : []).forEach(function (mediaUrl) { if (typeof workerDelete === 'function') workerDelete(mediaUrl).catch(function () { }); });
        notice('Marketplace post deleted.');
        loadMarketplacePosts(true);
    }
    catch (e) {
        notice(firebaseErrorMessage(e));
    } });
}
function reportMarketplacePost(id, uid) {
    return __awaiter(this, void 0, void 0, function* () { if (!isGoogleMarketplaceUser(currentFirebaseUser)) {
        openMarketplaceLogin();
        return;
    } if (!db) {
        notice('We could not connect to Afrishine Hub services. Please check your connection and reload the page.');
        return;
    } var reason = prompt('Why are you reporting this listing?'); if (!reason || !reason.trim())
        return; try {
        yield db.collection('marketplaceReports').add({ reporterUid: currentFirebaseUser.uid, postId: id, reportedUid: uid, reason: reason.trim().slice(0, 500), createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'new' });
        notice('Report sent. Thank you.');
    }
    catch (e) {
        notice(firebaseErrorMessage(e));
    } });
}

/* Offline-ready shell: cache the site shell and reuse cached scripts on slow connections. */
(function () {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('./sw.js').catch(function (err) { console.warn('Afrishine offline cache unavailable:', err); });
        });
    }
})();
function showCreatorEligibilityMessage() {
    const dialog = document.getElementById('creatorEligibilityDialog');
    if (dialog && !dialog.open)
        dialog.showModal();
}
function closeCreatorEligibilityMessage() {
    const dialog = document.getElementById('creatorEligibilityDialog');
    if (dialog && dialog.open)
        dialog.close();
}
