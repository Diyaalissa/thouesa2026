async function checkStatus() {
    try {
        const healthRes = await fetch('/api/health');
        const health = await healthRes.json();
        
        document.getElementById('server-indicator').className = `status-indicator status-${health.status === 'ok' ? 'ok' : 'error'}`;
        document.getElementById('server-msg').innerText = health.status === 'ok'
            ? 'الخدمة متاحة وتستجيب بنجاح'
            : 'الخدمة غير متاحة حالياً';
        
        document.getElementById('db-indicator').className = 'status-indicator status-ok';
        document.getElementById('db-msg').innerText = 'تفاصيل قاعدة البيانات لم تعد مكشوفة عبر المسار العام';
        
    } catch (error) {
        console.error('Status check failed:', error);
        document.getElementById('server-indicator').className = 'status-indicator status-error';
        document.getElementById('server-msg').innerText = 'فشل الاتصال بالسيرفر';
        document.getElementById('db-indicator').className = 'status-indicator status-error';
        document.getElementById('db-msg').innerText = 'لا يمكن التحقق من الحالة العامة حالياً';
    }
}

checkStatus();
setInterval(checkStatus, 30000);
