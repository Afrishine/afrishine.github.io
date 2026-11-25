/* Afrishine Hub - Sign-in (auth.js): email, Google and Pi login. Loads AFTER love.js and feed.js on purpose, because the sign-in listener and the first page opening call functions from them. */

/* EMAIL/PASSWORD FIREBASE AUTH */
function setAuthMessage(message, error = false) { const el = document.getElementById('authMessage'); el.textContent = message; el.style.color = error ? '#ff9b9b' : '#b8d9b8'; }
function firebaseErrorMessage(e) {
    const map = {
        'auth/email-already-in-use': 'This email already has an account. Please sign in.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Your password must contain at least 6 characters.',
        'auth/user-not-found': 'No account was found for this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
        'auth/operation-not-allowed': 'This sign-in method is not available right now.',
        'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
        'auth/popup-closed-by-user': 'Sign-in was cancelled.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled.',
        'auth/user-disabled': 'This account has been disabled. Please contact support.',
        'auth/unauthorized-domain': 'Sign-in is not available on this web address yet. Please contact support.',
        'permission-denied': 'You do not have permission to do this. Please sign in and try again.',
        'unauthenticated': 'Please sign in and try again.',
        'unavailable': 'Service temporarily unavailable. Please try again.',
        'failed-precondition': 'This content could not be loaded right now. Please try again shortly.',
        'resource-exhausted': 'Too many requests right now. Please try again later.',
        'deadline-exceeded': 'The request took too long. Please try again.'
    };
    const generic = 'Something went wrong. Please try again.';
    if (!e) return generic;
    if (e.code) return map[e.code] || generic;
    const m = String(e.message || '');
    return (m && !/firebase|firestore|insufficient|permission/i.test(m)) ? m : generic;
}
function emailSignUp() {
    return __awaiter(this, void 0, void 0, function* () { if (!auth) {
        setAuthMessage('We could not connect to Afrishine Hub services. Please check your connection and reload the page.', true);
        return;
    } const username = document.getElementById('authUsername').value.trim(), email = document.getElementById('authEmail').value.trim(), password = document.getElementById('authPassword').value, confirmPassword = document.getElementById('authConfirmPassword').value; if (!username || username.length < 3) {
        setAuthMessage('Choose a username with at least 3 characters.', true);
        return;
    } if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        setAuthMessage('Username can use letters, numbers, dot, dash and underscore only.', true);
        return;
    } if (!email || !password || !confirmPassword) {
        setAuthMessage('Enter your email, password and password confirmation.', true);
        return;
    } if (password.length < 6) {
        setAuthMessage('Your password must contain at least 6 characters.', true);
        return;
    } if (password !== confirmPassword) {
        setAuthMessage('Your passwords do not match. Please check and try again.', true);
        return;
    } try {
        const result = yield auth.createUserWithEmailAndPassword(email, password);
        yield result.user.updateProfile({ displayName: username });
        yield db.collection('users').doc(result.user.uid).set({ username: username, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        yield db.collection('publicProfiles').doc(result.user.uid).set({ username: username, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        setAuthMessage('Account created successfully. Welcome to Afrishine Hub.');
    }
    catch (e) {
        console.error(e);
        setAuthMessage(firebaseErrorMessage(e), true);
    } });
}
function emailSignIn() {
    return __awaiter(this, void 0, void 0, function* () { if (!auth) {
        setAuthMessage('We could not connect to Afrishine Hub services. Please check your connection and reload the page.', true);
        return;
    } const email = document.getElementById('authEmail').value.trim(), password = document.getElementById('authPassword').value; if (!email || !password) {
        setAuthMessage('Enter your email and password.', true);
        return;
    } try {
        yield auth.signInWithEmailAndPassword(email, password);
        setAuthMessage('You are signed in.');
    }
    catch (e) {
        console.error(e);
        setAuthMessage(firebaseErrorMessage(e), true);
    } });
}
function googleSignIn() {
    return __awaiter(this, void 0, void 0, function* () { if (!auth) {
        setAuthMessage('We could not connect to Afrishine Hub services. Please check your connection and reload the page.', true);
        return;
    } try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = yield auth.signInWithPopup(provider);
        const user = result.user;
        currentFirebaseUser = user;
        const username = (user.displayName || '').trim() || 'Afrishine Member';
        const userRef = db.collection('users').doc(user.uid);
        const userSnap = yield userRef.get();
        const profileUpdate = { username: username, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (!userSnap.exists || !userSnap.data().createdAt)
            profileUpdate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        yield userRef.set(profileUpdate, { merge: true });
        yield db.collection('publicProfiles').doc(user.uid).set({ username: username, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        setAuthMessage('Google sign-in successful.');
        if (pendingMarketplaceLogin) {
            pendingMarketplaceLogin = false;
            closeMarketplaceLogin();
            showPage('shop');
            loadMarketplacePosts();
        }
    }
    catch (e) {
        console.error(e);
        setAuthMessage(firebaseErrorMessage(e), true);
        const m = document.getElementById('marketLoginMessage');
        if (m && pendingMarketplaceLogin)
            m.textContent = firebaseErrorMessage(e);
    } });
}
function resetEmailPassword() {
    return __awaiter(this, void 0, void 0, function* () { if (!auth) {
        setAuthMessage('We could not connect to Afrishine Hub services. Please check your connection and reload the page.', true);
        return;
    } const email = document.getElementById('authEmail').value.trim(); if (!email) {
        setAuthMessage('Enter your email address first.', true);
        return;
    } try {
        yield auth.sendPasswordResetEmail(email);
        setAuthMessage('Password reset email sent. Check your inbox.');
    }
    catch (e) {
        setAuthMessage(firebaseErrorMessage(e), true);
    } });
}
function emailSignOut() {
    return __awaiter(this, void 0, void 0, function* () { try {
        yield auth.signOut();
        setAuthMessage('You have signed out.');
    }
    catch (e) {
        setAuthMessage(firebaseErrorMessage(e), true);
    } });
}
if (auth) {
    auth.onAuthStateChanged((user) => __awaiter(void 0, void 0, void 0, function* () {
        currentFirebaseUser = user;
        document.getElementById('emailAuthForm').style.display = user ? 'none' : 'block';
        document.getElementById('emailSignedIn').style.display = user ? 'block' : 'none';
        if (user) {
            document.getElementById('emailAccountStatus').textContent = 'Signed in as ' + (user.displayName || user.email || 'Afrishine member');
            try {
                if (db) {
                    const pubSnap = yield db.collection('publicProfiles').doc(user.uid).get();
                    const pubData = pubSnap.exists ? pubSnap.data() : null;
                    if (!pubData || !pubData.username) {
                        yield db.collection('publicProfiles').doc(user.uid).set({ username: (user.displayName || '').trim() || 'Afrishine Member', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    }
                    else {
                        /* The saved public profile wins: bring the sign-in profile (name + photo) in line with it. */
                        const heal = {};
                        if (pubData.username !== user.displayName) heal.displayName = pubData.username;
                        if (pubData.photoURL && pubData.photoURL !== user.photoURL && pubData.photoURL.length <= 2000) heal.photoURL = pubData.photoURL;
                        if (Object.keys(heal).length) { try { yield user.updateProfile(heal); } catch (_) { } }
                    }
                    const snap = yield db.collection('users').doc(user.uid).get();
                    if (snap.exists && snap.data().username)
                        document.getElementById('loveUsername').value = snap.data().username;
                }
            }
            catch (e) {
                console.warn('Could not load user profile', e);
            }
        }
        else {
            currentLoveProfile = null;
        }
        refreshLoveAccess();
        var marketplaceRedirect = sessionStorage.getItem('afrishine_marketplace_google_redirect') === '1';
        if (marketplaceRedirect) {
            if (isGoogleMarketplaceUser(user)) {
                sessionStorage.removeItem('afrishine_marketplace_google_redirect');
                pendingMarketplaceLogin = false;
                closeMarketplaceLogin();
                showPage('shop');
                loadMarketplacePosts();
            }
            else if (user) {
                sessionStorage.removeItem('afrishine_marketplace_google_redirect');
                pendingMarketplaceLogin = false;
                var loginMessage = document.getElementById('marketLoginMessage');
                if (loginMessage)
                    loginMessage.textContent = 'The Marketplace requires a Google account. Please sign out and sign in again with Google.';
            }
        }
        if (document.getElementById('shop').classList.contains('active')) {
            if (canViewMarketplace())
                loadMarketplacePosts();
            else {
                document.getElementById('shop').classList.remove('active');
                openMarketplaceLogin();
            }
        }
    }));
    auth.getRedirectResult().catch(function (e) { console.error('Google redirect result:', e); sessionStorage.removeItem('afrishine_marketplace_google_redirect'); pendingMarketplaceLogin = false; var loginMessage = document.getElementById('marketLoginMessage'); if (loginMessage)
        loginMessage.textContent = firebaseErrorMessage(e); });
}

/* PI LOGIN: unchanged and separate from Firebase email login */
var piSetupDone = false;
function setupPi() {
    if (piSetupDone) return; piSetupDone = true;
    return __awaiter(this, void 0, void 0, function* () { const btn = document.getElementById('piLoginBtn'); if (!btn)
        return; try {
        if (!window.Pi)
            throw new Error('Pi SDK unavailable');
        btn.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () { btn.disabled = true; btn.textContent = 'Connecting…'; try {
            const result = yield (window.afPiLogin ? window.afPiLogin() : window.Pi.authenticate(['username'], () => { }));
            const username = result && result.user && result.user.username;
            if (!username)
                throw new Error('Pi username was not returned');
            sessionStorage.setItem('afrishine_pi_username', username);
            const safe = String(username).replace(/[&<>"']/g, '');
            document.getElementById('piLoginArea').innerHTML = '<div class="pi-info"><div class="pi-symbol">π</div><div><b>Welcome @' + safe + '</b><small>Pi sign-in completed</small></div></div>';
            document.getElementById('profileStatus').textContent = 'Signed in with Pi as @' + safe + '.' + (window.AF_SKILLS ? '' : ' Email sign-in is separate.');
        }
        catch (e) {
            console.error(e);
            notice('Pi Login failed. Reopen in Pi Browser and try again.');
            btn.disabled = false;
            btn.textContent = 'Login with Pi →';
        } }));
    }
    catch (e) {
        console.warn('Pi SDK initialization:', e);
        btn.textContent = 'Open in Pi Browser';
        btn.addEventListener('click', () => { if (typeof window.afPiGate === 'function') window.afPiGate(); else notice('Open Afrishine Hub inside Pi Browser to use Pi Login.'); });
    } });
}
/* The Pi SDK is loaded only inside Pi Browser (async, see index.html): wait for it, but never longer than 10 s */
if (window.Pi || !/PiBrowser/i.test(navigator.userAgent || '')) setupPi();
else { window.addEventListener('pi-sdk-ready', setupPi, { once: true }); setTimeout(setupPi, 10000); }

/* Opening the first page (from the address or #hash). Kept here, after everything above has loaded. */
const firstPageHash = decodeURIComponent(location.hash.replace('#', ''));
const firstPageRoute = getAfrishineRoutePage();
const firstPage = (firstPageHash && document.getElementById(firstPageHash)) ? firstPageHash : (firstPageRoute || 'home');
if (document.getElementById(firstPage))
    showPage(firstPage);
const sharedPostId = new URLSearchParams(location.search).get('post');
if (sharedPostId) {
    const targetPage = new URLSearchParams(location.search).get('kind') === 'love_posts' ? 'love' : 'home';
    if (document.getElementById(targetPage))
        showPage(targetPage);
    window.ahSharedPostId = sharedPostId;
}
