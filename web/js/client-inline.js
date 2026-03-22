const token = localStorage.getItem('token');
if (!token) window.location.href = '/web/index.html';

let csrfToken = '';
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
    let currentToken = localStorage.getItem('token');
    if (!options.headers) options.headers = {};
    if (currentToken) options.headers['Authorization'] = `Bearer ${currentToken}`;
    
    let response = await fetch(url, options);
    
    if (response.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                const refreshRes = await fetch('/api/auth/refresh-token', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ refreshToken })
                });
                
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    currentToken = refreshData.data.token;
                    localStorage.setItem('token', currentToken);
                    if (refreshData.data.refreshToken) {
                        localStorage.setItem('refreshToken', refreshData.data.refreshToken);
                    }
                    
                    options.headers['Authorization'] = `Bearer ${currentToken}`;
                    response = await fetch(url, options);
                } else {
                    window.logout();
                }
            } catch (err) {
                console.error('Refresh token error:', err);
                window.logout();
            }
        } else {
            window.logout();
        }
    }
    return response;
}

let user = null;
let orders = [];
let addresses = [];
let selectedProductImg = null;
let insuranceEnabled = false;
let customsEnabled = true;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMultilineText(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
}

window.updateRoute = function() {
    const origin = document.getElementById('origin-country').value;
    const dest = document.getElementById('destination-country');
    const currencyLabels = document.querySelectorAll('.currency-label');
    
    if (origin === 'Jordan') {
        dest.value = 'Algeria';
        currencyLabels.forEach(l => l.innerText = 'د.أ');
    } else {
        dest.value = 'Jordan';
        currencyLabels.forEach(l => l.innerText = 'د.ج');
    }
};

window.toggleCustoms = function() {
    const type = document.getElementById('order-type').value;
    // Only optional for parcel
    if (type !== 'parcel') return;
    
    customsEnabled = !customsEnabled;
    document.getElementById('customs-toggle').classList.toggle('active', customsEnabled);
};

async function init() {
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!r.ok) {
            const errData = await r.json().catch(() => ({}));
            throw new Error(errData.error || `خطأ في الاتصال بالسيرفر: ${r.status}`);
        }
        const json = await r.json();
        user = json.data || json;
        
        document.getElementById('user-welcome').innerText = `أهلاً بك، ${user.full_name || ''}`;
        document.getElementById('user-cid').innerText = user.customer_id || '';
        
        const walletBalance = parseFloat(user.wallet_balance) || 0;
        document.getElementById('stat-wallet').innerText = `${walletBalance.toFixed(2)} د.أ`;
        document.getElementById('wallet-balance-display').innerText = `${walletBalance.toFixed(2)} د.أ`;
        
        document.getElementById('p-name').value = user.full_name || '';
        document.getElementById('p-phone').value = user.phone || '';
        document.getElementById('p-email').value = user.email || '';
        
        const idBox = document.getElementById('id-status-box');
        if (user.kyc_status === 'verified') {
            idBox.innerText = '✅ حساب موثق';
            idBox.style.color = '#00ff00';
        } else if (user.kyc_status === 'rejected') {
            idBox.innerText = '❌ تم رفض الهوية: ' + (user.verification_note || '');
            idBox.style.color = '#ff4444';
        } else if (user.kyc_status === 'pending') {
            idBox.innerText = '⏳ بانتظار التوثيق';
            idBox.style.color = 'var(--accent)';
        } else {
            idBox.innerText = '⚠️ الهوية غير مرفوعة';
            idBox.style.color = 'var(--text-dim)';
        }

        await loadOrders();
        await loadAddresses();
        await loadTransactions();
        await loadTickets();
        
        window.setOrderType('parcel');
        window.updateRoute();
    } catch (e) {
        console.error('Initialization Error:', e);
        window.toast('حدث خطأ أثناء تحميل بيانات الملف الشخصي: ' + e.message);
        // setTimeout(logout, 3000);
    } finally {
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if(splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.style.display = 'none', 500);
            }
        }, 800);
    }
}

