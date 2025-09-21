document.addEventListener('DOMContentLoaded', async () => {
    getCart();
    
    // --- Custom Modal Logic ---
    const customAlert = document.getElementById('customAlert');
    const modalMessage = document.getElementById('modalMessage');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const shareModal = document.getElementById('shareModal');
    const shareLinkInput = document.getElementById('shareLinkInput');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    
    // NEW: Variant Selection Modals
    const colorModal = document.getElementById('colorModal');
    const sizeModal = document.getElementById('sizeModal');

    function showCustomAlert(message) {
      if(modalMessage) modalMessage.textContent = message;
      if (customAlert) customAlert.classList.add('visible');
    }

    function hideCustomAlert() {
      if (customAlert) customAlert.classList.remove('visible');
    }

    if (modalOkBtn) modalOkBtn.addEventListener('click', hideCustomAlert);
    if (customAlert) customAlert.addEventListener('click', (e) => e.target === customAlert && hideCustomAlert());
    
    // --- Share Modal Logic ---
    function showShareModal() {
      if (shareLinkInput) shareLinkInput.value = window.location.href;
      if (shareModal) shareModal.classList.add('visible');
    }

    function hideShareModal() {
      if (shareModal) shareModal.classList.remove('visible');
    }
    
    if (shareModal) shareModal.addEventListener('click', (e) => e.target === shareModal && hideShareModal());

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        if (shareLinkInput) {
          navigator.clipboard.writeText(shareLinkInput.value).then(() => {
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyLinkBtn.textContent = 'Copy Link';
              hideShareModal();
            }, 1500);
          }).catch(() => {
            shareLinkInput.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
             setTimeout(() => {
              copyLinkBtn.textContent = 'Copy Link';
              hideShareModal();
            }, 1500);
          });
        }
      });
    }

    // --- NEW: Variant Modal Logic ---
    function showColorModal() { if (colorModal) colorModal.classList.add('visible'); }
    function hideColorModal() { if (colorModal) colorModal.classList.remove('visible'); }
    function showSizeModal() { if (sizeModal) sizeModal.classList.add('visible'); }
    function hideSizeModal() { if (sizeModal) sizeModal.classList.remove('visible'); }

    if (colorModal) colorModal.addEventListener('click', (e) => e.target === colorModal && hideColorModal());
    if (sizeModal) sizeModal.addEventListener('click', (e) => e.target === sizeModal && hideSizeModal());


    const id = qs('id');
    const wrap = document.getElementById('productDetail');
    const related = document.getElementById('relatedGrid');
    const ratingsSummaryEl = document.getElementById('ratingsSummary');
    const reviewsListEl = document.getElementById('reviewsList');
    const reviewFormContainerEl = document.getElementById('reviewFormContainer');

    if(!id){ wrap.innerHTML = 'No product id'; return; }
    const snap = await db.ref('products/'+id).once('value');
    const p = {id, ...snap.val()};
    
    let currentUser = auth.currentUser;
    let isInWishlist = false;

    auth.onAuthStateChanged(async user => {
      currentUser = user;
      isInWishlist = await checkWishlistStatus(id);
      renderProductDetails();
      renderReviewForm();
    });

    function finalPrice(){
      if(!p.discount) return p.price||0;
      if(typeof p.discount==='object'){
        return p.discount.type==='fixed' ? Math.max(0,(p.price||0)-(p.discount.value||0)) : Math.max(0,(p.price||0)*(1-(p.discount.value||0)/100));
      }
      return Math.max(0,(p.price||0)*(1-(+p.discount)/100));
    }
    
    let slideshowInterval;
    let currentImageIndex = 0;

    function renderProductDetails() {
      if (slideshowInterval) clearInterval(slideshowInterval);

      const mainImage = p.images?.[0] || 'assets/product-placeholder.png';
      
      wrap.innerHTML = `
        <div class="glass rounded-2xl p-3">
          <img id="mainProductImage" src="${mainImage}" class="w-full rounded-xl object-cover h-96">
          <div class="mt-3 flex gap-2 overflow-x-auto">
            ${(p.images||[]).map((u, i)=>`
              <img src="${u}" data-index="${i}" class="h-16 w-16 rounded-lg object-cover cursor-pointer hover:border-2 hover:border-yellow-400 transition thumb-img">
            `).join('')}
          </div>
        </div>
        <div class="space-y-4">
          <h1 class="text-xl font-bold">${p.name||''}</h1>
          <div>${p.discount?`<span class='opacity-70 line-through mr-2'>${fmt(p.price||0)}</span>`:''}<span class="text-yellow-300 text-lg">${fmt(finalPrice())}</span></div>
          <div class="opacity-80">${p.short||''}</div>
          
          <!-- NEW: Variant Selection UI -->
          <div class="space-y-3">
            <div class="flex items-center gap-4">
              <button id="colorSelectBtn" class="glass px-4 py-2 rounded-xl flex-1 text-left">Color</button>
              <div id="selectedColorDisplay" class="w-8 h-8 rounded-full border-2 border-white/20 flex-shrink-0" style="background-color: transparent;"></div>
            </div>
            <div class="flex items-center gap-4">
              <button id="sizeSelectBtn" class="glass px-4 py-2 rounded-xl flex-1 text-left">Size</button>
              <div id="selectedSizeDisplay" class="font-bold text-center w-8 h-8 flex items-center justify-center flex-shrink-0"></div>
            </div>
          </div>

          <div>
            <label class="opacity-80 text-sm">Qty</label>
            <div class="mt-1 flex items-center gap-2">
                <button id="qty-minus" class="glass w-10 h-10 rounded-xl flex items-center justify-center text-2xl">-</button>
                <span id="qty-display" class="font-bold text-lg w-12 text-center">1</span>
                <button id="qty-plus" class="glass w-10 h-10 rounded-xl flex items-center justify-center text-2xl">+</button>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3">
            <button class="btn-white-glow px-4 py-2 rounded-xl" id="addBtn">Add to Cart</button>
            <button class="btn-glow px-4 py-2 rounded-xl text-center" id="buyNowBtn">Buy Now</button>
          </div>
          <div class="flex gap-3 mt-2">
            <button class="glass px-4 py-2 rounded-xl flex-1" id="shareBtn">Share</button>
            <button class="glass px-4 py-2 rounded-xl flex-1" id="wishlistBtn">${isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}</button>
          </div>
          <div class="mt-2">
            <button id="descToggle" class="underline text-yellow-300">View full description</button>
            <p id="fulldesc" class="mt-2 hide">${p.description||''}</p>
          </div>
        </div>`;
      
        // --- Image Slideshow Logic ---
        const mainImageEl = document.getElementById('mainProductImage');
        document.querySelectorAll('.thumb-img').forEach(img => {
            img.onclick = () => {
                mainImageEl.src = img.src;
                currentImageIndex = parseInt(img.dataset.index, 10);
                clearInterval(slideshowInterval); // Stop slideshow on manual selection
            };
        });
        const startSlideshow = () => {
            if (p.images && p.images.length > 1) {
                slideshowInterval = setInterval(() => {
                    currentImageIndex = (currentImageIndex + 1) % p.images.length;
                    mainImageEl.src = p.images[currentImageIndex];
                }, 5000);
            }
        };
        startSlideshow();

        // --- NEW: Variant Selection Logic ---
        let selColor = null;
        let selSize = null;

        const colorSelectBtn = document.getElementById('colorSelectBtn');
        const selectedColorDisplay = document.getElementById('selectedColorDisplay');
        const colorGrid = document.getElementById('colorGrid');

        const sizeSelectBtn = document.getElementById('sizeSelectBtn');
        const selectedSizeDisplay = document.getElementById('selectedSizeDisplay');
        const sizeGrid = document.getElementById('sizeGrid');

        // Populate Colors
        colorGrid.innerHTML = ''; // Clear previous
        if(p.colors && p.colors.length > 0) {
            p.colors.forEach(c => {
                const colorEl = document.createElement('button');
                colorEl.className = 'color-circle';
                colorEl.style.backgroundColor = c;
                colorEl.dataset.val = c;
                colorEl.onclick = () => {
                    selColor = c;
                    selectedColorDisplay.style.backgroundColor = c;
                    document.querySelectorAll('.color-circle').forEach(circ => circ.classList.remove('selected'));
                    colorEl.classList.add('selected');
                    hideColorModal();
                };
                colorGrid.appendChild(colorEl);
            });
            colorSelectBtn.onclick = showColorModal;
        } else {
            colorSelectBtn.disabled = true;
            colorSelectBtn.textContent = 'No Colors Available';
        }

        // Populate Sizes
        sizeGrid.innerHTML = ''; // Clear previous
        if(p.sizes && p.sizes.length > 0) {
            p.sizes.forEach(s => {
                const sizeEl = document.createElement('button');
                sizeEl.className = 'size-btn badge';
                sizeEl.textContent = s;
                sizeEl.dataset.val = s;
                sizeEl.onclick = () => {
                    selSize = s;
                    selectedSizeDisplay.textContent = s;
                    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('selected'));
                    sizeEl.classList.add('selected');
                    hideSizeModal();
                };
                sizeGrid.appendChild(sizeEl);
            });
            sizeSelectBtn.onclick = showSizeModal;
        } else {
            sizeSelectBtn.disabled = true;
            sizeSelectBtn.textContent = 'No Sizes Available';
        }


        // --- Quantity and Action Buttons ---
        const qtyDisplay = document.getElementById('qty-display');
        let currentQty = 1;

        document.getElementById('qty-minus').onclick = () => {
            if (currentQty > 1) {
                currentQty--;
                qtyDisplay.textContent = currentQty;
            }
        };
        document.getElementById('qty-plus').onclick = () => {
            currentQty++;
            qtyDisplay.textContent = currentQty;
        };

        document.getElementById('descToggle').onclick = ()=> document.getElementById('fulldesc').classList.toggle('hide');
        document.getElementById('addBtn').onclick = ()=> {
          if((p.colors?.length > 0 && !selColor) || (p.sizes?.length > 0 && !selSize)){ 
            showCustomAlert('Please select color and size');
            return; 
          }
          addToCart({id:p.id, name:p.name, price:finalPrice(), image:p.images?.[0]||'', qty: currentQty, variant:{color:selColor, size:selSize}});
          showCustomAlert('Added to cart');
        };

        document.getElementById('buyNowBtn').onclick = () => {
          if ((p.colors?.length > 0 && !selColor) || (p.sizes?.length > 0 && !selSize)) {
              showCustomAlert('Please select color and size');
              return;
          }
          addToCart({ id: p.id, name: p.name, price: finalPrice(), image: p.images?.[0] || '', qty: currentQty, variant: { color: selColor, size: selSize } });
          window.location.href = 'checkout.html';
        };

        document.getElementById('shareBtn').onclick = showShareModal;
        
        document.getElementById('wishlistBtn').onclick = async () => {
          if (isInWishlist) {
            await removeFromWishlist(p.id);
          } else {
            await addToWishlist(p.id);
          }
          isInWishlist = await checkWishlistStatus(id);
          renderProductDetails();
        };
    }

    async function checkWishlistStatus(productId) {
      if (!currentUser) return false;
      const wishlist = await getWishlist();
      return !!wishlist[productId];
    }
    
    const allSnap = await db.ref('products').orderByChild('category').equalTo(p.category||'').once('value');
    const list=[];
    allSnap.forEach(ch=> list.push({id:ch.key, ...ch.val()}));

    const sameBrand = list.filter(x => x.id !== p.id && x.brand === p.brand);
    const otherInCat = list.filter(x => x.id !== p.id && x.brand !== p.brand);
    
    const relatedList = [...sameBrand, ...otherInCat].slice(0, 3);
    
    function productCard(p){
        const finalPrice = p.price||0;
        const badge = p.discount ? `<span class="absolute top-2 right-2 z-10 text-xs px-2 py-1 rounded-full font-bold shadow-md neon-red-badge">${p.discount.type==='fixed'?p.discount.value+' LKR OFF':p.discount.value+'% OFF'}</span>` : '';
        const priceHtml = p.discount ? `<div><span class="opacity-70 line-through mr-2">${fmt(p.price||0)}</span><span class="text-yellow-300">${fmt(finalPrice)}</span></div>` : `<div class="text-yellow-300">${fmt(finalPrice)}</div>`;
        
        return `<a href="product.html?id=${p.id}" class="glass card rounded-2xl overflow-hidden relative">
          ${badge}
          <img src="${p.images?.[0]||'assets/product-placeholder.png'}" class="w-full h-48 object-cover" alt="">
          <div class="p-3 space-y-1">
            <div class="font-semibold line-clamp-2">${p.name||'Unnamed'}</div>
            ${priceHtml}
            <button class="btn-glow px-3 py-1 rounded-xl" onclick="event.preventDefault(); addToCart({id:'${p.id}', name:'${p.name}', price:${finalPrice}, image:'${p.images?.[0]||''}', qty:1, variant:null})">Add</button>
          </div>
        </a>`;
    }
    related.innerHTML = relatedList.map(item => productCard(item)).join('');

    async function userCanReview() {
        if (!currentUser) return false;
        const ordersSnap = await db.ref('orders').orderByChild('email').equalTo(currentUser.email).once('value');
        let hasPurchased = false;
        ordersSnap.forEach(order => {
            if (order.val().items.some(item => item.id === id)) hasPurchased = true;
        });
        const reviewsSnap = await db.ref('reviews/' + id).once('value');
        let hasReviewed = false;
        reviewsSnap.forEach(review => {
            if (review.val().userId === currentUser.uid) hasReviewed = true;
        });
        return hasPurchased && !hasReviewed;
    }

    async function loadReviews() {
      const reviewsSnap = await db.ref('reviews/'+id).once('value');
      const reviews = [];
      reviewsSnap.forEach(ch => reviews.push({ id: ch.key, ...ch.val() }));
      const totalRatings = reviews.length;
      const sumRatings = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
      const avgRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : '0';
      ratingsSummaryEl.innerHTML = `<span class="text-3xl font-bold">${avgRating}</span><div class="flex">${renderStars(parseFloat(avgRating))}</div><span class="opacity-70">(${totalRatings} reviews)</span>`;
      if (reviews.length === 0) {
        reviewsListEl.innerHTML = `<p class="opacity-70 text-center">No reviews yet. Be the first!</p>`;
      } else {
        reviewsListEl.innerHTML = reviews.map(r => `<div class="glass p-4 rounded-2xl"><div class="flex items-center gap-3 mb-2"><img src="${r.userAvatar || 'assets/profile-placeholder.png'}" class="h-10 w-10 rounded-full object-cover" alt="User Avatar"/><div><div class="font-semibold">${r.userName || 'Anonymous'}</div><div class="flex text-sm">${renderStars(r.rating)}</div></div></div><p class="opacity-80">${r.comment || ''}</p>${r.image ? `<img src="${r.image}" onclick="showReviewImage('${r.image}')" class="mt-3 rounded-xl w-32 h-32 object-cover cursor-pointer hover:scale-105 transition-transform" alt="Review Image"/>` : ''}</div>`).join('');
      }
    }
    
    window.showReviewImage = (imgSrc) => {
        const modalHtml = `<div id="reviewImageModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onclick="this.remove()"><div class="relative w-full max-w-4xl max-h-full overflow-hidden" onclick="event.stopPropagation()"><button onclick="document.getElementById('reviewImageModal').remove()" class="absolute top-4 right-4 text-white text-3xl font-bold z-10 bg-black/50 rounded-full w-10 h-10 flex items-center justify-center">&times;</button><img src="${imgSrc}" class="w-full h-full object-contain rounded-xl"/></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    function renderStars(rating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span class="${i <= rating ? 'text-yellow-400' : 'text-gray-500'}">★</span>`;
        }
        return starsHtml;
    }

    async function renderReviewForm() {
      if (!currentUser) {
        reviewFormContainerEl.innerHTML = `<p class="text-center opacity-70">Please <a href="login.html" class="underline">login</a> to leave a review.</p>`;
        return;
      }
      if (!await userCanReview()) {
        reviewFormContainerEl.innerHTML = `<p class="text-center opacity-70">You can only review products you have purchased, and only once.</p>`;
        return;
      }
      reviewFormContainerEl.innerHTML = `<h4 class="font-bold mb-2">Leave a Review</h4><form id="reviewForm" class="space-y-3"><div class="flex items-center gap-2" id="starRating"><label class="opacity-80">Your Rating:</label><div class="rating-stars flex flex-row-reverse">${[5,4,3,2,1].map(n=>`<label for="star${n}" class="star-label text-yellow-400 text-3xl cursor-pointer"><input type="radio" id="star${n}" name="rating" value="${n}" class="hidden" required>★</label>`).join('')}</div></div><textarea id="reviewComment" class="input w-full" rows="3" placeholder="Write your review here..."></textarea><div><label class="opacity-80 text-sm">Upload an image (optional)</label><input type="file" id="reviewImage" class="input mt-1"></div><button type="submit" class="btn-glow px-4 py-2 rounded-xl">Submit Review</button></form>`;
      document.getElementById('reviewForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = parseInt(document.querySelector('input[name="rating"]:checked').value, 10);
        const comment = document.getElementById('reviewComment').value.trim();
        const imageFile = document.getElementById('reviewImage').files?.[0];
        if (!rating || !comment) {
          showCustomAlert('Please provide a rating and a comment.');
          return;
        }
        const userDataSnap = await db.ref('users/' + currentUser.uid).once('value');
        const userData = userDataSnap.val() || {};
        let imageUrl = null;
        if (imageFile) {
          const uploadRes = await uploadToCloudinary(imageFile, 'allhall_reviews');
          imageUrl = uploadRes.secure_url;
        }
        await db.ref('reviews/' + id).push({
          userId: currentUser.uid,
          userName: userData.first || 'Anonymous',
          userAvatar: userData.avatar || 'assets/profile-placeholder.png',
          rating,
          comment,
          image: imageUrl,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        showCustomAlert('Review submitted successfully!');
        loadReviews();
        reviewFormContainerEl.innerHTML = `<p class="text-center opacity-70">Thanks for your review!</p>`;
      });
    }

    if (new URLSearchParams(window.location.search).get('review') === 'true') {
        document.getElementById('reviewFormContainer')?.scrollIntoView({ behavior: 'smooth' });
    }

    loadReviews();
});

