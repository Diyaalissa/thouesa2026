let sets = {};

// Splash Screen Logic
function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
        setTimeout(() => splash.style.display = 'none', 800);
    }
}

window.addEventListener('load', hideSplash);
document.addEventListener('DOMContentLoaded', () => {
    // Fallback if load takes too long
    setTimeout(hideSplash, 3000);
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
});

async function load() {
    console.log('Starting settings load...');
    try {
        const r = await fetch('/api/v1/public/portal/settings');
        console.log('Settings fetch response:', r.status);
        if (r.ok) {
            const json = await r.json();
            sets = json.data || json;
            console.log('Settings loaded:', !!sets);
            if (document.getElementById('m-title')) document.getElementById('m-title').innerText = sets.hero_title || 'تحويسة | شحنك الشخصي صار أسهل';
            if (document.getElementById('m-desc')) document.getElementById('m-desc').innerText = sets.hero_slogan || 'المنصة الأولى والآمنة لخدمات الشحن والوساطة التجارية بين الجزائر والأردن.';
            if (document.getElementById('about-title')) document.getElementById('about-title').innerText = sets.main_screen_title || 'عن تحويسة';
            if (document.getElementById('about-desc')) document.getElementById('about-desc').innerText = sets.main_screen_description || 'نحن نقدم حلولاً لوجستية مبتكرة تربط بين الأردن والجزائر، مع التركيز على الأمان والسرعة والشفافية في كل شحنة.';
            if (document.getElementById('news-text')) document.getElementById('news-text').innerText = sets.news_text || 'نحن نوسع شبكة استلامنا في الجزائر لتشمل 48 ولاية قريباً!';
            if (document.getElementById('footer-copy')) document.getElementById('footer-copy').innerText = sets.footer_text || '© 2026 تحويسة للخدمات اللوجستية والشحن. جميع الحقوق محفوظة.';
            
            // Logo Management
            const logos = document.querySelectorAll('img[data-logo]');
            logos.forEach(img => {
                img.src = sets.site_logo || '/assets/logo/logo.png';
            });

            // Social Links
            const socials = {
                fb: { id: 'fb', url: sets.social_facebook, icon: '🔵' },
                wa: { id: 'wa', url: sets.social_whatsapp, icon: '💬' },
                ig: { id: 'ig', url: sets.social_instagram, icon: '📸' },
                tt: { id: 'tt', url: sets.social_tiktok, icon: '🎵' }
            };

            Object.keys(socials).forEach(key => {
                const s = socials[key];
                if (s.url) {
                    const footerLink = document.getElementById(`link-${s.id}`);
                    const modalLink = document.getElementById(`modal-${s.id}`);
                    if (footerLink) {
                        footerLink.href = s.url;
                        footerLink.classList.remove('hidden');
                        footerLink.innerText = s.id.toUpperCase();
                    }
                    if (modalLink) {
                        modalLink.href = s.url;
                        modalLink.classList.remove('hidden');
                    }
                }
            });
            
            if (document.getElementById('terms-content')) document.getElementById('terms-content').innerText = sets.terms_conditions || 'سيتم إضافة الشروط والأحكام قريباً.';
            if (document.getElementById('privacy-content')) document.getElementById('privacy-content').innerText = sets.privacy_policy || 'سيتم إضافة سياسة الخصوصية قريباً.';

            // Dynamic Texts
            if (sets.hero_title && document.getElementById('m-title')) document.getElementById('m-title').innerText = sets.hero_title;
            if (sets.hero_slogan && document.getElementById('m-desc')) document.getElementById('m-desc').innerText = sets.hero_slogan;
            if (sets.main_screen_title && document.getElementById('about-title')) document.getElementById('about-title').innerText = sets.main_screen_title;
            if (sets.main_screen_description && document.getElementById('about-desc')) document.getElementById('about-desc').innerText = sets.main_screen_description;
            if (sets.news_text && document.getElementById('news-text')) document.getElementById('news-text').innerText = sets.news_text;

            if (sets.hero_bg) {
                document.body.style.setProperty('--hero-bg', `url(${sets.hero_bg})`);
            }
            if (sets.hero_bg_mobile) {
                document.body.style.setProperty('--hero-bg-mobile', `url(${sets.hero_bg_mobile})`);
            }

            if (sets.faqs) {
                try {
                    const faqs = typeof sets.faqs === 'string' ? JSON.parse(sets.faqs) : sets.faqs;
                    if (Array.isArray(faqs)) {
                        const faqHtml = faqs.map(f => `
                            <div class="glass-card" style="padding: 20px; margin-bottom: 15px; cursor: pointer;" onclick="toggleFaq(this)">
                                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700;">
                                    <span>${f.q}</span>
                                    <span style="color: var(--accent);">+</span>
                                </div>
                                <div class="faq-answer hidden" style="margin-top: 15px; color: var(--text-dim); font-size: 14px; border-top: 1px solid var(--border); padding-top: 15px;">
                                    ${f.a}
                                </div>
                            </div>
                        `).join('');
                        if (document.getElementById('faq-list')) document.getElementById('faq-list').innerHTML = faqHtml;
                        if (document.getElementById('faq-modal-list')) document.getElementById('faq-modal-list').innerHTML = faqHtml;
                    }
                } catch (e) { console.error('FAQ parse error', e); }
            }
        }
    } catch (err) {
        console.error('Settings load error:', err);
    }
    
    try {
        const rTrips = await fetch('/api/v1/public/portal/trips');
        if (rTrips.ok) {
            const json = await rTrips.json();
            const trips = json.data || json;
            if (Array.isArray(trips) && trips.length > 0 && trips[0].trip_date) {
                const tripDate = new Date(trips[0].trip_date);
                if (!isNaN(tripDate.getTime())) {
                    const options = { year: 'numeric', month: 'long', day: 'numeric' };
                    const el = document.getElementById('trip-date-display');
                    if (el) el.innerText = tripDate.toLocaleDateString('ar-JO', options);
                }
            }
        }
    } catch (err) {
        console.error('Trips load error:', err);
    }

    try {
        const rReviews = await fetch('/api/v1/public/portal/reviews');
        if (rReviews.ok) {
            const json = await rReviews.json();
            const reviews = json.data || json;
            let reviewsHtml = '';
            if (Array.isArray(reviews) && reviews.length > 0) {
                reviewsHtml = reviews.map(r => {
                    const initials = r.full_name ? r.full_name.split(' ').map(n => n[0]).join('').substring(0, 2) : '??';
                    return `
                        <div class="glass review-card">
                            <div class="rating">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5-(r.rating || 5))}</div>
                            <p>${r.comment || ''}</p>
                            <div class="user-info">
                                <div class="avatar">${initials}</div>
                                <div>
                                    <div class="name">${r.full_name || 'عميل موثق'}</div>
                                    <div class="verified">✓ عميل موثق</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                const fallbacks = [
                    { name: 'أحمد بن يوسف', rating: 5, comment: 'خدمة ممتازة وسريعة جداً. وصلت الشحنة من عمان إلى الجزائر العاصمة في أقل من 10 أيام وبحالة ممتازة.' },
                    { name: 'سارة محمود', rating: 5, comment: 'جربت خدمة "اشترِ لي" وكانت تجربة رائعة. وفروا علي عناء البحث والدفع الدولي. شكراً لفريق تحويسة.' },
                    { name: 'محمد علي', rating: 4, comment: 'تعامل راقي جداً وتتبع دقيق للشحنة. أنصح بالتعامل معهم لمن يبحث عن الأمان والمصداقية.' }
                ];
                reviewsHtml = fallbacks.map(f => {
                    const initials = f.name.split(' ').map(n => n[0]).join('').substring(0, 2);
                    return `
                        <div class="glass review-card">
                            <div class="rating">${'★'.repeat(f.rating)}${'☆'.repeat(5-f.rating)}</div>
                            <p>${f.comment}</p>
                            <div class="user-info">
                                <div class="avatar">${initials}</div>
                                <div>
                                    <div class="name">${f.name}</div>
                                    <div class="verified">✓ عميل موثق</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            const el = document.getElementById('reviews-list');
            if (el) el.innerHTML = reviewsHtml;
        }
    } catch (err) {
        console.error('Reviews load error:', err);
    }
}

// Attach functions to window so they can be called from HTML onclick handlers
window.toggleTheme = function() { document.body.classList.toggle('light-mode'); };
window.openMod = function(id) { 
    console.log('Opening modal:', id);
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        // Force a reflow to ensure transition works
        el.offsetHeight; 
    } else {
        console.error('Modal element not found:', id);
    }
};

window.closeMod = function(id) { 
    console.log('Closing modal:', id);
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden'); 
};
window.togA = function(m) {
    document.getElementById('login-f').classList.toggle('hidden', m==='reg');
    document.getElementById('reg-f').classList.toggle('hidden', m!=='reg');
};

window.toggleFaq = function(el) {
    const answer = el.querySelector('.faq-answer');
    const icon = el.querySelector('span:last-child');
    answer.classList.toggle('hidden');
    icon.innerText = answer.classList.contains('hidden') ? '+' : '-';
};

load();
