// home.js - Final Corrected Code
document.addEventListener('DOMContentLoaded', async () => {
    try {
        getCart();

        const bannerSection = document.getElementById('bannerSection');
        const bannerWrap = document.getElementById('bannerSlider');
        const bannerWrap2 = document.getElementById('bannerSlider2');
        const topRatedGrid = document.getElementById('topRatedGrid');
        const recentlyAddedGrid = document.getElementById('recentlyAddedGrid');
        const flashSaleSection = document.getElementById('flashSaleSection');
        const allProductsGrid = document.getElementById('allProductsGrid');
        const loader = document.getElementById('loader');
        const catContainer = document.getElementById('tabCategoriesContent');
        
        // Helper function to render a product grid with staggered layout
        function renderStaggeredProductGrid(products, gridElement) {
            gridElement.innerHTML = products.map((p, i) => {
                const classes = i % 2 !== 0 ? 'product-card-staggered' : '';
                return `<div class="${classes}">${productCard(p)}</div>`;
            }).join('');
        }

        // Helper function to render a normal product grid
        function renderNormalProductGrid(products, gridElement) {
            gridElement.innerHTML = products.map(p => productCard(p)).join('');
        }

        // --- Main Banner & Countdown Logic ---
        const countdownContainer = document.getElementById('countdown-bar-container');
        const countdownTextEl = document.getElementById('countdown-text');
        const countdownBtn = document.getElementById('countdown-button');
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        const countdownSnap = await db.ref('promotions/countdown').once('value');
        const countdownData = countdownSnap.val();
        let countdownInterval;

        const handleBannerVisibility = (showBanner) => {
            if (showBanner) {
                if (bannerSection) bannerSection.classList.remove('hidden');
                if (countdownContainer) countdownContainer.classList.add('hidden');
            } else {
                if (bannerSection) bannerSection.classList.add('hidden');
                if (countdownContainer) countdownContainer.classList.remove('hidden');
            }
        };

        if (countdownData && countdownData.active && countdownData.endDate && new Date(countdownData.endDate).getTime() > Date.now()) {
            const endDate = new Date(countdownData.endDate).getTime();
            countdownTextEl.textContent = countdownData.text || 'Flash Sale Ends In:';
            countdownBtn.textContent = countdownData.buttonText || 'Shop Now!';
            if (countdownData.buttonLink) countdownBtn.href = countdownData.buttonLink;
            if (countdownData.background) {
                countdownContainer.style.background = `url(${countdownData.background}) center/cover`;
                countdownContainer.style.backgroundSize = 'cover';
            }
            handleBannerVisibility(false); // Hide banner, show countdown
            countdownInterval = setInterval(() => {
                const now = Date.now();
                const distance = endDate - now;
                if (distance < 0) {
                    clearInterval(countdownInterval);
                    handleBannerVisibility(true); // Show banner, hide countdown
                } else {
                    daysEl.textContent = String(Math.floor(distance / (1000 * 60 * 60 * 24))).padStart(2, '0');
                    hoursEl.textContent = String(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
                    minutesEl.textContent = String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
                    secondsEl.textContent = String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0');
                }
            }, 1000);
        } else {
            handleBannerVisibility(true); // Show banner, hide countdown
        }

        // --- Fetch and Render Banners ---
        const fetchBanners = async (path, wrap) => {
            const snap = await db.ref(path).once('value');
            const banners = [];
            snap.forEach(ch => {
                const value = ch.val();
                if (value && typeof value === 'object' && value.url) {
                    banners.push(value);
                }
            });
            if (banners.length > 0) {
                const bannersHtml = banners.map(b => `<img class="banner-slide rounded-2xl glass w-full h-32 md:h-60 object-cover" src="${b.url}" alt="banner">`).join('');
                const dotsHtml = banners.map((_, i) => `<span class="dot" data-index="${i}"></span>`).join('');
                wrap.innerHTML = `<div class="banner-slider-container">${bannersHtml}</div><div class="dots-container">${dotsHtml}</div>`;
                // Add slider logic here
                const container = wrap.querySelector('.banner-slider-container');
                const slides = container.querySelectorAll('.banner-slide');
                const dots = wrap.querySelectorAll('.dot');
                const totalSlides = slides.length;
                let currentSlide = 0;
                const updateDots = () => { dots.forEach(dot => dot.classList.remove('active')); if (dots[currentSlide]) dots[currentSlide].classList.add('active'); };
                const scrollToSlide = (index) => {
                    currentSlide = index;
                    if (slides[currentSlide]) container.scrollTo({ left: slides[currentSlide].offsetLeft, behavior: 'smooth' });
                    updateDots();
                };
                const autoSlide = () => { currentSlide = (currentSlide + 1) % totalSlides; scrollToSlide(currentSlide); };
                let intervalId = setInterval(autoSlide, 3000);
                dots.forEach(dot => {
                    dot.addEventListener('click', () => { clearInterval(intervalId); scrollToSlide(parseInt(dot.dataset.index, 10)); intervalId = setInterval(autoSlide, 3000); });
                });
                container.addEventListener('scroll', () => {
                    clearInterval(intervalId);
                    clearTimeout(container.scrollTimeout);
                    container.scrollTimeout = setTimeout(() => {
                        const newIndex = Math.round(container.scrollLeft / slides[0].offsetWidth);
                        if (currentSlide !== newIndex) { currentSlide = newIndex; updateDots(); }
                        intervalId = setInterval(autoSlide, 3000);
                    }, 100);
                });
                updateDots();
            } else {
                wrap.innerHTML = `<div class="glass rounded-2xl h-32 md:h-60 flex items-center justify-center w-full">Add banners in Admin</div>`;
            }
        };

        fetchBanners('banners/main', bannerWrap);
        fetchBanners('banners/secondary', bannerWrap2);

        // --- Fetch and Render Product Sections ---
        const allProductsSnap = await db.ref('products').once('value');
        const allProducts = [];
        allProductsSnap.forEach(ch => {
            const p = ch.val();
            if (p && p.name && p.images && p.images.length > 0) {
                allProducts.push({ id: ch.key, ...p });
            }
        });

        // 1. Hot Items (Biggest Discount)
        const discountedProducts = allProducts.filter(p => p.discount && p.price);
        let hotItems;
        if (discountedProducts.length > 0) {
            hotItems = discountedProducts
                .map(p => ({ ...p, calculatedDiscount: crossed(p.price || 0, p.discount) }))
                .sort((a, b) => (b.price - b.calculatedDiscount) - (a.price - a.calculatedDiscount))
                .slice(0, 12);
        } else {
            hotItems = allProducts.filter(p => p.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 12);
        }
        renderStaggeredProductGrid(hotItems, topRatedGrid);

        // 2. Recently Added Products
        const recentlyAdded = [];
        const recentlyAddedSnap = await db.ref('products').orderByChild('createdAt').limitToLast(12).once('value');
        recentlyAddedSnap.forEach(ch => {
            recentlyAdded.push({ id: ch.key, ...ch.val() });
        });
        recentlyAdded.reverse();
        renderStaggeredProductGrid(recentlyAdded, recentlyAddedGrid);

        // 3. Flash Sale
        const flashSaleSnap = await db.ref('flashSale').once('value');
        const flashSaleProduct = flashSaleSnap.val();
        if (flashSaleProduct && flashSaleProduct.id) {
            const pSnap = await db.ref('products/' + flashSaleProduct.id).once('value');
            const p = { id: pSnap.key, ...pSnap.val() };
            if (p && p.name) {
                flashSaleSection.innerHTML = `
                    <h2 class="section-title">Flash Sale!</h2>
                    <a href="product.html?id=${p.id}" class="glass rounded-2xl overflow-hidden relative flex flex-col md:flex-row items-center p-4">
                        <img src="${p.images?.[0]||'assets/product-placeholder.png'}" class="w-40 h-40 object-cover rounded-xl mb-4 md:mb-0 md:mr-6">
                        <div class="flex-1 text-center md:text-left space-y-2">
                            <div class="font-bold text-2xl">${p.name}</div>
                            <div class="text-xl text-yellow-300 font-bold">${fmt(p.price)}</div>
                            <p class="opacity-80">${p.short}</p>
                            <button class="btn-glow px-4 py-2 rounded-xl mt-2">Buy Now</button>
                        </div>
                    </a>
                `;
            }
        }

        // 4. Secondary Banner Slider
        const secondaryBannersSnap = await db.ref('banners/secondary').once('value');
        const secondaryBanners = [];
        secondaryBannersSnap.forEach(ch => {
            const value = ch.val();
            if (value && typeof value === 'object' && value.url) {
                secondaryBanners.push(value);
            }
        });

        if (secondaryBanners.length > 0) {
            const bannersHtml2 = secondaryBanners.map(b => `
                <img class="banner-slide rounded-2xl glass w-full h-32 md:h-60 object-cover" src="${b.url}" alt="banner">
            `).join('');

            const dotsHtml2 = secondaryBanners.map((_, i) => `<span class="dot" data-index="${i}"></span>`).join('');

            bannerWrap2.innerHTML = `
                <div class="banner-slider-container">
                    ${bannersHtml2}
                </div>
                <div class="dots-container">${dotsHtml2}</div>
            `;
        }
        
        // 5. All Products - Fixed to show highest priced first and limited to 24
        const highestPricedSnap = await db.ref('products').orderByChild('price').limitToLast(24).once('value');
        const highestPriced = [];
        highestPricedSnap.forEach(ch => {
            highestPriced.push({ id: ch.key, ...ch.val() });
        });
        highestPriced.reverse();
        renderNormalProductGrid(highestPriced, allProductsGrid);
        
        loader.classList.add('hidden');

        // Category loading logic
        const catsSnap = await db.ref('categories').once('value');
        const cats = [];
        catsSnap.forEach(ch => {
            cats.push({
                id: ch.key,
                ...ch.val()
            });
        });

        const baseCats = cats.length ? cats : [{
            name: 'Bags'
        }, {
            name: 'Cloths'
        }, {
            name: 'Watches'
        }];

        catContainer.innerHTML = baseCats.map(c => {
            const displayName = c.name || c.id;
            
            let iconHtml;
            if (c.icon && c.icon.startsWith('<')) {
                const coloredSvg = c.icon.replace(/<svg(.*?)>/, '<svg$1 fill="white">');
                iconHtml = `<img src="data:image/svg+xml;base64,${btoa(coloredSvg)}" class="h-14 w-14 object-contain home-category-icon icon-glow"/>`;
            } else if (c.icon) {
                iconHtml = `<img src="${c.icon}" class="h-14 w-14 object-contain home-category-icon icon-glow"/>`;
            } else {
                iconHtml = `<span class="text-lg font-bold">${displayName?.[0] || '?'}</span>`;
            }

            return `
                <div class="flex flex-col items-center gap-1">
                    <a href="categories.html?cat=${encodeURIComponent(displayName)}" 
                    class="glass rounded-2xl aspect-square flex items-center justify-center text-center text-sm hover:scale-105 transition">
                        ${iconHtml}
                    </a>
                </div>
            `;
        }).join('');

        // Search logic - now filters the existing allProducts array
        function doSearch(val) {
            const filteredList = allProducts.filter(p => {
                const term = (val || '').toLowerCase();
                return (p.name || '').toLowerCase().includes(term) || (p.brand || '').toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term);
            });
            renderNormalProductGrid(filteredList, allProductsGrid);
        }

        document.getElementById('search')?.addEventListener('input', e => doSearch(e.target.value));
        document.getElementById('search-m')?.addEventListener('input', e => doSearch(e.target.value));

    } catch (error) {
        console.error("An error occurred during page rendering:", error);
        document.body.innerHTML = "<h1>An error occurred. Please try again later.</h1>";
    }
});
