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
    
    // ==========================================
    // نمط تصميم: State Manager لإدارة الحالات
    // ==========================================
    const AppState = {
        status: 'idle', // idle, loading, success, error
        error: null,
        retryCount: 0,
        maxRetries: 3,
        listeners: [],
        
        setState(newState) {
            this.status = newState.status ?? this.status;
            this.error = newState.error ?? null;
            this.retryCount = newState.retryCount ?? this.retryCount;
            this.notifyListeners();
        },
        
        subscribe(callback) {
            this.listeners.push(callback);
        },
        
        notifyListeners() {
            this.listeners.forEach(cb => cb(this));
        },
        
        reset() {
            this.setState({ status: 'idle', error: null, retryCount: 0 });
        }
    };
    
    // ==========================================
    // نمط تصميم: Notification System موحد (متطور)
    // ==========================================
    
    // ==========================================
    // دالة Sanitize للحماية من XSS
    // ==========================================
    function sanitize(str) {
        const el = document.createElement('div');
        el.textContent = str ?? '';
        return el.innerHTML;
    }
    
    const ToastManager = {
        container: null,
        toastQueue: [],
        maxToasts: 4,
        
        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
        },
        
        show(message, type = 'info', duration = 4000, title = '') {
            this.init();
            
            const icons = {
                success: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>',
                error: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>',
                warning: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
                info: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            };
            
            const titles = {
                success: '',
                error: '',
                warning: '',
                info: ''
            };
            
            const toast = document.createElement('div');
            toast.className = `toast-notification toast-${type}`;
            toast.innerHTML = `
                <div class="toast-icon">${icons[type]}</div>
                <div class="toast-content">
                    <div class="toast-title">${title || titles[type]}${message ? ' - ' + message : ''}</div>
                </div>
                <button class="toast-close" onclick="ToastManager.dismiss(this.closest('.toast-notification'))">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
            `;
            
            this.container.appendChild(toast);
            
            requestAnimationFrame(() => {
                toast.classList.add('slide-in');
            });
            
            const timeoutId = setTimeout(() => {
                this.dismiss(toast);
            }, duration);
            
            toast.timeoutId = timeoutId;
            
            return toast;
        },
        
        dismiss(toast) {
            if (!toast || !toast.parentNode) return;
            
            if (toast.timeoutId) {
                clearTimeout(toast.timeoutId);
            }
            
            toast.classList.remove('slide-in');
            toast.classList.add('slide-out');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400);
        },
        
        dismissAll() {
            if (this.container) {
                const toasts = this.container.querySelectorAll('.toast-notification');
                toasts.forEach(toast => this.dismiss(toast));
            }
        },
        
        showError(message, duration = 4000, title = '') { 
            return this.show(message, 'error', duration, title); 
        },
        showSuccess(message, duration = 4000, title = '') { 
            return this.show(message, 'success', duration, title); 
        },
        showWarning(message, duration = 4000, title = '') { 
            return this.show(message, 'warning', duration, title); 
        },
        showInfo(message, duration = 4000, title = '') { 
            return this.show(message, 'info', duration, title); 
        }
    };
    
    // Alias for backward compatibility
    const NotificationManager = ToastManager;
    
    // ==========================================
    // نمط تصميم: Error Handler مركزي
    // ==========================================
    const ErrorHandler = {
        handle(error, context = '') {
            console.error(`[Error in ${context}]:`, error);
            
            AppState.setState({ 
                status: 'error', 
                error: error.message || 'حدث خطأ غير متوقع'
            });
            
            let userMessage = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
            
            if (error.message?.includes('network')) {
                userMessage = 'يبدو أنك غير متصل بالإنترنت. يرجى التحقق من اتصالك.';
            } else if (error.message?.includes('timeout')) {
                userMessage = 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.';
            }
            
            ToastManager.showError(userMessage, 5000);
            
            // تسجيل الخطأ للتحليل لاحقاً
            this.logError(error, context);
        },
        
        async logError(error, context) {
            try {
                await _supabase.from('error_logs').insert([{
                    error_message: error.message,
                    error_stack: error.stack,
                    context: context,
                    timestamp: new Date().toISOString(),
                    user_agent: navigator.userAgent
                }]);
            } catch (e) {
                console.warn('فشل تسجيل الخطأ:', e);
            }
        },
        
        retry(operation, maxRetries = 3) {
            return async (...args) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await operation(...args);
                    } catch (error) {
                        if (i === maxRetries - 1) throw error;
                        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    }
                }
            };
        }
    };

    // ==========================================
    // نمط تصميم: Favorites Manager لإدارة المفضلة
    // ==========================================
    const FavoritesManager = {
        favorites: [],
        
        init() {
            const saved = localStorage.getItem('elforat_favorites');
            if (saved) {
                this.favorites = JSON.parse(saved);
            }
        },
        
        save() {
            localStorage.setItem('elforat_favorites', JSON.stringify(this.favorites));
        },
        
        toggle(productId) {
            const index = this.favorites.indexOf(productId);
            if (index > -1) {
                this.favorites.splice(index, 1);
                ToastManager.showSuccess('تمت الإزالة من المفضلة', 3000); updateBadge();
            } else {
                this.favorites.push(productId);
                ToastManager.showSuccess('تمت الإضافة للمفضلة ❤️', 3000); updateBadge();
            }
            this.save();
            this.updateUI(productId);
        },
        
        isFavorite(productId) {
            return this.favorites.includes(productId);
        },
        
        updateUI(productId) {
            const btn = document.querySelector(`[data-favorite-btn="${productId}"]`);
            if (btn) {
                const isFav = this.isFavorite(productId);
                btn.classList.toggle('favorite-active', isFav);
                btn.innerHTML = isFav 
                    ? `<svg class="heart-icon w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                    : `<svg class="heart-icon w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
            }
        },
        
        getCount() {
            return this.favorites.length;
        }
    };

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
        // حفظ السلة لمدة 60 يوم
        localStorage.setItem('elforat_cart', JSON.stringify(cart));
        localStorage.setItem('elforat_cart_expiry', Date.now() + (60 * 24 * 60 * 60 * 1000));
    }
    
    // التحقق من انتهاء صلاحية السلة
    function checkCartExpiry() {
        const expiry = localStorage.getItem('elforat_cart_expiry');
        if (expiry && Date.now() > parseInt(expiry)) {
            localStorage.removeItem('elforat_cart');
            localStorage.removeItem('elforat_cart_expiry');
            cart = [];
        }
    }

    // دالة إصلاح المسارات لضمان ظهور الصور من فولدر uploads
    function getFullImg(path) {
        if (!path) return 'logo.png';
        if (path.startsWith('http')) return path;
        const cleanPath = path.replace('uploads/', '');
        return `${supabaseUrl}/storage/v1/object/public/products/uploads/${cleanPath}`;
    }

    async function fetchProducts() {
        AppState.setState({ status: 'loading' });
        
        // عرض Skeleton Loading أثناء التحميل
        renderSkeletonLoading();
        
        try {
            // [تعديل الترتيب]: جلب المنتجات مرتبة حسب الـ ID لضمان الترتيب القديم
            const fetchWithRetry = ErrorHandler.retry(async () => {
                const { data, error } = await _supabase
                    .from('products')
                    .select('*')
                    .order('priority', { ascending: false });
                
                if (error) throw error;
                return data;
            }, AppState.maxRetries);
            
            const data = await fetchWithRetry();

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
                size: p.size || '',
                stock: parseInt(p.stock) || 100 // إضافة المخزون
            }));
            
            AppState.setState({ status: 'success' });
        } catch (err) {
            ErrorHandler.handle(err, 'fetchProducts');
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
            
            renderCatalog(null, '');
        }
    }
    
    // دالة عرض Skeleton Loading
    function renderSkeletonLoading() {
        const grid = document.getElementById('catalog-grid');
        if (!grid) return;
        
        grid.innerHTML = Array(8).fill(0).map((_, i) => `
            <div class="product-card opacity-0 animate-fade-in-up" style="animation-delay: ${i * 50}ms">
                <div class="product-image-bg mb-6 skeleton-img aspect-square"></div>
                <div class="px-1 space-y-2">
                    <div class="skeleton skeleton-text w-20 h-3"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="flex gap-2 pt-2">
                        <div class="skeleton skeleton-text w-24 h-5"></div>
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <div class="skeleton skeleton-text flex-1 h-12 rounded-full"></div>
                    <div class="skeleton skeleton-text flex-1 h-12 rounded-full"></div>
                </div>
            </div>
        `).join('');
    }

        // ==========================================
    // دوال الإشعارات والصوت (Custom Alert & Snackbar)
    // ==========================================
    function showCustomAlert(message, type = 'error') {
        // استخدام نظام Toast الجديد بدلاً من المودال القديم
        if (type === 'error') {
            ToastManager.showError(message, 5000);
        } else {
            ToastManager.showSuccess(message, 4000);
        }
    }

    // دالة إظهار الشريط السفلي (Snackbar) - تم التحديث لاستخدام Toast
    function showCartPopup() {
        // استخدام Toast Manager للإشعار
        ToastManager.showSuccess('تم إضافة المنتج للحقيبة 🛍️', 3500);
        
        // تشغيل الصوت
        playCartSound();
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
    const LOW_STOCK_THRESHOLD = 10; // الحد الأدنى للمخزون المنخفض


    async function loadGifts() {
        try {
            const fetchGiftsWithRetry = ErrorHandler.retry(async () => {
                const { data, error } = await _supabase
                    .from("gifts")
                    .select("*")
                    .eq("is_active", true);
                if (error) throw error;
                return data;
            }, 2);
            
            const data = await fetchGiftsWithRetry();
            if (data) activeGifts = data;
            
            AppState.setState({ status: "success" });
        } catch (e) {
            ErrorHandler.handle(e, "loadGifts");
            console.log("تعذر جلب الهدايا من سوبابيز");
        }
    }


    // دالة التحقق من المخزون المنخفض وإظهار الإشعارات
    function checkLowStock() {
        const lowStockProducts = productsDB.filter(p => p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0);
        
        if (lowStockProducts.length > 0) {
            const productNames = lowStockProducts.slice(0, 3).map(p => p.name).join("، ");
            const moreCount = lowStockProducts.length - 3;
            
            let message = "⚠️ تنبيه: الكمية المتبقية قليلة لـ: " + productNames;
            if (moreCount > 0) {
                message += " و" + moreCount + " منتجات أخرى";
            }
            
            if (!sessionStorage.getItem("lowStockShown")) {
                ToastManager.showWarning(message, 5000);
                sessionStorage.setItem("lowStockShown", "true");
            }
        }
    }
    
    // ==========================================
    // شريط الإشعارات العلوي للعروض
    // ==========================================
    function showPromotionBanner() {
        const existingBanner = document.getElementById("promo-banner");
        if (existingBanner) existingBanner.remove();
        
        const banner = document.createElement("div");
        banner.id = "promo-banner";
        banner.className = "fixed top-0 left-0 right-0 bg-gradient-to-r from-primary via-pink-600 to-primary text-white py-3 px-4 z-[9998] flex items-center justify-center gap-4 overflow-hidden";
        banner.innerHTML = `
            <div class="animate-pulse">🎉</div>
            <span class="font-bold text-sm md:text-base">احصل علي كريم صنفرة مجانا للطلبات فوق 500 ج.م! | خصم 20% على المجموعات المتكاملة</span>
            <button id="close-promo-btn" class="hover:bg-white/20 rounded-full p-1 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;
        
        document.body.insertBefore(banner, document.body.firstChild);
        
        const nav = document.querySelector("nav");
        if (nav) {
            nav.style.top = "48px";
            nav.style.transition = "top 0.3s ease";
        }
        
        document.getElementById("close-promo-btn").addEventListener("click", function() {
            banner.remove();
            if (nav) {
                nav.style.top = "0";
            }
        });
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
        searchTerm: '',
        navigate: function (viewId, param = null, addToHistory = true) {
            const doNav = () => {
                if (addToHistory) history.pushState({ viewId, param }, "", param ? `#${viewId}?item=${param}` : `#${viewId}`);
                document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                
                updateNavMorph(viewId); 

                if (['home', 'catalog', 'about'].includes(viewId)) {
                    document.getElementById('view-main').classList.add('active');
                    if (viewId === 'catalog') renderCatalog(param, this.searchTerm); else renderCatalog(null, this.searchTerm);
                    const target = document.getElementById(viewId);
                    if (target) window.scrollTo({ top: target.offsetTop - 80, behavior: "smooth" });
                } else {
                    document.getElementById('view-' + viewId).classList.add('active');
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    if (viewId === 'product') renderProductDetails(param);
                    if (viewId === 'cart') renderCart();
                    if (viewId === 'favorites') renderFavorites();
                }
            };

            if (document.startViewTransition) {
                document.startViewTransition(() => doNav());
            } else {
                doNav();
            }
        },
        handleSearch: function(query) {
            // إلغاء أي توقيت بحث سابق (Debounce)
            clearTimeout(this.searchTimer);
            
            // بدء توقيت جديد - البحث سيتم بعد توقف المستخدم عن الكتابة لمدة 300 مللي ثانية
            this.searchTimer = setTimeout(() => {
                this.searchTerm = query.trim().toLowerCase();
                
                // تحديث حقول البحث الأخرى لتتزامن
                const desktopInput = document.getElementById('desktop-search-input');
                const mobileInput = document.getElementById('mobile-search-input');
                if (desktopInput && desktopInput !== event?.target) desktopInput.value = query;
                if (mobileInput && mobileInput !== event?.target) mobileInput.value = query;
                
                // إظهار/إخفاء قائمة الاقتراحات
                this.showSearchSuggestions(query);
                
                // إذا كنا في صفحة الكتالوج، أعد العرض مع الفلتر
                if (document.getElementById('catalog')) {
                    renderCatalog(null, this.searchTerm);
                } else if (this.searchTerm.length > 0) {
                    // إذا لم نكن في الكتالوج، اذهب للكتالوج مع البحث
                    this.navigate('catalog');
                }
                console.log("تم تنفيذ البحث عن: " + this.searchTerm);
            }, 300);
        },
        
        // دالة إظهار اقتراحات البحث التلقائية
        showSearchSuggestions: function(query) {
            const desktopContainer = document.getElementById('search-suggestions-desktop');
            const mobileContainer = document.getElementById('search-suggestions-mobile');
            
            if (!query || query.length < 2) {
                if (desktopContainer) desktopContainer.classList.add('hidden');
                if (mobileContainer) mobileContainer.classList.add('hidden');
                return;
            }
            
            // تصفية المنتجات المطابقة
            const suggestions = productsDB.filter(p => 
                p.name.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query)
            ).slice(0, 5); // عرض أول 5 نتائج فقط
            
            if (suggestions.length === 0) {
                if (desktopContainer) desktopContainer.classList.add('hidden');
                if (mobileContainer) mobileContainer.classList.add('hidden');
                return;
            }
            
            const suggestionsHTML = `
                <div class="py-2">
                    ${suggestions.map(p => `
                        <div onclick="app.navigate('product', '${p.id}'); app.hideSearchSuggestions();" 
                             class="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 cursor-pointer transition-colors group">
                            <img src="${p.img}" loading="lazy" class="w-10 h-10 object-contain rounded-lg bg-gray-50 group-hover:scale-110 transition-transform">
                            <div class="flex-1 text-right">
                                <p class="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">${p.name}</p>
                                <p class="text-xs text-gray-500">${p.category}</p>
                            </div>
                            <span class="text-xs font-bold text-primary">${p.price} ج.م</span>
                        </div>
                    `).join('')}
                    <div onclick="app.navigate('catalog'); app.hideSearchSuggestions();" 
                         class="border-t border-gray-100 mt-2 pt-3 px-4 text-center text-sm font-bold text-primary hover:bg-primary/5 cursor-pointer transition-colors">
                        عرض كل النتائج →
                    </div>
                </div>
            `;
            
            if (desktopContainer) {
                desktopContainer.innerHTML = suggestionsHTML;
                desktopContainer.classList.remove('hidden');
            }
            if (mobileContainer) {
                mobileContainer.innerHTML = suggestionsHTML;
                mobileContainer.classList.remove('hidden');
            }
        },
        
        // إخفاء قائمة الاقتراحات
        hideSearchSuggestions: function() {
            const desktopContainer = document.getElementById('search-suggestions-desktop');
            const mobileContainer = document.getElementById('search-suggestions-mobile');
            if (desktopContainer) desktopContainer.classList.add('hidden');
            if (mobileContainer) mobileContainer.classList.add('hidden');
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
        },
        toggleMobileMenu: function() {
            const panel = document.getElementById('mobile-menu-panel');
            const overlay = document.getElementById('mobile-menu-overlay');
            if (!panel || !overlay) return;
            
            const isClosed = panel.classList.contains('translate-x-full');
            if (isClosed) {
                // فتح القائمة
                panel.classList.remove('translate-x-full');
                panel.classList.add('translate-x-0');
                overlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            } else {
                // إغلاق القائمة
                panel.classList.add('translate-x-full');
                panel.classList.remove('translate-x-0');
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
            }
        },
        
        // ==========================================
        // Hero Carousel Functions - وظائف الكاروسيل
        // ==========================================
        initCarousel: function() {
            this.carouselIndex = 0;
            this.carouselSlides = document.querySelectorAll('.carousel-slide');
            this.carouselDots = document.querySelectorAll('.carousel-dot');
            this.carouselProgress = document.getElementById('carousel-progress');
            this.carouselInterval = null;
            this.carouselPauseTime = 5000; // 5 seconds per slide
            
            if (this.carouselSlides.length === 0) return;
            
            // Initialize first slide and dot
            this.updateCarousel(0);
            
            // Start auto-rotation
            this.startCarousel();
            
            // Event listeners for navigation buttons
            const prevBtn = document.getElementById('carousel-prev');
            const nextBtn = document.getElementById('carousel-next');
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    this.prevSlide();
                    this.resetCarouselTimer();
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    this.nextSlide();
                    this.resetCarouselTimer();
                });
            }
            
            // Event listeners for dots
            this.carouselDots.forEach((dot, index) => {
                dot.addEventListener('click', () => {
                    this.goToSlide(index);
                    this.resetCarouselTimer();
                });
            });
            
            // Pause on hover
            const carouselContainer = document.getElementById('hero-carousel');
            if (carouselContainer) {
                carouselContainer.addEventListener('mouseenter', () => this.pauseCarousel());
                carouselContainer.addEventListener('mouseleave', () => this.startCarousel());
            }
        },
        
        updateCarousel: function(index) {
            // Update slides
            this.carouselSlides.forEach((slide, i) => {
                slide.classList.remove('active', 'prev');
                if (i === index) {
                    slide.classList.add('active');
                } else if (i < index) {
                    slide.classList.add('prev');
                }
            });
            
            // Update dots
            this.carouselDots.forEach((dot, i) => {
                dot.classList.remove('active');
                dot.classList.add('bg-gray-300', 'border-gray-300');
                dot.classList.remove('bg-primary/60', 'border-primary');
                if (i === index) {
                    dot.classList.add('active');
                    dot.classList.remove('bg-gray-300', 'border-gray-300');
                    dot.classList.add('bg-primary/60', 'border-primary');
                }
            });
            
            // Reset and restart progress bar animation
            if (this.carouselProgress) {
                this.carouselProgress.style.animation = 'none';
                setTimeout(() => {
                    this.carouselProgress.style.animation = `progressAnimation ${this.carouselPauseTime}ms linear`;
                }, 10);
            }
        },
        
        nextSlide: function() {
            const newIndex = (this.carouselIndex + 1) % this.carouselSlides.length;
            this.goToSlide(newIndex);
        },
        
        prevSlide: function() {
            const newIndex = (this.carouselIndex - 1 + this.carouselSlides.length) % this.carouselSlides.length;
            this.goToSlide(newIndex);
        },
        
        goToSlide: function(index) {
            this.carouselIndex = index;
            this.updateCarousel(index);
        },
        
        startCarousel: function() {
            if (this.carouselInterval) clearInterval(this.carouselInterval);
            this.carouselInterval = setInterval(() => this.nextSlide(), this.carouselPauseTime);
        },
        
        pauseCarousel: function() {
            if (this.carouselInterval) clearInterval(this.carouselInterval);
            if (this.carouselProgress) {
                this.carouselProgress.style.animationPlayState = 'paused';
            }
        },
        
        resetCarouselTimer: function() {
            this.startCarousel();
            if (this.carouselProgress) {
                this.carouselProgress.style.animationPlayState = 'running';
            }
        }
    };
    
    // Initialize carousel when DOM is ready
    setTimeout(() => {
        if (window.app && typeof window.app.initCarousel === 'function') {
            window.app.initCarousel();
        }
    }, 100);
    
    // إضافة مستمع لزر القائمة في الجوال
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => app.toggleMobileMenu());
    }
    // ==========================================
    // 6. دوال العرض والـ Rendering (بالشكل القديم)
    // ==========================================
    function renderCatalog(filter = null, searchTerm = '') {
        const grid = document.getElementById('catalog-grid');
        let products = productsDB.filter(p => !p.isGift);
        
        // تطبيق فلتر الفئة
        if (filter) {
            products = products.filter(p => p.category === filter);
        }
        
        // تطبيق البحث الفوري
        if (searchTerm) {
            products = products.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.category.toLowerCase().includes(searchTerm) ||
                (p.desc && p.desc.toLowerCase().includes(searchTerm))
            );
        }
        
        if (grid) {
            if (products.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center py-32 text-center animate-fade-in-up">
                        <div class="w-48 h-48 bg-gradient-to-br from-primary/10 to-secondary rounded-full flex items-center justify-center mb-8 shadow-inner">
                            <svg class="w-24 h-24 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-900 mb-3">لم يتم العثور على نتائج</h3>
                        <p class="text-gray-500 text-lg mb-6 max-w-md">لا توجد منتجات تطابق بحثك "<span class="font-bold text-primary">${searchTerm}</span>"</p>
                        <button onclick="app.handleSearch(''); document.getElementById('desktop-search-input').value=''; document.getElementById('mobile-search-input').value='';" 
                                class="px-8 py-3 bg-primary text-white rounded-full font-bold hover:bg-neutral-900 transition-all shadow-lg shadow-primary/30 flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                            </svg>
                            عرض كل المنتجات
                        </button>
                    </div>`;
                return;
            }
            
            grid.innerHTML = products.map((p, index) => {
                const isFavorite = FavoritesManager.isFavorite(p.id);
                return `
                <article class="floating-card bg-white rounded-3xl p-4 text-right group opacity-0 animate-fade-in-up" style="animation-delay: ${index * 50}ms" onclick="app.navigate('product', '${sanitize(p.id)}')">
                    <div class="product-image-bg relative mb-6 overflow-hidden rounded-2xl bg-gray-50 flex items-center justify-center p-6">
                        <img src="${sanitize(p.img)}" loading="lazy" class="max-h-48 transition-transform duration-500 group-hover:scale-110" onerror="this.src='logo.png'">
                        ${p.badge ? `<div class="absolute top-4 left-4 z-10"><span class="badge-premium">${sanitize(p.badge)}</span></div>` : ''}
                        <button onclick="event.stopPropagation();" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn absolute top-3 right-3 z-20 w-8 h-8 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-md">
                            ${isFavorite 
                                ? `<svg class="heart-icon w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                                : `<svg class="heart-icon w-3.5 h-3.5 text-gray-400 hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`
                            }
                        </button>
                    </div>
                    <div class="space-y-1 mb-6 px-1">
                        <p class="text-[10px] uppercase tracking-widest text-primary font-bold">Elforat Pharma</p>
                        <h3 class="text-base font-extrabold text-gray-900 leading-tight">${sanitize(p.name)}</h3>
                        <div class="flex flex-row-reverse justify-end items-center gap-3 pt-1">
                            <span class="text-lg font-bold text-primary">${sanitize(p.price)} ج.م</span>
                            ${p.oldPrice ? `<span class="text-xs text-gray-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); app.addToCart('${sanitize(p.id)}')" class="flex-1 py-3 px-2 bg-gray-100 text-gray-800 rounded-full text-[11px] font-bold hover:bg-primary hover:text-white transition-colors">أضف للسلة</button>
                        <button onclick="event.stopPropagation(); app.buyNow('${sanitize(p.id)}')" class="flex-1 py-3 px-2 bg-black text-white rounded-full text-[11px] font-bold hover:bg-primary transition-colors">اشتري الآن</button>
                    </div>
                </article>`;
            }).join('');
            
            // إضافة مستمعي الأحداث لأزرار المفضلة
            setTimeout(() => {
                document.querySelectorAll('.favorite-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const productId = btn.getAttribute('data-favorite-btn');
                        FavoritesManager.toggle(productId);
                    });
                });
            }, 0);
        }
    }

    function renderProductDetails(id) {
        const p = productsDB.find(prod => prod.id == id);
        const container = document.getElementById('product-details-container');
        if (!container || !p) return;
        
        // إنشاء معرض صور متعدد (يمكن تعديله لصور حقيقية من قاعدة البيانات)
        const images = [p.img, p.img, p.img]; // في المستقبل يمكن جلب صور متعددة من سوبابيز
        
        let currentImageIndex = 0;
        
        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <!-- معرض الصور -->
                <div class="space-y-4">
                    <div class="product-image-bg aspect-square flex items-center justify-center p-8 bg-[#f9f9f9] rounded-3xl overflow-hidden group relative">
                        <img id="main-product-img" src="${sanitize(p.img)}" loading="lazy" class="max-h-full mix-blend-multiply transition-all duration-700 hover:scale-110 cursor-zoom-in" onerror="this.src='logo.png'" onclick="openImageZoom('${sanitize(p.img)}')">
                        <!-- أزرار التنقل للمعرض -->
                        <button onclick="changeProductImage(-1)" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        <button onclick="changeProductImage(1)" class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                        <!-- زر التكبير -->
                        <button onclick="openImageZoom('${sanitize(p.img)}')" class="absolute bottom-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white" title="تكبير الصورة">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path></svg>
                        </button>
                    </div>
                    <div class="flex gap-3 justify-center">
                        ${images.map((img, idx) => `
                            <button onclick="changeProductImage(${idx})" 
                                    class="thumbnail-btn w-20 h-20 bg-[#f9f9f9] rounded-xl p-2 border-2 ${idx === 0 ? 'border-primary' : 'border-transparent'} hover:border-primary/50 transition-all overflow-hidden"
                                    data-index="${idx}">
                                <img src="${sanitize(img)}" loading="lazy" class="w-full h-full object-contain mix-blend-multiply thumbnail-img">
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <!-- معلومات المنتج مع تابات -->
                <div class="flex flex-col text-right space-y-6">
                    <div class="space-y-3">
                        <p class="text-primary font-bold text-[10px] uppercase tracking-[0.3em]">${sanitize(p.category)}</p>
                        <h1 class="text-4xl md:text-5xl font-extrabold text-black leading-tight tracking-tight">${sanitize(p.name)}</h1>
                        <div class="flex items-center gap-4 pt-2 flex-wrap">
                            <span class="text-3xl font-bold text-primary">${sanitize(p.price)} ج.م</span>
                            ${p.oldPrice ? `<span class="text-lg text-gray-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                            ${p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0 ? `<span class="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full font-bold low-stock-alert shadow-sm">⚠️ متبقي ${p.stock} فقط!</span>` : ''}
                            ${p.stock === 0 ? `<span class="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-full font-bold shadow-sm">❌ نفذ من المخزون</span>` : ''}
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                            <button onclick="FavoritesManager.toggle('${sanitize(p.id)}'); event.stopPropagation();" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn flex items-center gap-2 px-4 py-2 border-2 border-gray-200 rounded-full hover:border-primary transition-all ${FavoritesManager.isFavorite(p.id) ? 'favorite-active border-primary' : ''}">
                                ${FavoritesManager.isFavorite(p.id) 
                                    ? `<svg class="heart-icon w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                                    : `<svg class="heart-icon w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`
                                }
                                <span class="text-sm font-bold">${FavoritesManager.isFavorite(p.id) ? 'في المفضلة' : 'أضف للمفضلة'}</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- نظام التابات المحسن -->
                    <div class="border-b border-gray-200">
                        <div class="flex gap-6" role="tablist">
                            <button onclick="switchTab('desc')" 
                                    id="tab-btn-desc"
                                    class="tab-btn pb-3 border-b-2 border-primary text-primary font-bold text-sm transition-all relative"
                                    role="tab"
                                    aria-selected="true"
                                    aria-controls="tab-desc">
                                الوصف
                                <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary transform scale-x-100 transition-transform"></span>
                            </button>
                            <button onclick="switchTab('ingredients')" 
                                    id="tab-btn-ingredients"
                                    class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-bold text-sm transition-all hover:text-gray-700"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="tab-ingredients">
                                المكونات
                            </button>
                            <button onclick="switchTab('reviews')" 
                                    id="tab-btn-reviews"
                                    class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-bold text-sm transition-all hover:text-gray-700"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="tab-reviews">
                                التقييمات
                            </button>
                        </div>
                    </div>
                    
                    <div id="tab-desc" class="tab-content text-gray-600 leading-relaxed animate-fade-in-up">
                        <p>${sanitize(p.desc) || 'أفضل منتجات العناية المختارة بعناية فائقة لضمان أفضل النتائج لبشرتك وشعرك.'}</p>
                        ${p.size ? `<p class="mt-4 text-sm"><strong>الحجم:</strong> ${sanitize(p.size)}</p>` : ''}
                    </div>
                    
                    <div id="tab-ingredients" class="tab-content hidden text-gray-600 leading-relaxed">
                        <p>${sanitize(p.ingredients) || 'مكونات طبيعية 100% بدون مواد حافظة أو كحول. مناسب لجميع أنواع البشرة والشعر.'}</p>
                    </div>
                    
                    <div id="tab-reviews" class="tab-content hidden text-gray-600 leading-relaxed">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="flex text-yellow-400 text-lg">★★★★★</div>
                            <span class="text-sm font-bold">(4.9/5 من 127 تقييم)</span>
                        </div>
                        <div class="space-y-4">
                            <div class="bg-gray-50 p-4 rounded-2xl">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">ن</div>
                                    <span class="font-bold text-sm">نورة أحمد</span>
                                    <div class="flex text-yellow-400 text-xs mr-auto">★★★★★</div>
                                </div>
                                <p class="text-sm text-gray-600">منتج رائع جداً! لاحظت الفرق من أول أسبوع. أنصح به بشدة 💕</p>
                            </div>
                        </div>
                        <button class="mt-4 w-full py-3 border-2 border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition-all text-sm">إضافة تقييمك</button>
                    </div>
                    
                    <!-- أزرار الإجراء -->
                    <div class="space-y-3 pt-4 border-t border-gray-100">
                        <div class="flex items-center gap-4">
                            <div class="flex border-2 border-gray-200 rounded-full" dir="ltr">
                                <button onclick="const qtyInput = document.getElementById('product-qty'); const newVal = Math.max(1, parseInt(qtyInput.value) - 1); qtyInput.value = newVal;" class="px-4 py-3 text-primary font-bold hover:bg-primary/10 transition-colors rounded-l-full active:scale-95">-</button>
                                <input id="product-qty" type="number" value="1" min="1" max="${p.stock}" class="w-12 text-center font-bold border-x-2 border-gray-200 focus:outline-none" readonly>
                                <button onclick="const qtyInput = document.getElementById('product-qty'); const newVal = Math.min(${p.stock}, parseInt(qtyInput.value) + 1); qtyInput.value = newVal;" class="px-4 py-3 text-primary font-bold hover:bg-primary/10 transition-colors rounded-r-full active:scale-95">+</button>
                            </div>
                            <button onclick="app.addToCart('${p.id}', document.getElementById('product-qty').value)" class="flex-1 bg-primary text-white font-bold uppercase text-sm tracking-widest py-4 rounded-full hover:bg-black transition-all shadow-lg shadow-primary/30 active:scale-95">أضف للحقيبة</button>
                        </div>
                        <button onclick="app.buyNow('${p.id}', document.getElementById('product-qty').value)" class="w-full bg-black text-white font-bold uppercase text-sm tracking-widest py-4 rounded-full hover:bg-primary transition-all active:scale-95">اشتري الآن</button>
                    </div>
                </div>
            </div>
            
            <!-- نافذة تكبير الصور (Modal) -->
            <div id="image-zoom-modal" class="fixed inset-0 bg-black/95 z-[9999] hidden items-center justify-center" onclick="closeImageZoom()">
                <button onclick="closeImageZoom()" class="absolute top-6 right-6 text-white hover:text-primary transition-colors">
                    <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <button onclick="changeZoomImage(-1)" class="absolute left-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <button onclick="changeZoomImage(1)" class="absolute right-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <img id="zoomed-image" src="" class="max-w-[90vw] max-h-[90vh] object-contain" onclick="event.stopPropagation()">
                <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                    <span id="zoom-counter">1 / 3</span>
                </div>
            </div>
            
            <script>
                window.currentImageIndex = 0;
                window.productImages = ${JSON.stringify(images)};
                window.zoomImageIndex = 0;
                
                function changeProductImage(direction) {
                    if (typeof direction === 'number') {
                        if (direction >= 0) {
                            window.currentImageIndex = direction;
                        } else {
                            window.currentImageIndex = (window.currentImageIndex - 1 + window.productImages.length) % window.productImages.length;
                        }
                    }
                    
                    const mainImg = document.getElementById('main-product-img');
                    mainImg.style.opacity = '0';
                    mainImg.style.transform = 'scale(0.95)';
                    
                    setTimeout(() => {
                        mainImg.src = window.productImages[window.currentImageIndex];
                        mainImg.style.opacity = '1';
                        mainImg.style.transform = 'scale(1)';
                    }, 200);
                    
                    // تحديث الثمبنيلز
                    document.querySelectorAll('.thumbnail-btn').forEach((btn, idx) => {
                        if (idx === window.currentImageIndex) {
                            btn.classList.add('border-primary');
                            btn.classList.remove('border-transparent');
                        } else {
                            btn.classList.remove('border-primary');
                            btn.classList.add('border-transparent');
                        }
                    });
                }
                
                function openImageZoom(imgSrc) {
                    const modal = document.getElementById('image-zoom-modal');
                    const zoomedImg = document.getElementById('zoomed-image');
                    const counter = document.getElementById('zoom-counter');
                    
                    // البحث عن индекс الصورة الحالية
                    window.zoomImageIndex = window.productImages.indexOf(imgSrc);
                    if (window.zoomImageIndex === -1) window.zoomImageIndex = 0;
                    
                    zoomedImg.src = window.productImages[window.zoomImageIndex];
                    counter.textContent = (window.zoomImageIndex + 1) + ' / ' + window.productImages.length;
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    document.body.style.overflow = 'hidden';
                }
                
                function closeImageZoom() {
                    const modal = document.getElementById('image-zoom-modal');
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                    document.body.style.overflow = '';
                }
                
                function changeZoomImage(direction) {
                    const zoomedImg = document.getElementById('zoomed-image');
                    const counter = document.getElementById('zoom-counter');
                    
                    if (direction === -1) {
                        window.zoomImageIndex = (window.zoomImageIndex - 1 + window.productImages.length) % window.productImages.length;
                    } else {
                        window.zoomImageIndex = (window.zoomImageIndex + 1) % window.productImages.length;
                    }
                    
                    zoomedImg.style.opacity = '0';
                    zoomedImg.style.transform = 'scale(0.95)';
                    
                    setTimeout(() => {
                        zoomedImg.src = window.productImages[window.zoomImageIndex];
                        zoomedImg.style.opacity = '1';
                        zoomedImg.style.transform = 'scale(1)';
                        counter.textContent = (window.zoomImageIndex + 1) + ' / ' + window.productImages.length;
                    }, 150);
                }
                
                // دعم لوحة المفاتيح للتنقل في المعرض المكبر
                document.addEventListener('keydown', function(e) {
                    const modal = document.getElementById('image-zoom-modal');
                    if (!modal || modal.classList.contains('hidden')) return;
                    
                    if (e.key === 'ArrowLeft') changeZoomImage(1);
                    if (e.key === 'ArrowRight') changeZoomImage(-1);
                    if (e.key === 'Escape') closeImageZoom();
                });
                
                function switchTab(tabName) {
                    // إخفاء كل المحتوى
                    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
                    // إظهار المحتوى المطلوب
                    document.getElementById('tab-' + tabName).classList.remove('hidden');
                    
                    // تحديث حالة الأزرار
                    document.querySelectorAll('.tab-btn').forEach(btn => {
                        btn.classList.remove('border-primary', 'text-primary');
                        btn.classList.add('border-transparent', 'text-gray-500');
                        btn.setAttribute('aria-selected', 'false');
                    });
                    
                    const activeBtn = document.getElementById('tab-btn-' + tabName);
                    activeBtn.classList.remove('border-transparent', 'text-gray-500');
                    activeBtn.classList.add('border-primary', 'text-primary');
                    activeBtn.setAttribute('aria-selected', 'true');
                }
                
                // تحديث Breadcrumb
                const breadcrumbCategory = document.getElementById('breadcrumb-category');
                if (breadcrumbCategory) {
                    breadcrumbCategory.textContent = '${p.category}';
                }
                
                // عرض المنتجات ذات الصلة
                renderRelatedProducts('${p.id}', '${p.category}');
                
                // إضافة مستمعي الأحداث لأزرار المفضلة
                setTimeout(() => {
                    document.querySelectorAll('.favorite-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const productId = btn.getAttribute('data-favorite-btn');
                            FavoritesManager.toggle(productId);
                        });
                    });
                }, 0);
            <\/script>`;
    }
    
    // دالة عرض المنتجات ذات الصلة
    function renderRelatedProducts(currentId, category) {
        const relatedSection = document.getElementById('related-products');
        const relatedGrid = document.getElementById('related-products-grid');
        
        if (!relatedSection || !relatedGrid) return;
        
        // جلب منتجات من نفس الفئة باستثناء المنتج الحالي
        const relatedProducts = productsDB
            .filter(p => p.category === category && p.id !== currentId)
            .slice(0, 4);
        
        if (relatedProducts.length === 0) {
            relatedSection.classList.add('hidden');
            return;
        }
        
        relatedSection.classList.remove('hidden');
        relatedGrid.innerHTML = relatedProducts.map((p, index) => {
            const isFav = FavoritesManager.isFavorite(p.id);
            const isOutOfStock = p.stock <= 0;
            
            return `
                <article class="product-card text-right group opacity-0 animate-fade-in-up" style="animation-delay: ${index * 50}ms">
                    <div class="relative overflow-hidden rounded-custom bg-white shadow-md hover:shadow-xl transition-all duration-300">
                        <!-- Badge -->
                        ${p.badge ? `<span class="absolute top-3 left-3 z-10 bg-primary text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">${sanitize(p.badge)}</span>` : ''}
                        
                        <!-- زر المفضلة -->
                        <div class="absolute top-3 right-3 z-20">
                            <button onclick="event.stopPropagation(); FavoritesManager.toggle('${sanitize(p.id)}');" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn p-2.5 rounded-full shadow-lg transition-all duration-300 ${isFav ? 'favorite-active' : ''}" title="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
                                ${isFav 
                                    ? '<svg class="heart-icon w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
                                    : '<svg class="heart-icon w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>'
                                }
                            </button>
                        </div>
                        
                        <!-- صورة المنتج -->
                        <div class="aspect-square bg-[#f9f9f9] p-6 flex items-center justify-center cursor-pointer" onclick="app.navigate('product', '${sanitize(p.id)}')">
                            <img src="${sanitize(p.img)}" loading="lazy" alt="${sanitize(p.name)}" class="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110" onerror="this.src='logo.png'">
                        </div>
                        
                        <!-- معلومات المنتج -->
                        <div class="p-4 space-y-3">
                            <h3 class="font-bold text-sm text-gray-900 line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-primary transition-colors" onclick="app.navigate('product', '${sanitize(p.id)}')">${sanitize(p.name)}</h3>
                            
                            <div class="flex items-center gap-2 justify-between">
                                <div class="flex flex-col">
                                    <span class="text-primary font-bold text-base">${sanitize(p.price)} ج.م</span>
                                    ${p.oldPrice ? `<span class="text-xs text-gray-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                                </div>
                                ${isOutOfStock 
                                    ? '<span class="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">نفذت الكمية</span>'
                                    : p.stock <= LOW_STOCK_THRESHOLD 
                                        ? `<span class="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-bold">متبقي ${p.stock}</span>`
                                        : ''
                                }
                            </div>
                            
                            ${!isOutOfStock ? `
                                <button onclick="app.addToCart('${sanitize(p.id)}', 1)" class="w-full bg-primary text-white font-bold uppercase text-[10px] tracking-widest py-2.5 rounded-full hover:bg-neutral-900 transition-all shadow-lg shadow-primary/30 active:scale-95">
                                    أضف للحقيبة
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
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
                        <img src="${sanitize(item.img)}" class="w-full h-full object-contain mix-blend-multiply">
                        <span class="absolute -bottom-2 -left-2 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full">x${item.qty}</span>
                    </div>
                    <div class="flex-grow space-y-1">
                        <span class="text-[9px] font-black uppercase tracking-widest text-primary">هدية مجانية 🎁</span>
                        <h3 class="text-sm font-extrabold uppercase text-black">${sanitize(item.name)}</h3>
                        <p class="text-base font-bold text-green-500 pt-2">مجانـــــاً</p>
                    </div>
                </div>`;
            }
            return `
            <div class="flex gap-8 border-b border-gray-100 pb-10 text-right group relative">
                <div class="w-24 h-24 bg-[#f9f9f9] p-4 rounded-2xl relative"><img src="${sanitize(item.img)}" class="w-full h-full object-contain mix-blend-multiply"></div>
                <div class="flex-grow space-y-1">
                    <h3 class="text-sm font-extrabold uppercase text-black">${sanitize(item.name)}</h3>
                    <div class="flex flex-row-reverse justify-between items-center pt-4">
                        <span class="text-base font-bold text-primary">${sanitize(item.price * item.qty)} ج.م</span>
                        <div class="flex border border-gray-100 rounded-full" dir="ltr">
                            <button onclick="app.updateQty('${sanitize(item.id)}', 1)" class="px-3 py-1 text-primary font-bold">+</button>
                            <span class="px-4 py-1 text-xs font-bold">${item.qty}</span>
                            <button onclick="app.updateQty('${sanitize(item.id)}', -1)" class="px-3 py-1 text-primary font-bold">-</button>
                        </div>
                    </div>
                </div>
                <button onclick="app.removeItem('${sanitize(item.id)}')" class="text-gray-300 hover:text-red-500 transition-colors">×</button>
            </div>`;
        }).join('');
        if (summary) summary.innerHTML = `<div class="flex justify-between items-center text-xl font-bold"><span>الإجمالي</span><span class="text-primary">${sanitize(subtotal)} ج.م</span></div>`;
    }

    function updateBadge() { 
        const b = document.getElementById('cart-badge'); 
        if (b) b.innerText = cart.reduce((s, i) => s + i.qty, 0);
        
        // تحديث شارة المفضلة
        const favBadge = document.getElementById('favorites-badge');
        if (favBadge) favBadge.innerText = FavoritesManager.getCount();
    }

    // ==========================================
    // عرض صفحة المفضلة
    // ==========================================
    function renderFavorites() {
        const grid = document.getElementById('favorites-grid');
        const emptyState = document.getElementById('favorites-empty');
        
        if (!grid) return;
        
        const favoriteProducts = productsDB.filter(p => FavoritesManager.isFavorite(p.id));
        
        if (favoriteProducts.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        grid.innerHTML = favoriteProducts.map((p, index) => {
            const isFav = FavoritesManager.isFavorite(p.id);

            return `
                <article class="product-card text-right group opacity-0 animate-fade-in-up" style="animation-delay: ${index * 50}ms" onclick="app.navigate('product', '${sanitize(p.id)}')">
                    <div class="product-image-bg relative mb-6 overflow-hidden">
                        <img src="${sanitize(p.img)}" loading="lazy" class="max-h-full transition-transform duration-500 group-hover:scale-110" onerror="this.src='logo.png'">
                        ${p.badge ? `<div class="absolute top-4 left-4 z-10"><span class="badge-premium">${sanitize(p.badge)}</span></div>` : ''}
                        <button onclick="event.stopPropagation(); FavoritesManager.toggle('${sanitize(p.id)}');" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn absolute top-3 right-3 z-20 w-6 h-6 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all ${isFav ? 'favorite-active' : ''}" title="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
                            ${isFav
                                ? `<svg class="heart-icon w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                                : `<svg class="heart-icon w-3.5 h-3.5 text-gray-400 hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`
                            }
                        </button>
                    </div>
                    <div class="space-y-1 mb-6 px-1">
                        <p class="text-[9px] uppercase tracking-widest text-primary font-bold">Elforat Pharma</p>
                        <h3 class="text-base font-extrabold text-black leading-tight">${sanitize(p.name)}</h3>
                        <div class="flex flex-row-reverse justify-end items-center gap-3 pt-1">
                            <span class="text-sm font-bold text-gray-900">${sanitize(p.price)} ج.م</span>
                            ${p.oldPrice ? `<span class="text-xs text-gray-400 line-through decoration-gray-300">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); app.addToCart('${sanitize(p.id)}', 1)" class="flex-1 btn-pill btn-add-cart-minimal py-3">أضف للسلة</button>
                        <button onclick="event.stopPropagation(); app.buyNow('${sanitize(p.id)}')" class="flex-1 btn-pill btn-buy-now-premium py-3">اشتري الآن</button>
                    </div>
                </article>
            `;
        }).join('');

        // إضافة مستمعي الأحداث لأزرار المفضلة
        setTimeout(() => {
            document.querySelectorAll('.favorite-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const productId = btn.getAttribute('data-favorite-btn');
                    FavoritesManager.toggle(productId);
                    updateBadge();
                    renderFavorites();
                });
            });
        }, 0);
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
            try {
    const orderSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    orderSound.play().catch(()=>{});
} catch(e) {}
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
    checkCartExpiry(); // التحقق من انتهاء صلاحية السلة
    loadCart();
    updateBadge();

    // إخفاء شاشة التحميل العالمية عند اكتمال التحميل
    function hideGlobalLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => loader.remove(), 500);
        }
    }

    loadGifts();
    FavoritesManager.init(); // تهيئة نظام المفضلة
    updateBadge(); // تحديث شارة المفضلة عند التحميل
    fetchProducts().then(() => {
        hideGlobalLoader();
    }).catch(() => {
        hideGlobalLoader();
    });
    
    // Timeout احتياطي لإخفاء اللودر حتى لو حدث خطأ
    setTimeout(hideGlobalLoader, 5000);
    
    checkLowStock();
    startCountdown();
    
    /* إظهار شريط العروض الترويجية */
    showPromotionBanner();
});