async function checkStatus() {
    try {
        const healthRes = await fetch('/api/health');
        const health = await healthRes.json();
        
        document.getElementById('server-indicator').className = `status-indicator status-${health.status === 'ok' ? 'ok' : 'error'}`;
        document.getElementById('server-msg').innerText = `السيرفر يعمل بشكل طبيعي (الإصدار: ${health.version})`;
        
        document.getElementById('db-indicator').className = `status-indicator status-${health.database === 'connected' ? 'ok' : 'error'}`;
        document.getElementById('db-msg').innerText = health.database === 'connected' ? 'قاعدة البيانات متصلة' : 'خطأ في الاتصال بقاعدة البيانات';
        
    } catch (error) {
        console.error('Status check failed:', error);
        document.getElementById('server-indicator').className = 'status-indicator status-error';
        document.getElementById('server-msg').innerText = 'فشل الاتصال بالسيرفر';
    }
}

checkStatus();
setInterval(checkStatus, 30000);