window.showSection = function(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(id + '-section');
    if(section) section.classList.remove('hidden');
    
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`[data-section="${id}"]`).forEach(l => l.classList.add('active'));
    
    const titles = {
        dashboard: 'الرئيسية',
        'new-order': 'طلب جديد',
        tracking: 'تتبع الشحنات',
        wallet: 'المحفظة',
        payments: 'المدفوعات',
        addresses: 'دفتر العناوين',
        tickets: 'الدعم الفني',
        profile: 'الملف الشخصي'
    };
    document.getElementById('page-title').innerText = titles[id] || '';

    if(id === 'wallet') loadTransactions();
    if(id === 'payments') loadPayments();
    if(id === 'tracking') loadOrders();
    if(id === 'tickets') loadTickets();
    if(id === 'addresses') loadAddresses();
};

window.setOrderType = function(type, el) {
    document.getElementById('order-type').value = type;
    if (el) {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    }

    const customsToggle = document.getElementById('customs-toggle');
    if (type === 'parcel') {
        customsToggle.style.display = 'flex';
        customsToggle.classList.add('active');
        customsEnabled = true;
    } else {
        // For buy and global, customs is usually included/mandatory in our flow
        customsToggle.style.display = 'none';
        customsEnabled = true;
    }

    const origin = document.getElementById('origin-country').value;
    const currency = origin === 'Jordan' ? 'د.أ' : 'د.ج';

    const container = document.getElementById('dynamic-fields');
    if (type === 'parcel') {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div>
                    <label class="stat-label">الوزن التقريبي (كغم)</label>
                    <input type="number" id="o-weight" class="fs-input" placeholder="مثلاً: 5" step="0.01">
                </div>
                <div>
                    <label class="stat-label">نوع الطرد</label>
                    <input type="text" id="o-package-type" class="fs-input" placeholder="مثلاً: كرتون، كيس">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div>
                    <label class="stat-label">الطول (سم)</label>
                    <input type="number" id="o-length" class="fs-input" placeholder="0" step="0.1">
                </div>
                <div>
                    <label class="stat-label">العرض (سم)</label>
                    <input type="number" id="o-width" class="fs-input" placeholder="0" step="0.1">
                </div>
                <div>
                    <label class="stat-label">الارتفاع (سم)</label>
                    <input type="number" id="o-height" class="fs-input" placeholder="0" step="0.1">
                </div>
            </div>
            <label class="stat-label">محتويات الطرد</label>
            <textarea id="o-items" class="fs-input" placeholder="مثلاً: ملابس، أحذية، هدايا..."></textarea>
            <label class="stat-label">القيمة المصرح بها (للجمارك)</label>
            <div style="position: relative;">
                <input type="number" id="o-value" class="fs-input" placeholder="القيمة">
                <span class="currency-label" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-weight: 700;">${currency}</span>
            </div>
        `;
    } else if (type === 'buy') {
        container.innerHTML = `
            <label class="stat-label">اسم المتجر / الرابط</label>
            <input type="text" id="o-store" class="fs-input" placeholder="رابط المنتج أو اسم المحل">
            <label class="stat-label">وصف المنتج والمواصفات</label>
            <textarea id="o-items" class="fs-input" placeholder="اللون، المقاس، الكمية..."></textarea>
            <label class="stat-label">السعر التقريبي</label>
            <div style="position: relative;">
                <input type="number" id="o-value" class="fs-input" placeholder="السعر">
                <span class="currency-label" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-weight: 700;">${currency}</span>
            </div>
        `;
    } else {
        container.innerHTML = `
            <label class="stat-label">رابط المنتج العالمي</label>
            <input type="url" id="o-link" class="fs-input" placeholder="https://amazon.com/...">
            <label class="stat-label">وصف المنتج</label>
            <textarea id="o-items" class="fs-input" placeholder="المواصفات المطلوبة..."></textarea>
            <label class="stat-label">القيمة المصرح بها</label>
            <div style="position: relative;">
                <input type="number" id="o-value" class="fs-input" placeholder="القيمة">
                <span class="currency-label" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-weight: 700;">${currency}</span>
            </div>
        `;
    }
};

async function loadOrders() {
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/orders', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return;
        const json = await r.json();
        orders = json.data || json;
        if(!Array.isArray(orders)) orders = [];
        
        document.getElementById('stat-total').innerText = orders.length;
        document.getElementById('stat-pending').innerText = orders.filter(o => o.status === 'pending').length;

        const dashList = document.getElementById('dash-orders-list');
        const trackList = document.getElementById('orders-tracking-list');
        
        const renderOrder = (o) => {
            const statuses = ['pending', 'approved', 'in_progress', 'completed'];
            const currentIdx = statuses.indexOf(o.status);
            const isRejected = o.status === 'rejected';
            
            return `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="font-weight: 900; color: var(--accent);">${o.serial_number || ''}</span>
                        <span style="font-size: 12px; opacity: 0.5;">${o.created_at ? new Date(o.created_at).toLocaleDateString('ar-JO') : ''}</span>
                    </div>

                    ${isRejected ? `
                        <div style="background: rgba(255,0,0,0.1); border: 1px solid #ff4444; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                            <div style="color: #ff4444; font-weight: 900; font-size: 14px;">❌ تم رفض الطلب</div>
                            <div style="color: #ff4444; font-size: 12px; margin-top: 5px;">السبب: ${o.rejection_reason || 'غير محدد'}</div>
                        </div>
                    ` : `
                        <div class="timeline">
                            <div class="t-step ${currentIdx >= 0 ? 'active' : ''}">
                                <div class="t-dot">1</div>
                                <div class="t-label">مراجعة</div>
                            </div>
                            <div class="t-step ${currentIdx >= 1 ? 'active' : ''}">
                                <div class="t-dot">2</div>
                                <div class="t-label">دفع</div>
                            </div>
                            <div class="t-step ${currentIdx >= 2 ? 'active' : ''}">
                                <div class="t-dot">3</div>
                                <div class="t-label">شحن</div>
                            </div>
                            <div class="t-step ${currentIdx >= 3 ? 'active' : ''}">
                                <div class="t-dot">4</div>
                                <div class="t-label">تسليم</div>
                            </div>
                        </div>
                    `}

                    <div style="font-size: 13px; margin-bottom: 15px;">
                        <div><strong>النوع:</strong> ${o.type === 'parcel' ? 'شحن طرد' : o.type === 'buy' ? 'اشترِ لي' : 'تسوق عالمي'}</div>
                        <div><strong>المحتوى:</strong> ${o.items || 'عام'}</div>
                    </div>

                    ${o.status !== 'pending' && o.status !== 'rejected' ? `
                        <div class="invoice-box">
                            <div class="inv-row"><span>أجور الشحن</span><span>${o.shipping_fees || 0} د.أ</span></div>
                            <div class="inv-row"><span>الجمارك والضرائب</span><span>${(parseFloat(o.customs_fees) || 0) + (parseFloat(o.tax_value) || 0)} د.أ</span></div>
                            <div class="inv-row"><span>التأمين</span><span>${o.insurance_amount || 0} د.أ</span></div>
                            <div class="inv-row"><span>التوصيل المحلي</span><span>${o.local_delivery_fees || 0} د.أ</span></div>
                            <div class="inv-row inv-total"><span>المجموع الكلي</span><span>${o.final_price || 0} د.أ</span></div>
                        </div>
                    ` : ''}

                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        ${o.status === 'pending' ? `<button class="btn btn-outline" style="flex: 1; border-color: #ff4444; color: #ff4444;" onclick="cancelOrder('${o.id}')">إلغاء الطلب</button>` : ''}
                        ${o.waybill_url ? `<button class="btn" style="flex: 1;" onclick="window.open('${o.waybill_url}')">📄 البوليصة</button>` : ''}
                        <button class="btn btn-glass" style="flex: 1;" onclick="viewOrderFiles('${o.id}')">📎 الملفات</button>
                        <button class="btn btn-outline" style="flex: 1;" onclick="showSection('tickets')">🎫 مساعدة</button>
                    </div>
                </div>
            `;
        };

        dashList.innerHTML = orders.slice(0, 3).map(renderOrder).join('') || '<p style="text-align:center; opacity:0.5;">لا توجد طلبات بعد</p>';
        trackList.innerHTML = orders.map(renderOrder).join('') || '<p style="text-align:center; opacity:0.5;">لا توجد طلبات بعد</p>';
    } catch(e) { console.error(e); }
}

async function loadAddresses() {
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/addresses', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return;
        const json = await r.json();
        addresses = json.data || json;
        if(!Array.isArray(addresses)) addresses = [];
        
        const select = document.getElementById('order-address');
        select.innerHTML = '<option value="">اختر من دفتر العناوين...</option>' + 
            addresses.map(a => `<option value="${a.id}">${a.name} - ${a.phone}</option>`).join('');
        
        document.getElementById('address-book-list').innerHTML = addresses.map(a => `
            <div class="card" style="padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 800;">${a.name}</div>
                    <div style="font-size: 12px; opacity: 0.6;">${a.phone} | ${a.address}</div>
                </div>
                <button class="btn btn-outline" style="padding: 5px 10px; color: #ff4444; border-color: #ff4444;" onclick="deleteAddress('${a.id}')">حذف</button>
            </div>
        `).join('') || '<p style="text-align:center; opacity:0.5;">لا توجد عناوين محفوظة</p>';
    } catch(e) { console.error(e); }
}

window.saveAddress = async function() {
    const name = document.getElementById('addr-name').value;
    const phone = document.getElementById('addr-phone').value;
    const address = document.getElementById('addr-val').value;
    
    if (!name || !phone || !address) return window.toast('يرجى ملء كافة الحقول');

    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/addresses', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ name, phone, address })
        });
        if (r.ok) {
            window.toast('تم حفظ العنوان');
            document.getElementById('addr-name').value = '';
            document.getElementById('addr-phone').value = '';
            document.getElementById('addr-val').value = '';
            loadAddresses();
        } else {
            window.toast('حدث خطأ أثناء حفظ العنوان');
        }
    } catch(e) { console.error(e); }
};

window.deleteAddress = async function(id) {
    if (confirm('هل أنت متأكد من حذف هذا العنوان؟')) {
        try {
            await fetchWithAuth(`/api/v1/customer/portal/addresses/${id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'X-CSRF-Token': csrfToken
                }
            });
            loadAddresses();
        } catch(e) { console.error(e); }
    }
};

