/* Marketplace refresh: public browsing, Google-authenticated publishing, product cards and saved items. */
(function(){
'use strict';
var marketProducts=[], marketSavedIds=[];
var marketWorker='https://afrishine-media.usherluckyelie.workers.dev';
var marketDetailId=null;
try{marketSavedIds=JSON.parse(localStorage.getItem('afrishine_market_saved_v1')||'[]')}catch(e){marketSavedIds=[]}
function mEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function mUser(){return window.currentFirebaseUser||currentFirebaseUser||null}
function mDb(){return window.db||db||null}
function mNotice(t){if(typeof notice==='function')notice(t);else alert(t)}
function mLogin(){pendingMarketplaceLogin=true;var el=document.getElementById('marketLoginModal');if(el)el.classList.add('open')}
function mRequireLogin(){if(!mUser()||!isGoogleMarketplaceUser(mUser())){mLogin();return false}return true}
function mSaved(){try{localStorage.setItem('afrishine_market_saved_v1',JSON.stringify(marketSavedIds))}catch(e){}}
function mProduct(p){return p&&p.product===true || p&&Array.isArray(p.images)}
function mImage(p){return (p.images&&p.images[0])||p.imageUrl||''}
function mPrice(p){var raw=p.price,f=function(n){return new Intl.NumberFormat('en-US').format(n)};if(typeof raw==='string'&&raw.trim()){var t=raw.trim(),m=t.match(/^(?:FRW|RWF)\s*([\d.,]+)$/i);if(m&&Number(m[1].replace(/,/g,'')))return f(Number(m[1].replace(/,/g,'')))+' Frw';var u=t.match(/^\$\s*([\d.,]+)$/);if(u&&Number(u[1].replace(/,/g,'')))return '$'+f(Number(u[1].replace(/,/g,'')));return t}var n=Number(raw);return n?f(n)+' Frw':'Price on request'}
function mCard(p){
 var id=mEsc(p.id),img=mEsc(mImage(p)),saved=marketSavedIds.indexOf(p.id)>=0;
 var condition=mEsc(p.condition||'New'),title=mEsc(p.title||p.text||'Product'),location=mEsc(p.location||'Rwanda');
 return '<article class="market-product-card"><div class="market-product-image" onclick="marketOpenDetails(\''+id+'\')">'+(img?'<img src="'+img+'" alt="'+title+'" loading="lazy">':'<div style="display:grid;place-items:center;height:100%;font-size:42px">🛍️</div>')+'<span class="market-condition">'+condition+'</span><button class="market-save '+(saved?'saved':'')+'" onclick="event.stopPropagation();marketToggleSaved(\''+id+'\')" aria-label="Save product">'+(saved?'♥':'♡')+'</button></div><div class="market-product-info"><strong class="market-product-price">'+mPrice(p)+'</strong><div class="market-product-title">'+title+'</div><div class="market-product-location">📍 '+location+'</div><button class="market-open-product" onclick="marketOpenDetails(\''+id+'\')">View Product →</button></div></article>';
}
window.canViewMarketplace=function(){return true};
window.enterMarketplace=function(){showPage('shop');document.body.classList.add('marketplace-active');marketShowPanel('home')};
window.marketGoBack=function(){if(document.getElementById('marketProductModal').classList.contains('open')){marketCloseDetails();return}if(document.getElementById('marketSellModal').classList.contains('open')){marketCloseSell();return}showPage('home');document.body.classList.remove('marketplace-active')};
var marketCondition='all',marketLoadedAt=0,marketLoadPromise=null;
window.marketAddProduct=function(p){if(p&&p.id&&!marketProducts.some(function(x){return x.id===p.id}))marketProducts.push(p)};
window.marketSetView=function(v){var b=document.getElementById('marketAllBtn');document.querySelectorAll('.market-filter-row button').forEach(function(x){x.classList.remove('active')});if(v==='all'&&b)b.classList.add('active');else Array.from(document.querySelectorAll('.market-filter-row button')).find(function(x){return x.textContent.trim()===v})?.classList.add('active');marketRenderProducts(v)};
function marketShowPanel(which){
 ['marketplaceFeed','marketSavedView','marketChatView','marketProfileView'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display=(which==='home'&&id==='marketplaceFeed'||which==='saved'&&id==='marketSavedView'||which==='chat'&&id==='marketChatView'||which==='profile'&&id==='marketProfileView')?'':'none'});
 document.querySelectorAll('.market-bottom-nav button').forEach(function(b){b.classList.remove('active')});
 var idx={home:0,saved:1,sell:2,chat:3,profile:4}[which];var nav=document.querySelectorAll('.market-bottom-nav button');if(nav[idx])nav[idx].classList.add('active');
}
window.marketBottom=function(which){
 if(which==='home'){showPage('home');document.body.classList.remove('marketplace-active');return}
 if(which==='sell'){marketOpenSell();return}
 marketShowPanel(which);
 if(which==='saved')marketRenderSaved();
 if(which==='chat'){var c=document.getElementById('marketChatContent');if(c)c.innerHTML=mUser()?'<p class="muted">Your conversations with buyers and sellers are in your Inbox.</p><button class="gold" onclick="showPage(\'inbox\')">Open Inbox →</button>':'<p class="muted">Sign in with Google to view your conversations.</p><button class="gold" onclick="marketOpenLogin()">Sign in with Google</button>'}
 if(which==='profile'){var p=document.getElementById('marketProfileContent');if(p)p.innerHTML=mUser()?'<b>'+mEsc(mUser().displayName||'Afrishine Member')+'</b><p class="creator-hint">Google account signed in.</p><button class="secondary" onclick="auth.signOut()">Sign Out</button>':'<p class="muted">You are not signed in.</p><button class="gold" onclick="marketOpenLogin()">Login with Google</button>'}
};
window.marketOpenLogin=mLogin;
window.marketOpenSell=function(){if(!mRequireLogin())return;document.getElementById('marketSellModal').classList.add('open')};
window.marketCloseSell=function(){document.getElementById('marketSellModal').classList.remove('open')};
window.marketCloseDetails=function(){document.getElementById('marketProductModal').classList.remove('open');marketDetailId=null};
window.marketToggleSaved=function(id){var i=marketSavedIds.indexOf(id);if(i>=0)marketSavedIds.splice(i,1);else marketSavedIds.push(id);mSaved();marketRenderProducts();if(document.getElementById('marketSavedView').style.display!=='none')marketRenderSaved()};
window.marketRenderProducts=function(condition){
 var feed=document.getElementById('marketplaceFeed');if(!feed)return;
 if(typeof condition==='string')marketCondition=condition;condition=marketCondition;
 var q=(document.getElementById('marketSearchInput').value||'').trim().toLowerCase();
 var filtered=marketProducts.filter(function(p){var text=[p.title,p.description,p.text,p.category,p.location].join(' ').toLowerCase();return (!q||text.indexOf(q)>=0)&&(!condition||condition==='all'||(p.condition||'').toLowerCase()===condition.toLowerCase())});
 document.getElementById('marketProductCount').textContent=filtered.length+' products';
 feed.innerHTML=filtered.map(mCard).join('')||'<div class="empty-feed" style="grid-column:1/-1">No products match your search. Try another keyword.</div>';
};
function marketRenderSaved(){var feed=document.getElementById('marketSavedFeed');if(!feed)return;var list=marketProducts.filter(function(p){return marketSavedIds.indexOf(p.id)>=0});feed.innerHTML=list.map(mCard).join('')||'<p class="empty-feed">You have no saved products yet.</p>'}
window.marketRenderSaved=marketRenderSaved;
window.marketLoadProducts=function(force){
 var feed=document.getElementById('marketplaceFeed');if(!feed)return Promise.resolve();
 if(marketLoadPromise)return marketLoadPromise;
 if(!force&&marketProducts.length&&Date.now()-marketLoadedAt<60000){marketRenderProducts();return Promise.resolve()}
 if(!mDb()){feed.innerHTML='<p class="empty-feed">We could not connect to Afrishine Hub services. Please check your connection and reload the page.</p>';return Promise.resolve()}
 feed.innerHTML='<p class="empty-feed">Loading products…</p>';
 marketLoadPromise=(async function(){
  try{
   var snap=await mDb().collection('marketplacePosts').orderBy('createdAt','desc').limit(100).get();
   marketProducts=snap.docs.map(function(d){var p=d.data();p.id=d.id;return p}).filter(function(p){return p.status!=='deleted'&&(mProduct(p)||p.type==='sell')});
   marketLoadedAt=Date.now();marketRenderProducts();
  }catch(e){console.error('Marketplace read:',e);feed.innerHTML='<div class="empty-feed" style="grid-column:1/-1">Could not load products. Please check your connection and try again.<br><button class="secondary" style="margin-top:10px" onclick="marketLoadProducts(true)">Try again</button></div>'}
  finally{marketLoadPromise=null}
 })();
 return marketLoadPromise;
};
window.loadMarketplacePosts=window.marketLoadProducts;
window.setMarketplaceFilter=function(f){marketSetView(f==='buy'?'all':f==='sell'?'all':'all')};
window.publishMarketplacePost=function(){marketOpenSell()};
window.marketToggleSaved=window.marketToggleSaved;
window.marketOpenDetails=function(id){
 var p=marketProducts.find(function(x){return x.id===id});if(!p)return;marketDetailId=id;
 var imgs=(p.images&&p.images.length?p.images:[mImage(p)]).filter(Boolean);
 var main=imgs[0]||'';
 var gallery=imgs.slice(1).map(function(u){return '<img src="'+mEsc(u)+'" alt="Product photo" onclick="document.getElementById(\'marketDetailMain\').src=this.src">'}).join('');
 var seller=mEsc(p.authorName||'Afrishine Seller');
 var html=(main?'<img id="marketDetailMain" class="market-detail-main" src="'+mEsc(main)+'" alt="'+mEsc(p.title||'Product')+'">':'')+
 '<div class="market-detail-gallery">'+gallery+'</div><h2 class="market-detail-title">'+mEsc(p.title||p.text||'Product')+'</h2><div class="market-detail-price">'+mPrice(p)+'</div>'+
 '<p class="creator-hint">'+mEsc(p.condition||'')+' · '+mEsc(p.category||'')+' · 📍 '+mEsc(p.location||'')+'</p><p class="market-detail-description">'+mEsc(p.description||p.text||'')+'</p>'+
 (p.videoUrl?'<video class="market-detail-video" controls playsinline src="'+mEsc(p.videoUrl)+'"></video>':'')+
 '<div class="market-profile-mini">'+(p.authorPhoto?'<img src="'+mEsc(p.authorPhoto)+'" alt="">':'<span style="font-size:28px">👤</span>')+'<div><b>'+seller+'</b><div class="creator-hint">Seller on Afrishine Hub</div></div></div>'+
 '<div class="market-detail-actions"><button class="gold" onclick="marketContactSeller(\''+mEsc(p.uid)+'\',\''+mEsc(seller).replace(/'/g,'&#39;')+'\')">✉ Chat to Seller</button><button class="secondary" onclick="marketToggleSaved(\''+mEsc(id)+'\')">♡ Save</button></div>';
 document.getElementById('marketProductDetails').innerHTML=html;document.getElementById('marketProductModal').classList.add('open');
};
window.marketContactSeller=function(uid,name){if(!mRequireLogin())return;if(!uid||uid===mUser().uid){mNotice('This is your own product.');return}if(typeof startConversation==='function'){marketCloseDetails();startConversation(uid,name)}else mNotice('Chat is currently unavailable.')}
var photoInput=document.getElementById('marketProductPhotos');
if(photoInput)photoInput.addEventListener('change',function(){var box=document.getElementById('marketPhotoPreview');box.innerHTML='';Array.from(this.files||[]).slice(0,8).forEach(function(f){if(!f.type.startsWith('image/'))return;var u=URL.createObjectURL(f),im=document.createElement('img');im.src=u;box.appendChild(im)})});
async function marketUpload(file){
 var u=mUser();if(!u)throw new Error('Please sign in with Google first.');
 var token=await u.getIdToken();
 var response=await fetch(marketWorker+'/upload?filename='+encodeURIComponent(file.name||'market-media'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':file.type||'application/octet-stream'},body:file});
 var data=await response.json().catch(function(){return {}});
 if(!response.ok||!data.success||!data.url){afWorkerFailure(data,response.status);throw new Error(data.error||'Media upload failed. Please try again.')}
 return data.url;
}
async function marketCompress(file){
 if(!file.type.startsWith('image/')||!window.createImageBitmap)return file;
 try{var im=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);var blob=await new Promise(function(r){c.toBlob(r,'image/jpeg',.78)});im.close&&im.close();return blob?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):file}catch(e){return file}
}
window.marketPublishProduct=async function(){
 if(!mRequireLogin())return;
 var photos=Array.from(document.getElementById('marketProductPhotos').files||[]).filter(function(f){return f.type.startsWith('image/')}).slice(0,8);
 var video=document.getElementById('marketProductVideo').files[0];
 var title=document.getElementById('marketProductTitle').value.trim(),description=document.getElementById('marketProductDescription').value.trim(),price=Number(document.getElementById('marketProductPrice').value),locationText=document.getElementById('marketProductLocation').value;
 if(photos.length<3){mNotice('Please select at least 3 product photos.');return}
 if(video&&!/^video\//.test(video.type||'')&&!/\.(mp4|mov|m4v|webm|3gp)$/i.test(video.name||'')){mNotice('Please choose a valid video file.');return}
 if(!title||description.length<8||!price||price<1){mNotice('Please enter a valid title, description and price.');return}
 var btn=document.getElementById('marketPublishButton'),status=document.getElementById('marketUploadStatus');btn.disabled=true;status.textContent='Uploading photos…';
 try{
  var imageUrls=[];for(var i=0;i<photos.length;i++){status.textContent='Uploading photo '+(i+1)+' / '+photos.length;imageUrls.push(await marketUpload(await marketCompress(photos[i])))}
  var videoUrl='';if(video){status.textContent='Uploading video…';videoUrl=await marketUpload(await afPrepareVideo(video,function(t){status.textContent=t}))}
  status.textContent='Saving product…';
  await mDb().collection('marketplacePosts').add({uid:mUser().uid,authorName:mUser().displayName||'Afrishine Seller',authorPhoto:mUser().photoURL||'',type:'sell',product:true,title:title,description:description,text:description,price:(document.getElementById('marketProductCurrency').value==='USD'?'$':'FRW ')+String(price),condition:document.getElementById('marketProductCondition').value,category:document.getElementById('marketProductCategory').value,location:locationText,images:imageUrls,videoUrl:videoUrl,createdAt:firebase.firestore.FieldValue.serverTimestamp(),status:'active'});
  ['marketProductTitle','marketProductDescription','marketProductPrice','marketProductPhotos','marketProductVideo'].forEach(function(id){document.getElementById(id).value=''});
  document.getElementById('marketPhotoPreview').innerHTML='';marketCloseSell();mNotice('Your product has been published successfully.');await marketLoadProducts(true);
 }catch(e){console.error(e);status.textContent=e.message||'Could not publish the product.';mNotice(status.textContent)}
 finally{btn.disabled=false}
};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){marketCloseDetails();marketCloseSell()}});
var headerForm=document.getElementById('headerSearchForm');
if(headerForm)headerForm.addEventListener('submit',function(e){
 if(!document.getElementById('shop').classList.contains('active'))return;
 e.preventDefault();e.stopImmediatePropagation();
 var q=document.getElementById('headerSearch').value||'';
 document.getElementById('marketSearchInput').value=q;
 marketShowPanel('home');marketRenderProducts();
},{capture:true});
var originalShowPage=window.showPage;
if(typeof originalShowPage==='function'){
 window.showPage=function(id){originalShowPage(id);if(id==='shop'){document.body.classList.add('marketplace-active');marketShowPanel('home');marketLoadProducts()}else document.body.classList.remove('marketplace-active')};
}
if(document.getElementById('shop') && document.getElementById('shop').classList.contains('active')){
 document.body.classList.add('marketplace-active');
 marketShowPanel('home');
 marketLoadProducts();
 if(typeof loadMarketplacePosts==='function') loadMarketplacePosts();
}
})();