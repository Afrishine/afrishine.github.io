/* Afrishine Hub - JavaScript that must run AFTER marketplace.js (app-extras.js). */

(function(){
'use strict';
var previousPage='home',returnPage='home',activeTab='My Video',profileReady=false;
function byId(id){return document.getElementById(id)}
function currentUser(){return window.currentFirebaseUser||currentFirebaseUser||null}
function dbRef(){return window.db||db||null}
function safe(v){return typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function note(t){if(typeof notice==='function')notice(t);else alert(t)}
function isPi(){try{return typeof isPiBrowser==='function'&&isPiBrowser()}catch(e){return /PiBrowser/i.test(navigator.userAgent)}}
function ensureProfile(){
 var page=byId('profile');if(!page||byId('ahProfileDashboard'))return;
 var legacy=Array.from(page.children).filter(function(n){return n.classList&&n.classList.contains('panel')});
 var pi=byId('piLoginArea');if(pi&&!isPi()){var p=pi.closest('.panel');if(p)p.style.display='none'}
 var hero=document.createElement('section');hero.className='panel ah-profile-hero';hero.id='ahProfileDashboard';
 hero.innerHTML='<img class="ah-avatar" id="ahDashboardAvatar" alt="Profile photo"><div class="ah-profile-identity"><h2 id="ahDashboardName">Guest</h2><p class="creator-hint" id="ahDashboardBio">Sign in or create an account to manage your profile.</p><div class="ah-profile-stats"><span id="ahPostCount">0<small>posts</small></span><span id="ahFollowerStat">0<small>followers</small></span><span id="ahFollowingStat">0<small>following</small></span></div><div class="ah-profile-actions"><button 
class="secondary" type="button" onclick="ahProfileEdit()">Edit Profile</button><button class="secondary" type="button" onclick="ahShareProfile()">Share Profile</button></div></div><details class="ah-profile-more" id="ahProfileMore"><summary aria-label="Profile options">⋮</summary><div class="ah-sheet-backdrop" onclick="document.getElementById(&#39;ahProfileMore&#39;).open=false"></div><div class="ah-profile-menu" role="menu"><div class="ah-sheet-handle"></div> <div class="ah-sheet-head"><img 
class="ah-sheet-avatar" id="ahSheetAvatar" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="><div><b id="ahSheetName">Afrishine Hub</b><small id="ahSheetSub">Your profile menu</small></div><button type="button" class="ah-sheet-close" aria-label="Close menu" onclick="document.getElementById(&#39;ahProfileMore&#39;).open=false">✕</button></div> <div class="ah-menu-section">Account</div> <button type="button" class="ah-menu-item" role="menuitem" 
onclick="ahProfileMenuAction(&#39;Edit Profile&#39;)"><i>✏️</i><span>Edit Profile<small>Name, bio and location</small></span></button> <button type="button" class="ah-menu-item" role="menuitem" onclick="ahProfileMenuAction(&#39;Change Profile Photo&#39;)"><i>📷</i><span>Change Profile Photo<small>Update your picture</small></span></button> <button type="button" class="ah-menu-item" role="menuitem" onclick="ahProfileMenuAction(&#39;Share Profile&#39;)"><i>🔗</i><span>Share Profile<small>Copy 
your profile link</small></span></button> <button type="button" class="ah-menu-item" role="menuitem" onclick="ahProfileMenuAction(&#39;Notifications&#39;)"><i>🔔</i><span>Notifications<small>Messages, follows and new posts</small></span></button> <div class="ah-menu-section">Privacy and security</div> <button type="button" class="ah-menu-item" role="menuitem" onclick="ahProfileMenuAction(&#39;Settings&#39;)"><i>⚙️</i><span>Settings and Privacy<small>Your data and account 
help</small></span></button> <button type="button" class="ah-menu-item" role="menuitem" onclick="ahProfileMenuAction(&#39;Change Password&#39;)"><i>🔒</i><span>Change Password<small>Get a reset link by email</small></span></button> <div class="ah-menu-section">Grow with Afrishine</div> <button type="button" class="ah-menu-item gold" role="menuitem" onclick="ahProfileMenuAction(&#39;Verification&#39;)"><i>✔️</i><span>Verified Badge<small>Get verified and stand out</small></span></button> <button 
type="button" class="ah-menu-item gold" role="menuitem" onclick="ahProfileMenuAction(&#39;Subscription&#39;)"><i>👑</i><span>Subscription<small>Unlock premium features</small></span></button> <button type="button" class="ah-menu-item gold" role="menuitem" onclick="ahProfileMenuAction(&#39;Boost Your Post&#39;)"><i>🚀</i><span>Boost Your Post<small>Reach more people</small></span></button> <button type="button" class="ah-menu-item gold" role="menuitem" 
onclick="ahProfileMenuAction(&#39;Ads&#39;)"><i>📣</i><span>Ads<small>Promote your business</small></span></button> <div class="ah-menu-section">Support</div> <button type="button" class="ah-menu-item" role="menuitem" onclick="ahProfileMenuAction(&#39;Help&#39;)"><i>💬</i><span>Help and Contact<small>We are here to help</small></span></button> <div id="ahMenuAdminWrap" style="display:none"><div class="ah-menu-section">Administration</div><button type="button" class="ah-menu-item admin" 
id="ahMenuAdmin" role="menuitem" onclick="ahProfileMenuAction(&#39;Admin Dashboard&#39;)"><i>🛡️</i><span>Admin Dashboard<small>Monitor and manage the platform</small></span></button></div> <div class="ah-menu-section"></div> <button type="button" class="ah-menu-item danger" role="menuitem" onclick="ahProfileMenuAction(&#39;Logout&#39;)"><i>⎋</i><span>Log out<small>Sign out on this device</small></span></button> <p class="ah-sheet-foot">Afrishine Hub · Kigali, Rwanda</p></div></details>';
 var back=document.createElement('button');back.type='button';back.className='secondary ah-profile-back';back.id='ahProfileBack';back.textContent='← Back';back.style.display='none';back.onclick=function(){showPage(returnPage||'home')};
 page.insertBefore(back,page.firstChild);page.insertBefore(hero,back.nextSibling);
 var tabs=document.createElement('div');tabs.className='ah-profile-tabs';tabs.id='ahProfileTabs';
 ['My Video','Saved','Like','Repost','Private'].forEach(function(label){var b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.tab=label;b.onclick=function(){ahProfileTab(label)};tabs.appendChild(b)});
 hero.insertAdjacentElement('afterend',tabs);
 var content=document.createElement('section');content.className='panel ah-profile-content';content.id='ahProfileTabContent';content.innerHTML='<p class="creator-hint">Your content will appear here.</p>';tabs.insertAdjacentElement('afterend',content);
 // Hidden targets keep existing profile loaders and saved-post functionality intact.
 var hidden=document.createElement('div');hidden.style.display='none';hidden.innerHTML=['ahMyVideosList','ahMyPostsList','ahSavedList'].filter(function(i){return !document.getElementById(i)}).map(function(i){return '<div id="'+i+'"></div>'}).join('');page.appendChild(hidden);
 // Existing editor remains available from the profile menu, but not mixed into the feed.
 var oldEditor=byId('ahProfileEditor');if(oldEditor){oldEditor.style.display='none';}
 legacy.forEach(function(panel){if(panel!==hero&&panel!==oldEditor){panel.dataset.ahLegacy='1';}});
 updateDashboard();setAuthVisibility();
}
function setAuthVisibility(){
 var u=currentUser(),page=byId('profile');if(!page)return;
 var authPanel=byId('emailAuthForm')&&byId('emailAuthForm').closest('.panel');
 if(authPanel)authPanel.style.display=u?'none':'block';
 var piPanel=byId('piLoginArea')&&byId('piLoginArea').closest('.panel');
 if(piPanel)piPanel.style.display=(!u&&isPi())?'block':'none';
 var status=byId('profileStatus');if(status)status.textContent=u?'Signed in as '+(u.displayName||u.email||'Afrishine Member'):'You are not signed in yet. Choose Google, email, or create an account below.';
 var dashboard=byId('ahProfileDashboard'),tabs=byId('ahProfileTabs'),content=byId('ahProfileTabContent');
 if(dashboard)dashboard.style.display='grid';if(tabs)tabs.style.display=u?'flex':'none';if(content)content.style.display=u?'grid':'none';
 var back=byId('ahProfileBack');if(back)back.style.display=returnPage&&returnPage!=='profile'?'inline-block':'none';
}
async function updateDashboard(){
 var u=currentUser();if(!u)return;
 var name=byId('ahDashboardName'),bio=byId('ahDashboardBio'),avatar=byId('ahDashboardAvatar');
 if(name)name.textContent=u.displayName||u.email||'Afrishine Member';
 if(avatar)avatar.src=u.photoURL||'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#303747"/><circle cx="50" cy="37" r="18" fill="#aeb6c5"/><path d="M15 95c2-24 15-35 35-35s33 11 35 35" fill="#aeb6c5"/></svg>');
 try{
  var d=dbRef();if(!d)return;
  var none=function(){return {size:0}};var tasks=await Promise.all([d.collection('posts').where('uid','==',u.uid).get(),d.collection('publicProfiles').doc(u.uid).get(),d.collection('follows').where('followingUid','==',u.uid).get().catch(none),d.collection('follows').where('followerUid','==',u.uid).get().catch(none)]);
  var count=byId('ahPostCount');if(count)count.innerHTML=String(tasks[0].size)+'<small>posts</small>';
  var prof=tasks[1].exists?tasks[1].data():{};
  if(name&&prof.username)name.textContent=prof.username;
  if(bio&&prof.bio)bio.textContent=prof.bio;
  if(avatar&&prof.photoURL)avatar.src=prof.photoURL;
  var f=byId('ahFollowerStat'),g=byId('ahFollowingStat');
  if(f)f.innerHTML=String(tasks[2].size)+'<small>followers</small>';
  if(g)g.innerHTML=String(tasks[3].size)+'<small>following</small>';
 }catch(e){console.warn('Profile dashboard stats:',e)}
}
function profileAuthRequired(action){
 if(currentUser())return true;
 returnPage=previousPage&&previousPage!=='profile'?previousPage:'home';
 showPage('profile');setAuthVisibility();
 note('Create an account or sign in to '+(action||'continue')+'.');
 return false;
}
window.ahProfileEdit=function(){var editor=byId('ahProfileEditor');if(!currentUser()){profileAuthRequired('edit your profile');return}if(editor){editor.style.display='block';editor.scrollIntoView({behavior:'smooth',block:'start'})} };
window.ahShareProfile=function(){var u=currentUser();if(!u){profileAuthRequired('share your profile');return}var url=location.origin+location.pathname+'?member='+encodeURIComponent(u.uid);if(navigator.share)navigator.share({title:'Afrishine Hub Profile',url:url}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){note('Profile link copied.')});else note(url)};
window.ahProfileMenuAction=function(action){
 var editor=byId('ahProfileEditor');
 if(action==='Logout'){if(auth&&auth.signOut)auth.signOut().then(function(){showPage('profile');setAuthVisibility();note('You have signed out.')}).catch(function(e){note(e.message)});return}
 if(action==='Edit Profile'){window.ahProfileEdit();return}
 if(action==='Change Profile Photo'){if(!profileAuthRequired('change your photo'))return;var input=byId('ahProfilePhoto');if(input)input.click();else window.ahProfileEdit();return}
 if(action==='Verification'){window.afOpenGate('verificationGate');return}if(action==='Subscription'){window.afOpenGate('subscriptionGate');return}if(action==='Boost Your Post'||action==='Ads'){window.afOpenGate('subscriptionGate');return}
 if(action==='Settings'||action==='Privacy'){showPage('settings');return}
 if(action==='Change Password'){var email= currentUser()&&currentUser().email;if(email&&typeof resetEmailPassword==='function'){if(confirm('Send a password reset email?'))resetEmailPassword()}else note('Password settings are available for email accounts.');return}
 if(action==='Notifications'){showPage('inbox');return}
 if(action==='Help'){showPage('contact');return}
 if(action==='Share Profile'){if(window.ahShareProfile)window.ahShareProfile();return}
 if(action==='Admin Dashboard'){showPage('admin');return}
};
async function renderOwnedPosts(mode){
 var u=currentUser(),d=dbRef(),out=byId('ahProfileTabContent');if(!u||!d||!out)return;
 out.innerHTML='<p class="creator-hint">Loading…</p>';
 try{
  var snap=await d.collection('posts').where('uid','==',u.uid).limit(100).get();
  var rows=snap.docs.map(function(x){return Object.assign({id:x.id},x.data())}).sort(function(a,b){return (b.createdAt&&b.createdAt.toMillis?b.createdAt.toMillis():0)-(a.createdAt&&a.createdAt.toMillis?a.createdAt.toMillis():0)});
  if(mode==='My Video')rows=rows.filter(function(p){return p.type==='video'||p.mediaType==='video'});
  if(mode==='Repost')rows=rows.filter(function(p){return p.isRepost===true});
  if(mode==='Private')rows=rows.filter(function(p){return p.visibility==='private'});
  if(!rows.length){out.innerHTML='<p class="creator-hint">There is no content in '+safe(mode)+'.</p>';return}
  out.innerHTML=rows.map(function(p){var media=p.mediaUrl?((p.mediaType==='video'||p.type==='video')?'<video controls playsinline preload="metadata" style="width:100%;max-height:280px;border-radius:12px" src="'+safe(p.mediaUrl)+'"></video>':'<img loading="lazy" style="width:100%;max-height:280px;object-fit:contain;border-radius:12px" src="'+safe(p.mediaUrl)+'">'):'';
   return '<article class="post-card"><div class="post-meta"><b>'+safe(p.authorName||u.displayName||'You')+'</b><span>'+safe(p.visibility||'public')+'</span></div><p class="post-body">'+safe(p.text||p.title||'')+'</p>'+media+'<div class="actions"><button class="secondary" onclick="ahSetVisibility(&#39;'+safe(p.id)+'&#39;,&#39;'+(p.visibility==='private'?'public':'private')+'&#39;)">'+(p.visibility==='private'?'Make Public':'Make Private')+'</button><button class="post-delete" onclick="ahDeleteOwnPost(&#39;'+safe(p.id)+'&#39;)">Delete</button></div></article>';
  }).join('');
 }catch(e){out.textContent=(typeof firebaseErrorMessage==='function'?firebaseErrorMessage(e):e.message)}
}
async function renderLiked(){
 var u=currentUser(),d=dbRef(),out=byId('ahProfileTabContent');if(!u||!d||!out)return;
 out.innerHTML='<p class="creator-hint">Loading liked posts…</p>';
 try{
  var snap=await d.collectionGroup('likes').where('uid','==',u.uid).limit(60).get();
  var docs=await Promise.all(snap.docs.map(async function(l){var parent=l.ref.parent.parent;if(!parent)return null;var p=await parent.get();return p.exists?Object.assign({id:p.id,kind:parent.parent.id},p.data()):null}));
  docs=docs.filter(Boolean);
  out.innerHTML=docs.length?docs.map(function(p){return '<article class="post-card"><b>'+safe(p.authorName||'Afrishine Member')+'</b><p class="post-body">'+safe(p.text||'')+'</p><p class="creator-hint">Liked post</p></article>'}).join(''):'<p class="creator-hint">You have not liked any posts yet.</p>';
 }catch(e){out.innerHTML='<p class="creator-hint">Liked posts could not be loaded right now. Please try again later.</p>'}
}
async function renderSaved(){
 var u=currentUser(),d=dbRef(),out=byId('ahProfileTabContent');if(!u||!d||!out)return;
 out.innerHTML='<p class="creator-hint">Loading saved posts…</p>';
 try{
  var snap=await d.collection('savedPosts').where('uid','==',u.uid).limit(60).get();
  var rows=await Promise.all(snap.docs.map(async function(x){var v=x.data();try{var p=await d.collection(v.kind||'posts').doc(v.postId).get();return p.exists?Object.assign({id:p.id},p.data()):null}catch(e){return null}}));
  rows=rows.filter(Boolean);
  out.innerHTML=rows.length?rows.map(function(p){var media=p.mediaUrl?((p.mediaType==='video'||p.type==='video')?'<video controls playsinline style="width:100%;max-height:260px;border-radius:12px" src="'+safe(p.mediaUrl)+'"></video>':'<img loading="lazy" style="width:100%;max-height:260px;object-fit:contain;border-radius:12px" src="'+safe(p.mediaUrl)+'">'):'';return '<article class="post-card"><b>'+safe(p.authorName||'Afrishine Member')+'</b><p class="post-body">'+safe(p.text||'')+'</p>'+media+'</article>'}).join(''):'<p class="creator-hint">You have not saved any posts yet.</p>';
 }catch(e){out.textContent='Saved posts could not be loaded right now. Please try again later.'}
}
window.ahProfileTab=function(tab){
 if(!profileAuthRequired('view '+tab))return;
 activeTab=tab;document.querySelectorAll('#ahProfileTabs button').forEach(function(b){b.classList.toggle('active',b.dataset.tab===tab)});
 var out=byId('ahProfileTabContent');if(!out)return;
 if(tab==='My Video')renderOwnedPosts('My Video');
 else if(tab==='Saved')renderSaved();
 else if(tab==='Like')renderLiked();
 else renderOwnedPosts(tab);
};
var originalShow=window.showPage;
if(typeof originalShow==='function'){
 window.showPage=function(id){
  if(id==='profile'){if(previousPage&&previousPage!=='profile')returnPage=previousPage;originalShow(id);ensureProfile();setAuthVisibility();if(currentUser()&&!activeTab)activeTab='My Video';return}
  if(id!=='profile')previousPage=id;
  originalShow(id);
 };
}
var originalCreateAction=window.createAction;
window.createAction=function(type){if(!profileAuthRequired('continue'))return;return originalCreateAction?originalCreateAction(type):openCreator(type)};
var originalOpenCreator=window.openCreator;
window.openCreator=function(type){if(!profileAuthRequired('create a post'))return;return originalOpenCreator&&originalOpenCreator(type)};
var originalMarketBottom=window.marketBottom;
window.marketBottom=function(which){if(which==='profile'){showPage('profile');return}return originalMarketBottom&&originalMarketBottom(which)};
var originalMarketSell=window.marketOpenSell;
window.marketOpenSell=function(){if(!profileAuthRequired('publish a product on the Marketplace'))return;return originalMarketSell&&originalMarketSell()};
var originalLoveSave=window.saveLoveProfile;
if(typeof originalLoveSave==='function')window.saveLoveProfile=function(){if(!profileAuthRequired('use Love Connection'))return;return originalLoveSave()};
document.addEventListener('DOMContentLoaded',function(){ensureProfile();setAuthVisibility()});
window.addEventListener('load',function(){setTimeout(function(){ensureProfile();setAuthVisibility();updateDashboard()},1200)});
if(typeof auth!=='undefined'&&auth&&auth.onAuthStateChanged)auth.onAuthStateChanged(function(){setTimeout(function(){ensureProfile();setAuthVisibility();updateDashboard();if(currentUser())window.ahProfileTab(activeTab)},350)});
})();

