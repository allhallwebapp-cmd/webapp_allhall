document.addEventListener('DOMContentLoaded', async () => {
    // Shared functions for formatting and utility
    function fmt(val) {
        return `LKR ${val.toLocaleString()}`;
    }

    function uploadToCloudinary(file, folder) {
        return new Promise((resolve, reject) => {
            const CLOUD_NAME = "dzubrnb9y"; 
            const UPLOAD_PRESET = "contactusallhall";

            if (!CLOUD_NAME || !UPLOAD_PRESET) {
                console.error("Cloudinary credentials are not set.");
                reject(new Error("Cloudinary credentials are not configured."));
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', folder);

            const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

            fetch(url, {
                method: 'POST',
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                if (data.secure_url) {
                    resolve(data);
                } else {
                    reject(new Error('Cloudinary upload failed.'));
                }
            })
            .catch(error => {
                console.error('Error uploading to Cloudinary:', error);
                reject(error);
            });
        });
    }

    const isUserPage = document.getElementById('chat-messages');
    const isAdminPage = document.getElementById('admin-chat-messages');

    if (isUserPage) {
        // User-side chat logic
        const chatMessages = document.getElementById('chat-messages');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const imageUpload = document.getElementById('image-upload');
        const orderButton = document.getElementById('order-button');
        const orderModal = document.getElementById('order-modal');
        const ordersList = document.getElementById('orders-list');
        const adminAvatar = document.getElementById('admin-avatar');
        const adminNickname = document.getElementById('admin-nickname');

        let user;
        let assignedAdminId;
        let chatRef;

        auth.onAuthStateChanged(async (u) => {
            if (!u) {
                chatMessages.innerHTML = `<p class="text-center opacity-70">Please log in to chat with an admin.</p>`;
                messageInput.disabled = true;
                sendButton.disabled = true;
                return;
            }
            user = u;

            const userChatSnap = await db.ref(`userChats/${user.uid}`).once('value');
            const chatData = userChatSnap.val();
            assignedAdminId = chatData?.adminId;

            if (!assignedAdminId) {
                const adminsSnap = await db.ref('roles/contactAdmins').once('value');
                const adminIds = Object.keys(adminsSnap.val() || {});
                
                if (adminIds.length > 0) {
                    const chatCounts = await Promise.all(adminIds.map(async id => {
                        const countSnap = await db.ref(`chatCounts/${id}`).once('value');
                        return { id, count: countSnap.val() || 0 };
                    }));

                    chatCounts.sort((a, b) => a.count - b.count);
                    assignedAdminId = chatCounts[0].id;
                    
                    const userProfileSnap = await db.ref(`users/${user.uid}`).once('value');
                    const userRole = userProfileSnap.val()?.role || 'user';
                    
                    await db.ref(`userChats/${user.uid}`).set({ adminId: assignedAdminId, role: userRole });
                    await db.ref(`chatCounts/${assignedAdminId}`).transaction(current => (current || 0) + 1);
                }
            }

            if (assignedAdminId) {
                chatRef = db.ref(`chats/${assignedAdminId}/${user.uid}`);
                const adminProfileSnap = await db.ref(`contactAdmins/${assignedAdminId}/profile`).once('value');
                const adminData = adminProfileSnap.val() || { nickname: 'Admin Support', avatar: 'https://via.placeholder.com/60' };
                adminNickname.textContent = adminData.nickname;
                adminAvatar.src = adminData.avatar;
                
                chatRef.on('value', (snapshot) => {
                    const messages = snapshot.val() || {};
                    chatMessages.innerHTML = '';
                    Object.values(messages).forEach(msg => {
                        renderMessage(msg, chatMessages);
                    });
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                });
            } else {
                chatMessages.innerHTML = `<p class="text-center opacity-70">No admins are currently available to chat. Please try again later.</p>`;
            }

            sendButton.addEventListener('click', async () => {
                const messageText = messageInput.value.trim();
                if (messageText && assignedAdminId) {
                    const userProfileSnap = await db.ref(`users/${user.uid}`).once('value');
                    const userRole = userProfileSnap.val()?.role || 'user';
                    await sendMessage(user.uid, assignedAdminId, messageText, 'user', userRole);
                    messageInput.value = '';
                }
            });

            imageUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && assignedAdminId) {
                    alert('Uploading image...');
                    const uploadRes = await uploadToCloudinary(file, 'chat_images');
                    if (uploadRes && uploadRes.secure_url) {
                        const userProfileSnap = await db.ref(`users/${user.uid}`).once('value');
                        const userRole = userProfileSnap.val()?.role || 'user';
                        await sendMessage(user.uid, assignedAdminId, null, 'user', userRole, uploadRes.secure_url);
                    }
                }
            });

            orderButton.addEventListener('click', async () => {
                orderModal.classList.remove('hidden');
                const ordersSnap = await db.ref('orders').orderByChild('uid').equalTo(user.uid).once('value');
                const userOrders = [];
                ordersSnap.forEach(ch => userOrders.push({ id: ch.key, ...ch.val() }));
                
                if (userOrders.length > 0) {
                    ordersList.innerHTML = userOrders.map(order => `
                        <button class="glass w-full p-2 rounded-xl text-left" data-order-id="${order.id}">
                            Order #${order.id} - ${fmt(order.total || 0)}
                        </button>
                    `).join('');
                } else {
                    ordersList.innerHTML = `<p class="opacity-70 text-center">No past orders found.</p>`;
                }
            });

            ordersList.addEventListener('click', async (e) => {
                const orderBtn = e.target.closest('button');
                if (orderBtn && orderBtn.dataset.orderId && assignedAdminId) {
                    const orderId = orderBtn.dataset.orderId;
                    const orderSnap = await db.ref('orders/' + orderId).once('value');
                    const orderData = orderSnap.val();
                    const messageText = `Regarding my order #${orderId}:\nTotal: ${fmt(orderData.total)}\nStatus: ${orderData.status}`;
                    const userProfileSnap = await db.ref(`users/${user.uid}`).once('value');
                    const userRole = userProfileSnap.val()?.role || 'user';
                    await sendMessage(user.uid, assignedAdminId, messageText, 'user', userRole);
                    orderModal.classList.add('hidden');
                }
            });
        });

    } else if (isAdminPage) {
        const userListEl = document.getElementById('user-list');
        const chatHeader = document.getElementById('chat-header');
        const chatMessagesEl = document.getElementById('admin-chat-messages');
        const chatPlaceholder = document.getElementById('chat-placeholder');
        const messageInput = document.getElementById('admin-message-input');
        const sendButton = document.getElementById('admin-send-button');
        const imageUpload = document.getElementById('admin-image-upload');
        const settingsButton = document.getElementById('settings-button');
        const makeGroupBtn = document.getElementById('make-group-btn');
        const contactAdminBtn = document.getElementById('contact-admin-btn');
        const chatSearch = document.getElementById('chat-search');

        let cadminUser;
        let selectedUser;
        let selectedGroup;
        let chatRef;
        let activeChats = [];

        auth.onAuthStateChanged(async (u) => {
            if (!u) {
                location.href = 'login.html';
                return;
            }
            cadminUser = u;
            const isAdminSnap = await db.ref(`roles/contactAdmins/${cadminUser.uid}`).once('value');
            if (!isAdminSnap.exists()) {
                alert('You do not have access to this page.');
                location.href = 'index.html';
                return;
            }
            
            db.ref(`userChats`).orderByChild('adminId').equalTo(cadminUser.uid).on('value', async snapshot => {
                const userChats = snapshot.val() || {};
                
                const userPromises = Object.keys(userChats).map(async uid => {
                    const userProfileSnap = await db.ref(`users/${uid}`).once('value');
                    const userProfile = userProfileSnap.val() || { first: 'User', last: 'Unknown' };
                    const lastMessageSnap = await db.ref(`chats/${cadminUser.uid}/${uid}`).limitToLast(1).once('value');
                    const lastMessage = lastMessageSnap.val() ? Object.values(lastMessageSnap.val())[0] : null;
                    const unreadSnap = await db.ref(`unreadCounts/${uid}/${cadminUser.uid}`).once('value');
                    const unreadCount = unreadSnap.val() || 0;
                    return { uid, email: userProfile.email, name: `${userProfile.first} ${userProfile.last}`, unreadCount, lastMessage, role: userProfile.role };
                });
                
                const groupsSnap = await db.ref('groups').once('value');
                const groups = [];
                groupsSnap.forEach(ch => {
                    const group = { id: ch.key, ...ch.val() };
                    if (group.members.includes(cadminUser.uid)) {
                        groups.push(group);
                    }
                });
                
                const groupPromises = groups.map(async group => {
                    const lastMessageSnap = await db.ref(`groupChats/${group.id}`).limitToLast(1).once('value');
                    const lastMessage = lastMessageSnap.val() ? Object.values(lastMessageSnap.val())[0] : null;
                    const unreadSnap = await db.ref(`unreadCounts/${group.id}/${cadminUser.uid}`).once('value');
                    const unreadCount = unreadSnap.val() || 0;
                    return { ...group, isGroup: true, lastMessage, unreadCount };
                });
                
                const allChats = [...await Promise.all(userPromises), ...await Promise.all(groupPromises)];
                allChats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
                
                activeChats = allChats;
                renderUserList(allChats);
            });

            const renderUserList = (chats) => {
                const query = chatSearch.value.toLowerCase();
                const filteredChats = chats.filter(chat =>
                    (chat.name && chat.name.toLowerCase().includes(query)) || (chat.email && chat.email.toLowerCase().includes(query))
                );

                if (filteredChats.length > 0) {
                    userListEl.innerHTML = filteredChats.map(chat => `
                        <button class="glass p-3 rounded-xl w-full text-left flex items-center justify-between" data-chat-id="${chat.isGroup ? 'group:' + chat.id : chat.uid}">
                            <div>
                                <div class="font-semibold flex items-center gap-2">
                                    ${chat.isGroup ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05c1.89.86 3.16 2.37 3.16 4.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>` : ''}
                                    ${chat.isGroup ? chat.name : chat.name}
                                </div>
                                <div class="text-sm opacity-60 flex items-center gap-2">
                                    ${chat.isGroup ? 'Group Chat' : chat.email}
                                    ${!chat.isGroup ? `<span class="badge ${chat.role === 'seller' ? 'bg-yellow-500/20' : 'bg-gray-500/20'}">${chat.role || 'user'}</span>` : ''}
                                </div>
                            </div>
                            ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
                        </button>
                    `).join('');
                } else {
                    userListEl.innerHTML = `<p class="opacity-70 text-center">No active chats.</p>`;
                }
            };

            chatSearch.addEventListener('input', () => renderUserList(activeChats));

            userListEl.addEventListener('click', async (e) => {
                const chatBtn = e.target.closest('button');
                if (chatBtn) {
                    const chatId = chatBtn.dataset.chatId;
                    const isGroupChat = chatId.startsWith('group:');
                    let chatUid = chatId.replace('group:', '');
                    
                    selectedUser = null;
                    selectedGroup = null;

                    if (isGroupChat) {
                        const groupSnap = await db.ref(`groups/${chatUid}`).once('value');
                        selectedGroup = groupSnap.val();
                        selectedGroup.id = chatUid;
                        
                        document.getElementById('chat-user-name').textContent = selectedGroup.name;
                        document.getElementById('chat-user-email').textContent = 'Group Chat';
                        document.getElementById('chat-user-avatar').src = 'https://via.placeholder.com/60';
                        settingsButton.classList.add('hidden');
                        
                        chatRef = db.ref(`groupChats/${chatUid}`);
                        chatRef.on('value', snapshot => {
                            const messages = snapshot.val() || {};
                            chatMessagesEl.innerHTML = '';
                            Object.values(messages).forEach(msg => {
                                renderMessage(msg, chatMessagesEl, true);
                            });
                            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
                        });
                        
                        await db.ref(`unreadCounts/${chatUid}/${cadminUser.uid}`).set(0);

                    } else {
                        const userSnap = await db.ref(`users/${chatUid}`).once('value');
                        selectedUser = userSnap.val();
                        selectedUser.uid = chatUid;
                        
                        document.getElementById('chat-user-name').textContent = `${selectedUser.first} ${selectedUser.last}`;
                        document.getElementById('chat-user-email').textContent = selectedUser.email;
                        document.getElementById('chat-user-avatar').src = selectedUser.avatar || 'https://via.placeholder.com/60';
                        settingsButton.classList.remove('hidden');

                        chatRef = db.ref(`chats/${cadminUser.uid}/${chatUid}`);
                        chatRef.on('value', snapshot => {
                            const messages = snapshot.val() || {};
                            chatMessagesEl.innerHTML = '';
                            Object.values(messages).forEach(msg => {
                                renderMessage(msg, chatMessagesEl);
                            });
                            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
                        });
                        
                        await db.ref(`unreadCounts/${chatUid}/${cadminUser.uid}`).set(0);
                    }
                    
                    chatHeader.classList.remove('hidden');
                    chatPlaceholder.classList.add('hidden');
                    chatMessagesEl.classList.remove('hidden');
                    document.getElementById('admin-chat-input').classList.remove('hidden');
                }
            });

            sendButton.addEventListener('click', async () => {
                const messageText = messageInput.value.trim();
                if (messageText && (selectedUser || selectedGroup)) {
                    if (selectedUser) {
                        await sendMessage(selectedUser.uid, cadminUser.uid, messageText, 'admin', cadminUser.role);
                    } else if (selectedGroup) {
                        await sendGroupMessage(selectedGroup, cadminUser.uid, messageText, 'admin', cadminUser.role);
                    }
                    messageInput.value = '';
                }
            });

            imageUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && (selectedUser || selectedGroup)) {
                    alert('Uploading image...');
                    const uploadRes = await uploadToCloudinary(file, 'chat_images');
                    if (uploadRes && uploadRes.secure_url) {
                        if (selectedUser) {
                            await sendMessage(selectedUser.uid, cadminUser.uid, null, 'admin', cadminUser.role, uploadRes.secure_url);
                        } else if (selectedGroup) {
                            await sendGroupMessage(selectedGroup, cadminUser.uid, null, 'admin', cadminUser.role, uploadRes.secure_url);
                        }
                    }
                }
            });

            settingsButton.addEventListener('click', () => showAdminSettings(cadminUser));
            
            makeGroupBtn.addEventListener('click', () => showGroupModal(cadminUser));
            contactAdminBtn.addEventListener('click', () => contactMainAdmin(cadminUser));
        });
    }

    async function renderMessage(msg, container, isGroup = false) {
        let senderRole;
        let senderName;
        let messageClass = 'chat-message-user'; // Default class
        let nameHtml = '';
        
        if (msg.senderId) {
            const userSnap = await db.ref(`users/${msg.senderId}`).once('value');
            const userProfile = userSnap.val() || { first: 'User', last: 'Unknown' };
            senderRole = userProfile.role || 'user';
            senderName = userProfile.first || 'User';

            if (msg.sender === 'admin') {
                messageClass = 'chat-message-admin';
                if (senderRole === 'admin') {
                    messageClass += ' glow-gold';
                    senderName += ' Admin';
                } else if (senderRole === 'seller') {
                    senderName += ' Seller';
                } else {
                    senderName = msg.senderRole === 'admin' ? 'Normal Admin' : 'Cadmin'; // Cadmin sending to user
                }
            }
        }
        
        if (msg.sender === 'admin') {
            if (msg.senderRole === 'admin') {
                messageClass = 'chat-message-admin glow-gold';
            } else {
                messageClass = 'chat-message-admin';
            }
        } else {
            messageClass = 'chat-message-user';
        }

        if (isGroup) {
            const senderProfile = (await db.ref(`users/${msg.senderId}`).once('value')).val() || { first: 'Unknown', last: 'User' };
            const displayName = msg.sender === 'admin' ? senderProfile.first + ' Admin' : senderProfile.first;
            nameHtml = `<div class="font-bold text-sm ${msg.senderRole === 'admin' ? 'text-yellow-400' : 'text-white/80'}">${displayName}</div>`;
        }

        const imageHtml = msg.image ? `<img src="${msg.image}" class="max-w-xs rounded-xl mt-2"/>` : '';
        
        container.innerHTML += `
            <div class="p-3 rounded-2xl max-w-[70%] ${messageClass}">
                ${isGroup ? nameHtml : ''}
                <div class="text-sm">${msg.text || ''}</div>
                ${imageHtml}
                <div class="text-xs opacity-50 mt-1">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
        `;
    }

    async function sendMessage(toUid, fromUid, text, sender, senderRole = 'user', image = null) {
        const fromProfileSnap = await db.ref(`users/${fromUid}`).once('value');
        const fromProfile = fromProfileSnap.val() || { first: 'User' };
        
        const chatRef = db.ref(`chats/${fromUid}/${toUid}`).push();
        await chatRef.set({
            text: text,
            sender: sender,
            senderId: fromUid,
            senderRole: senderRole,
            senderName: fromProfile.first,
            image: image,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        if (sender === 'admin') {
            const notifData = {
                type: 'chat',
                title: 'New Message from Admin',
                body: text || 'You have a new image from the admin.',
                url: 'contact.html',
                buttonText: 'Reply Now',
                isRead: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            await db.ref(`notifications/${toUid}`).push(notifData);
        } else {
            await db.ref(`unreadCounts/${fromUid}/${toUid}`).transaction(current => (current || 0) + 1);
        }
    }
    
    async function sendGroupMessage(group, fromUid, text, sender, senderRole, image = null) {
        const fromProfileSnap = await db.ref(`users/${fromUid}`).once('value');
        const fromProfile = fromProfileSnap.val() || { first: 'User' };
        
        const groupChatRef = db.ref(`groupChats/${group.id}`).push();
        const payload = {
            text,
            sender,
            senderId: fromUid,
            senderRole,
            senderName: fromProfile.first,
            image,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        await groupChatRef.set(payload);

        group.members.forEach(async memberId => {
            if (memberId !== fromUid) {
                 const notifData = {
                    type: 'chat',
                    title: `New Group Message in ${group.name}`,
                    body: text || 'You have a new image in the group chat.',
                    url: 'contact.html',
                    buttonText: 'Reply Now',
                    isRead: false,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };
                await db.ref(`notifications/${memberId}`).push(notifData);
                await db.ref(`unreadCounts/${group.id}/${memberId}`).transaction(current => (current || 0) + 1);
            }
        });
    }


    async function showAdminSettings(cadminUser) {
        const adminProfileSnap = await db.ref(`contactAdmins/${cadminUser.uid}/profile`).once('value');
        const profileData = adminProfileSnap.val() || { nickname: '', avatar: '' };

        const modalHtml = `
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div class="glass p-6 rounded-2xl w-full max-w-md space-y-4">
                    <h3 class="text-xl font-bold">Admin Settings</h3>
                    <form id="admin-settings-form" class="space-y-4">
                        <div>
                            <label class="opacity-80">Nickname</label>
                            <input type="text" id="admin-nickname-input" class="input w-full mt-1" value="${profileData.nickname || ''}">
                        </div>
                        <div>
                            <label class="opacity-80">Profile Picture</label>
                            <input type="file" id="admin-avatar-upload" class="input w-full mt-1">
                            ${profileData.avatar ? `<img src="${profileData.avatar}" class="w-20 h-20 rounded-full object-cover mt-2">` : ''}
                        </div>
                        <div class="flex justify-end gap-2">
                            <button type="button" class="glass px-4 py-2 rounded-xl" onclick="this.closest('.fixed').remove()">Cancel</button>
                            <button type="submit" class="btn-glow px-4 py-2 rounded-xl">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('admin-settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nickname = document.getElementById('admin-nickname-input').value;
            const avatarFile = document.getElementById('admin-avatar-upload').files[0];
            
            let avatarUrl = profileData.avatar;
            if (avatarFile) {
                const uploadRes = await uploadToCloudinary(avatarFile, 'admin_avatars');
                avatarUrl = uploadRes.secure_url;
            }

            await db.ref(`contactAdmins/${cadminUser.uid}/profile`).set({ nickname, avatar: avatarUrl });
            alert('Settings saved!');
            document.getElementById('chat-header').remove();
            location.reload(); 
        });
    }

    async function showGroupModal(cadminUser) {
        const usersSnap = await db.ref('users').once('value');
        const allUsers = Object.values(usersSnap.val() || {}).filter(u => u.uid !== cadminUser.uid);

        const userListHtml = allUsers.map(u => `
            <label class="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 cursor-pointer">
                <input type="checkbox" data-uid="${u.uid}" class="h-4 w-4">
                <img src="${u.avatar || 'https://via.placeholder.com/60'}" class="h-8 w-8 rounded-full object-cover">
                <div class="flex-1">${u.first} ${u.last}</div>
            </label>
        `).join('');

        const modalHtml = `
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div class="glass p-6 rounded-2xl w-full max-w-md space-y-4">
                    <h3 class="text-xl font-bold">Create New Group</h3>
                    <form id="create-group-form" class="space-y-4">
                        <div>
                            <label class="opacity-80">Group Name</label>
                            <input type="text" id="group-name-input" class="input w-full mt-1" required>
                        </div>
                        <div>
                            <label class="opacity-80">Add Members</label>
                            <div class="border border-white/10 p-2 rounded-xl max-h-40 overflow-y-auto space-y-1">
                                ${userListHtml}
                            </div>
                        </div>
                        <div class="flex justify-end gap-2">
                            <button type="button" class="glass px-4 py-2 rounded-xl" onclick="this.closest('.fixed').remove()">Cancel</button>
                            <button type="submit" class="btn-glow px-4 py-2 rounded-xl">Create Group</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('create-group-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupName = document.getElementById('group-name-input').value;
            const selectedUids = Array.from(document.querySelectorAll('#create-group-form input[type="checkbox"]:checked')).map(cb => cb.dataset.uid);
            
            if (!groupName || selectedUids.length === 0) {
                alert('Please enter a group name and select at least one member.');
                return;
            }

            const newGroupRef = db.ref('groups').push();
            await newGroupRef.set({
                name: groupName,
                members: [...selectedUids, cadminUser.uid],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: cadminUser.uid
            });
            alert('Group created successfully!');
            document.querySelector('.fixed').remove();
            location.reload();
        });
    }

    async function contactMainAdmin(cadminUser) {
        const adminUidsSnap = await db.ref('roles/adminEmails').once('value');
        const adminUids = Object.keys(adminUidsSnap.val() || {});
        
        if (adminUids.length === 0) {
            alert('No normal admins found to contact.');
            return;
        }

        const randomAdminUid = adminUids[Math.floor(Math.random() * adminUids.length)];
        
        const mainAdminProfileSnap = await db.ref(`users/${randomAdminUid}`).once('value');
        selectedUser = mainAdminProfileSnap.val();
        selectedUser.uid = randomAdminUid;
        
        chatRef = db.ref(`chats/${cadminUser.uid}/${randomAdminUid}`);

        document.getElementById('chat-user-name').textContent = `${selectedUser.first} Admin`;
        document.getElementById('chat-user-email').textContent = 'Admin';
        document.getElementById('chat-user-avatar').src = selectedUser.avatar || 'https://via.placeholder.com/60';
        
        document.getElementById('chat-header').classList.remove('hidden');
        document.getElementById('chat-placeholder').classList.add('hidden');
        document.getElementById('admin-chat-input').classList.remove('hidden');
        
        chatRef.on('value', snapshot => {
            const messages = snapshot.val() || {};
            const chatMessagesEl = document.getElementById('admin-chat-messages');
            chatMessagesEl.innerHTML = '';
            Object.values(messages).forEach(msg => {
                renderMessage(msg, chatMessagesEl);
            });
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        });

        alert(`Chatting with main admin: ${selectedUser.first}`);
    }
    
    if (isAdminPage) {
        const makeGroupBtn = document.getElementById('make-group-btn');
        const contactAdminBtn = document.getElementById('contact-admin-btn');
        const userRoleSelect = document.createElement('select');
        userRoleSelect.className = 'input w-40';
        userRoleSelect.innerHTML = `
            <option value="user">User</option>
            <option value="seller">Seller</option>
            <option value="admin">Admin</option>
        `;
        const chatHeader = document.getElementById('chat-header');
        
        makeGroupBtn.addEventListener('click', () => showGroupModal(cadminUser));
        contactAdminBtn.addEventListener('click', () => contactMainAdmin(cadminUser));

        chatHeader.appendChild(userRoleSelect);
        userRoleSelect.addEventListener('change', async (e) => {
            if (selectedUser && confirm(`Change role of ${selectedUser.first} to ${e.target.value}?`)) {
                await db.ref(`users/${selectedUser.uid}/role`).set(e.target.value);
                alert('User role updated!');
                location.reload();
            }
        });
    }
});

async function renderMessage(msg, container, isGroup = false) {
    let senderRole = msg.senderRole || 'user';
    let senderName = msg.senderName || 'Unknown';
    let messageClass;
    let nameHtml = '';

    const userSnap = await db.ref(`users/${msg.senderId}`).once('value');
    const userProfile = userSnap.val() || { first: 'User', last: 'Unknown', role: 'user' };

    if (msg.sender === 'admin' && userProfile.role === 'admin') {
        // Cadmin's view of a Normal Admin's message
        messageClass = 'chat-message-admin';
        nameHtml = `<div class="font-bold text-sm text-yellow-400">${userProfile.first} Admin</div>`;
    } else if (msg.sender === 'admin') {
        // Cadmin's own message
        messageClass = 'chat-message-admin';
    } else {
        // Cadmin's view of a user's message
        messageClass = 'chat-message-user';
        if (userProfile.role === 'seller') {
            nameHtml = `<div class="font-bold text-sm text-gray-300">${userProfile.first} Seller</div>`;
        } else {
            nameHtml = `<div class="font-bold text-sm text-gray-300">${userProfile.first}</div>`;
        }
    }
    
    if (msg.sender === 'admin') {
        if (msg.senderRole === 'admin') {
            messageClass = 'chat-message-admin glow-gold';
        } else {
            messageClass = 'chat-message-admin';
        }
    } else {
        messageClass = 'chat-message-user';
    }

    const imageHtml = msg.image ? `<img src="${msg.image}" class="max-w-xs rounded-xl mt-2"/>` : '';
    
    container.innerHTML += `
        <div class="p-3 rounded-2xl max-w-[70%] ${messageClass}">
            ${isGroup ? nameHtml : ''}
            <div class="text-sm">${msg.text || ''}</div>
            ${imageHtml}
            <div class="text-xs opacity-50 mt-1">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
    `;
}

async function sendMessage(toUid, fromUid, text, sender, senderRole = 'user', image = null) {
    const fromProfileSnap = await db.ref(`users/${fromUid}`).once('value');
    const fromProfile = fromProfileSnap.val() || { first: 'User' };
    
    const chatRef = db.ref(`chats/${fromUid}/${toUid}`).push();
    await chatRef.set({
        text: text,
        sender: sender,
        senderId: fromUid,
        senderRole: senderRole,
        senderName: fromProfile.first,
        image: image,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    if (sender === 'admin') {
        const notifData = {
            type: 'chat',
            title: 'New Message from Admin',
            body: text || 'You have a new image from the admin.',
            url: 'contact.html',
            buttonText: 'Reply Now',
            isRead: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        await db.ref(`notifications/${toUid}`).push(notifData);
    } else {
        await db.ref(`unreadCounts/${fromUid}/${toUid}`).transaction(current => (current || 0) + 1);
    }
}

async function sendGroupMessage(group, fromUid, text, sender, senderRole, image = null) {
    const fromProfileSnap = await db.ref(`users/${fromUid}`).once('value');
    const fromProfile = fromProfileSnap.val() || { first: 'User' };
    
    const groupChatRef = db.ref(`groupChats/${group.id}`).push();
    const payload = {
        text,
        sender,
        senderId: fromUid,
        senderRole,
        senderName: fromProfile.first,
        image,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    await groupChatRef.set(payload);

    group.members.forEach(async memberId => {
        if (memberId !== fromUid) {
             const notifData = {
                type: 'chat',
                title: `New Group Message in ${group.name}`,
                body: text || 'You have a new image in the group chat.',
                url: 'contact.html',
                buttonText: 'Reply Now',
                isRead: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            await db.ref(`notifications/${memberId}`).push(notifData);
            await db.ref(`unreadCounts/${group.id}/${memberId}`).transaction(current => (current || 0) + 1);
        }
    });
}