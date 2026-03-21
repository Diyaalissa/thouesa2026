// Admin Dashboard Logic
window.showModal = function(id) { document.getElementById(id).style.display = 'flex'; };
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };

const adminAuthOverlay = document.getElementById('admin-auth-overlay');
const adminSidebar = document.getElementById('admin-sidebar');
const adminMain = document.getElementById('admin-main');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

// State
let currentAdmin = null;
let csrfToken = '';
let allOrders = [];

async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token', { credentials: 'include' });
        const json = await response.json();
        csrfToken = json.data.token;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
}

async function fetchWithAuth(url, options = {}) {
    let currentToken = localStorage.getItem('adminToken');
    if (!options.headers) options.headers = {};
    if (currentToken) options.headers['Authorization'] = `Bearer ${currentToken}`;
    
    let response = await fetch(url, options);
    
    if (response.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                const refreshRes = await fetch('/api/auth/refresh-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ refreshToken })
                });
                
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    currentToken = refreshData.data.token;
                    localStorage.setItem('adminToken', currentToken);
                    localStorage.setItem('token', currentToken);
                    if (refreshData.data.refreshToken) {
                        localStorage.setItem('refreshToken', refreshData.data.refreshToken);
                    }
                    
                    options.headers['Authorization'] = `Bearer ${currentToken}`;
                    response = await fetch(url, options);
                } else {
                    localStorage.removeItem('adminToken');
                    showAdminAuth();
                }
            } catch (err) {
                console.error('Refresh token error:', err);
                localStorage.removeItem('adminToken');
                showAdminAuth();
            }
        } else {
            localStorage.removeItem('adminToken');
            showAdminAuth();
        }
    }
    return response;
}

// Check Admin Auth
const checkAdminAuth = async () => {
    let token = localStorage.getItem('adminToken');
    if (!token) {
        token = localStorage.getItem('token');
        if (token) {
            localStorage.setItem('adminToken', token);
        }
    }
    if (!token) {
        showAdminAuth();
        return;
    }

    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const json = await response.json();
            const user = json.data;
            if (user.role === 'admin' || user.role === 'operator') {
                showAdminDashboard(user);
            } else {
                localStorage.removeItem('adminToken');
                showAdminAuth();
                alert('عذراً، ليس لديك صلاحيات إدارية');
            }
        } else {
            localStorage.removeItem('adminToken');
            showAdminAuth();
        }
    } catch (error) {
        console.error('Admin auth check failed:', error);
        showAdminAuth();
    }
};

const showAdminAuth = () => {
    adminAuthOverlay.classList.remove('hidden');
    adminSidebar.classList.add('hidden');
    adminMain.classList.add('hidden');
};

const showAdminDashboard = (user) => {
    currentAdmin = user;
    adminAuthOverlay.classList.add('hidden');
    adminSidebar.classList.remove('hidden');
    adminMain.classList.remove('hidden');
    document.getElementById('admin-welcome').innerText = `مرحباً بك، ${user.full_name || user.name}`;
    loadAdminData();
};

// Admin Login
adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ email, password })
        });

        const json = await response.json();
        const data = json.data;
        if (response.ok) {
            if (data.user.role === 'admin' || data.user.role === 'operator') {
                localStorage.setItem('adminToken', data.token);
                if (data.refreshToken) {
                    localStorage.setItem('refreshToken', data.refreshToken);
                }
                showAdminDashboard(data.user);
            } else {
                alert('عذراً، هذا الحساب ليس له صلاحيات إدارية');
            }
        } else {
            alert(data.message || 'خطأ في الدخول');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        alert('فشل الاتصال بالخادم');
    }
});

// Admin Logout
adminLogoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('adminToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ refreshToken })
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    localStorage.removeItem('adminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    location.reload();
});

// Tab Switching
document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        
        // Update UI
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        
        document.getElementById('tab-title').innerText = link.querySelector('span').innerText;
        
        // Load specific data if needed
        if (tab === 'users') loadUsers();
        if (tab === 'orders') loadOrders();
        if (tab === 'trips') loadTrips();
        if (tab === 'tracking') loadTrackingEvents();
        if (tab === 'rates') loadRates();
        if (tab === 'finances') {
            loadWalletTransactions();
            loadPayments();
        }
        if (tab === 'coupons') loadCoupons();
        if (tab === 'tickets') loadTickets();
        if (tab === 'reviews') loadReviews();
        if (tab === 'carriers') loadCarriers();
        if (tab === 'warehouses') loadWarehouses();
        if (tab === 'notifications') loadNotifications();
        if (tab === 'logs') loadLogsFull();
        if (tab === 'files') loadFiles();
        if (tab === 'settings') loadSettings();
    });
});