window.toggleInsurance = function() {
    insuranceEnabled = !insuranceEnabled;
    document.getElementById('insurance-toggle').classList.toggle('active', insuranceEnabled);
};

window.updateDeliveryFee = function() {
    // Logic to update delivery fee display if needed
};

window.handleProductUpload = async function(input) {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/upload/product', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: formData
        });
        const json = await r.json();
        const data = json.data || json;
        if (data.filePath) {
            selectedProductImg = data.filePath;
            const preview = document.getElementById('product-img-preview');
            preview.style.display = 'block';
            preview.style.backgroundImage = `url(${data.filePath})`;
            window.toast('تم رفع الصورة');
        }
    } catch(e) { console.error(e); }
};

window.uploadID = async function(input) {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/upload/id', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: formData
        });
        if (r.ok) {
            window.toast('تم رفع الهوية، بانتظار المراجعة');
            init();
        } else {
            window.toast('حدث خطأ أثناء رفع الهوية');
        }
    } catch(e) { console.error(e); }
};

window.submitOrder = async function() {
    const type = document.getElementById('order-type').value;
    const address_id = document.getElementById('order-address').value;
    const delivery_method = document.getElementById('delivery-method').value;
    const itemsText = document.getElementById('o-items').value;
    const value = document.getElementById('o-value').value;
    const origin_country = document.getElementById('origin-country').value;
    const destination_country = document.getElementById('destination-country').value;
    const currency = origin_country === 'Jordan' ? 'JOD' : 'DZD';
    
    if (!address_id || !itemsText || !value) return window.toast('يرجى إكمال بيانات الطلب والعنوان');

    const payload = {
        type,
        address_id,
        delivery_method,
        items: [{ description: itemsText, quantity: 1, price: parseFloat(value) }],
        declared_value: parseFloat(value),
        insurance_enabled: insuranceEnabled,
        customs_included: customsEnabled,
        origin_country,
        destination_country,
        currency,
        product_image_url: selectedProductImg
    };

    if (type === 'parcel') {
        payload.weight = parseFloat(document.getElementById('o-weight').value) || 0;
        payload.package_type = document.getElementById('o-package-type').value;
        payload.length = parseFloat(document.getElementById('o-length').value) || 0;
        payload.width = parseFloat(document.getElementById('o-width').value) || 0;
        payload.height = parseFloat(document.getElementById('o-height').value) || 0;
    }

    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/orders', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload)
        });
        
        if (r.ok) {
            window.toast('تم إنشاء الطلب بنجاح');
            window.showSection('tracking');
            loadOrders();
            
            // Reset form
            document.getElementById('o-items').value = '';
            document.getElementById('o-value').value = '';
            selectedProductImg = null;
            document.getElementById('product-img-preview').style.display = 'none';
        } else {
            window.toast('فشل إنشاء الطلب');
        }
    } catch(e) { console.error(e); }
};

