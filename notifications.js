document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Redirect to login if not authenticated
            location.href = 'login.html';
            return;
        }

        const notifListEl = document.getElementById('notifList');
        const notifRef = db.ref('notifications/' + user.uid);

        notifRef.on('value', (snapshot) => {
            const notifications = [];
            snapshot.forEach(child => {
                notifications.push({
                    id: child.key,
                    ...child.val()
                });
            });
            displayNotifications(notifications.reverse());
        });

        // Function to display notifications with color-coding and progress bar
        async function displayNotifications(notifications) {
            if (notifications.length === 0) {
                notifListEl.innerHTML = `<p class="text-center opacity-70 mt-10">You have no notifications.</p>`;
                return;
            }

            const notificationsHtmlPromises = notifications.map(async (notif) => {
                const isReadClass = notif.isRead ? 'opacity-50' : '';
                const date = notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : '';
                let colorClass;

                // These colors are suggestions. I will list them for you below.
                switch (notif.type) {
                    case 'offers':
                        colorClass = 'border-red-500'; // Offers
                        break;
                    case 'notice':
                        colorClass = 'border-yellow-500'; // Notice
                        break;
                    case 'updates':
                        colorClass = 'border-blue-500'; // Updates
                        break;
                    case 'chat':
                        colorClass = 'border-green-500'; // Chat
                        break;
                    default:
                        colorClass = 'border-gray-500'; // Default
                        break;
                }

                let progressBarHtml = '';
                if (notif.orderId) {
                    const orderSnap = await db.ref('orders/' + notif.orderId).once('value');
                    const order = orderSnap.val();
                    if (order) {
                        progressBarHtml = renderProgressBar(order.status);
                    }
                }

                return `
                    <div class="glass p-4 rounded-2xl transition border-l-4 ${colorClass} ${isReadClass}" onclick="markAsRead('${notif.id}')">
                        <div class="flex justify-between items-center mb-1">
                            <h3 class="font-bold">${notif.title || 'Notification'}</h3>
                            <span class="text-xs opacity-70">${date}</span>
                        </div>
                        <p class="text-sm opacity-80">${notif.body || ''}</p>
                        ${progressBarHtml}
                        ${notif.url ? `<a href="${notif.url}" class="text-xs underline text-yellow-400 mt-2 block">${notif.buttonText || 'View details'}</a>` : ''}
                    </div>
                `;
            });
            
            const notificationsHtml = await Promise.all(notificationsHtmlPromises);
            notifListEl.innerHTML = notificationsHtml.join('');
        }
        
        // Function to render the order status progress bar
        function renderProgressBar(status) {
            const statuses = ['pending', 'accepted', 'packing', 'shipped', 'delivered'];
            const currentStatusIndex = statuses.indexOf(status);

            const stepsHtml = statuses.map((s, index) => {
                const isActive = index <= currentStatusIndex;
                const activeColor = 'bg-yellow-400';
                const inactiveColor = 'bg-gray-700';
                const barColor = 'bg-yellow-400';
                const inactiveBarColor = 'bg-gray-700';

                return `
                    <div class="flex-1 flex flex-col items-center relative">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center ${isActive ? activeColor : inactiveColor}">
                            ${isActive ? '<i data-feather="check" class="w-4 h-4 text-white"></i>' : ''}
                        </div>
                        <div class="absolute top-3.5 left-1/2 -translate-x-1/2 w-full h-0.5 z-0 ${isActive ? barColor : inactiveBarColor}"></div>
                        <span class="text-xs mt-2 text-center opacity-80">${s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    </div>
                `;
            }).join('');

            return `<div class="flex items-center justify-between mt-4">
                ${stepsHtml}
            </div>`;
        }

        // Function to mark a notification as read
        window.markAsRead = (notifId) => {
            db.ref('notifications/' + user.uid + '/' + notifId).update({ isRead: true });
        };
    });
});