// Data Loading Functions
const loadAdminData = async () => {
    loadStats();
    loadLogs();
};

const loadStats = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/stats', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const stats = json.data;
            document.getElementById('stat-total-orders').innerText = stats.totalOrders || 0;
            document.getElementById('stat-pending-orders').innerText = stats.pendingOrders || 0;
            document.getElementById('stat-total-users').innerText = stats.totalUsers || 0;
            document.getElementById('stat-total-revenue').innerText = `$${stats.totalRevenue || 0}`;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
};

const loadLogs = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/logs', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const logs = json.data;
            const tbody = document.getElementById('admin-logs-table');
            tbody.innerHTML = logs.map(log => `
                <tr>
                    <td>${log.user_name || 'النظام'}</td>
                    <td>${log.action}</td>
                    <td>${log.details}</td>
                    <td>${new Date(log.created_at).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
};

const loadUsers = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const users = json.data;
            const tbody = document.getElementById('admin-users-table');
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.customer_id}</td>
                    <td>${user.full_name}</td>
                    <td>${user.phone}</td>
                    <td>
                        <span class="badge badge-${user.account_status === 'active' ? 'success' : 'danger'}">${user.account_status}</span>
                        <span class="badge badge-${user.kyc_status === 'verified' ? 'success' : 'pending'}">${user.kyc_status}</span>
                    </td>
                    <td>$${user.wallet_balance || 0}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="viewUser('${user.id}')" title="عرض التفاصيل">👁️</button>
                        <button class="btn btn-glass btn-icon" onclick="adjustWallet('${user.id}')" title="تعديل المحفظة">💰</button>
                        <button class="btn btn-glass btn-icon" onclick="openNotificationModal('${user.id}')" title="إرسال تنبيه">🔔</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
};

const viewUser = async (id) => {
    try {
        const response = await fetch(`/api/v1/admin/portal/users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        const json = await response.json();
        const users = json.data;
        const user = users.find(u => u.id === id);
        
        if (!user) return alert('المستخدم غير موجود');
        
        const content = document.getElementById('user-details-content');
        content.innerHTML = `
            <div>
                <p><strong>الاسم:</strong> ${user.full_name}</p>
                <p><strong>البريد:</strong> ${user.email}</p>
                <p><strong>الهاتف:</strong> ${user.phone}</p>
                <p><strong>الدولة:</strong> ${user.country || 'غير محدد'}</p>
                <p><strong>المدينة:</strong> ${user.city || 'غير محدد'}</p>
            </div>
            <div>
                <p><strong>حالة الحساب:</strong> ${user.account_status}</p>
                <p><strong>حالة التوثيق:</strong> ${user.kyc_status}</p>
                <p><strong>آخر دخول:</strong> ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('ar-EG') : 'أبداً'}</p>
                <p><strong>تاريخ التسجيل:</strong> ${new Date(user.created_at).toLocaleDateString('ar-EG')}</p>
                <p><strong>الرصيد:</strong> $${user.wallet_balance}</p>
            </div>
            <div style="grid-column: span 2; margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
                <p><strong>صورة الهوية:</strong></p>
                ${user.kyc_document ? `<img src="${user.kyc_document}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;" alt="ID Image">` : '<p>لا توجد صورة مرفوعة</p>'}
            </div>
        `;
        
        document.getElementById('btn-suspend-user').innerText = user.account_status === 'active' ? 'تعليق الحساب' : 'تنشيط الحساب';
        document.getElementById('btn-suspend-user').onclick = () => suspendUser(user.id, user.account_status === 'active' ? 'suspended' : 'active');
        
        // Add Adjust Wallet button if not already there
        let btnAdjust = document.getElementById('btn-adjust-wallet');
        if (!btnAdjust) {
            btnAdjust = document.createElement('button');
            btnAdjust.id = 'btn-adjust-wallet';
            btnAdjust.className = 'btn btn-glass';
            btnAdjust.innerText = 'تعديل المحفظة';
            document.getElementById('btn-suspend-user').after(btnAdjust);
        }
        btnAdjust.onclick = () => adjustWallet(user.id);
        
        document.getElementById('btn-verify-user').innerText = user.kyc_status === 'verified' ? 'إلغاء التوثيق' : 'توثيق الحساب';
        document.getElementById('btn-verify-user').onclick = () => verifyUser(user.id, user.kyc_status === 'verified' ? 'none' : 'verified');
        
        // Add Reject KYC button if not already there
        let btnReject = document.getElementById('btn-reject-kyc');
        if (!btnReject) {
            btnReject = document.createElement('button');
            btnReject.id = 'btn-reject-kyc';
            btnReject.className = 'btn btn-glass';
            btnReject.style.color = 'var(--danger)';
            btnReject.innerText = 'رفض التوثيق';
            document.getElementById('btn-verify-user').after(btnReject);
        }
        btnReject.onclick = () => verifyUser(user.id, 'rejected');
        btnReject.style.display = user.kyc_status === 'verified' ? 'none' : 'block';

        document.getElementById('btn-delete-user').onclick = () => deleteUser(user.id);
        
        showModal('user-details-modal');
    } catch (error) {
        console.error('View user error:', error);
    }
};

