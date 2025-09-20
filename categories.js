// categories.js - Full Code
document.addEventListener('DOMContentLoaded', async () => {
  getCart();
  const grid = document.getElementById('catProductGrid');
  const loader = document.getElementById('catLoader');
  const sortSel = document.getElementById('sortSelect');
  const cat = new URLSearchParams(location.search).get('cat');
  const search = new URLSearchParams(location.search).get('search');
  const catHeading = document.getElementById('catHeading');

  if (search) {
      catHeading.textContent = `Search results for "${search}"`;
  } else if (cat) {
    catHeading.textContent = cat;
  }

  let all = [];

  async function fetchAll() {
    loader.classList.remove('hidden');
    const productsRef = db.ref('products');
    let snap;
    
    // Fetch all products for client-side filtering
    snap = await productsRef.once('value');
    
    const list = [];
    snap.forEach(ch => {
        const item = ch.val();
        if (item) {
            list.push({ id: ch.key, ...item });
        }
    });

    // Apply search filter if a search term exists
    if (search) {
        const searchTerm = search.toLowerCase();
        all = list.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchTerm)) || 
            (p.brand && p.brand.toLowerCase().includes(searchTerm)) || 
            (p.category && p.category.toLowerCase().includes(searchTerm))
        );
    } else if (cat) {
        all = list.filter(p => p.category === cat);
    } else {
        all = list;
    }
    
    if (all.length === 0) {
      grid.innerHTML = '<div class="col-span-full text-center py-10 opacity-70">No products found.</div>';
    }
    loader.classList.add('hidden');
  }

  function applySort() {
    const v = sortSel.value;
    const items = [...all];
    if (v === 'priceAsc') items.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (v === 'priceDesc') items.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (v === 'rating') items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (v === 'brand') items.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));

    if (typeof productCard === 'function') {
        grid.innerHTML = items.map((p, i) => {
            const classes = i % 2 !== 0 ? 'product-card-staggered' : '';
            return `<div class="${classes}">${productCard(p)}</div>`;
        }).join('');
    } else {
        console.error("The 'productCard' function is not defined. Please ensure main.js is loaded correctly.");
        grid.innerHTML = '<div class="col-span-full text-center py-10 opacity-70">Error: Could not render products.</div>';
    }
  }

  await fetchAll();
  applySort();
  sortSel.addEventListener('change', applySort);
});
