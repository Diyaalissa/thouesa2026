// site-init.js
document.addEventListener('DOMContentLoaded', async () => {
    let settings = window.SITE_CONFIG || { site_name: 'تحويسة', logo: '/web/assets/logo/logo.png' };
    
    try {
        const response = await fetch('/api/v1/public/portal/settings');
        if (response.ok) {
            const json = await response.json();
            if (json.status === 'success' && json.data) {
                // Merge fetched settings with local config
                settings = { ...settings, ...json.data };
            }
        }
    } catch (error) {
        console.error('Failed to fetch settings:', error);
    }

    // Set Logo
    const logoUrl = settings.site_logo || settings.logo || '/web/assets/logo/logo.png';
    document.querySelectorAll('[data-logo]').forEach(img => {
        img.src = logoUrl;
    });
    
    // Set Site Name
    const siteName = settings.site_name || settings.name || 'تحويسة';
    document.querySelectorAll('[data-site-name]').forEach(el => {
        el.textContent = siteName;
    });
    
    // Set Page Title
    if (document.title.includes('THOUESA')) {
        document.title = document.title.replace('THOUESA', siteName);
    } else if (document.title.includes('تحويسة')) {
        document.title = document.title.replace('تحويسة', siteName);
    }

    // Check System Health
    try {
        const healthResponse = await fetch('/api/health');
        if (healthResponse.ok) {
            const health = await healthResponse.json();
            if (health.status !== 'ok') {
                showOfflineBanner(health.database);
            }
        } else {
            showOfflineBanner('unknown');
        }
    } catch (error) {
        showOfflineBanner('offline');
    }

    // Set Hero Title and Slogan if they exist
    if (settings.hero_title) {
        document.querySelectorAll('[data-hero-title]').forEach(el => el.textContent = settings.hero_title);
        const mTitle = document.getElementById('m-title');
        if (mTitle) mTitle.textContent = settings.hero_title;
    }
    if (settings.hero_slogan) {
        document.querySelectorAll('[data-hero-slogan]').forEach(el => el.textContent = settings.hero_slogan);
        const mDesc = document.getElementById('m-desc');
        if (mDesc) mDesc.textContent = settings.hero_slogan;
    }
});

function showOfflineBanner(status) {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.width = '100%';
    banner.style.background = 'rgba(242, 125, 38, 0.9)';
    banner.style.color = 'white';
    banner.style.textAlign = 'center';
    banner.style.padding = '10px';
    banner.style.zIndex = '9999';
    banner.style.fontSize = '14px';
    banner.style.fontWeight = 'bold';
    banner.style.direction = 'rtl';
    banner.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

    let message = '⚠️ النظام يعمل في وضع المعاينة (بدون قاعدة بيانات). بعض الوظائف قد لا تعمل.';
    if (status === 'unconfigured') {
        message = '⚠️ لم يتم إعداد قاعدة البيانات بعد. يرجى مراجعة ملف .env';
    } else if (status === 'disconnected') {
        message = '⚠️ فشل الاتصال بقاعدة البيانات. تأكد من تشغيل MySQL.';
    }

    banner.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: white; color: var(--accent); border: none; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">إغلاق</button>
        </div>
    `;
    document.body.prepend(banner);
    
    // Adjust body padding to not hide content under banner
    document.body.style.paddingTop = '40px';
}