const suspendUser = async (id, status) => {
    const reason = prompt('أدخل سبب الإجراء:');
    if (reason === null) return;
    
    try {
        const response = await fetch(`/api/v1/admin/portal/users/${id}/suspend`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ status, reason })
        });
        if (response.ok) {
            alert('تم تحديث حالة الحساب');
            closeModal('user-details-modal');
            loadUsers();
        }
    } catch (error) {
        console.error('Suspend user error:', error);
    }
};

const verifyUser = async (id, status) => {
    const note = prompt('أدخل ملاحظة التوثيق:');
    if (note === null) return;
    
    try {
        const response = await fetch(`/api/v1/admin/portal/users/${id}/verify-kyc`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ status, note })
        });
        if (response.ok) {
            alert('تم تحديث حالة التوثيق');
            closeModal('user-details-modal');
            loadUsers();
        }
    } catch (error) {
        console.error('Verify user error:', error);
    }
};

const deleteUser = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    try {
        const response = await fetch(`/api/v1/admin/portal/users/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            alert('تم حذف المستخدم بنجاح');
            closeModal('user-details-modal');
            loadUsers();
        }
    } catch (error) {
        console.error('Delete user error:', error);
    }
};

const openNotificationModal = (userId) => {
    document.getElementById('notif-user-id').value = userId;
    document.getElementById('notif-broadcast').checked = false;
    showModal('notification-modal');
};

const sendNotification = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('notification-form');
    const formData = new FormData(form);
    const data = {
        user_id: formData.get('user_id'),
        title: formData.get('title'),
        message: formData.get('message'),
        broadcast: document.getElementById('notif-broadcast').checked
    };

    try {
        const response = await fetch('/api/v1/admin/portal/notifications', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إرسال التنبيه بنجاح');
            closeModal('notification-modal');
            form.reset();
        }
    } catch (error) {
        console.error('Send notification error:', error);
    }
};

document.getElementById('notification-form')?.addEventListener('submit', sendNotification);

const adjustWallet = async (id) => {
    const amount = prompt('أدخل المبلغ المراد إضافته أو خصمه (مثال: 10 أو -5):');
    if (amount === null || amount === '') return;
    
    try {
        const response = await fetch(`/api/v1/admin/portal/users/${id}/wallet`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ amount: parseFloat(amount) })
        });
        if (response.ok) {
            alert('تم تعديل المحفظة بنجاح');
            loadUsers();
        }
    } catch (error) {
        console.error('Wallet adjustment error:', error);
    }
};

let currentOrderId = null;
const editOrder = (id) => {
    currentOrderId = id;
    const order = allOrders.find(o => o.id === id);
    if (order) {
        const form = document.getElementById('order-status-form');
        const fields = [
            'status', 'weight', 'length', 'width', 'height', 
            'shipping_fees', 'customs_fees', 'insurance_amount', 
            'local_delivery_fees', 'tax_value', 'final_price',
            'package_type', 'priority', 'warehouse_id', 'cancellation_reason'
        ];
        fields.forEach(field => {
            if (form.elements[field]) {
                form.elements[field].value = order[field] || '';
            }
        });
        if (form.elements['reason']) {
            form.elements['reason'].value = order.rejection_reason || '';
        }
    }
    showModal('order-modal');
};

const updateOrderStatus = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('order-status-form');
    const formData = new FormData(form);
    const data = {};
    
    const numericFields = [
        'weight', 'length', 'width', 'height', 
        'shipping_fees', 'customs_fees', 'insurance_amount', 
        'local_delivery_fees', 'tax_value', 'final_price'
    ];

    formData.forEach((value, key) => {
        if (value !== '') {
            if (numericFields.includes(key)) {
                data[key] = parseFloat(value);
            } else {
                data[key] = value;
            }
        }
    });

    try {
        const response = await fetch(`/api/v1/admin/portal/orders/${currentOrderId}/status`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('تم تحديث حالة الطلب');
            closeModal('order-modal');
            loadOrders();
        } else {
            alert('خطأ: ' + (result.error || result.message || 'فشل التحديث'));
        }
    } catch (error) {
        console.error('Order update error:', error);
        alert('حدث خطأ أثناء الاتصال بالخادم');
    }
};

const loadOrders = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/orders', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            allOrders = json.data;
            const orders = allOrders;
            const tbody = document.getElementById('admin-orders-table');
            tbody.innerHTML = orders.map(order => `
                <tr>
                    <td>${order.tracking_number || order.id.substring(0, 8)}</td>
                    <td>${order.customer_name}</td>
                    <td>${order.origin} ➔ ${order.destination}</td>
                    <td><span class="badge badge-${getStatusClass(order.status)}">${order.status}</span></td>
                    <td>$${order.final_price || 0}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="editOrder('${order.id}')">✏️</button>
                        <button class="btn btn-glass btn-icon" onclick="openAddTrackingModal('${order.id}')" title="إضافة تتبع">📍</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load orders:', error);
    }
};

