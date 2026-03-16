// Client Authentication Logic for index.html

let csrfToken = '';

// Fetch CSRF Token
const fetchCsrfToken = async () => {
    try {
        const response = await fetch('/api/csrf-token', { credentials: 'include' });
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
};

// Helper for API errors
const handleApiError = (data, defaultMsg) => {
    if (data.status === 'fail' || data.status === 'error') {
        return data.message || defaultMsg;
    }
    return data.error || data.message || defaultMsg;
};

// Expose login and register to global scope so onclick handlers in index.html work
window.login = async function() {
    const country = document.getElementById('l-country').value;
    let phone = document.getElementById('l-phone').value.trim();
    const password = document.getElementById('l-pass').value;

    if (!phone || !password) {
        alert('يرجى إدخال رقم الهاتف وكلمة المرور');
        return;
    }

    // Clean phone number
    if (phone.startsWith('0')) phone = phone.substring(1);
    const fullPhone = country + phone;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ phone: fullPhone, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = data.user.role === 'admin' ? '/web/gate77.html' : '/web/client.html';
        } else {
            alert(handleApiError(data, 'خطأ في المصادقة'));
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('فشل الاتصال بالخادم');
    }
};

window.register = async function() {
    const full_name = document.getElementById('r-name').value;
    const email = document.getElementById('r-email').value;
    const country = document.getElementById('r-country').value;
    let phone = document.getElementById('r-phone').value.trim();
    const password = document.getElementById('r-pass').value;

    if (!full_name || !phone || !password) {
        alert('يرجى ملء جميع الحقول الإلزامية');
        return;
    }

    // Clean phone number
    if (phone.startsWith('0')) phone = phone.substring(1);
    const fullPhone = country + phone;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ name: full_name, email, password, phone: fullPhone })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = '/web/client.html';
        } else {
            alert(handleApiError(data, 'خطأ في التسجيل'));
        }
    } catch (error) {
        console.error('Register error:', error);
        alert('فشل الاتصال بالخادم');
    }
};

// Init
console.log('client.js loaded, fetching CSRF token...');
fetchCsrfToken();
