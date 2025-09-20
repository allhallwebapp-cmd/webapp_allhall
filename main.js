// Shared constants
const CLOUDINARY_CLOUD = "dzgsde4su";
const PRESET_RECEIPT = "allhall_receipts";
const PRESET_PRODUCT = "allhall_product";
const PRESET_PROFILE = "shop_unsigned";

function fmt(n){ return new Intl.NumberFormat('en-LK').format(n) + " LKR"; }

function getCart(){
  const c = JSON.parse(localStorage.getItem('cart')||'[]');
  document.querySelectorAll('#navCartCount').forEach(el=> el.textContent = c.length ? '('+c.length+')' : '');
  return c;
}
function setCart(items){ localStorage.setItem('cart', JSON.stringify(items)); getCart(); }
function addToCart(item){ const c=getCart(); if(c.length>=50){alert('Cart max 50 items'); return;} c.push(item); setCart(c); }

function crossed(price, discount){
  if(!discount) return '';
  if(typeof discount === 'object'){
    // {type:'percent'|'fixed', value:number}
    return discount.type==='percent' ? Math.max(0, price*(1-discount.value/100)) : Math.max(0, price - discount.value);
  }
  // percent as number
  return Math.max(0, price*(1-discount/100));
}

// main.js - Corrected productCard function
function productCard(p){
  const finalPrice = crossed(p.price||0, p.discount) || p.price||0;
  const hasDiscount = !!p.discount;
  const badgeText = (typeof p.discount === 'object' && p.discount.type === 'fixed')
    ? (p.discount.value + ' LKR OFF')
    : (typeof p.discount === 'object' ? p.discount.value : p.discount) + '% OFF';
  const badge = hasDiscount 
    ? `<span class="absolute top-2 right-2 z-10 text-xs px-2 py-1 rounded-full font-bold shadow-md neon-red-badge">${badgeText}</span>` 
    : '';
  
  const priceHtml = hasDiscount 
    ? `<div><span class="opacity-70 line-through mr-2">${fmt(p.price||0)}</span><span class="text-yellow-300">${fmt(finalPrice)}</span></div>` 
    : `<div class="text-yellow-300">${fmt(finalPrice)}</div>`;

  return `<div class="glass card rounded-2xl overflow-hidden relative">
    ${badge}
    <a href="product.html?id=${p.id}"><img src="${p.images?.[0]||'assets/product-placeholder.png'}" class="w-full h-48 object-cover" alt=""></a>
    <div class="p-3 space-y-1">
      <a href="product.html?id=${p.id}" class="font-semibold line-clamp-2">${p.name||'Unnamed'}</a>
      ${priceHtml}
      <button class="btn-glow px-3 py-1 rounded-xl" onclick='addToCart({id:"${p.id}", name:"${p.name}", price:${finalPrice}, image:"${p.images?.[0]||''}", qty:1, variant:null})'>Add</button>
    </div>
  </div>`;
}
// load all then filter client-side (title+brand+category)
async function searchFilter(term){
  term = (term||'').toLowerCase();
  const snap = await db.ref('products').once('value');
  const list=[]; snap.forEach(ch=> list.push({id:ch.key, ...ch.val()}));
  if(!term) return list;
  return list.filter(p=> (p.name||'').toLowerCase().includes(term) || (p.brand||'').toLowerCase().includes(term) || (p.category||'').toLowerCase().includes(term));
}

// helpers
function qs(name){ const p=new URLSearchParams(location.search); return p.get(name); }

// Order ID format AHS-YYYYMMDD-XXXXXX
function makeOrderId(){
  const d = new Date(); const ymd = d.toISOString().slice(0,10).replace(/-/g,''); 
  const rand = Math.random().toString(36).slice(2,8).toUpperCase();
  return `AHS-${ymd}-${rand}`;
}

// Cloudinary unsigned upload
async function uploadToCloudinary(file, preset){
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', preset);
  const r = await fetch(url, { method:'POST', body: fd });
  if(!r.ok) throw new Error('Upload failed');
  return r.json();
}

auth.onAuthStateChanged(u=>{ 
  window.currentUser = u || null;
  checkNotifications();
});

// admin email list check helper (emails stored under /roles/adminEmails/encodedEmail:true)
function encEmail(e){ return (e||'').replaceAll('.', ','); }


// New notification function for site-wide use
async function checkNotifications() {
    const user = auth.currentUser;
    if (!user) {
        document.getElementById('notifDot').classList.add('opacity-0');
        return;
    }

    const notifSnap = await db.ref('notifications/' + user.uid).once('value');
    const hasUnread = notifSnap.exists() && Object.values(notifSnap.val()).some(n => !n.isRead);

    const notifDot = document.getElementById('notifDot');
    if (notifDot) {
        if (hasUnread) {
            notifDot.classList.remove('opacity-0');
        } else {
            notifDot.classList.add('opacity-0');
        }
    }
}

// --- Wishlist Functions ---
async function getWishlist() {
    const user = auth.currentUser;
    if (!user) return {};
    const snap = await db.ref('wishlists/' + user.uid).once('value');
    return snap.val() || {};
}

async function addToWishlist(productId) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to add to your wishlist.');
        return;
    }
    await db.ref('wishlists/' + user.uid + '/' + productId).set(true);
    alert('Product added to wishlist!');
}

async function removeFromWishlist(productId) {
    const user = auth.currentUser;
    if (!user) return;
    await db.ref('wishlists/' + user.uid + '/' + productId).remove();
    alert('Product removed from wishlist.');
}