const loadTrackingEvents = async () => {
    const search = document.getElementById('tracking-search-order').value;
    let url = '/api/v1/admin/portal/tracking';
    if (search) url += `?orderId=${search}`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const events = json.data;
            const tbody = document.getElementById('admin-tracking-table');
            tbody.innerHTML = events.map(event => `
                <tr>
                    <td>${event.tracking_number || event.order_id.substring(0, 8)}</td>
                    <td>${event.status}</td>
                    <td>${event.location || '-'}</td>
                    <td>${event.description || '-'}</td>
                    <td>${new Date(event.created_at).toLocaleString('ar-EG')}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="deleteTrackingEvent('${event.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load tracking events:', error);
    }
};

const openAddTrackingModal = (orderId) => {
    document.getElementById('tracking-order-id').value = orderId;
    showModal('modal-add-tracking');
};

const addTrackingEvent = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('add-tracking-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/v1/admin/portal/tracking', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إضافة حدث التتبع');
            closeModal('modal-add-tracking');
            loadTrackingEvents();
            form.reset();
        }
    } catch (error) {
        console.error('Add tracking event error:', error);
    }
};

const deleteTrackingEvent = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحدث؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/tracking/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadTrackingEvents();
        }
    } catch (error) {
        console.error('Delete tracking event error:', error);
    }
};

const loadRates = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/rates', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const rates = json.data;
            const tbody = document.getElementById('admin-rates-table');
            tbody.innerHTML = rates.map(rate => `
                <tr>
                    <td>${rate.origin_country}</td>
                    <td>${rate.destination_country}</td>
                    <td>$${rate.base_price}</td>
                    <td>$${rate.price_per_kg}</td>
                    <td>${rate.min_weight} - ${rate.max_weight} كجم</td>
                    <td>${rate.carrier_name || 'افتراضي'}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="deleteRate('${rate.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load rates:', error);
    }
};

const addRate = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('add-rate-form');
    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
        if (['base_price', 'price_per_kg', 'min_weight', 'max_weight'].includes(key)) {
            data[key] = parseFloat(value);
        } else {
            data[key] = value;
        }
    });

    try {
        const response = await fetch('/api/v1/admin/portal/rates', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إضافة السعر بنجاح');
            closeModal('modal-add-rate');
            loadRates();
            form.reset();
        }
    } catch (error) {
        console.error('Add rate error:', error);
    }
};

const deleteRate = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا السعر؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/rates/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadRates();
        }
    } catch (error) {
        console.error('Delete rate error:', error);
    }
};

