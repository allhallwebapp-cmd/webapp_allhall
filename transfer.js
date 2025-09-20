// Function to show a custom message box
function showMessage(msg, isSuccess = false) {
    const existingModal = document.querySelector('.feedback-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'feedback-modal fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50';
    
    // Updated styling to match the website's theme
    const bgColor = isSuccess ? 'bg-green-500' : 'bg-yellow-400';
    const textColor = isSuccess ? 'text-white' : 'text-black';

    modal.innerHTML = `
        <div class="glass text-white rounded-2xl p-6 shadow-xl max-w-sm w-full transform transition-transform duration-300 scale-95 opacity-0 animate-fade-in-up">
            <p class="text-center mb-4">${msg}</p>
            <button class="${bgColor} ${textColor} font-bold w-full py-2 rounded-lg hover:opacity-90 transition-opacity">Close</button>
        </div>
        <style>
            @keyframes fade-in-up {
                from { transform: scale(0.95) translateY(10px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            .animate-fade-in-up {
                animation: fade-in-up 0.3s ease-out forwards;
            }
        </style>
    `;
    document.body.appendChild(modal);
    modal.querySelector('button').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

// Function to format currency
function fmt(num) {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2
    }).format(num);
}

document.addEventListener('DOMContentLoaded', async () => {
    // The Firebase app is initialized by the canvas environment.
    const db = firebase.database();

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const userId = urlParams.get('userId');

    if (!orderId || !userId) {
        showMessage('Order or user details missing from URL. Cannot proceed.');
        return;
    }

    document.getElementById('orderId').textContent = orderId;

    try {
        const [bankSnap, whatsappSnap, orderSnap, userSnap] = await Promise.all([
            db.ref('siteSettings/bankDetails').once('value'),
            db.ref('siteSettings/whatsapp').once('value'),
            db.ref('orders/' + orderId).once('value'),
            db.ref('users/' + userId).once('value')
        ]);
        
        const bankDetails = bankSnap.val() || {};
        const orderDetails = orderSnap.val() || {};
        const userDetails = userSnap.val() || {};
        const rawAdminWhatsapp = whatsappSnap.val();

        if (!orderDetails.total || !bankDetails.bankName) {
            showMessage('Could not find complete order or bank details.');
            return;
        }

        // Display bank and order details
        document.getElementById('bankName').textContent = bankDetails.bankName;
        document.getElementById('accountNo').textContent = bankDetails.accountNo;
        document.getElementById('accountOwner').textContent = bankDetails.accountOwner;
        document.getElementById('totalAmount').textContent = fmt(orderDetails.total);

        // Copy button logic
        document.getElementById('copyBtn').addEventListener('click', () => {
            const accountNo = document.getElementById('accountNo').textContent;
            navigator.clipboard.writeText(accountNo).then(() => {
                showMessage('Account number copied!', true);
            });
        });

        // WhatsApp button logic
        document.getElementById('whatsappBtn').addEventListener('click', () => {
            if (!rawAdminWhatsapp) {
                showMessage('Admin WhatsApp number is not configured in the database.');
                return;
            }
            
            const adminWhatsapp = String(rawAdminWhatsapp).replace(/\D/g, '');

            const itemsList = orderDetails.items 
                ? orderDetails.items.map(item => `- ${item.name} (x${item.qty})`).join('\n') 
                : 'No items found.';

            const message = `*New Bank Transfer Order Received*\n\n*Order ID:* ${orderId}\n*Total Amount:* ${fmt(orderDetails.total)}\n\n*Customer Details:*\n_Name:_ ${userDetails.first || 'N/A'} ${userDetails.last || 'N/A'}\n_Email:_ ${userDetails.email || 'N/A'}\n_Phone:_ ${userDetails.phone || 'N/A'}\n_Address:_ ${userDetails.address || 'N/A'}\n\n*Order Items:*\n${itemsList}`;

            const whatsappUrl = `https://wa.me/${adminWhatsapp}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        });

    } catch (error) {
        console.error("Error fetching data:", error);
        showMessage("Failed to load details. Please check your connection and try again.");
    }
});