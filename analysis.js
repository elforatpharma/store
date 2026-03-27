/**
 * ELFORAT PHARMA - FULL INTEGRATED SCRIPT
 * النسخة الكاملة: التصميم الأصلي + سوبابيز + الترتيب + الخط المتحرك + الصور
 */

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. إعدادات السيرفر وقاعدة البيانات
    // ==========================================
    const supabaseUrl = 'https://sidtdxchiqiogfkwbdui.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZHRkeGNoaXFpb2dma3diZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTEyMTAsImV4cCI6MjA4OTY4NzIxMH0.QF1-67Qu2HfWJt3ANSegM87fykOYQBwqC7ggLG8LTVU';
    const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

  let productsDB = [];
    let cart = [];

    // ==========================================
    // دوال حفظ واسترجاع السلة (الجديدة)
    // ==========================================
    function loadCart() {
        const savedCart = localStorage.getItem('elforat_cart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
        }
    }

    function saveCart() {
        localStorage.setItem('elforat_cart', JSON.stringify(cart));
    }

    // دالة إصلاح المسارات لضمان ظهور الصور من فولدر uploads
    function getFullImg(path) {
        if (!path) return 'logo.png';
        if (path.startsWith('http')) return path;
        const cleanPath = path.replace('uploads/', '');
        return `${supabaseUrl}/storage/v1/object/public/products/uploads/${cleanPath}`;
    }

    async function fetchProducts() {
        try {
            // [تعديل الترتيب]: جلب المنتجات مرتبة حسب الـ ID لضمان الترتيب القديم
            const { data, error } = await _supabase
                .from('products')
                .select('*')
                .order('priority', { ascending: false }); // الترتيب حسب الأولوية
            
            if (error) throw error;

            productsDB = data.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category || 'عام',
                price: parseFloat(p.price) || 0,
                oldPrice: p.oldPrice || null,
                img: getFullImg(p.img),
                badge: p.badge || '',
                desc: p.desc || '',
                ingredients: p.ingredients || '',
                size: p.size || ''
            }));
        } catch (err) {
            console.warn('تعذر الاتصال بالسيرفر، سيتم استخدام البيانات المحلية الاحتياطية.');
            productsDB = [
                { id: 'p1', name: 'Guzel Gold Serum', category: 'العناية بالشعر', price: 250, oldPrice: 350, img: getFullImg('guzel_gold.png'), badge: 'خصم 28%' }
            ];
        } finally {
            // دمج المجموعات المتكاملة دايماً
            const bundles = [
                { id: 'b1', name: 'مجموعة الديتوكس والترطيب', category: 'مجموعات متكاملة', price: 125, oldPrice: 175, img: getFullImg('group1.png'), badge: 'توفير' },
                { id: 'b2', name: 'مجموعة العناية الفائقة بالمناطق الحساسة', category: 'مجموعات متكاملة', price: 280, oldPrice: 380, img: getFullImg('group2.png'), badge: 'عرض خاص' },
                { id: 'b3', name: 'مجموعة النعومة وعلاج جلد الوزة', category: 'مجموعات متكاملة', price: 350, oldPrice: 470, img: getFullImg('group3.png'), badge: 'الأكثر طلباً' }
            ];
            productsDB = [...productsDB, ...bundles];

            // الهدايا تُجلب ديناميكياً من سوبابيز عبر loadGifts()
            
            renderCatalog();
        }
    }

        // ==========================================
    // دوال الإشعارات والصوت (Custom Alert & Snackbar)
    // ==========================================
    function showCustomAlert(message, type = 'error') {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center opacity-0 transition-opacity duration-300';
        
        const icon = type === 'error' 
            ? `<div class="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></div>`
            : `<div class="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>`;

        const modal = document.createElement('div');
        modal.className = 'bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-[90%] text-center transform scale-90 transition-transform duration-300';
        modal.innerHTML = `
            ${icon}
            <h3 class="text-xl font-black text-gray-900 mb-2">${type === 'error' ? 'تنبيه!' : 'نجاح!'}</h3>
            <p class="text-gray-600 text-sm mb-6 leading-relaxed">${message}</p>
            <button class="w-full py-3 bg-primary text-white rounded-full font-bold hover:bg-black transition-colors" onclick="this.closest('.fixed').remove()">حسناً، فهمت</button>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-90');
            modal.classList.add('scale-100');
        });
    }

    // دالة إظهار الشريط السفلي (Snackbar)
    function showCartPopup() {
        let popup = document.getElementById('smart-cart-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'smart-cart-popup';
            popup.className = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center justify-between gap-6 z-[999] transition-all duration-300 translate-y-20 opacity-0 min-w-[300px] w-[90%] md:w-auto';
            popup.innerHTML = `
                <span class="font-bold text-sm">تم إضافة المنتج للحقيبة 🛍️</span>
                <button onclick="app.navigate('cart'); document.getElementById('smart-cart-popup').classList.add('translate-y-20', 'opacity-0');" class="bg-primary text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">الذهاب للسلة</button>
            `;
            document.body.appendChild(popup);
        }

        requestAnimationFrame(() => {
            popup.classList.remove('translate-y-20', 'opacity-0');
        });

        clearTimeout(window.cartPopupTimeout);
        window.cartPopupTimeout = setTimeout(() => {
            if (popup) popup.classList.add('translate-y-20', 'opacity-0');
        }, 4000);
    }

    // دالة تشغيل الصوت
    function playCartSound() {
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/water/pop.ogg');
            audio.volume = 0.5;
            audio.play().catch(e => console.log('سياسة المتصفح تمنع تشغيل الصوت تلقائياً قبل تفاعل المستخدم'));
        } catch (err) {
            console.error('خطأ في تشغيل الصوت:', err);
        }
    }

  // ==========================================
    // دوال الإشعارات والصوت (Custom Alert & Snackbar)
    // ==========================================
    function showCustomAlert(message, type = 'error') {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center opacity-0 transition-opacity duration-300';
        
        const icon = type === 'error' 
            ? `<div class="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></div>`
            : `<div class="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>`;

        const modal = document.createElement('div');
        modal.className = 'bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-[90%] text-center transform scale-90 transition-transform duration-300';
        modal.innerHTML = `
            ${icon}
            <h3 class="text-xl font-black text-gray-900 mb-2">${type === 'error' ? 'تنبيه!' : 'نجاح!'}</h3>
            <p class="text-gray-600 text-sm mb-6 leading-relaxed">${message}</p>
            <button class="w-full py-3 bg-primary text-white rounded-full font-bold hover:bg-black transition-colors" onclick="this.closest('.fixed').remove()">حسناً، فهمت</button>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-90');
            modal.classList.add('scale-100');
        });
    }

    // دالة إظهار الشريط السفلي (Snackbar)
    function showCartPopup() {
        let popup = document.getElementById('smart-cart-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'smart-cart-popup';
            popup.className = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center justify-between gap-6 z-[999] transition-all duration-300 translate-y-20 opacity-0 min-w-[300px] w-[90%] md:w-auto';
            popup.innerHTML = `
                <span class="font-bold text-sm">تم إضافة المنتج للحقيبة 🛍️</span>
                <button onclick="app.navigate('cart'); document.getElementById('smart-cart-popup').classList.add('translate-y-20', 'opacity-0');" class="bg-primary text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">الذهاب للسلة</button>
            `;
            document.body.appendChild(popup);
        }

        requestAnimationFrame(() => {
            popup.classList.remove('translate-y-20', 'opacity-0');
        });

        clearTimeout(window.cartPopupTimeout);
        window.cartPopupTimeout = setTimeout(() => {
            if (popup) popup.classList.add('translate-y-20', 'opacity-0');
        }, 4000);
    }

    // دالة تشغيل الصوت
    function playCartSound() {
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/water/pop.ogg');
            audio.volume = 0.5;
            audio.play().catch(e => console.log('سياسة المتصفح تمنع تشغيل الصوت تلقائياً قبل تفاعل المستخدم'));
        } catch (err) {
            console.error('خطأ في تشغيل الصوت:', err);
        }
    }

    // ==========================================
    // 2. إعداد الـ Morphing Magic Line للناف بار
    // ==========================================
    const firstLink = document.querySelector('.nav-link');
    let morphLine;
    
    if (firstLink) {
        const navContainer = firstLink.parentElement;
        navContainer.style.position = 'relative';

        morphLine = document.createElement('div');
        morphLine.className = 'absolute bottom-[-4px] h-[3px] bg-primary transition-all duration-300 ease-out rounded-full';
        navContainer.appendChild(morphLine);

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('border-b-2', 'border-primary', 'border-transparent', 'pb-1');
        });
    }

    function updateNavMorph(activeId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-target') === activeId) {
                link.classList.add('text-primary');
                link.classList.remove('text-gray-900');
                
                if (morphLine) {
                    morphLine.style.width = `${link.offsetWidth}px`;
                    morphLine.style.left = `${link.offsetLeft}px`;
                }
            } else {
                link.classList.add('text-gray-900');
                link.classList.remove('text-primary');
            }
        });
    }

    window.addEventListener('resize', () => {
        const activeLink = document.querySelector('.nav-link.text-primary');
        if (activeLink && morphLine) {
            morphLine.style.width = `${activeLink.offsetWidth}px`;
            morphLine.style.left = `${activeLink.offsetLeft}px`;
        }
    });

    // ==========================================
    // 3. نظام الهدايا الديناميكي من سوبابيز
    // ==========================================
    let activeGifts = []; // هيتملى من سوبابيز عند التحميل

    async function loadGifts() {
        try {
            const { data, error } = await _supabase
                .from('gifts')
                .select('*')
                .eq('is_active', true);
            if (!error && data) activeGifts = data;
        } catch (e) {
            console.log('تعذر جلب الهدايا من سوبابيز');
        }
    }

    function checkOffers() {
        // إزالة كل الهدايا الحالية من السلة أولاً
        cart = cart.filter(i => !i.isGift);

        // تطبيق كل هدية نشطة من سوبابيز
        activeGifts.forEach(gift => {
            // البحث عن المنتج المشترط في السلة
            const triggerItem = cart.find(i =>
                i.name.toLowerCase().includes(gift.trigger_product_name.toLowerCase())
            );

            if (triggerItem && triggerItem.qty >= gift.trigger_qty) {
                const earnedQty = Math.floor(triggerItem.qty / gift.trigger_qty);
                cart.push({
                    id: 'gift_' + gift.id,
                    name: gift.gift_name,
                    price: 0,
                    oldPrice: null,
                    img: gift.gift_img || 'logo.png',
                    badge: 'مجاناً 🎁',
                    isGift: true,
                    qty: earnedQty
                });
            }
        });
    }

    // ==========================================
    // 4. نظام التنقل والسلة (App Logic)
    // ==========================================
  window.app = {
        navigate: function (viewId, param = null, addToHistory = true) {
            const doNav = () => {
                if (addToHistory) history.pushState({ viewId, param }, "", param ? `#${viewId}?item=${param}` : `#${viewId}`);
                document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                
                updateNavMorph(viewId); 

                if (['home', 'catalog', 'about'].includes(viewId)) {
                    document.getElementById('view-main').classList.add('active');
                    if (viewId === 'catalog') renderCatalog(param); else renderCatalog();
                    const target = document.getElementById(viewId);
                    if (target) window.scrollTo({ top: target.offsetTop - 80, behavior: "smooth" });
                } else {
                    document.getElementById('view-' + viewId).classList.add('active');
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    if (viewId === 'product') renderProductDetails(param);
                    if (viewId === 'cart') renderCart();
                }
            };

            if (document.startViewTransition) {
                document.startViewTransition(() => doNav());
            } else {
                doNav();
            }
        },
        addToCart: function (id, qty = 1, silent = false) {
            const product = productsDB.find(p => p.id === id);
            if (!product) return;

            const existing = cart.find(item => item.id === id);
            if (existing) existing.qty += parseInt(qty); else cart.push({ ...product, qty: parseInt(qty) });
            
            checkOffers(); 
            saveCart(); // [جديد] حفظ التحديث
            updateBadge();
            
            if (!silent) {
                playCartSound(); 
                showCartPopup(); 
            }
        },
        buyNow: function (id, qty = 1) { this.addToCart(id, qty, true); this.navigate('cart'); },
        updateQty: function (id, change) {
            const item = cart.find(item => item.id === id);
            if (item) { 
                item.qty += change; 
                if (item.qty <= 0) cart = cart.filter(i => i.id !== id); 
                checkOffers(); 
                saveCart(); // [جديد] حفظ التحديث
                renderCart(); 
                updateBadge(); 
            }
        },
        removeItem: function (id) { 
            cart = cart.filter(i => i.id !== id); 
            checkOffers(); 
            saveCart(); // [جديد] حفظ التحديث
            renderCart(); 
            updateBadge(); 
        }
    };
    // ==========================================
    // 6. دوال العرض والـ Rendering (بالشكل القديم)
    // ==========================================
    function renderCatalog(filter = null) {
        const grid = document.getElementById('catalog-grid');
        let products = filter ? productsDB.filter(p => p.category === filter && !p.isGift) : productsDB.filter(p => !p.isGift);
        if (grid) {
            grid.innerHTML = products.map(p => `
                <article class="product-card text-right group" onclick="app.navigate('product', '${p.id}')">
                    <div class="product-image-bg relative mb-6 overflow-hidden">
                        <img src="${p.img}" class="max-h-full transition-transform duration-500 group-hover:scale-110" onerror="this.src='logo.png'">
                        ${p.badge ? `<div class="absolute top-4 left-4 z-10"><span class="badge-premium">${p.badge}</span></div>` : ''}
                        <button onclick="event.stopPropagation(); app.addToCart('${p.id}')" class="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md py-4 text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black hover:text-white border border-gray-100">إضافة سريعة +</button>
                    </div>
                    <div class="space-y-1 mb-6 px-1">
                        <p class="text-[9px] uppercase tracking-widest text-primary font-bold">Elforat Pharma</p>
                        <h3 class="text-base font-extrabold text-black leading-tight">${p.name}</h3>
                        <div class="flex flex-row-reverse justify-end items-center gap-3 pt-1">
                            <span class="text-sm font-bold text-gray-900">${p.price} ج.م</span>
                            ${p.oldPrice ? `<span class="text-xs text-gray-400 line-through decoration-gray-300">${p.oldPrice} ج.م</span>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); app.addToCart('${p.id}')" class="flex-1 btn-pill btn-add-cart-minimal py-3">أضف للسلة</button>
                        <button onclick="event.stopPropagation(); app.buyNow('${p.id}')" class="flex-1 btn-pill btn-buy-now-premium py-3">اشتري الآن</button>
                    </div>
                </article>`).join('');
        }
    }

    function renderProductDetails(id) {
        const p = productsDB.find(prod => prod.id == id);
        const container = document.getElementById('product-details-container');
        if (!container || !p) return;
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                <div class="product-image-bg aspect-square flex items-center justify-center p-16 bg-[#f9f9f9] rounded-3xl">
                    <img src="${p.img}" class="max-h-full mix-blend-multiply transition-transform duration-1000 hover:scale-105" onerror="this.src='logo.png'">
                </div>
                <div class="flex flex-col justify-center text-right space-y-8">
                    <div class="space-y-3">
                        <p class="text-primary font-bold text-[10px] uppercase tracking-[0.3em]">${p.category}</p>
                        <h1 class="text-5xl font-extrabold text-black leading-tight tracking-tight">${p.name}</h1>
                        <div class="flex flex-row-reverse justify-end items-center gap-6 pt-4">
                            <span class="text-3xl font-medium text-gray-900">${p.price} ج.م</span>
                        </div>
                    </div>
                    <p class="text-gray-500 font-light leading-relaxed text-lg border-t border-gray-50 pt-6">${p.desc || 'أفضل منتجات العناية المختارة بعناية فائقة لضمان أفضل النتائج لبشرتك وشعرك.'}</p>
                    <button onclick="app.buyNow('${p.id}')" class="w-full bg-primary text-white font-bold uppercase text-[11px] tracking-widest py-5 rounded-full hover:bg-black transition-all">أضيفي للحقيبة</button>
                </div>
            </div>`;
    }

    function renderCart() {
        const container = document.getElementById('cart-items-container');
        const summary = document.getElementById('cart-summary-totals');
        if (!container) return;
        if (cart.length === 0) { 
            container.innerHTML = '<div class="py-32 text-center text-gray-400 uppercase tracking-widest">حقيبة التسوق فارغة</div>'; 
            if (summary) summary.innerHTML = ''; return; 
        }
        let subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        container.innerHTML = cart.map(item => {
            if (item.isGift) {
                return `
                <div class="flex gap-8 border-b border-gray-100 pb-10 text-right group relative">
                    <div class="w-24 h-24 bg-[#fdf2f5] p-4 rounded-2xl relative shrink-0">
                        <img src="${item.img}" class="w-full h-full object-contain mix-blend-multiply">
                        <span class="absolute -bottom-2 -left-2 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full">x${item.qty}</span>
                    </div>
                    <div class="flex-grow space-y-1">
                        <span class="text-[9px] font-black uppercase tracking-widest text-primary">هدية مجانية 🎁</span>
                        <h3 class="text-sm font-extrabold uppercase text-black">${item.name}</h3>
                        <p class="text-base font-bold text-green-500 pt-2">مجانـــــاً</p>
                    </div>
                </div>`;
            }
            return `
            <div class="flex gap-8 border-b border-gray-100 pb-10 text-right group relative">
                <div class="w-24 h-24 bg-[#f9f9f9] p-4 rounded-2xl relative"><img src="${item.img}" class="w-full h-full object-contain mix-blend-multiply"></div>
                <div class="flex-grow space-y-1">
                    <h3 class="text-sm font-extrabold uppercase text-black">${item.name}</h3>
                    <div class="flex flex-row-reverse justify-between items-center pt-4">
                        <span class="text-base font-bold text-primary">${(item.price * item.qty)} ج.م</span>
                        <div class="flex border border-gray-100 rounded-full" dir="ltr">
                            <button onclick="app.updateQty('${item.id}', 1)" class="px-3 py-1 text-primary font-bold">+</button>
                            <span class="px-4 py-1 text-xs font-bold">${item.qty}</span>
                            <button onclick="app.updateQty('${item.id}', -1)" class="px-3 py-1 text-primary font-bold">-</button>
                        </div>
                    </div>
                </div>
                <button onclick="app.removeItem('${item.id}')" class="text-gray-300 hover:text-red-500 transition-colors">×</button>
            </div>`;
        }).join('');
        if (summary) summary.innerHTML = `<div class="flex justify-between items-center text-xl font-bold"><span>الإجمالي</span><span class="text-primary">${subtotal} ج.م</span></div>`;
    }

    function updateBadge() { 
        const b = document.getElementById('cart-badge'); 
        if (b) b.innerText = cart.reduce((s, i) => s + i.qty, 0); 
    }

     // ==========================================
    // 6. كود إرسال الطلب للسيرفر والتحويل الفوري للواتساب 🔥
    // ==========================================
    const checkoutForm = document.getElementById('checkout-form');
    if(checkoutForm) {
        checkoutForm.onsubmit = async (e) => { 
            e.preventDefault();

            const submitBtn = checkoutForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'جاري تحويلك للواتساب...';
            submitBtn.disabled = true;

            const nameEl = document.getElementById('cust-name');
            const phoneEl = document.getElementById('cust-phone');
            const addressEl = document.getElementById('cust-address');
            const paymentEl = document.getElementById('cust-payment');

            if (!nameEl || !phoneEl || !addressEl || !paymentEl) {
                showCustomAlert('يوجد خطأ في النموذج. يرجى التأكد من الحقول.', 'error');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            const name = nameEl.value;
            const phone = phoneEl.value;
            const address = addressEl.value;
            const payment = paymentEl.value;

            if (cart.length === 0) {
                showCustomAlert('سلة المشتريات فارغة! ضيفي منتجات عشان تقدري تكملي الطلب.', 'error');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            const phoneRegex = /^01[0-9]{9}$/;
            if (!phoneRegex.test(phone)) {
                showCustomAlert('عفواً، برجاء إدخال رقم هاتف صحيح يتكون من 11 رقم ويبدأ بـ 01', 'error');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return; 
            }

            let subtotal = 0;
            const orderItems = [];
            
            cart.forEach(item => {
                const itemTotal = item.price * item.qty;
                subtotal += itemTotal;
                orderItems.push({
                    id: item.id,
                    name: item.name,
                    qty: item.qty,
                    price: item.price,
                    isGift: item.isGift || false
                });
            });

            try {
                const orderData = {
                    customerName: name,
                    phone: phone,
                    address: address,
                    total: subtotal,
                    status: 'قيد التنفيذ',
                    date: new Date().toLocaleString('ar-EG'),
                    items: orderItems
                };
                const { error: orderError } = await _supabase.from('orders').insert([orderData]);
                if (orderError) throw orderError;
            } catch (err) {
                console.error("خطأ صامت في سوبابيز، جاري استكمال التحويل...", err);
            }

            let message = `*طلب جديد من موقع Elforat Pharma* 🛍️\n\n`;
            message += `👤 *اسم العميل:* ${name}\n`;
            message += `📞 *رقم الهاتف:* ${phone}\n`;
            message += `📍 *العنوان:* ${address}\n`;
            message += `💳 *طريقة الدفع:* ${payment}\n\n`;
            message += `*المنتجات المطلوبة:*\n`;

            cart.forEach(item => {
                const itemTotal = item.price * item.qty;
                const priceText = item.isGift ? 'مجاناً 🎁' : `${itemTotal} ج.م`;
                message += `▫️ ${item.name} (الكمية: ${item.qty}) = ${priceText}\n`;
            });

            message += `\n💰 *الإجمالي المطلوب:* ${subtotal} ج.م\n`;
            message += `\nشكراً لاختيارك الفرات فارما! 🌺`;

           cart = []; 
            saveCart(); // [جديد] مسح المنتجات من التخزين بعد إرسال الطلب بنجاح
            
            updateBadge(); 
            checkoutForm.reset();
            
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;

            const encodedMessage = encodeURIComponent(message);
            const whatsappNumber = "201146809133"; 
            
            window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
            
            setTimeout(() => {
                app.navigate('home');
            }, 1000);
        };
    }
       // ==========================================
    // 7. كود الـ Scroll Spy مع الخط المتحرك
    // ==========================================
    const sections = document.querySelectorAll('#home, #catalog, #about');
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -20% 0px', // قللنا النسبة عشان يلقط الأقسام بشكل أسرع
        threshold: 0
    };

    // الكود الإضافي ده بيضمن إنه أول ما توصل لآخر الصفحة تحت خالص، ينقل الخط فوراً لـ "عن الشركة"
    window.addEventListener('scroll', () => {
        if (Math.ceil(window.innerHeight + window.scrollY) >= document.body.offsetHeight - 30) {
            updateNavMorph('about');
        }
    });

    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                updateNavMorph(entry.target.id);
            }
        });
    }, observerOptions);

    sections.forEach(section => scrollObserver.observe(section));

    // ==========================================
    // 8. كود العداد الذكي (معدل ليتجدد تلقائياً)
    // ==========================================
    function startCountdown() {
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        if (!hoursEl || !minutesEl || !secondsEl) return;

        let endTime = localStorage.getItem('elforat_offer_end');

        if (!endTime || parseInt(endTime, 10) <= Date.now()) {
            endTime = Date.now() + (24 * 60 * 60 * 1000); 
            localStorage.setItem('elforat_offer_end', endTime);
        } else {
            endTime = parseInt(endTime, 10);
        }

        setInterval(() => {
            const now = Date.now();
            let timeRemaining = Math.floor((endTime - now) / 1000);

            if (timeRemaining <= 0) {
                endTime = Date.now() + (24 * 60 * 60 * 1000);
                localStorage.setItem('elforat_offer_end', endTime);
                timeRemaining = Math.floor((endTime - now) / 1000);
                
                checkOffers();
                renderCart();
                updateBadge();
            }

            const h = Math.floor(timeRemaining / 3600);
            const m = Math.floor((timeRemaining % 3600) / 60);
            const s = timeRemaining % 60;

            hoursEl.textContent = h.toString().padStart(2, '0');
            minutesEl.textContent = m.toString().padStart(2, '0');
            secondsEl.textContent = s.toString().padStart(2, '0');
        }, 1000);
    }

    // ==========================================
    // 9. تشغيل النظام بالكامل
    // ==========================================
// تسجيل زيارة جديدة في السيرفر
    async function trackVisitor() {
        const { data } = await _supabase.from('visitors').select('*').limit(1).single();
        if (data) {
            await _supabase.from('visitors').update({ count: data.count + 1 }).eq('id', data.id);
        } else {
            await _supabase.from('visitors').insert([{ count: 1 }]);
        }
    }
    trackVisitor();

    // [جديد] استرجاع السلة وتحديث الرقم في الناف بار فوراً
    loadCart();
    updateBadge();

    loadGifts();
    fetchProducts();
    startCountdown();
});