const loadTickets = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/tickets', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        const json = await response.json();
        const tickets = json.data;
        const tbody = document.getElementById('admin-tickets-table');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        tickets.forEach(ticket => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${ticket.full_name}</td>
                <td>${ticket.subject}</td>
                <td><span class="status-badge ${getStatusClass(ticket.status)}">${ticket.status}</span></td>
                <td>${new Date(ticket.created_at).toLocaleDateString('ar-EG')}</td>
                <td>
                    <button class="btn btn-glass" onclick="replyTicket('${ticket.id}')">رد</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Load tickets error:', error);
    }
};

const replyTicket = async (id) => {
    const reply = prompt('أدخل الرد على التذكرة:');
    if (!reply) return;
    
    try {
        const response = await fetch(`/api/v1/admin/portal/tickets/${id}/reply`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ reply })
        });
        if (response.ok) {
            alert('تم إرسال الرد');
            loadTickets();
        }
    } catch (error) {
        console.error('Reply ticket error:', error);
    }
};

const loadWalletTransactions = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/transactions', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const transactions = json.data;
            const tbody = document.getElementById('admin-wallet-table');
            tbody.innerHTML = transactions.map(t => `
                <tr>
                    <td>${t.full_name || 'مستخدم'}</td>
                    <td style="color: ${t.amount >= 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${t.amount >= 0 ? '+' : ''}$${t.amount}
                    </td>
                    <td>${t.type}</td>
                    <td>$${t.balance_before}</td>
                    <td>$${t.balance_after}</td>
                    <td>${t.description || '-'}</td>
                    <td>${new Date(t.created_at).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load transactions:', error);
    }
};

const loadCoupons = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/coupons', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const coupons = json.data;
            const tbody = document.getElementById('admin-coupons-table');
            tbody.innerHTML = coupons.map(c => `
                <tr>
                    <td>${c.code}</td>
                    <td>${c.discount_type === 'percent' ? 'نسبة' : 'ثابت'}</td>
                    <td>${c.discount_value}${c.discount_type === 'percent' ? '%' : '$'}</td>
                    <td>${c.current_uses} / ${c.max_uses}</td>
                    <td>${c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar-EG') : 'بدون'}</td>
                    <td><span class="badge badge-${c.is_active ? 'success' : 'danger'}">${c.is_active ? 'نشط' : 'معطل'}</span></td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="deleteCoupon('${c.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load coupons:', error);
    }
};

const addCoupon = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('add-coupon-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.discount_value = parseFloat(data.discount_value);
    data.max_uses = parseInt(data.max_uses);

    try {
        const response = await fetch('/api/v1/admin/portal/coupons', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إضافة الكوبون');
            closeModal('modal-add-coupon');
            loadCoupons();
            form.reset();
        }
    } catch (error) {
        console.error('Add coupon error:', error);
    }
};

const deleteCoupon = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/coupons/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadCoupons();
        }
    } catch (error) {
        console.error('Delete coupon error:', error);
    }
};

const loadTrips = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/trips', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const trips = json.data;
            const tbody = document.getElementById('admin-trips-table');
            tbody.innerHTML = trips.map(trip => `
                <tr>
                    <td>${new Date(trip.trip_date).toLocaleDateString('ar-EG')}</td>
                    <td>${trip.route}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="deleteTrip('${trip.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load trips:', error);
    }
};

const addTrip = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('add-trip-form');
    const formData = new FormData(form);
    const data = {
        route: formData.get('trip-destination'),
        trip_date: formData.get('trip-date')
    };

    try {
        const response = await fetch('/api/v1/admin/portal/trips', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إضافة الرحلة');
            closeModal('modal-add-trip');
            loadTrips();
            form.reset();
        }
    } catch (error) {
        console.error('Add trip error:', error);
    }
};

const deleteTrip = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الرحلة؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/trips/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadTrips();
        }
    } catch (error) {
        console.error('Delete trip error:', error);
    }
};

const generateReport = async () => {
    const month = prompt('أدخل الشهر (1-12):', new Date().getMonth() + 1);
    const year = prompt('أدخل السنة:', new Date().getFullYear());
    if (!month || !year) return;

    try {
        const response = await fetch(`/api/v1/admin/portal/monthly-report?month=${month}&year=${year}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        const json = await response.json();
        const data = json.data;
        if (response.ok) {
            alert(`تقرير شهر ${month}/${year}:\nإجمالي الطلبات: ${data.stats.total}\nالإيرادات: $${data.stats.revenue || 0}\nمستخدمين جدد: ${data.newUsers}`);
        }
    } catch (error) {
        console.error('Report error:', error);
    }
};

