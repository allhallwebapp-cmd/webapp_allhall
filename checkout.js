// delivery: 1-2 = 350, 3-4 = 450, 5 = 550, then every +2 items add +100
function deliveryFee(count){
  if(count<=2) return 350;
  if(count<=4) return 450;
  if(count===5) return 550;
  const extra = count-5;
  return 550 + Math.ceil(extra/2)*100;
}

// Function to retrieve cart items from local storage
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch (e) {
    console.error("Failed to parse cart data from localStorage", e);
    return [];
  }
}

// Function to save cart items to local storage
function setCart(items) {
  localStorage.setItem('cart', JSON.stringify(items));
}

// Function to add an item to the cart
function addToCart(item) {
    const items = getCart();
    const existingItem = items.find(it => it.id === item.id);
    if (existingItem) {
        existingItem.qty = (existingItem.qty || 1) + (item.qty || 1);
    } else {
        items.push(item);
    }
    setCart(items);
}

// Function to send email to admin via Formspree
async function notifyAdmin(email, orderId, data){
  try{
    await fetch('https://formspree.io/f/mgvldedw',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, message: 'New order ID: '+orderId+' | '+JSON.stringify(data) })
    });
  }catch(e){ console.warn('Formspree failed', e); }
}

// Function to show a custom message box instead of alert()
function showMessage(msg) {
  const modal = document.getElementById('messageModal');
  const messageText = document.getElementById('messageText');
  const closeBtn = document.getElementById('closeModalBtn');

  if (modal && messageText) {
    messageText.textContent = msg;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    closeBtn.onclick = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    };
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const checkoutForm = document.getElementById('checkoutForm');
  const mainSubmitBtn = document.getElementById('mainSubmitBtn');
  const bankTransferSection = document.getElementById('bankTransferSection');
  const personalInfoSection = document.getElementById('personalInfoSection');
  const addressSection = document.getElementById('addressSection');
  const paymentSection = document.getElementById('paymentSection');
  const orderDetailsSection = document.getElementById('orderDetailsSection');
  const codBtn = document.getElementById('codBtn');
  const bankBtn = document.getElementById('bankBtn');
  const whatsappOrderBtn = document.getElementById('whatsappOrderBtn');
  
  let orderData = null;
  let orderId = null;
  let selectedPaymentMethod = null;
  let adminWhatsapp = null;
  const urlParams = new URLSearchParams(window.location.search);
  const existingOrderId = urlParams.get('orderId');

  const items = getCart();
  const count = items.reduce((a,b)=> a + (b.qty||1), 0);
  const subtotal = items.reduce((a,b)=> a + (b.price||0)*(b.qty||1), 0);
  const ship = deliveryFee(count);
  const total = subtotal + ship;

  // Listen for payment option changes
  [codBtn, bankBtn].forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove 'active' class from all payment buttons
        codBtn.classList.remove('active');
        bankBtn.classList.remove('active');
        
        // Add 'active' class to the clicked button
        btn.classList.add('active');
        selectedPaymentMethod = btn.dataset.payment;
        mainSubmitBtn.disabled = false;
        mainSubmitBtn.textContent = 'Place Order';
    });
  });

  // Listen for Firebase auth state changes to get the logged-in user and fetch data
  auth.onAuthStateChanged(async user => {
    // Fetch bank and admin details once when the page loads
    const siteSettingsRef = db.ref('siteSettings');
    const bankSnap = await siteSettingsRef.child('bankDetails').once('value');
    const bankDetails = bankSnap.val() || {};
    document.getElementById('bankName').textContent = bankDetails?.bankName || 'N/A';
    document.getElementById('accountNo').textContent = bankDetails?.accountNo || 'N/A';
    adminWhatsapp = bankDetails?.whatsapp;

    if(user){
      const snap = await db.ref('users/' + user.uid).once('value');
      const userData = snap.val();

      if(userData){
        document.getElementById('firstName').value = userData.first || '';
        document.getElementById('lastName').value = userData.last || '';
        document.getElementById('email').value = userData.email || user.email;
        document.getElementById('email').readOnly = true;
        document.getElementById('phone').value = userData.phone || '';
        document.getElementById('age').value = userData.age || '';
        document.getElementById('gender').value = userData.gender || '';

        if (userData.addresses) {
          const firstAddress = Object.values(userData.addresses)[0];
          if (firstAddress) {
            document.getElementById('address').value = `${firstAddress.ownerName}\n${firstAddress.addressNo}, ${firstAddress.lane}\n${firstAddress.fullAddress}, ${firstAddress.town}\n${firstAddress.district}`;
          }
        }
      }
    }
  });

  // Display initial order summary
  document.getElementById('summaryCount').textContent = String(count);
  document.getElementById('summarySubtotal').textContent = fmt(subtotal);
  document.getElementById('summaryDelivery').textContent = fmt(ship);
  document.getElementById('summaryTotal').textContent = fmt(total);

  // Function to show/hide sections based on order state
  const showSection = (sectionId) => {
    const sections = [checkoutForm, bankTransferSection];
    sections.forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
  };

  // Check for existing order ID in URL on page load
  if (existingOrderId) {
    orderId = existingOrderId;
    document.getElementById('orderId').textContent = orderId;
    document.getElementById('orderTotal').textContent = fmt(total);
    showSection('bankTransferSection');
  } else {
    showSection('checkoutForm');
  }

  // Main form submission handler
  checkoutForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    
    // Disable the button immediately to prevent multiple clicks
    mainSubmitBtn.disabled = true;
    mainSubmitBtn.textContent = 'Processing...';

    try {
        const payment = selectedPaymentMethod;
        if (!payment) {
            showMessage('Please select a payment method.');
            return;
        }
        
        // Create order data and ID only once on initial submission
        const user = auth.currentUser;
        if (!user) {
            showMessage('You must be logged in to place an order.');
            return;
        }
        const userId = user.uid;

        orderData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            phone2: document.getElementById('phone2').value.trim(),
            age: document.getElementById('age').value,
            gender: document.getElementById('gender').value,
            address: document.getElementById('address').value.trim(),
            payment, items, subtotal, ship, total, status:'pending',
            createdAt: Date.now()
        };
        orderId = makeOrderId();
        
        // Save the order to the database
        await db.ref('orders/' + orderId).set(orderData);
        await notifyAdmin(orderData.email, orderId, { total: orderData.total, payment: orderData.payment });
        
        if (payment === 'bankBtn') {
            // Redirect to the new bank transfer page
            window.location.href = `transfer.html?orderId=${orderId}&userId=${userId}`;
        } else { // COD
            showMessage('Order placed! ID: ' + orderId);
            localStorage.removeItem('cart');
            location.href = 'profile.html?tab=orders';
        }
    } catch (error) {
        console.error("Error submitting order:", error);
        showMessage("An error occurred. Please try again.");
    } finally {
        // Re-enable the button and reset text in case of an error
        mainSubmitBtn.disabled = false;
        mainSubmitBtn.textContent = 'Place Order';
    }
  });

  // Handle bank transfer specific actions
  document.getElementById('copyAccountBtn').addEventListener('click', () => {
    const accountNo = document.getElementById('accountNo').textContent;
    navigator.clipboard.writeText(accountNo);
    showMessage('Account number copied!');
  });

  document.getElementById('submitReceiptBtn').addEventListener('click', async () => {
    // Ensure an order has been created
    if (!orderId) {
      showMessage('Please place your order first.');
      return;
    }

    const receiptFile = document.getElementById('receiptFile').files[0];
    if (!receiptFile) {
        showMessage('Please upload a receipt image.');
        return;
    }

    const submitBtn = document.getElementById('submitReceiptBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
        const uploadResult = await uploadToCloudinary(receiptFile, 'allhall_receipts');
        const receiptUrl = uploadResult.secure_url;

        // Update the existing order with the receipt URL
        await db.ref('orders/' + orderId).update({
            receiptUrl: receiptUrl,
            status: 'pending'
        });

        showMessage('Receipt uploaded successfully! Your order is now pending confirmation.');
        localStorage.removeItem('cart');
        location.href = 'profile.html?tab=orders';
    } catch (error) {
        console.error('Error uploading receipt:', error);
        showMessage('An error occurred. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Receipt';
    }
  });

  document.getElementById('transferLaterBtn').addEventListener('click', async () => {
    // Ensure an order has been created
    if (!orderId) {
      showMessage('Please place your order first.');
      return;
    }
    
    // The order is already saved from the main form submission.
    // We just need to notify the user and navigate.
    showMessage('Your order details have been saved. You will be notified shortly.');
    localStorage.removeItem('cart');
    location.href = 'profile.html?tab=orders';
  });
  
  // New WhatsApp button logic
  whatsappOrderBtn.addEventListener('click', async () => {
    if (!orderId) {
        showMessage('Please place your order first.');
        return;
    }
    
    const snap = await db.ref('orders/' + orderId).once('value');
    const orderDetails = snap.val();

    if (!orderDetails) {
        showMessage('Order details not found.');
        return;
    }

    // Prepare the message content
    const orderItemsList = orderDetails.items.map(item => `\n- ${item.name} (x${item.qty})`).join('');
    const message = `*New Bank Transfer Order Received*%0A%0A*Order ID:* ${orderId}%0A*Total Amount:* ${fmt(orderDetails.total)}%0A%0A*Customer Details:*%0A_Name:_ ${orderDetails.firstName} ${orderDetails.lastName}%0A_Email:_ ${orderDetails.email}%0A_Phone:_ ${orderDetails.phone}%0A_Address:_ ${orderDetails.address}%0A%0A*Order Items:*${orderItemsList}`;

    // Create the WhatsApp URL
    const whatsappUrl = `https://wa.me/${adminWhatsapp}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, '_blank');
  });
});
