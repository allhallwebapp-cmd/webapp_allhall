// Renders the cart items on the page
function renderCart() {
    const holder = document.getElementById('cartItems');
    const items = getCart();

    // Display a message if the cart is empty
    if (items.length === 0) {
        holder.innerHTML = '<div class="glass p-4 rounded-2xl text-center">Your cart is empty.</div>';
        // Hide checkout bar if cart is empty
        const checkoutBar = document.querySelector('.sticky.bottom-0');
        if (checkoutBar) checkoutBar.classList.add('hidden');
        return;
    }

    let subtotal = 0;

    // Generate HTML for each item in the cart
    holder.innerHTML = items.map((it, i) => {
        const currentQty = it.qty || 1;
        const rowTotal = (it.price || 0) * currentQty;
        subtotal += rowTotal;
        const formattedRowTotal = typeof fmt === 'function' ? fmt(rowTotal) : rowTotal;

        return `
        <div class="glass p-3 rounded-2xl flex items-start gap-4">
          <img src="${it.image || 'assets/product-placeholder.png'}" class="h-20 w-20 rounded-xl object-cover">
          <div class="flex-1 space-y-1">
            <div class="font-semibold line-clamp-2">${it.name}</div>
            <div class="text-sm opacity-80">Price: ${typeof fmt === 'function' ? fmt(it.price) : it.price}</div>
            <div class="flex items-center justify-between mt-2">
              
              <!-- Quantity Stepper -->
              <div class="flex items-center gap-3 bg-black/20 rounded-lg p-1">
                <button 
                  class="glass w-8 h-8 rounded-md flex items-center justify-center text-yellow-400 text-xl font-bold hover:bg-yellow-400/20 transition-colors" 
                  onclick="updateQty(${i}, ${currentQty - 1})">
                  -
                </button>
                <span class="font-bold text-md w-6 text-center">${currentQty}</span>
                <button 
                  class="glass w-8 h-8 rounded-md flex items-center justify-center text-yellow-400 text-xl font-bold hover:bg-yellow-400/20 transition-colors" 
                  onclick="updateQty(${i}, ${currentQty + 1})">
                  +
                </button>
              </div>

              <span class="font-semibold text-yellow-300 text-lg">${formattedRowTotal}</span>
            </div>
          </div>
          
          <!-- Remove Item Button -->
          <button class="glass p-2 rounded-md hover:bg-red-500/20 transition-colors" onclick="removeItem(${i})">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>`;
    }).join('');

    // Update the subtotal display
    const subtotalEl = document.getElementById('cartSubtotal');
    if (subtotalEl) {
        subtotalEl.textContent = typeof fmt === 'function' ? fmt(subtotal) : subtotal + " LKR";
    }
}

// Updates the quantity of an item in the cart
function updateQty(idx, val) {
    const items = getCart();
    // Ensure quantity is at least 1
    items[idx].qty = Math.max(1, parseInt(val || '1', 10));
    setCart(items);
    renderCart(); // Re-render the cart to reflect changes
}

// Removes an item from the cart
function removeItem(idx) {
    const items = getCart();
    items.splice(idx, 1);
    setCart(items);
    renderCart(); // Re-render the cart
}

// Initial setup when the page loads
document.addEventListener('DOMContentLoaded', () => {
    getCart(); // Update nav cart count
    renderCart(); // Render cart items
});