const clearCache = () => {
    alert('تم مسح التخزين المؤقت للنظام');
};

const getStatusClass = (status) => {
    switch(status) {
        case 'pending': return 'pending';
        case 'shipped': return 'info';
        case 'delivered': return 'success';
        case 'rejected': return 'danger';
        default: return 'info';
    }
};

const loadSettings = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/settings', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const settings = json.data;
            const form = document.getElementById('settings-form');
            if (settings && form) {
                // Map settings to form fields
                const fields = [
                    'site_name', 'site_logo', 'hero_title', 'hero_slogan', 
                    'hero_bg', 'hero_bg_mobile', 'main_screen_title', 
                    'main_screen_description', 'insurance_rate', 
                    'referral_reward_jod', 'news_text', 'footer_text', 
                    'terms_conditions', 'privacy_policy',
                    'social_facebook', 'social_whatsapp', 'social_instagram', 'social_tiktok'
                ];
                
                fields.forEach(field => {
                    if (form.elements[field]) {
                        form.elements[field].value = settings[field] || '';
                    }
                });
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
};

const saveSettings = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('settings-form');
    const formData = new FormData(form);
    const settings = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/v1/admin/portal/settings', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(settings)
        });
        if (response.ok) {
            alert('تم حفظ الإعدادات بنجاح');
            // Update local SITE_CONFIG if possible or reload
            location.reload();
        } else {
            const data = await response.json();
            alert(data.message || 'فشل حفظ الإعدادات');
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert('خطأ في الاتصال');
    }
};

const uploadSettingsLogo = async (input) => {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/v1/upload', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: formData
        });
        if (response.ok) {
            const json = await response.json();
            const data = json.data;
            document.getElementById('settings-logo-url').value = data.url;
            alert('تم رفع الشعار بنجاح');
        } else {
            alert('فشل رفع الشعار');
        }
    } catch (error) {
        console.error('Logo upload error:', error);
        alert('خطأ في الرفع');
    }
};

const loadReviews = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/reviews', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const reviews = json.data;
            const tbody = document.getElementById('admin-reviews-table');
            tbody.innerHTML = reviews.map(r => `
                <tr>
                    <td>${r.user_name || 'زائر'}</td>
                    <td>${'⭐'.repeat(r.rating)}</td>
                    <td>${r.comment || '-'}</td>
                    <td><span class="badge badge-${r.status === 'displayed' ? 'success' : 'danger'}">${r.status === 'displayed' ? 'معروض' : 'مخفي'}</span></td>
                    <td>${new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>
                        ${r.status === 'hidden' ? `<button class="btn btn-glass btn-icon" onclick="updateReviewStatus('${r.id}', 'displayed')" title="عرض">👁️</button>` : ''}
                        ${r.status === 'displayed' ? `<button class="btn btn-glass btn-icon" onclick="updateReviewStatus('${r.id}', 'hidden')" title="إخفاء">🚫</button>` : ''}
                        <button class="btn btn-glass btn-icon" onclick="deleteReview('${r.id}')" title="حذف">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load reviews:', error);
    }
};

const updateReviewStatus = async (id, status) => {
    try {
        const response = await fetch(`/api/v1/admin/portal/reviews/${id}/status`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            loadReviews();
        }
    } catch (error) {
        console.error('Update review status error:', error);
    }
};

const deleteReview = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا التقييم؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/reviews/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadReviews();
        }
    } catch (error) {
        console.error('Delete review error:', error);
    }
};

const loadCarriers = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/carriers', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const carriers = json.data;
            const tbody = document.getElementById('admin-carriers-table');
            tbody.innerHTML = carriers.map(c => `
                <tr>
                    <td>${c.name}</td>
                    <td>${c.tracking_url || '-'}</td>
                    <td>${c.contact_email || '-'}</td>
                    <td><span class="badge badge-${c.status === 'active' ? 'success' : 'danger'}">${c.status}</span></td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="deleteCarrier('${c.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
            
            // Update carrier select in rates modal
            const select = document.getElementById('rate-carrier-select');
            if (select) {
                select.innerHTML = '<option value="">اختر الناقل...</option>' + 
                    carriers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load carriers:', error);
    }
};

const addCarrier = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('add-carrier-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/v1/admin/portal/carriers', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إضافة الناقل');
            closeModal('modal-add-carrier');
            loadCarriers();
            form.reset();
        }
    } catch (error) {
        console.error('Add carrier error:', error);
    }
};

