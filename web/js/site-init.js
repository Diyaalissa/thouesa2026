import { SITE_CONFIG } from '../config/siteConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    // Set Logo
    document.querySelectorAll('[data-logo]').forEach(img => {
        img.src = SITE_CONFIG.logo;
    });
    
    // Set Site Name
    document.querySelectorAll('[data-site-name]').forEach(el => {
        el.textContent = SITE_CONFIG.name;
    });
    
    // Set Page Title
    if (document.title.includes('THOUESA')) {
        document.title = document.title.replace('THOUESA', SITE_CONFIG.name);
    }
});
