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