const deleteCarrier = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الناقل؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/carriers/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadCarriers();
        }
    } catch (error) {
        console.error('Delete carrier error:', error);
    }
};

const loadWarehouses = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/warehouses', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const warehouses = json.data;
            const tbody = document.getElementById('admin-warehouses-table');
            tbody.innerHTML = warehouses.map(w => `
                <tr>
                    <td>${w.name}</td>
                    <td>${w.country}</td>
                    <td>${w.city}</td>
                    <td>${w.address}</td>
                    <td>${w.contact_phone || '-'}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="deleteWarehouse('${w.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load warehouses:', error);
    }
};

const addWarehouse = async (e) => {
    if (e) e.preventDefault();
    const form = document.getElementById('add-warehouse-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/v1/admin/portal/warehouses', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('تم إضافة المستودع');
            closeModal('modal-add-warehouse');
            loadWarehouses();
            form.reset();
        }
    } catch (error) {
        console.error('Add warehouse error:', error);
    }
};

const deleteWarehouse = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستودع؟')) return;
    try {
        const response = await fetch(`/api/v1/admin/portal/warehouses/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'X-CSRF-Token': csrfToken
            }
        });
        if (response.ok) {
            loadWarehouses();
        }
    } catch (error) {
        console.error('Delete warehouse error:', error);
    }
};

const loadNotifications = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/notifications/all', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const notifications = json.data;
            const tbody = document.getElementById('admin-notifications-table');
            tbody.innerHTML = notifications.map(n => `
                <tr>
                    <td>${n.user_name || 'الجميع'}</td>
                    <td>${n.title}</td>
                    <td>${n.message}</td>
                    <td>${n.type || 'system'}</td>
                    <td>${new Date(n.created_at).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
};

const loadLogsFull = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/logs', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const logs = json.data;
            const tbody = document.getElementById('admin-logs-full-table');
            tbody.innerHTML = logs.map(log => `
                <tr>
                    <td>${log.user_name || 'النظام'}</td>
                    <td>${log.action}</td>
                    <td>${log.resource_type || '-'}</td>
                    <td>${log.ip_address || '-'}</td>
                    <td>${new Date(log.created_at).toLocaleString('ar-EG')}</td>
                    <td>
                        <button class="btn btn-glass btn-icon" onclick="alert('${(log.details || '').replace(/'/g, "\\'")}')">ℹ️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load full logs:', error);
    }
};

const loadPayments = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/payments', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const payments = json.data;
            const tbody = document.getElementById('admin-payments-table');
            tbody.innerHTML = payments.map(p => `
                <tr>
                    <td>${p.full_name || 'مستخدم'}</td>
                    <td>$${p.amount}</td>
                    <td>${p.method || '-'}</td>
                    <td>${p.shipment_id ? p.shipment_id.substring(0, 8) : '-'}</td>
                    <td><span class="badge badge-${p.status === 'completed' ? 'success' : 'pending'}">${p.status === 'completed' ? 'مكتمل' : 'معلق'}</span></td>
                    <td>${new Date(p.created_at).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load payments:', error);
    }
};

const loadFiles = async () => {
    try {
        const response = await fetch('/api/v1/admin/portal/files', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (response.ok) {
            const json = await response.json();
            const files = json.data;
            const tbody = document.getElementById('admin-files-table');
            tbody.innerHTML = files.map(f => `
                <tr>
                    <td>${f.user_name || 'مستخدم'}</td>
                    <td>${f.serial_number || f.order_id || '-'}</td>
                    <td>${f.type || 'file'}</td>
                    <td><a href="${f.file_url}" target="_blank" class="btn btn-glass btn-icon">📎</a></td>
                    <td>${new Date(f.created_at).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load files:', error);
    }
};

// Event Listeners
document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
document.getElementById('order-status-form')?.addEventListener('submit', updateOrderStatus);
document.getElementById('add-trip-form')?.addEventListener('submit', addTrip);
document.getElementById('add-rate-form')?.addEventListener('submit', addRate);
document.getElementById('add-coupon-form')?.addEventListener('submit', addCoupon);
document.getElementById('add-tracking-form')?.addEventListener('submit', addTrackingEvent);
document.getElementById('add-carrier-form')?.addEventListener('submit', addCarrier);
document.getElementById('add-warehouse-form')?.addEventListener('submit', addWarehouse);

// Init
fetchCsrfToken().then(() => {
    checkAdminAuth();
});