window.cancelOrder = async function(id) {
    if(confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
        try {
            const r = await fetchWithAuth(`/api/v1/customer/portal/orders/${id}/cancel`, {
                method: 'POST',
                credentials: 'include',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'X-CSRF-Token': csrfToken
                }
            });
            if(r.ok) {
                window.toast('تم إلغاء الطلب');
                loadOrders();
            } else {
                window.toast('لا يمكن إلغاء الطلب في هذه المرحلة');
            }
        } catch(e) { console.error(e); }
    }
};

async function loadTransactions() {
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return;
        const json = await r.json();
        let trans = json.data || json;
        if(!Array.isArray(trans)) trans = [];
        
        document.getElementById('transactions-list').innerHTML = trans.map(t => `
            <div style="display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border);">
                <div>
                    <div style="font-weight: 700;">${t.type === 'deposit' ? 'إيداع' : (t.type === 'payment' ? 'دفع طلب' : 'حركة مالية')}</div>
                    <div style="font-size: 11px; opacity: 0.5;">${t.created_at ? new Date(t.created_at).toLocaleString('ar-JO') : ''}</div>
                    <div style="font-size: 10px; opacity: 0.4;">${t.description || ''}</div>
                </div>
                <div style="font-weight: 900; color: ${['deposit', 'refund'].includes(t.type) ? '#00ff00' : '#ff4444'};">
                    ${['deposit', 'refund'].includes(t.type) ? '+' : '-'}${t.amount} د.أ
                </div>
            </div>
        `).join('') || '<p style="text-align:center; opacity:0.5; padding: 20px;">لا توجد حركات مالية</p>';
    } catch(e) { console.error(e); }
}

