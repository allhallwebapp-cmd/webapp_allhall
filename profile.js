document.addEventListener('DOMContentLoaded', async () => {
    // Listen for Firebase auth state changes to ensure the user object is ready
    auth.onAuthStateChanged(async user => {
        const content = document.getElementById('tabContent');
        const userNameEl = document.getElementById('userName');
        const userEmailEl = document.getElementById('userEmail');
        const avatar = document.getElementById('avatar');
        const avatarInput = document.getElementById('avatarInput');

        if (!user) {
            // If no user is logged in, redirect to the registration page
            location.href = 'register.html';
            return;
        }

        // Fetch user data from the database
        db.ref('users/' + user.uid).once('value').then(snap => {
            const userData = snap.val();
            if (userData) {
                // Display "Hello [First Name]"
                userNameEl.textContent = `Hello, ${userData.first}!`;
            }
        });

        userEmailEl.textContent = user.email;

        // Load user's custom avatar from database
        db.ref('users/' + user.uid + '/avatar').once('value').then(snap => {
            if (snap.exists()) {
                avatar.src = snap.val();
            }
        });

        // Event listener for tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;

            if (tab === 'info') {
                loadPersonalInfo(user);
            } else if (tab === 'orders') {
                loadOrders(user);
            } else if (tab === 'wishlist') {
                loadWishlist(user);
            } else if (tab === 'settings') {
                loadSettings(user);
            }
        }));

        // Check for a specific URL parameter to open the settings tab
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'settings') {
            document.querySelector('.tab-btn[data-tab="settings"]').click();
        } else {
            document.querySelector('.tab-btn[data-tab="info"]').click();
        }

        // Handle avatar file input
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const res = await uploadToCloudinary(file, 'shop_unsigned');
            avatar.src = res.secure_url;

            if (user) {
                await db.ref('users/' + user.uid + '/avatar').set(res.secure_url);
            }
        });

        // --- Functions for each tab ---

        async function loadPersonalInfo(user) {
            const userDataSnap = await db.ref('users/' + user.uid).once('value');
            const userData = userDataSnap.val();

            // Display personal info
            let infoHtml = `
                <div class="glass p-4 rounded-2xl">
                    <h3 class="font-semibold text-lg mb-4">Personal Information</h3>
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <span class="text-sm opacity-80 w-24">Full Name:</span>
                            <span class="font-semibold">${(userData.first || '')} ${(userData.last || '')}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm opacity-80 w-24">Phone:</span>
                            <span class="font-semibold">${userData.phone || 'Not set'}</span>
                        </div>
                    </div>
                </div>
            `;

            // Fetch and display addresses
            const addressesSnap = await db.ref('users/' + user.uid + '/addresses').once('value');
            const addresses = [];
            addressesSnap.forEach(ch => addresses.push(ch.val()));

            if (addresses.length === 0) {
                infoHtml += `
                    <div class="glass p-4 rounded-2xl mt-4">
                        <h3 class="font-semibold text-lg mb-4">Addresses</h3>
                        <div class="text-center">
                            <div class="opacity-80">No addresses added yet.</div>
                            <a href="profile.html?tab=settings" class="btn-glow px-4 py-2 rounded-xl mt-4">Add Address</a>
                        </div>
                    </div>
                `;
            } else {
                infoHtml += `
                    <div class="glass p-4 rounded-2xl mt-4">
                        <h3 class="font-semibold text-lg mb-4">Addresses</h3>
                        ${addresses.map(addr => `
                            <div class="p-3 border-b border-white/10 last:border-0">
                                <div class="font-semibold">${addr.ownerName}</div>
                                <div class="text-sm opacity-80">${addr.addressNo}, ${addr.lane}</div>
                                <div class="text-sm opacity-80">${addr.fullAddress}, ${addr.town}</div>
                                <div class="text-sm opacity-80">${addr.district}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            content.innerHTML = infoHtml;
        }

        async function loadSettings(user) {
            // Edit Profile Form
            content.innerHTML = `
                <div class="glass p-4 rounded-2xl">
                    <h3 class="font-semibold text-lg mb-4">Edit Personal Information</h3>
                    <form id="editInfoForm" class="space-y-4">
                        <div>
                            <label for="firstName" class="block text-sm opacity-80 mb-1">First Name</label>
                            <input type="text" id="firstName" class="glass w-full px-3 py-2 rounded-xl" placeholder="First Name">
                        </div>
                        <div>
                            <label for="lastName" class="block text-sm opacity-80 mb-1">Last Name</label>
                            <input type="text" id="lastName" class="glass w-full px-3 py-2 rounded-xl" placeholder="Last Name">
                        </div>
                        <div>
                            <label for="phoneNumber" class="block text-sm opacity-80 mb-1">Phone Number</label>
                            <input type="tel" id="phoneNumber" class="glass w-full px-3 py-2 rounded-xl" placeholder="Enter your phone number">
                        </div>
                        <button type="submit" class="btn-glow px-4 py-2 rounded-xl">Save Changes</button>
                    </form>
                </div>
                <div class="glass p-4 rounded-2xl mt-4">
                    <h3 class="font-semibold text-lg mb-4">Add New Address</h3>
                    <form id="addAddressForm" class="space-y-4">
                        <div>
                            <label for="ownerName" class="block text-sm opacity-80 mb-1">Name of Owner</label>
                            <input type="text" id="ownerName" class="glass w-full px-3 py-2 rounded-xl" placeholder="Name of owner">
                        </div>
                        <div>
                            <label for="addressNo" class="block text-sm opacity-80 mb-1">No.</label>
                            <input type="text" id="addressNo" class="glass w-full px-3 py-2 rounded-xl" placeholder="House number">
                        </div>
                        <div>
                            <label for="lane" class="block text-sm opacity-80 mb-1">Lane</label>
                            <input type="text" id="lane" class="glass w-full px-3 py-2 rounded-xl" placeholder="Street/Lane name">
                        </div>
                        <div>
                            <label for="fullAddress" class="block text-sm opacity-80 mb-1">Full Address</label>
                            <textarea id="fullAddress" class="glass w-full px-3 py-2 rounded-xl" rows="3" placeholder="Full address"></textarea>
                        </div>
                        <div>
                            <label for="town" class="block text-sm opacity-80 mb-1">Town</label>
                            <input type="text" id="town" class="glass w-full px-3 py-2 rounded-xl" placeholder="Town/City">
                        </div>
                        <div>
                            <label for="district" class="block text-sm opacity-80 mb-1">District</label>
                            <input type="text" id="district" class="glass w-full px-3 py-2 rounded-xl" placeholder="District">
                        </div>
                        <button type="submit" class="btn-glow px-4 py-2 rounded-xl">Save Address</button>
                    </form>
                </div>
                <div class="glass p-4 rounded-2xl mt-4 text-center">
                    <button id="logoutBtn" class="btn-glow px-4 py-2 rounded-xl">Logout</button>
                </div>
            `;
            
            // Load existing personal info for the form
            const userDataSnap = await db.ref('users/' + user.uid).once('value');
            const userData = userDataSnap.val();
            if (userData) {
                document.getElementById('firstName').value = userData.first || '';
                document.getElementById('lastName').value = userData.last || '';
                document.getElementById('phoneNumber').value = userData.phone || '';
            }

            // Handle Edit Personal Info Form submission
            document.getElementById('editInfoForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const updates = {
                    first: document.getElementById('firstName').value,
                    last: document.getElementById('lastName').value,
                    phone: document.getElementById('phoneNumber').value
                };
                await db.ref('users/' + user.uid).update(updates);
                alert('Personal info updated successfully!');
            });

            // Handle Add New Address Form submission
            document.getElementById('addAddressForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const newAddress = {
                    ownerName: document.getElementById('ownerName').value,
                    addressNo: document.getElementById('addressNo').value,
                    lane: document.getElementById('lane').value,
                    fullAddress: document.getElementById('fullAddress').value,
                    town: document.getElementById('town').value,
                    district: document.getElementById('district').value,
                };
                // Push the new address to the 'addresses' node under the user's UID
                await db.ref('users/' + user.uid + '/addresses').push(newAddress);
                alert('Address added successfully!');
                // Clear the form after submission
                document.getElementById('addAddressForm').reset();
            });

            // Handle logout button click
            document.getElementById('logoutBtn').onclick = () => auth.signOut().then(() => location.href = 'index.html');
        }
        
        async function loadOrders(user) {
            if (!user) {
                content.innerHTML = '<div class="glass p-4 rounded-2xl">Login to view orders.</div>';
                return;
            }

            // Fetch all orders from the 'orders' node
            const snap = await db.ref('orders').once('value');
            
            // Convert the Firebase snapshot to a list of orders
            const list = [];
            snap.forEach(ch => {
                const order = ch.val();
                if (order) {
                    list.push({
                        id: ch.key,
                        ...order
                    });
                }
            });

            // Filter the list to find only the orders matching the user's email
            const userOrders = list.filter(order => order.email && order.email.toLowerCase().trim() === user.email.toLowerCase().trim());

            if (userOrders.length === 0) {
                content.innerHTML = '<div class="glass p-3 rounded-2xl">No orders yet.</div>';
                return;
            }

            // Map the filtered list to HTML
            content.innerHTML = userOrders.map(o => {
                const orderDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A';
                return `<div class="glass p-3 rounded-2xl space-y-1">
                    <div class="flex items-center justify-between">
                        <div>Order <span class="badge">#${o.id}</span></div>
                        <div class="badge">${o.status}</div>
                    </div>
                    ${renderProgressBar(o.status)}
                    <div class="text-sm opacity-80">Date: ${orderDate} • Total: ${fmt(o.total || 0)}</div>
                    <button class="glass px-3 py-1 rounded-xl mt-2" onclick='showOrderItems(${JSON.stringify(o.items || [])})'>View Items</button>
                </div>`;
            }).join('');
        }
        
        // New function to show order items in a pop-up
        window.showOrderItems = function(items) {
            const itemsHtml = items.map(item => {
                const variantText = item.variant
                    ? `Color: ${item.variant.color || 'N/A'}, Size: ${item.variant.size || 'N/A'}`
                    : '';

                return `
                    <div class="flex items-center gap-3 p-2 bg-gray-800 rounded">
                        <img src="${item.image || 'assets/product-placeholder.png'}" class="w-12 h-12 object-cover rounded"/>
                        <div class="flex-1">
                            <div class="font-semibold">${item.name || 'Unnamed Product'}</div>
                            <div class="text-sm opacity-80">${variantText}</div>
                        </div>
                        <div class="text-right">
                           <div class="font-semibold">${item.qty || 0} x ${fmt(item.price || 0)}</div>
                           <a href="product.html?id=${item.id}&review=true" class="text-yellow-400 text-sm underline mt-1">Add Review</a>
                        </div>
                    </div>
                `;
            }).join('');

            const modalHtml = `
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div class="glass p-6 rounded-2xl w-full max-w-md space-y-4">
                        <div class="flex justify-between items-center">
                            <h3 class="text-xl font-bold">Order Items</h3>
                            <button onclick="this.closest('.fixed').remove()" class="text-white opacity-70 hover:opacity-100">&times;</button>
                        </div>
                        <div class="max-h-96 overflow-y-auto space-y-2">
                            ${itemsHtml || '<p class="opacity-70 text-center">No items found for this order.</p>'}
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        };

        async function loadWishlist(user) {
            if (!user) {
                content.innerHTML = '<div class="glass p-3 rounded-2xl">Please log in to view your wishlist.</div>';
                return;
            }

            const wishlistIds = Object.keys(await getWishlist() || {});
            
            if (wishlistIds.length === 0) {
                content.innerHTML = '<div class="glass p-3 rounded-2xl">Your wishlist is empty.</div>';
                return;
            }

            const productPromises = wishlistIds.map(id => db.ref('products/' + id).once('value'));
            const productSnaps = await Promise.all(productPromises);
            const products = productSnaps.map(snap => ({ id: snap.key, ...snap.val() }));

            content.innerHTML = `<div class="grid md:grid-cols-3 gap-4">
                ${products.map(p => `
                    <div class="glass p-3 rounded-2xl space-y-2">
                        <img src="${p.images?.[0]||'assets/product-placeholder.png'}" class="w-full h-40 object-cover rounded-xl">
                        <div class="font-semibold">${p.name||''}</div>
                        <div class="text-yellow-300">${fmt(p.price||0)}</div>
                        <div class="flex gap-2">
                            <button class="btn-glow px-3 py-1 rounded-xl" onclick='addToCart({id:"${p.id}", name:"${p.name}", price:${p.price}, image:"${p.images?.[0]||''}", qty:1, variant:null})'>Add to Cart</button>
                            <button class="glass px-3 py-1 rounded-xl" onclick='removeFromWishlist("${p.id}")'>Remove</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }
        
        // New function to render the order status progress bar
        function renderProgressBar(status) {
            const statuses = ['pending', 'accepted', 'packing', 'shipped', 'delivered'];
            const currentStatusIndex = statuses.indexOf(status);

            const stepsHtml = statuses.map((s, index) => {
                const isActive = index <= currentStatusIndex;
                const isFinal = index === statuses.length - 1;
                const activeColor = 'bg-yellow-400';
                const inactiveColor = 'bg-gray-700';

                return `
                    <div class="flex-1 flex flex-col items-center relative">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center ${isActive ? activeColor : inactiveColor}">
                            ${isActive ? '<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
                        </div>
                        ${!isFinal ? `<div class="absolute top-3.5 left-1/2 -translate-x-1/2 w-full h-0.5 ${isActive ? activeColor : inactiveColor}"></div>` : ''}
                        <span class="text-xs mt-2 text-center opacity-80">${s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    </div>
                `;
            }).join('');

            return `<div class="flex items-center justify-between mt-4">
                ${stepsHtml}
            </div>`;
        }

        getCart();
    });
});