/* ---------- next block ---------- */

(function(){
 'use strict';
 var gateReturnPage='home';
 window.afOpenGate=function(id){var active=document.querySelector('.page.active');gateReturnPage=active&&active.id!=='verificationGate'&&active.id!=='subscriptionGate'?active.id:(window.afPreviousPage||'home');if(typeof window.showPage==='function')window.showPage(id)};
 window.afReturnFromGate=function(){var target=gateReturnPage||'home';if(typeof window.showPage==='function')window.showPage(target)};
 // Gate unfinished premium / verified-only areas without exposing unfinished screens.
 var previousShowPage=window.showPage;
 if(typeof previousShowPage==='function'){
  window.showPage=function(id){
   return previousShowPage(id);
  };
 }
 // Profile header control becomes the three-dot profile menu only while Profile is open.
 var headerMenu=document.querySelector('.header-actions .menu-button');
 function syncHeaderMenu(){if(!headerMenu)return;var onProfile=!!document.getElementById('profile')&&document.getElementById('profile').classList.contains('active');headerMenu.textContent=onProfile?'⋮':'☰';headerMenu.setAttribute('aria-label',onProfile?'Open profile menu':'Open main menu');headerMenu.title=onProfile?'Profile options':'Main menu'}
 if(headerMenu){headerMenu.addEventListener('click',function(e){var onProfile=document.getElementById('profile')&&document.getElementById('profile').classList.contains('active');if(!onProfile)return;e.stopImmediatePropagation();var details=document.getElementById('ahProfileMore');if(details)details.open=!details.open;},true)}
 var observer=new MutationObserver(syncHeaderMenu);document.querySelectorAll('.page').forEach(function(el){observer.observe(el,{attributes:true,attributeFilter:['class']})});syncHeaderMenu();
 // Close the profile dropdown after choosing an action.
 document.addEventListener('click',function(e){var b=e.target.closest('.ah-profile-menu button');if(b){var d=document.getElementById('ahProfileMore');if(d)d.open=false}});
 // Ensure English labels and confirmation behavior are consistent.
 var confirmField=document.getElementById('authConfirmPassword');if(confirmField){confirmField.addEventListener('input',function(){var p=document.getElementById('authPassword');confirmField.setCustomValidity(p&&confirmField.value&&p.value!==confirmField.value?'Passwords do not match.':'')})}
 // Keep the profile's guest registration options visible and Pi login limited to Pi Browser.
 var piArea=document.getElementById('piLoginArea');if(piArea){var pi=false;try{pi=typeof isPiBrowser==='function'&&isPiBrowser()}catch(e){}if(!pi){var pp=piArea.closest('.panel');if(pp)pp.style.display='none'}}
})();