async function loadPayments() {
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/payments', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return;
        const json = await r.json();
        let payments = json.data || json;
        if(!Array.isArray(payments)) payments = [];
        
        document.getElementById('payments-list').innerHTML = payments.map(p => `
            <div style="display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border);">
                <div>
                    <div style="font-weight: 700;">دفع شحنة #${p.shipment_id ? p.shipment_id.substring(0,8) : ''}</div>
                    <div style="font-size: 11px; opacity: 0.5;">${p.created_at ? new Date(p.created_at).toLocaleString('ar-JO') : ''}</div>
                    <div style="font-size: 10px; opacity: 0.4;">الطريقة: ${p.method === 'wallet' ? 'المحفظة' : p.method}</div>
                </div>
                <div style="text-align: left;">
                    <div style="font-weight: 900; color: #ff4444;">-${p.amount} د.أ</div>
                    <div style="font-size: 10px; color: ${p.status === 'completed' ? '#00ff00' : '#ff8a00'};">${p.status === 'completed' ? 'مكتمل' : 'معلق'}</div>
                </div>
            </div>
        `).join('') || '<p style="text-align:center; opacity:0.5; padding: 20px;">لا توجد مدفوعات</p>';
    } catch(e) { console.error(e); }
}

window.viewOrderFiles = async function(orderId) {
    try {
        const r = await fetchWithAuth(`/api/v1/customer/portal/orders/${orderId}/files`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return window.toast('فشل تحميل الملفات');
        const json = await r.json();
        const files = json.data || [];
        
        if(files.length === 0) return window.toast('لا توجد ملفات مرفوعة لهذا الطلب');
        
        const fileList = files.map(f => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--glass); border-radius: 8px; margin-bottom: 5px;">
                <span style="font-size: 12px;">${f.type === 'product_image' ? 'صورة المنتج' : f.type}</span>
                <a href="${f.file_url}" target="_blank" style="color: var(--accent); text-decoration: none; font-weight: 700;">عرض 📎</a>
            </div>
        `).join('');
        
        // Simple alert for now, could be a modal
        const div = document.createElement('div');
        div.innerHTML = `
            <div id="file-modal" class="modal-overlay show" style="z-index: 2000;">
                <div class="modal">
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    <h2>ملفات الطلب</h2>
                    <div style="margin-top: 20px;">${fileList}</div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    } catch(e) { console.error(e); }
};

async function loadTickets() {
    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/tickets', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return;
        const json = await r.json();
        let tickets = json.data || json;
        if(!Array.isArray(tickets)) tickets = [];
        
        document.getElementById('tickets-list').innerHTML = tickets.map(t => {
            const adminReply = t.admin_reply ? `
                <div style="margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(0, 255, 163, 0.08); border: 1px solid rgba(0, 255, 163, 0.2);">
                    <div style="font-size: 12px; font-weight: 800; color: var(--accent); margin-bottom: 6px;">رد الإدارة</div>
                    <div style="font-size: 13px; line-height: 1.7;">${formatMultilineText(t.admin_reply)}</div>
                </div>
            ` : '';

            return `
                <div class="card" style="padding: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; gap: 12px;">
                        <strong>${escapeHtml(t.subject || '')}</strong>
                        <span style="font-size: 11px; color: var(--accent); white-space: nowrap;">${escapeHtml(t.status || '')}</span>
                    </div>
                    <p style="font-size: 13px; opacity: 0.7; line-height: 1.7;">${formatMultilineText(t.message || '')}</p>
                    ${adminReply}
                </div>
            `;
        }).join('') || '<p style="text-align:center; opacity:0.5;">لا توجد تذاكر دعم</p>';
    } catch(e) { console.error(e); }
}

window.sendTicket = async function() {
    const subject = document.getElementById('t-subject').value;
    const message = document.getElementById('t-message').value;
    if (!subject || !message) return window.toast('يرجى كتابة الموضوع والرسالة');

    try {
        const r = await fetchWithAuth('/api/v1/customer/portal/tickets', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ subject, message })
        });
        if(r.ok) {
            window.toast('تم إرسال التذكرة');
            document.getElementById('t-subject').value = '';
            document.getElementById('t-message').value = '';
            loadTickets();
        } else {
            window.toast('حدث خطأ أثناء إرسال التذكرة');
        }
    } catch(e) { console.error(e); }
};

window.toast = function(msg) {
    const t = document.getElementById('toast');
    if(t) {
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }
};

window.logout = async function() {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ refreshToken })
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/web/index.html';
};

fetchCsrfToken().then(() => {
    init();
});
