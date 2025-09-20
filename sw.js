const CACHE = 'ahs-v1';
const ASSETS = [
  '/', 'index.html','categories.html','product.html','cart.html','checkout.html','profile.html','login.html','register.html','admin.html','banktransfer.html',
  'style.css','main.js','home.js','categories.js','product.js','cart.js','checkout.js','profile.js','login.js','register.js','admin.js','banktransfer.js',
  'logo.png','wall.png','assets/product-placeholder.png','assets/profile-placeholder.png'
];
self.addEventListener('install', e=> e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch', e=> e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))));