/* ---------- next block ---------- */

(function(){
 'use strict';
 var returnPage='home', notificationUnsub=null;
 function el(id){return document.getElementById(id)}
 function user(){return window.currentFirebaseUser || (window.auth && window.auth.currentUser) || (typeof currentFirebaseUser!=='undefined'?currentFirebaseUser:null)}
 function dbx(){return window.db || (typeof db!=='undefined'?db:null)}
 function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function closeModal(){var m=el('afFeatureModal');if(m)m.remove()}
 function activePage(){var p=document.querySelector('.page.active');return p&&p.id?p.id:'home'}
 function ensureModal(){
  if(el('afFeatureModal'))return;
  var style=document.createElement('style');
  style.textContent=
   '#afFeatureModal{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,6,13,.82);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}'+
   '.af-feature-card{width:min(100%,520px);background:#191f30;border:1px solid #30394f;border-radius:28px;padding:28px 24px 24px;text-align:center;box-shadow:0 24px 80px #0009;color:#f4f6fc}'+
   '.af-feature-icon{width:82px;height:82px;border-radius:50%;margin:0 auto 22px;background:#3a3420;color:#ffbd08;display:grid;place-items:center;font-size:42px;font-weight:800}'+
   '.af-feature-card h2{font-size:25px;line-height:1.2;margin:0 0 14px}.af-feature-card p{color:#aab2c5;font-size:16px;line-height:1.65;margin:0 0 20px}'+
   '.af-feature-card input{width:100%;box-sizing:border-box;background:#101522;border:1px solid #46506a;color:#fff;border-radius:13px;padding:14px 15px;font-size:16px;margin:0 0 14px;min-height:50px}'+
   '.af-feature-actions{display:grid;gap:12px}.af-feature-actions button{border:0;border-radius:15px;min-height:58px;padding:12px 16px;font-size:16px;font-weight:700;cursor:pointer}'+
   '.af-feature-primary{background:#ffbd08;color:#171717}.af-feature-secondary{background:#252d3e;color:#f1f3f8}.af-feature-status{min-height:20px;font-size:13px;color:#ffcf54;margin:0 0 10px}'+
   '@media(max-width:420px){.af-feature-card{padding:24px 18px 20px;border-radius:24px}.af-feature-card h2{font-size:23px}.af-feature-card p{font-size:15px}}';
  document.head.appendChild(style);
 }
 function showModal(kind){
  ensureModal();closeModal();
  var u=user(), title='', message='', icon='✓', primary='Get Verified', secondary='Close', email='';
  if(kind==='verification'){
   title='Not eligible yet';
   message="A Verified Badge is for creators and members who meet our requirements. You don't qualify at the moment. Complete your profile, keep posting, and check back soon.";
   icon='✧';primary='Notify me';secondary='Close';email=u&&u.email?u.email:'';
  }else if(kind==='subscription'){
   title='Subscription';
   message='Subscriptions are available to accounts with a Verified Badge. Get verified first, then come back to unlock this feature.';
   icon='★';
  }else if(kind==='boost'){
   title='Boost Your Post';
   message="Boost is available to accounts with a Verified Badge. Once you're verified, you'll be able to promote your posts and reach more people.";
   icon='↗';
  }else if(kind==='ads'){
   title='Ads';
   message='Ads are available to accounts with a Verified Badge. Get verified first, then return to start advertising on Afrishine Hub.';
   icon='⚑';
  }
  var modal=document.createElement('div');modal.id='afFeatureModal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','afFeatureTitle');
  modal.innerHTML='<section class="af-feature-card"><div class="af-feature-icon" aria-hidden="true">'+icon+'</div><h2 id="afFeatureTitle">'+safe(title)+'</h2><p>'+safe(message)+'</p>'+
   (kind==='verification'?'<input id="afVerificationEmail" type="email" autocomplete="email" placeholder="Your email address" value="'+safe(email)+'" aria-label="Your email address"><div class="af-feature-status" id="afVerificationStatus" aria-live="polite"></div>':'')+
   '<div class="af-feature-actions">'+(kind==='verification'?'<button class="af-feature-primary" id="afFeaturePrimary">Notify me</button>':'<button class="af-feature-primary" id="afFeaturePrimary">Get Verified</button>')+'<button class="af-feature-secondary" id="afFeatureClose">'+safe(secondary)+'</button></div></section>';
  document.body.appendChild(modal);
  el('afFeatureClose').addEventListener('click',function(){closeModal()});
  el('afFeaturePrimary').addEventListener('click',function(){
   if(kind==='verification'){saveInterest();return}
   showModal('verification');
  });
  modal.addEventListener('click',function(e){if(e.target===modal)closeModal()});
 }
 function saveInterest(){
  var u=user(), d=dbx(), input=el('afVerificationEmail'), email=input?input.value.trim():'', status=el('afVerificationStatus');
  if(!u){if(status)status.textContent='Please sign in or create an account before requesting an email notification.';return}
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){if(status)status.textContent='Enter a valid email address.';if(input)input.focus();return}
  if(!d){if(status)status.textContent='Connection unavailable. Please try again.';return}
  var btn=el('afFeaturePrimary');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  d.collection('verificationInterest').doc(u.uid).set({
   uid:u.uid,email:email,createdAt:(window.firebase&&firebase.firestore)?firebase.firestore.FieldValue.serverTimestamp():new Date(),
   updatedAt:(window.firebase&&firebase.firestore)?firebase.firestore.FieldValue.serverTimestamp():new Date(),
   status:'interested'
  },{merge:true}).then(function(){
   closeModal();
   if(typeof window.notice==='function')window.notice('Thank you! Your interest in the Verified Badge has been saved. We will notify you when applications open.');
  }).catch(function(err){
   if(status)status.textContent=err&&err.code==='permission-denied'?'We could not save your request right now. Please try again later.':'Could not save your request. Please try again.';
   if(btn){btn.disabled=false;btn.textContent='Notify me'}
   console.error('Verification interest save failed:',err);
  });
 }
 window.afOpenFeatureGate=function(kind){returnPage=activePage();showModal(kind||'verification')};
 window.afOpenGate=function(id){returnPage=activePage();showModal(id==='subscriptionGate'?'subscription':'verification')};
 window.afReturnFromGate=function(){closeModal();if(returnPage&&typeof window.showPage==='function')window.showPage(returnPage)};
 window.afCreateNotification=function(recipientUid,type,title,body,targetPage){
  var u=user(),d=dbx();if(!u||!d||!recipientUid||recipientUid===u.uid)return Promise.resolve();
  return d.collection('notifications').add({
   recipientUid:recipientUid,actorUid:u.uid,type:type||'update',title:title||'New update',
   body:body||'You have a new update on Afrishine Hub.',targetPage:targetPage||'inbox',
   createdAt:firebase.firestore.FieldValue.serverTimestamp(),read:false
  }).catch(function(e){console.warn('Notification could not be created:',e)});
 };
  var notifDocs=[], followingUids=new Set(), readLocal=new Set();
  function seenKey(){var u=user();return 'afrishine_notif_seen_'+(u?u.uid:'guest')}
  function getSeen(){try{return Number(localStorage.getItem(seenKey())||0)}catch(e){return 0}}
  function setSeen(t){try{localStorage.setItem(seenKey(),String(t))}catch(e){}}
  function ms(t){return t&&t.toMillis?t.toMillis():(t&&t.toDate?t.toDate().getTime():0)}
  function updateBadge(n){
   var link=document.querySelector('.bottom-nav a[data-page="inbox"]');if(!link)return;
   var b=link.querySelector('.nav-badge');if(!b){b=document.createElement('span');b.className='nav-badge';b.setAttribute('aria-hidden','true');link.appendChild(b)}
   b.textContent=n>9?'9+':String(n);b.style.display=n>0?'block':'none';
   link.setAttribute('aria-label',n>0?'Inbox, '+n+' new notifications':'Inbox');
  }
  function followItems(){
   var u=user(),posts=window.__afLatestPosts||[],out=[],cutoff=Date.now()-14*86400000;
   if(!u||!followingUids.size)return out;
   posts.forEach(function(p){
    if(!p||!followingUids.has(p.uid)||p.uid===u.uid||p.visibility==='private')return;
    var t=ms(p.createdAt);if(!t||t<cutoff)return;
    var what=String(p.title||p.text||'').trim();if(what.length>90)what=what.slice(0,90)+'…';
    if(!what)what=p.type==='video'?'Shared a new video.':p.type==='image'?'Shared a new photo.':'Shared a new post.';
    out.push({id:'feed-'+p.id,title:'New post from '+(p.authorName||'someone you follow'),body:what,time:t,target:p.source==='talent'?'talent':'home',read:false,doc:false});
   });
   out.sort(function(x,y){return y.time-x.time});
   return out.slice(0,20);
  }
  function paintNotifications(){
   var box=el('afNotificationsList');
   var u=user();
   if(!u){if(box)box.innerHTML='<p class="muted">Sign in to receive notifications.</p>';updateBadge(0);return}
   var seen=getSeen();
   var items=notifDocs.map(function(d){var n=d.data();return {id:d.id,title:n.title||'New notification',body:n.body||'You have a new update.',time:ms(n.createdAt),target:n.targetPage||'inbox',read:!!n.read||readLocal.has(d.id),doc:true}})
    .concat(followItems().map(function(f){f.read=f.time<=seen;return f}));
   items.sort(function(x,y){return y.time-x.time});
   var unread=items.filter(function(i){return !i.read}).length;
   updateBadge(unread);
   if(!box)return;
   if(!items.length){box.innerHTML='<p class="muted">You are all caught up. New messages, followers and posts from people you follow will appear here.</p>';return}
   box.innerHTML=(unread?'<div class="af-notif-tools"><button type="button" class="secondary" id="afMarkAllRead">Mark all as read</button></div>':'')+items.map(function(n){
    return '<button type="button" class="af-notification-row'+(n.read?'':' new')+'" data-af-id="'+safe(n.id)+'" data-af-doc="'+(n.doc?'1':'')+'" data-af-time="'+n.time+'" data-af-target="'+safe(n.target)+'"><b>'+safe(n.title)+'</b><span>'+safe(n.body)+'</span><small>'+(n.time?new Date(n.time).toLocaleString():'Just now')+(n.read?'':' · New')+'</small></button>';
   }).join('');
   Array.prototype.forEach.call(box.querySelectorAll('.af-notification-row'),function(btn){btn.addEventListener('click',function(){
    var id=btn.getAttribute('data-af-id'),target=btn.getAttribute('data-af-target')||'inbox';
    if(btn.getAttribute('data-af-doc')==='1'){readLocal.add(id);dUpdateRead(id)}else setSeen(Math.max(getSeen(),Number(btn.getAttribute('data-af-time'))||0));
    if(typeof window.showPage==='function')window.showPage(target);
   })});
   var all=el('afMarkAllRead');
   if(all)all.addEventListener('click',function(){
    var d=dbx();setSeen(Date.now());notifDocs.forEach(function(x){readLocal.add(x.id)});
    if(d){try{var batch=d.batch(),n=0;notifDocs.forEach(function(x){readLocal.add(x.id);if(!x.data().read){batch.update(d.collection('notifications').doc(x.id),{read:true});n++}});if(n)batch.commit().catch(function(e){console.warn(e)})}catch(e){console.warn(e)}}
    paintNotifications();
   });
  }
  function dUpdateRead(id){var d=dbx(),u=user();if(!d||!u)return;d.collection('notifications').doc(id).update({read:true}).catch(function(e){console.warn(e)})}
  function loadFollowing(){
   var u=user(),d=dbx();followingUids=new Set();
   if(!u||!d){paintNotifications();return}
   d.collection('follows').where('followerUid','==',u.uid).limit(200).get().then(function(snap){snap.docs.forEach(function(x){var v=x.data();if(v&&v.followingUid)followingUids.add(v.followingUid)});paintNotifications()}).catch(function(e){console.warn('Following list:',e)});
  }
  function startNotifications(){
   var u=user(),d=dbx();if(notificationUnsub){notificationUnsub();notificationUnsub=null}
   notifDocs=[];
   var box=el('afNotificationsList');
   if(!u||!d){paintNotifications();return}
   if(box)box.innerHTML='<p class="muted">Loading notifications…</p>';
   notificationUnsub=d.collection('notifications').where('recipientUid','==',u.uid).limit(50).onSnapshot(function(snap){notifDocs=snap.docs.slice();paintNotifications()},function(e){console.warn('Notifications:',e);if(box)box.innerHTML='<p class="muted">Notifications are temporarily unavailable.</p>'});
   loadFollowing();
  }
  window.afRefreshNotifications=paintNotifications;
  if(typeof auth!=='undefined'&&auth&&auth.onAuthStateChanged)auth.onAuthStateChanged(function(){startNotifications()});
  window.afReloadFollowing=loadFollowing;
 // Show a notification center within Inbox, preserving the existing conversations.
 var inbox=el('inbox');
 if(inbox&&!el('afNotificationsPanel')){
  var panel=document.createElement('section');panel.className='panel';panel.id='afNotificationsPanel';
  panel.innerHTML='<h2>Notifications</h2><div id="afNotificationsList"><p class="muted">Sign in to receive notifications.</p></div>';
  var conversations=inbox.querySelector('.panel');if(conversations)inbox.insertBefore(panel,conversations);
 }
 // Start live updates when Inbox opens; listeners are detached when the account changes.
 var originalShow=window.showPage;
 if(typeof originalShow==='function'){
  window.showPage=function(id){var result=originalShow(id);if(id==='inbox'){if(notificationUnsub){loadFollowing();paintNotifications()}else startNotifications()}return result};
 }
 document.addEventListener('click',function(e){
  var b=e.target.closest('.wallet-open');if(b){e.preventDefault();if(typeof window.showPage==='function')window.showPage('wallet')}
 });
 // Profile menu actions: premium features lead to their matching eligibility explanation.
 var oldMenu=window.ahProfileMenuAction;
 window.ahProfileMenuAction=function(action){
  if(action==='Verification'){window.afOpenFeatureGate('verification');return}
  if(action==='Subscription'){window.afOpenFeatureGate('subscription');return}
  if(action==='Boost Your Post'){window.afOpenFeatureGate('boost');return}
  if(action==='Ads'){window.afOpenFeatureGate('ads');return}
  if(typeof oldMenu==='function')return oldMenu(action);
 };
 // Route all wallet actions to the Verified Badge gate while keeping the wallet itself accessible.
 var wallet=el('wallet');
 if(wallet){Array.prototype.forEach.call(wallet.querySelectorAll('button'),function(b){if(!b.classList.contains('wallet-open'))b.onclick=function(){window.afWalletToast()}})}
})();

/* ---------- next block ---------- */

(function () {
    'use strict';
    window.openProfileEditor = function () { showPage('profile'); setTimeout(function () { if (typeof window.ahProfileEdit === 'function') window.ahProfileEdit(); }, 80); };
    window.settingsSignOut = function () {
        if (!auth || !auth.currentUser) { notice('You are not signed in.'); return; }
        auth.signOut().then(function () { notice('You have signed out.'); showPage('home'); }).catch(function (e) { notice(firebaseErrorMessage(e)); });
    };

    /* ---- Feature popups, wallet message, Go Live requirements ---- */
    var GATES = {
        travel: { icon: '✈️', title: 'Travel Booking', msg: 'To unlock this feature, please complete your profile and verify your account first. Then return here to continue.' },
        academy: { icon: '🎓', title: 'Welcome to Afrishine Academy', msg: 'To unlock this feature, please complete your profile and subscribe to access more features. Then return here to continue.' },
        jobs: { icon: '💼', title: 'Welcome to Opportunity Job', msg: 'To unlock this feature, please complete your profile and verify your account first. Then return here to continue.' }
    };
    function closeGate() { var o = document.getElementById('afGateModal'); if (o) o.remove(); }
    function openGate(inner) {
        closeGate();
        var o = document.createElement('div');
        o.id = 'afGateModal'; o.className = 'gate-overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
        o.innerHTML = '<section class="gate-card">' + inner + '<button type="button" class="gate-cancel">Cancel</button></section>';
        document.body.appendChild(o);
        var c = o.querySelector('.gate-cancel');
        c.addEventListener('click', closeGate);
        o.addEventListener('click', function (e) { if (e.target === o) closeGate(); });
        c.focus();
    }
    window.afGate = function (kind) {
        var g = GATES[kind]; if (!g) return;
        openGate('<div class="gate-icon" aria-hidden="true">' + g.icon + '</div><h2>' + g.title + '</h2><p>' + g.msg + '</p>');
    };
    window.afLiveRequirements = function () {
        openGate('<div class="gate-icon" aria-hidden="true">🔴</div><h2>Go Live Requirements</h2><ul class="gate-list"><li>Have at least 100 followers</li><li>Post 3+ original public videos</li><li>Follow Afrishine Hub rules and guidelines</li></ul>');
    };
    var toastTimer = null;
    function hideToast() { var t = document.getElementById('afSmallToast'); if (t) t.style.display = 'none'; clearTimeout(toastTimer); }
    window.afWalletToast = function () {
        var t = document.getElementById('afSmallToast');
        if (!t) { t = document.createElement('div'); t.id = 'afSmallToast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
        t.textContent = 'Please first complete verification on your profile to proceed.';
        t.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, 5000);
    };
    var prevCreateAction = window.createAction;
    window.createAction = function (type) {
        if (type === 'live') { try { closeCreateMenu(); } catch (_) {} window.afLiveRequirements(); return; }
        return prevCreateAction ? prevCreateAction(type) : openCreator(type);
    };
    var prevShowPage = window.showPage;
    window.showPage = function (id) {
        hideToast(); closeGate(); closeViewer(); closeLinkEditor();
        if (id === 'admin' && !window.__afIsAdmin) { notice('This area is for administrators only.'); return prevShowPage('home'); }
        var result = prevShowPage(id);
        if (id === 'admin') admRender(ADM.tab);
        else if (id === 'trafficRules') { if (window.afAcademy) window.afAcademy.paint(); }
        else if (id === 'profile') syncAdminMenu();
        return result;
    };
    /* ---- Cloudflare media cleanup: frees storage when a post is deleted ---- */
    window.workerDelete = function (keyOrUrl) {
        var base = 'https://afrishine-media.usherluckyelie.workers.dev';
        var key = String(keyOrUrl || '');
        if (key.indexOf(base + '/media/') === 0) key = key.slice((base + '/media/').length);
        try { key = decodeURIComponent(key); } catch (_) { }
        var u = (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null;
        if (!u || !key) return Promise.reject(new Error('Missing user or file'));
        return u.getIdToken().then(function (token) {
            return fetch(base + '/delete', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.success) throw new Error(d.error || 'Delete failed'); return d; });
        });
    };

    /* ---- Upload helpers: friendly popups, video conversion, format checks ---- */
    window.AF_QUOTA_MESSAGE = 'You have already used your credits. Please try uploading again after one week, or verify your account to upload immediately.';
    window.AF_MEDIA = { maxBytes: 100 * 1024 * 1024, targetBytes: 92 * 1024 * 1024, maxConvertSeconds: 300, maxVideoBps: 16000000, audioBps: 128000, maxSide: 1920, fps: 30 };
    var MEDIA_WORKER_URL = 'https://afrishine-media.usherluckyelie.workers.dev';
    var MSG_VIDEO = "This video format can't be processed. Please edit it and export it as MP4 (H.264), then upload it again.";
    var MSG_PHOTO = "This photo format can't be processed. Please edit it and save it as JPG or PNG, then upload it again.";
    function plain(text) { return String(text).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    window.afPopup = function (opts) {
        window.__afPopupMsg = opts.message;
        window.__afPopupAt = Date.now();
        openGate((opts.icon ? '<div class="gate-icon" aria-hidden="true">' + opts.icon + '</div>' : '') + (opts.title ? '<h2>' + plain(opts.title) + '</h2>' : '') + '<p>' + plain(opts.message) + '</p>');
    };
    var prevNotice = window.notice;
    window.notice = function (text) {
        if (text && window.__afPopupMsg === text && Date.now() - (window.__afPopupAt || 0) < 4000) return;
        return prevNotice(text);
    };
    window.afMediaProblem = function (kind) {
        var message = kind === 'photo' ? MSG_PHOTO : MSG_VIDEO;
        window.afPopup({ icon: '🛠️', title: 'Edit needed', message: message });
        return message;
    };
    window.afWorkerFailure = function (data, status) {
        var code = data && data.code;
        if (code === 'STORAGE_LIMIT_REACHED') window.afPopup({ icon: '📦', message: window.AF_QUOTA_MESSAGE });
        else if (code === 'DAILY_LIMIT_REACHED') window.afPopup({ icon: '⏳', message: data.error });
        else if (code === 'FILE_TYPE_NOT_ALLOWED') window.afPopup({ icon: '🛠️', title: 'Edit needed', message: "This file format can't be processed. Please edit it and export it as JPG, PNG or MP4, then upload it again." });
        else if (code === 'FILE_TOO_LARGE') window.afPopup({ icon: '🛠️', title: 'Edit needed', message: 'This file is larger than the 100 MB limit. Please trim or compress it, then upload it again.' });
    };
    window.afCanUpload = function () {
        var u = (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null;
        if (!u) return Promise.resolve(true);
        return u.getIdToken().then(function (token) {
            return fetch(MEDIA_WORKER_URL + '/usage', { headers: { Authorization: 'Bearer ' + token } });
        }).then(function (r) {
            if (!r.ok) return true;
            return r.json().then(function (d) {
                if (d.canUpload === false) { window.afPopup({ icon: '📦', message: window.AF_QUOTA_MESSAGE }); return false; }
                return true;
            });
        }).catch(function () { return true; });
    };
    function inferVideoType(file) {
        var t = (file.type || '').toLowerCase();
        if (t.indexOf('video/') === 0) return t;
        var m = /\.([a-z0-9]+)$/i.exec(file.name || '');
        var ext = m ? m[1].toLowerCase() : '';
        return ({ mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' })[ext] || t;
    }
    function hasFourCC(bytes, cc) {
        var a = cc.charCodeAt(0), b = cc.charCodeAt(1), c = cc.charCodeAt(2), d = cc.charCodeAt(3);
        for (var i = 0; i < bytes.length - 3; i++) { if (bytes[i] === a && bytes[i + 1] === b && bytes[i + 2] === c && bytes[i + 3] === d) return true; }
        return false;
    }
    /* iPhone HEVC (H.265) videos play on iPhones but not on many other phones, so they are converted to H.264. */
    function looksLikeHevc(file) {
        var size = file.size, head = Math.min(size, 2 * 1024 * 1024), tail = Math.min(size, 6 * 1024 * 1024);
        return Promise.all([file.slice(0, head).arrayBuffer(), file.slice(Math.max(0, size - tail), size).arrayBuffer()]).then(function (parts) {
            return parts.some(function (buf) { var b = new Uint8Array(buf); return hasFourCC(b, 'hvc1') || hasFourCC(b, 'hev1') || hasFourCC(b, 'dvh1'); });
        }).catch(function () { return false; });
    }
    /* Can this browser open the file at all? */
    function checkPlayable(file) {
        return new Promise(function (resolve) {
            var v = document.createElement('video'), url = URL.createObjectURL(file), done = false;
            function end(ok) { if (done) return; done = true; clearTimeout(timer); try { v.removeAttribute('src'); v.load(); } catch (_) { } URL.revokeObjectURL(url); resolve(ok); }
            var timer = setTimeout(function () { end(false); }, 15000);
            v.preload = 'auto'; v.muted = true;
            v.onloadeddata = function () { end(!!v.videoWidth); };
            v.onerror = function () { end(false); };
            v.src = url;
        });
    }
    function pickRecorderMime() {
        var list = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
        for (var i = 0; i < list.length; i++) { try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (_) { } }
        return '';
    }
    function transcodeVideo(file, onStatus) {
        return new Promise(function (resolve, reject) {
            var M = window.AF_MEDIA, finished = false, started = false;
            var url = URL.createObjectURL(file), video = document.createElement('video');
            var canvas, ctx, recorder, ac, stream, chunks = [], stallTimer = null, loadTimer = null, lastTime = -1, stalls = 0, rafId = 0;
            video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto';
            video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
            document.body.appendChild(video);
            function cleanup() {
                clearTimeout(loadTimer); clearInterval(stallTimer);
                if (rafId) cancelAnimationFrame(rafId);
                try { video.pause(); } catch (_) { }
                try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) { }
                try { if (ac && ac.state !== 'closed') ac.close(); } catch (_) { }
                try { video.removeAttribute('src'); video.load(); } catch (_) { }
                if (video.parentNode) video.parentNode.removeChild(video);
                URL.revokeObjectURL(url);
            }
            function fail(message) {
                if (finished) return;
                finished = true;
                try { if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop(); } } catch (_) { }
                cleanup();
                window.afPopup({ icon: '🛠️', title: 'Edit needed', message: message });
                reject(new Error(message));
            }
            if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
                finished = true; cleanup();
                var m = 'Your browser cannot optimize this video. Please trim it or export it under 100 MB (MP4), then upload it again.';
                window.afPopup({ icon: '🛠️', title: 'Edit needed', message: m });
                return reject(new Error(m));
            }
            function draw() {
                if (finished || video.ended) return;
                try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch (_) { }
                if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw); else rafId = requestAnimationFrame(draw);
            }
            function start() {
                if (started || finished) return;
                started = true; clearTimeout(loadTimer);
                if (!video.videoWidth || !video.videoHeight) return fail(MSG_VIDEO);
                if (video.duration === Infinity) {
                    /* Some browser-made WebM files report no length: seek to the end to learn it. */
                    video.ontimeupdate = function () { video.ontimeupdate = null; video.onseeked = function () { video.onseeked = null; begin(video.duration); }; video.currentTime = 0; };
                    video.currentTime = 1e7;
                    return;
                }
                begin(video.duration);
            }
            function begin(d) {
                var vw = video.videoWidth, vh = video.videoHeight;
                if (!isFinite(d) || d <= 0 || !vw || !vh) return fail(MSG_VIDEO);
                if (d > M.maxConvertSeconds) return fail('This video is too long to optimize automatically. Please trim it or export it under 100 MB, then upload it again.');
                var videoBps = Math.min(M.maxVideoBps, Math.floor((M.targetBytes * 8 * 0.9) / d - M.audioBps));
                if (videoBps < 1000000) return fail('This video is too long to keep its quality under 100 MB. Please trim it, then upload it again.');
                var scale = Math.min(1, M.maxSide / Math.max(vw, vh));
                canvas = document.createElement('canvas');
                canvas.width = Math.max(2, Math.round(vw * scale / 2) * 2);
                canvas.height = Math.max(2, Math.round(vh * scale / 2) * 2);
                ctx = canvas.getContext('2d', { alpha: false });
                stream = canvas.captureStream(M.fps);
                try {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    ac = new AC();
                    if (ac.resume) ac.resume();
                    var source = ac.createMediaElementSource(video), dest = ac.createMediaStreamDestination();
                    source.connect(dest);
                    dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
                } catch (_) { /* no audio track available */ }
                var mime = pickRecorderMime();
                try {
                    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: videoBps, audioBitsPerSecond: M.audioBps } : { videoBitsPerSecond: videoBps });
                } catch (_) { return fail(MSG_VIDEO); }
                var outType = (recorder.mimeType || mime || 'video/webm').split(';')[0];
                recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
                recorder.onerror = function () { fail(MSG_VIDEO); };
                recorder.onstop = function () {
                    if (finished) return;
                    var blob = new Blob(chunks, { type: outType });
                    if (!blob.size) return fail(MSG_VIDEO);
                    if (blob.size > M.maxBytes) return fail('We could not compress this video below 100 MB without losing quality. Please trim it, then upload it again.');
                    finished = true; cleanup();
                    var base = (file.name || 'video').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'video';
                    resolve(new File([blob], base + (outType === 'video/mp4' ? '.mp4' : '.webm'), { type: outType, lastModified: Date.now() }));
                };
                recorder.start(1000);
                video.onended = function () { setTimeout(function () { if (recorder.state !== 'inactive') recorder.stop(); }, 300); };
                video.ontimeupdate = function () { if (onStatus) onStatus('Optimizing video… ' + Math.min(99, Math.round(video.currentTime / d * 100)) + '%'); };
                stallTimer = setInterval(function () {
                    if (video.currentTime === lastTime) { stalls++; if (stalls >= 6) fail('Video optimization stopped. Please keep this screen open and try again.'); }
                    else { stalls = 0; lastTime = video.currentTime; }
                }, 4000);
                if (onStatus) onStatus('Optimizing video… 0%');
                video.play().then(draw).catch(function () { fail('Your browser blocked video optimization. Please tap Post again, or export the video under 100 MB and upload it again.'); });
            }
            video.onloadeddata = start;
            video.onerror = function () { if (!started) fail(MSG_VIDEO); };
            loadTimer = setTimeout(function () { if (!started) fail(MSG_VIDEO); }, 20000);
            video.src = url;
        });
    }
    /* Videos up to 100 MB in MP4/WebM/MOV (H.264) upload as they are. Bigger videos, other
       formats and iPhone HEVC videos are converted to a smaller H.264 video first. */
    window.afPrepareVideo = function (file, onStatus) {
        var M = window.AF_MEDIA, type = inferVideoType(file);
        var allowed = ['video/mp4', 'video/webm', 'video/quicktime'].indexOf(type) !== -1;
        var big = file.size > M.maxBytes;
        var check = (!big && allowed && type !== 'video/webm') ? looksLikeHevc(file) : Promise.resolve(false);
        return check.then(function (hevc) {
            if (allowed && !big && !hevc) {
                return checkPlayable(file).then(function (ok) {
                    if (!ok) { window.afMediaProblem('video'); throw new Error(MSG_VIDEO); }
                    return type === file.type ? file : new File([file], file.name || 'video', { type: type, lastModified: file.lastModified });
                });
            }
            return window.afCanUpload().then(function (ok) {
                if (!ok) throw new Error(window.AF_QUOTA_MESSAGE);
                return transcodeVideo(file, onStatus);
            });
        });
    };
    /* ================= TALENT HUB: YouTube / TikTok video links ================= */
    function ms2(t) { return t && t.toMillis ? t.toMillis() : 0; }
    function parseVideoLink(raw) {
        var url;
        try { url = new URL(String(raw || '').trim()); } catch (e) { return null; }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        var host = url.hostname.toLowerCase().replace(/^(www|m)\./, ''), path = url.pathname, id = '', m;
        if (host === 'youtu.be') id = path.slice(1).split('/')[0];
        else if (host === 'youtube.com' || host === 'music.youtube.com') {
            if (path === '/watch') id = url.searchParams.get('v') || '';
            else if ((m = /^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(path))) id = m[2];
        }
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
            return { provider: 'youtube', id: id, url: /^\/shorts\//.test(path) ? 'https://www.youtube.com/shorts/' + id : 'https://www.youtube.com/watch?v=' + id };
        }
        if (host === 'tiktok.com' || host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
            m = /^\/@([A-Za-z0-9._-]+)\/video\/(\d{8,25})/.exec(path);
            if (m && host === 'tiktok.com') return { provider: 'tiktok', id: m[2], url: 'https://www.tiktok.com/@' + m[1] + '/video/' + m[2] };
            if (host !== 'tiktok.com' || /^\/t\/[A-Za-z0-9]+/.test(path)) return { provider: 'tiktok', id: '', short: true, url: 'https://' + url.hostname + path };
        }
        return null;
    }
    window.afParseVideoLink = parseVideoLink;
    function fetchJson(u, wait) {
        return new Promise(function (resolve) {
            var done = false;
            var t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, wait || 6000);
            fetch(u, { mode: 'cors' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (!done) { done = true; clearTimeout(t); resolve(j); } }).catch(function () { if (!done) { done = true; clearTimeout(t); resolve(null); } });
        });
    }
    function resolveVideoLink(info) {
        if (info.provider === 'youtube') {
            return fetchJson('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(info.url), 6000).then(function (j) {
                return { provider: 'youtube', id: info.id, url: info.url, title: (j && j.title) || '', thumb: 'https://i.ytimg.com/vi/' + info.id + '/hqdefault.jpg' };
            });
        }
        return fetchJson('https://www.tiktok.com/oembed?url=' + encodeURIComponent(info.url), 7000).then(function (j) {
            var id = info.id || (j && j.embed_product_id) || '';
            if (!/^\d{8,25}$/.test(id)) return null;
            var url = info.short ? 'https://www.tiktok.com/@' + ((j && j.author_unique_id) || 'user') + '/video/' + id : info.url;
            return { provider: 'tiktok', id: id, url: url, title: (j && j.title) || '', thumb: (j && /^https:\/\//.test(j.thumbnail_url || '')) ? j.thumbnail_url : '' };
        });
    }
    function linkCardHtml(p) {
        var tiktok = p.linkProvider === 'tiktok', provider = tiktok ? 'tiktok' : 'youtube';
        var title = String(p.linkTitle || (tiktok ? 'TikTok video' : 'YouTube video'));
        var id = String(p.linkId || ''), url = String(p.linkUrl || '');
        var thumb = /^https:\/\//.test(p.linkThumb || '') ? p.linkThumb : (!tiktok && /^[A-Za-z0-9_-]{11}$/.test(id) ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '');
        return '<div class="vlink vlink-' + provider + '" data-vlink data-provider="' + provider + '" data-id="' + plain(id) + '" data-url="' + plain(url) + '">'
            + '<div class="vlink-media"><button type="button" class="vlink-thumb" data-vlink-play aria-label="Play video: ' + plain(title) + '">'
            + (thumb ? '<img src="' + plain(thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '')
            + '<span class="vlink-play"></span></button></div>'
            + '<div class="vlink-info"><span class="vlink-chip">' + (tiktok ? 'TikTok' : 'YouTube') + '</span><b class="vlink-title">' + plain(title) + '</b><small>' + (tiktok ? 'tiktok.com' : 'youtube.com') + '</small></div></div>';
    }
    window.afLinkCardHtml = linkCardHtml;
    function safeVideoUrl(u) { return /^https:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com)\//.test(u || '') ? u : ''; }
    function stopLink(box) {
        if (!box) return;
        var media = box.querySelector('.vlink-media');
        if (media && box.__thumbHtml != null) { media.innerHTML = box.__thumbHtml; media.classList.remove('is-error'); }
        var tools = box.querySelector('.vlink-tools'); if (tools) tools.remove();
        box.removeAttribute('data-vlink-playing');
    }
    function showLinkError(box, kind) {
        var media = box.querySelector('.vlink-media'), tiktok = box.dataset.provider === 'tiktok';
        var name = tiktok ? 'TikTok' : 'YouTube', msg;
        if (kind === 'unavailable') msg = 'This video is unavailable. It may have been removed or made private by its owner.';
        else if (kind === 'invalid') msg = 'This video link is not valid.';
        else msg = "This video can't be played inside Afrishine Hub because its owner has turned off embedding on " + name + '. This is a ' + name + ' rule, not a problem with your phone.';
        var href = safeVideoUrl(box.dataset.url);
        media.classList.add('is-error');
        media.innerHTML = '<div class="vlink-error"><b>Video unavailable here</b><span>' + plain(msg) + '</span><div class="row">' + (href ? '<a href="' + plain(href) + '" target="_blank" rel="noopener">Watch on ' + name + '</a>' : '') + '<button type="button" data-vlink-back>Back</button></div></div>';
        var tools = box.querySelector('.vlink-tools'); if (tools) tools.remove();
    }
    function playLink(box) {
        var provider = box.dataset.provider, id = box.dataset.id, src = '';
        Array.prototype.forEach.call(document.querySelectorAll('[data-vlink-playing="1"]'), stopLink);
        if (provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id)) src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
        else if (provider === 'tiktok' && /^\d{8,25}$/.test(id)) src = 'https://www.tiktok.com/player/v1/' + id + '?autoplay=1&rel=0&controls=1&description=0&music_info=0';
        var media = box.querySelector('.vlink-media');
        if (box.__thumbHtml == null) box.__thumbHtml = media.innerHTML;
        if (!src) { box.setAttribute('data-vlink-playing', '1'); return showLinkError(box, 'invalid'); }
        box.setAttribute('data-vlink-playing', '1');
        media.innerHTML = '<iframe class="vlink-frame" src="' + src + '" title="Video player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        var frame = media.querySelector('iframe');
        if (provider === 'youtube') frame.addEventListener('load', function () { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (_) { } });
        var href = safeVideoUrl(box.dataset.url), tools = document.createElement('div');
        tools.className = 'vlink-tools';
        tools.innerHTML = '<button type="button" data-vlink-back>Close player</button>' + (provider === 'tiktok' && href ? '<a href="' + plain(href) + '" target="_blank" rel="noopener">Not playing? Open on TikTok</a>' : '');
        box.appendChild(tools);
    }
    document.addEventListener('click', function (e) {
        var play = e.target.closest ? e.target.closest('[data-vlink-play]') : null;
        if (play) { e.preventDefault(); playLink(play.closest('[data-vlink]')); return; }
        var back = e.target.closest ? e.target.closest('[data-vlink-back]') : null;
        if (back) { e.preventDefault(); stopLink(back.closest('[data-vlink]')); }
    });
    window.addEventListener('message', function (e) {
        var data = e.data;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { return; } }
        if (!data || typeof data !== 'object') return;
        var frames = document.querySelectorAll('.vlink-frame'), frame = null;
        for (var i = 0; i < frames.length; i++) { if (frames[i].contentWindow === e.source) frame = frames[i]; }
        if (!frame) return;
        var box = frame.closest('[data-vlink]');
        if (data.event === 'onError') showLinkError(box, Number(data.info) === 100 ? 'unavailable' : 'embed');
        else if (data['x-tiktok-player'] && data.type === 'onError') showLinkError(box, 'embed');
    });
    var linkState = null;
    function closeLinkEditor() { var o = document.getElementById('afLinkSheet'); if (o) o.remove(); linkState = null; }
    function openLinkEditor() {
        if (typeof currentFirebaseUser === 'undefined' || !currentFirebaseUser) { notice('Create an account or sign in to share a video link.'); showPage('profile'); return; }
        closeGate(); closeLinkEditor();
        var o = document.createElement('div');
        o.id = 'afLinkSheet'; o.className = 'gate-overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
        o.innerHTML = '<section class="gate-card link-editor"><h2>Share a video link</h2><p class="sub">Paste a YouTube or TikTok link. Members watch it inside Afrishine Hub.</p>'
            + '<input class="field" id="afLinkUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://youtube.com/watch?v=…">'
            + '<div id="afLinkPreview"></div><p class="link-msg" id="afLinkMsg" role="status"></p>'
            + '<input class="field" id="afLinkTitle" maxlength="200" placeholder="Title (optional)" style="display:none">'
            + '<textarea class="field" id="afLinkCaption" maxlength="500" placeholder="Say something about this video (optional)"></textarea>'
            + '<button type="button" class="gold" id="afLinkPost" disabled>Post Video</button><button type="button" class="gate-cancel" id="afLinkCancel">Cancel</button></section>';
        document.body.appendChild(o);
        var input = o.querySelector('#afLinkUrl'), msg = o.querySelector('#afLinkMsg'), prev = o.querySelector('#afLinkPreview'), btn = o.querySelector('#afLinkPost'), titleEl = o.querySelector('#afLinkTitle'), timer = null, seq = 0;
        function say2(text, bad) { msg.textContent = text || ''; msg.className = 'link-msg' + (bad ? ' err' : ''); }
        function check() {
            var mine = ++seq, raw = input.value.trim();
            linkState = null; btn.disabled = true; prev.innerHTML = ''; titleEl.style.display = 'none';
            if (!raw) return say2('');
            var info = parseVideoLink(raw);
            if (!info) return say2('Paste a valid YouTube or TikTok video link.', true);
            say2('Checking link…');
            resolveVideoLink(info).then(function (r) {
                if (mine !== seq) return;
                if (!r) return say2('Please paste the full TikTok link that looks like tiktok.com/@name/video/123…', true);
                linkState = r;
                titleEl.style.display = ''; titleEl.value = r.title ? r.title.slice(0, 200) : '';
                prev.innerHTML = linkCardHtml({ linkProvider: r.provider, linkId: r.id, linkUrl: r.url, linkTitle: r.title, linkThumb: r.thumb });
                say2('Ready to post.'); btn.disabled = false;
            });
        }
        input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(check, 450); });
        input.addEventListener('paste', function () { setTimeout(check, 60); });
        o.querySelector('#afLinkCancel').addEventListener('click', closeLinkEditor);
        o.addEventListener('click', function (e) { if (e.target === o) closeLinkEditor(); });
        btn.addEventListener('click', function () {
            if (!linkState || !db || !currentFirebaseUser) return;
            var r = linkState, title = (titleEl.value || '').trim().slice(0, 200) || (r.provider === 'tiktok' ? 'TikTok video' : 'YouTube video');
            btn.disabled = true; btn.textContent = 'Posting…';
            db.collection('posts').add({
                uid: currentFirebaseUser.uid, authorName: currentFirebaseUser.displayName || 'Afrishine Member',
                text: (o.querySelector('#afLinkCaption').value || '').trim().slice(0, 500), type: 'link', source: 'talent',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                linkProvider: r.provider, linkUrl: r.url, linkId: r.id, linkTitle: title, linkThumb: r.thumb || ''
            }).then(function () { closeLinkEditor(); notice('Your video link has been shared.'); }).catch(function (e) { btn.disabled = false; btn.textContent = 'Post Video'; say2(firebaseErrorMessage(e), true); });
        });
        input.focus();
    }
    window.afOpenLinkEditor = openLinkEditor;

    /* The Academy (traffic rules course, files, viewer) now lives in afrishine-academy.js. */
    function toast(text, wait) {
        var t = document.getElementById('afSmallToast');
        if (!t) { t = document.createElement('div'); t.id = 'afSmallToast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
        t.textContent = text; t.style.display = 'block';
        clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, wait || 5000);
    }
    window.afToast = toast;
    function snip2(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }
    function closeViewer() { var v = document.getElementById('afViewer'); if (v) v.remove(); }
    /* ================= ADMIN DASHBOARD ================= */
    var ADM = { tab: 'overview' };
    window.__afIsAdmin = false;
    function syncAdminMenu() { var w = document.getElementById('ahMenuAdminWrap'); if (w) w.style.display = window.__afIsAdmin ? '' : 'none'; }
    function checkAdmin() {
        var u = (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null;
        if (!u || !db) { window.__afIsAdmin = false; syncAdminMenu(); return; }
        db.collection('admins').doc(u.uid).get().then(function (s) { window.__afIsAdmin = !!s.exists; syncAdminMenu(); }).catch(function () { window.__afIsAdmin = false; syncAdminMenu(); });
    }
    if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) auth.onAuthStateChanged(function () { checkAdmin(); });
    function body() { return document.getElementById('admBody'); }
    function busy(t) { body().innerHTML = '<p class="adm-empty">' + plain(t || 'Loading…') + '</p>'; }
    function fdate(t) { var m = ms2(t); return m ? new Date(m).toLocaleString() : ''; }
    function docsOf(snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }
    function byNew(a) { return a.sort(function (x, y) { return ms2(y.createdAt) - ms2(x.createdAt); }); }
    function countOf(q) {
        var p = q.count ? q.count().get().then(function (s) { return s.data().count; }) : Promise.reject(new Error('no count'));
        return p.catch(function () { return q.limit(1000).get().then(function (s) { return s.size >= 1000 ? '1000+' : s.size; }); });
    }
    function fail(e) { body().innerHTML = '<p class="adm-empty">' + plain(firebaseErrorMessage(e)) + '</p>'; }
    function admOverview() {
        busy();
        var Q = function (c, w) { var q = db.collection(c); return w ? q.where(w[0], '==', w[1]) : q; };
        var items = [['Members', Q('publicProfiles'), '👥'], ['Posts', Q('posts'), '📝'], ['Love posts', Q('love_posts'), '💞'], ['Marketplace listings', Q('marketplacePosts'), '🛍️'],
            ['Pending verifications', Q('verificationRequests', ['status', 'pending']), '✅'], ['New Love reports', Q('love_reports', ['status', 'new']), '🚩'], ['New Marketplace reports', Q('marketplaceReports', ['status', 'new']), '🚩'],
            ['Verification “notify me”', Q('verificationInterest'), '🔔'], ['Academy files', Q('academyFiles'), '🎓']];
        Promise.all(items.map(function (it) { return countOf(it[1]).catch(function () { return '—'; }); })).then(function (vals) {
            var grid = '<div class="adm-grid">' + items.map(function (it, i) { return '<div class="adm-stat"><i>' + it[2] + '</i><b>' + plain(vals[i]) + '</b><small>' + plain(it[0]) + '</small></div>'; }).join('') + '</div>';
            return db.collection('posts').orderBy('createdAt', 'desc').limit(8).get().then(function (s) {
                var rows = docsOf(s).map(function (p) { return '<div class="adm-row"><div class="grow"><span class="adm-tag">' + plain(p.type || 'text') + '</span><b>' + plain(p.authorName || 'Member') + '</b><small>' + plain(snip2(p.linkTitle || p.title || p.text || '(media post)', 110)) + ' · ' + plain(fdate(p.createdAt)) + '</small></div></div>'; }).join('');
                body().innerHTML = grid + '<h3 class="adm-h">Latest activity</h3>' + (rows || '<p class="adm-empty">No posts yet.</p>') + '<button type="button" class="adm-btn" data-adm-act="refresh">Refresh</button>';
            });
        }).catch(fail);
    }
    function admMembers() {
        busy();
        db.collection('publicProfiles').orderBy('updatedAt', 'desc').limit(80).get().then(function (s) {
            var rows = docsOf(s);
            body().innerHTML = '<input class="field adm-search" id="admSearch" placeholder="Search members…" autocomplete="off"><div id="admMemberList">' + (rows.map(function (m) {
                return '<div class="adm-row" data-name="' + plain(String(m.username || '').toLowerCase()) + '"><div class="grow"><b>' + plain(m.username || 'Member') + '</b>' + (m.verified ? ' <span class="adm-tag">✔ Verified</span>' : '') + '<small>' + plain(snip2(m.bio || m.location || '', 70)) + '</small><small>' + plain(m.id) + '</small></div><div class="acts"><button type="button" class="adm-btn ' + (m.verified ? 'red' : 'gold') + '" data-adm-act="verify" data-id="' + plain(m.id) + '" data-on="' + (m.verified ? '0' : '1') + '">' + (m.verified ? 'Remove badge' : 'Verify') + '</button></div></div>';
            }).join('') || '<p class="adm-empty">No members found.</p>') + '</div>';
        }).catch(fail);
    }
    function contentRows(col, rows) {
        return rows.map(function (p) {
            var main = p.title || p.linkTitle || p.text || p.description || '(media)';
            return '<div class="adm-row"><div class="grow"><span class="adm-tag">' + plain(p.type || col) + '</span><b>' + plain(p.authorName || 'Member') + '</b><small>' + plain(snip2(main, 120)) + ' · ' + plain(fdate(p.createdAt)) + '</small></div><div class="acts"><button type="button" class="adm-btn red" data-adm-act="del" data-col="' + col + '" data-id="' + plain(p.id) + '">Delete</button></div></div>';
        }).join('') || '<p class="adm-empty">Nothing here yet.</p>';
    }
    function admContent() {
        busy();
        var get = function (c, n) { return db.collection(c).orderBy('createdAt', 'desc').limit(n).get().then(docsOf).catch(function () { return []; }); };
        Promise.all([get('posts', 25), get('love_posts', 20), get('marketplacePosts', 20)]).then(function (r) {
            body().innerHTML = '<h3 class="adm-h">Posts (Home and Talent Hub)</h3>' + contentRows('posts', r[0]) + '<h3 class="adm-h">Love Connection</h3>' + contentRows('love_posts', r[1]) + '<h3 class="adm-h">Marketplace</h3>' + contentRows('marketplacePosts', r[2]);
        });
    }
    function admReports() {
        busy();
        var get = function (c, kind) { return db.collection(c).limit(60).get().then(function (s) { return docsOf(s).map(function (x) { x.kind = kind; return x; }); }).catch(function () { return []; }); };
        Promise.all([get('love_reports', 'love'), get('marketplaceReports', 'market')]).then(function (r) {
            var rows = byNew(r[0].concat(r[1]));
            body().innerHTML = rows.map(function (x) {
                var col = x.kind === 'love' ? 'love_posts' : 'marketplacePosts';
                return '<div class="adm-row"><div class="grow"><span class="adm-tag">' + (x.kind === 'love' ? 'Love' : 'Marketplace') + '</span><span class="adm-tag">' + plain(x.status || 'new') + '</span><b>' + plain(snip2(x.reason, 160)) + '</b><small>Post: ' + plain(x.postId) + '</small><small>Reported member: ' + plain(x.reportedUid) + ' · ' + plain(fdate(x.createdAt)) + '</small></div><div class="acts"><button type="button" class="adm-btn red" data-adm-act="del" data-col="' + col + '" data-id="' + plain(x.postId) + '" data-report="' + plain(x.id) + '" data-rcol="' + (x.kind === 'love' ? 'love_reports' : 'marketplaceReports') + '">Delete post</button><button type="button" class="adm-btn" data-adm-act="report" data-s="reviewed" data-id="' + plain(x.id) + '" data-rcol="' + (x.kind === 'love' ? 'love_reports' : 'marketplaceReports') + '">Reviewed</button><button type="button" class="adm-btn" data-adm-act="report" data-s="dismissed" data-id="' + plain(x.id) + '" data-rcol="' + (x.kind === 'love' ? 'love_reports' : 'marketplaceReports') + '">Dismiss</button></div></div>';
            }).join('') || '<p class="adm-empty">No reports. Everything looks calm.</p>';
        });
    }
    function admVerify() {
        busy();
        Promise.all([db.collection('verificationRequests').where('status', '==', 'pending').limit(50).get().then(docsOf).catch(function () { return []; }), db.collection('verificationInterest').limit(50).get().then(docsOf).catch(function () { return []; })]).then(function (r) {
            var req = byNew(r[0]);
            body().innerHTML = '<h3 class="adm-h">Pending verification requests</h3>' + (req.map(function (x) {
                return '<div class="adm-row"><div class="grow"><b>' + plain(x.displayName || 'Member') + '</b> <span class="adm-tag">' + plain(x.profession) + '</span><small>' + plain(snip2(x.details, 300)) + '</small><small>' + plain(x.uid) + ' · ' + plain(fdate(x.createdAt)) + '</small></div><div class="acts"><button type="button" class="adm-btn gold" data-adm-act="approve" data-id="' + plain(x.id) + '" data-uid="' + plain(x.uid) + '">Approve</button><button type="button" class="adm-btn red" data-adm-act="reject" data-id="' + plain(x.id) + '">Reject</button></div></div>';
            }).join('') || '<p class="adm-empty">No pending requests.</p>') + '<h3 class="adm-h">“Notify me” list (' + r[1].length + ')</h3>' + (r[1].map(function (x) { return '<div class="adm-row"><div class="grow">' + plain(x.email || '(no email)') + '<small>' + plain(x.uid) + '</small></div></div>'; }).join('') || '<p class="adm-empty">Nobody yet.</p>');
        });
    }
    function admAcademy() {
        busy();
        window.afAcademy.load(true).then(function () {
            var opts = window.AF_TR_CATS.map(function (c) { return '<option value="' + c.id + '">' + c.n + '. ' + plain(c.title) + '</option>'; }).join('');
            var lists = window.AF_TR_CATS.map(function (c) {
                var fs = window.afAcademy.filesOf(c.id);
                return '<h3 class="adm-h">' + c.n + '. ' + plain(c.title) + ' (' + fs.length + ')</h3>' + (fs.map(function (f) {
                    return '<div class="adm-row"><div class="grow"><span class="adm-tag">' + plain(f.fileType) + '</span><b>' + plain(f.title) + '</b><small>' + plain(snip2(f.description, 100)) + '</small></div><div class="acts"><button type="button" class="adm-btn" data-adm-act="renamefile" data-id="' + plain(f.id) + '">Rename</button><button type="button" class="adm-btn red" data-adm-act="delfile" data-id="' + plain(f.id) + '">Delete</button></div></div>';
                }).join('') || '<p class="adm-empty">No files yet. Members will see the “subscription” message here.</p>');
            }).join('');
            body().innerHTML = '<div class="adm-form"><b>Upload a file to Amategeko y’umuhanda</b><select class="field" id="admAcCat">' + opts + '</select><input class="field" id="admAcTitle" maxlength="150" placeholder="Title (e.g. Official Gazette – 2026)"><textarea class="field" id="admAcDesc" maxlength="300" placeholder="Short description (optional)" style="min-height:64px"></textarea><input class="field" id="admAcFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"><button type="button" class="adm-btn gold" id="admAcGo" data-adm-act="upfile" style="padding:12px">Upload file</button><small id="admAcMsg" class="adm-empty" style="padding:0"></small></div>' + lists;
        });
    }
    function admStorage() {
        busy();
        var u = currentFirebaseUser; if (!u) return;
        u.getIdToken().then(function (t) { return fetch('https://afrishine-media.usherluckyelie.workers.dev/usage', { headers: { Authorization: 'Bearer ' + t } }); }).then(function (r) { return r.json(); }).then(function (d) {
            var gb = function (n) { return (Number(n || 0) / 1e9).toFixed(2) + ' GB'; }, pct = Math.min(100, Math.round((d.monthlyUsedBytes || d.usedBytes || 0) / (d.limitBytes || 1) * 100));
            body().innerHTML = '<div class="adm-stat"><small>New uploads this month</small><b>' + gb(d.monthlyUsedBytes || d.usedBytes) + ' / ' + gb(d.limitBytes) + '</b><div class="adm-bar"><span style="width:' + pct + '%"></span></div><small style="margin-top:8px">' + pct + '% used · uploads ' + (d.canUpload === false ? 'are paused' : 'are open') + (d.resetsAt ? ' · resets ' + plain(new Date(d.resetsAt).toLocaleDateString()) : '') + '</small></div><div class="adm-grid" style="margin-top:10px"><div class="adm-stat"><i>🗄️</i><b>' + gb(d.totalStoredBytes) + '</b><small>Total stored in Cloudflare</small></div><div class="adm-stat"><i>📁</i><b>' + plain(d.objectCount == null ? '—' : d.objectCount) + '</b><small>Files stored</small></div></div><p class="adm-empty">Cloudflare’s free R2 allowance is 10 GB of stored data. Files from earlier months stay stored and still count toward it.</p>';
        }).catch(function () { body().innerHTML = '<p class="adm-empty">Storage numbers are not available right now.</p>'; });
    }
    var ADM_TABS = { overview: admOverview, members: admMembers, content: admContent, reports: admReports, verify: admVerify, academy: admAcademy, storage: admStorage };
    function admRender(tab) {
        ADM.tab = ADM_TABS[tab] ? tab : 'overview';
        Array.prototype.forEach.call(document.querySelectorAll('#admTabs [data-adm-tab]'), function (b) { b.classList.toggle('on', b.getAttribute('data-adm-tab') === ADM.tab); });
        if (!db) { busy('Service temporarily unavailable.'); return; }
        ADM_TABS[ADM.tab]();
    }
    window.afAdminRender = admRender;
    function admDelete(col, id, reportId, rcol) {
        if (!confirm('Delete this item permanently?')) return;
        var ref = db.collection(col).doc(id);
        ref.get().then(function (snap) {
            var d = snap.exists ? snap.data() : {};
            return ref.delete().then(function () {
                [].concat(d.mediaKey ? [d.mediaKey] : [], d.imageKey ? [d.imageKey] : [], d.images || [], d.imageUrls || [], d.videoUrl ? [d.videoUrl] : []).forEach(function (u) { if (window.workerDelete) window.workerDelete(u).catch(function () { }); });
                if (reportId && rcol) return db.collection(rcol).doc(reportId).update({ status: 'reviewed', reviewedAt: firebase.firestore.FieldValue.serverTimestamp(), reviewedBy: currentFirebaseUser.uid }).catch(function () { });
            });
        }).then(function () { notice('Deleted.'); admRender(ADM.tab); }).catch(function (e) { notice(firebaseErrorMessage(e)); });
    }
    function admUploadFile() {
        var cat = document.getElementById('admAcCat').value, title = document.getElementById('admAcTitle').value.trim(), desc = document.getElementById('admAcDesc').value.trim();
        var file = document.getElementById('admAcFile').files[0], msg = document.getElementById('admAcMsg'), btn = document.getElementById('admAcGo');
        if (title.length < 3) { msg.textContent = 'Please write a title (at least 3 characters).'; return; }
        if (!file) { msg.textContent = 'Please choose a file.'; return; }
        var kind = file.type === 'application/pdf' ? 'pdf' : /^image\//.test(file.type) ? 'image' : /^video\//.test(file.type) ? 'video' : '';
        if (!kind) { msg.textContent = 'Use a PDF, an image or a video file.'; return; }
        btn.disabled = true; msg.textContent = 'Uploading…';
        var prep = kind === 'video' ? window.afPrepareVideo(file, function (t) { msg.textContent = t; }) : Promise.resolve(file);
        prep.then(function (f) {
            msg.textContent = 'Uploading…';
            return currentFirebaseUser.getIdToken().then(function (t) {
                return fetch('https://afrishine-media.usherluckyelie.workers.dev/upload?filename=' + encodeURIComponent(f.name || 'file'), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': f.type }, body: f });
            }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.success) { window.afWorkerFailure(d, r.status); throw new Error(d.error || 'Upload failed. Please try again.'); } return d; }); });
        }).then(function (up) {
            return db.collection('academyFiles').add({ category: cat, title: title, description: desc, fileUrl: up.url, fileKey: up.key, fileType: kind, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentFirebaseUser.uid });
        }).then(function () { notice('File added to the course.'); window.afAcademy.state.at = 0; admAcademy(); }).catch(function (e) { btn.disabled = false; msg.textContent = firebaseErrorMessage(e); });
    }
    document.addEventListener('click', function (e) {
        var tab = e.target.closest ? e.target.closest('[data-adm-tab]') : null;
        if (tab) { admRender(tab.getAttribute('data-adm-tab')); return; }
        var b = e.target.closest ? e.target.closest('[data-adm-act]') : null;
        if (!b || !window.__afIsAdmin) return;
        var act = b.getAttribute('data-adm-act'), id = b.getAttribute('data-id'), ts = firebase.firestore.FieldValue.serverTimestamp();
        if (act === 'refresh') admRender(ADM.tab);
        else if (act === 'verify') db.collection('publicProfiles').doc(id).update({ verified: b.getAttribute('data-on') === '1' }).then(function () { notice('Updated.'); admMembers(); }).catch(function (er) { notice(firebaseErrorMessage(er)); });
        else if (act === 'del') admDelete(b.getAttribute('data-col'), id, b.getAttribute('data-report'), b.getAttribute('data-rcol'));
        else if (act === 'report') db.collection(b.getAttribute('data-rcol')).doc(id).update({ status: b.getAttribute('data-s'), reviewedAt: ts, reviewedBy: currentFirebaseUser.uid }).then(function () { admReports(); }).catch(function (er) { notice(firebaseErrorMessage(er)); });
        else if (act === 'approve') {
            var uid = b.getAttribute('data-uid');
            db.collection('publicProfiles').doc(uid).update({ verified: true }).then(function () { return db.collection('verificationRequests').doc(id).update({ status: 'approved', reviewedAt: ts, reviewedBy: currentFirebaseUser.uid }); }).then(function () { notice('Member verified.'); admVerify(); }).catch(function (er) { notice(firebaseErrorMessage(er)); });
        }
        else if (act === 'reject') db.collection('verificationRequests').doc(id).update({ status: 'rejected', reviewedAt: ts, reviewedBy: currentFirebaseUser.uid }).then(function () { admVerify(); }).catch(function (er) { notice(firebaseErrorMessage(er)); });
        else if (act === 'upfile') admUploadFile();
        else if (act === 'renamefile') { var f = window.afAcademy.state.files.filter(function (x) { return x.id === id; })[0], nt = f && prompt('New title', f.title); if (nt && nt.trim().length >= 3) db.collection('academyFiles').doc(id).update({ title: nt.trim().slice(0, 150), updatedAt: ts }).then(function () { window.afAcademy.state.at = 0; admAcademy(); }).catch(function (er) { notice(firebaseErrorMessage(er)); }); }
        else if (act === 'delfile') {
            var file = window.afAcademy.state.files.filter(function (x) { return x.id === id; })[0];
            if (file && confirm('Delete this file from the course?')) db.collection('academyFiles').doc(id).delete().then(function () { if (file.fileKey && window.workerDelete) window.workerDelete(file.fileKey).catch(function () { }); window.afAcademy.state.at = 0; admAcademy(); }).catch(function (er) { notice(firebaseErrorMessage(er)); });
        }
    });
    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'admSearch') {
            var q = e.target.value.trim().toLowerCase();
            Array.prototype.forEach.call(document.querySelectorAll('#admMemberList [data-name]'), function (r) { r.style.display = r.getAttribute('data-name').indexOf(q) !== -1 ? '' : 'none'; });
        }
    });
    /* profile menu sheet header */
    document.addEventListener('toggle', function (e) {
        if (!e.target || e.target.id !== 'ahProfileMore' || !e.target.open) return;
        var n = document.getElementById('ahDashboardName'), a = document.getElementById('ahDashboardAvatar'), u = (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null;
        var name = (n && n.textContent.trim()) || (u && u.displayName) || 'Afrishine Hub';
        document.getElementById('ahSheetName').textContent = name;
        document.getElementById('ahSheetSub').textContent = u ? (u.email || 'Signed in') : 'You are not signed in';
        var img = document.getElementById('ahSheetAvatar'); if (img && a && a.src) img.src = a.src;
        syncAdminMenu();
    }, true);

    var prevCreateAction2 = window.createAction;
    window.createAction = function (type) {
        if (type === 'link') { try { closeCreateMenu(); } catch (_) { } openLinkEditor(); return; }
        return prevCreateAction2(type);
    };
    var prevOpenCreateMenu = window.openCreateMenu;
    window.openCreateMenu = function (source) {
        var r = prevOpenCreateMenu.apply(this, arguments);
        var b = document.getElementById('createLinkOption'); if (b) b.style.display = (source === 'talent') ? '' : 'none';
        return r;
    };
    /* Android / browser Back button moves between pages */
    window.addEventListener('popstate', function () {
        closeGate();
        hideToast();
        var hashId = decodeURIComponent(location.hash.replace('#', ''));
        var routeId = getAfrishineRoutePage();
        var id = (hashId && document.getElementById(hashId)) ? hashId : (routeId || 'home');
        var target = document.getElementById(id);
        if (target && target.classList.contains('page')) {
            window.showPage(id);
            if (id === 'shop' && typeof loadMarketplacePosts === 'function') loadMarketplacePosts();
        }
    });
        /* Escape closes open overlays */
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        closeGate(); closeLinkEditor(); closeViewer();
        try { closeMenu(); closeCreateMenu(); } catch (_) {}
        var ws = document.getElementById('creatorWorkspace');
        if (ws && ws.classList.contains('open')) closeCreator();
        var lm = document.getElementById('marketLoginModal');
        if (lm && lm.classList.contains('open')) closeMarketplaceLogin();
    });
    /* Shared profile links (?member=UID) */
    var member = new URLSearchParams(location.search).get('member');
    if (member && typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) {
        var off = null;
        off = auth.onAuthStateChanged(function () { if (off) off(); if (typeof openMemberProfile === 'function') openMemberProfile(member); });
    }
})();

/* ---------- next block ---------- */

/* Direct visits to /marketplace, /academy and /talent: run the route again once every override
   (public Marketplace browsing, Marketplace panels) has loaded, so the page opens instead of the login popup. */
(function () {
  try {
    var route = typeof getAfrishineRoutePage === 'function' ? getAfrishineRoutePage() : '';
    if (!route) return;
    var hashId = decodeURIComponent((location.hash || '').replace('#', ''));
    if (hashId && document.getElementById(hashId)) return;
    var modal = document.getElementById('marketLoginModal');
    if (modal) modal.classList.remove('open');
    try { pendingMarketplaceLogin = false; } catch (_) { }
    window.showPage(route);
  } catch (e) { console.warn('Route start failed:', e); }
})();
