/**
 * ELFORAT PHARMA - FULL INTEGRATED SCRIPT
 * النسخة الكاملة: التصميم الأصلي + سوبابيز + الترتيب + الخط المتحرك + الصور
 */

// ==========================================
// نظام الرسائل المنبثقة (Toast) - بديل جميل لـ alert() الافتراضي
// ==========================================
(function () {
    let toastContainer = null;

    function getToastContainer() {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed top-5 inset-x-0 z-[9999] flex flex-col items-center gap-3 pointer-events-none px-4';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    // النوع: 'success' (افتراضي) / 'error' / 'info'
    window.showToast = function (message, type = 'success') {
        const container = getToastContainer();

        const styles = {
            success: { bg: 'from-primary to-secondary', icon: 'fa-circle-check', iconColor: 'text-emerald-300' },
            error: { bg: 'from-rose-500 to-rose-600', icon: 'fa-circle-exclamation', iconColor: 'text-white' },
            info: { bg: 'from-emerald-500 to-emerald-600', icon: 'fa-circle-info', iconColor: 'text-white' },
        };
        const s = styles[type] || styles.success;

        const toast = document.createElement('div');
        toast.setAttribute('role', 'status');
        toast.className = `pointer-events-auto flex items-center gap-3 bg-gradient-to-l ${s.bg} text-white font-bold text-sm px-5 py-3.5 rounded-2xl shadow-purple-glow border border-white/20 max-w-sm w-fit opacity-0 -translate-y-4 transition-all duration-300 ease-out`;
        toast.innerHTML = `
            <span class="${s.iconColor} text-lg leading-none"><i class="fa-solid ${s.icon}"></i></span>
            <span class="flex-1 leading-snug">${message}</span>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.remove('opacity-0', '-translate-y-4');
            });
        });

        // Auto dismiss
        setTimeout(() => {
            toast.classList.add('opacity-0', '-translate-y-4');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // استبدال alert() الافتراضي في كل الموقع برسالة منبثقة أنيقة
    window.alert = function (message) {
        window.showToast(message, 'success');
    };
})();

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
                btn.innerHTML = isFav
                    ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                    : `<i class="fa-regular fa-heart text-xs"></i>`;
            }
        },

        getCount() {
            return this.favorites.length;
        }
    };

    let productsDB = [];
    let cart = [];
    let appliedCoupon = null; // { code, discount_percentage }

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

    // ==========================================
    // دوال حفظ واسترجاع كود الكوبون المطبّق
    // ==========================================
    function loadCoupon() {
        try {
            const saved = localStorage.getItem('elforat_coupon');
            appliedCoupon = saved ? JSON.parse(saved) : null;
        } catch (e) {
            appliedCoupon = null;
        }
        // كوبون الترحيب صالح لأول زيارة فقط: لو المحفوظ WELCOME10 والزيارة الأولى خلصت → يتشال تلقائياً
        if (appliedCoupon && window.WelcomeOffer && !window.WelcomeOffer.guard(appliedCoupon.code).ok) {
            appliedCoupon = null;
            saveCoupon();
        }
    }

    function saveCoupon() {
        if (appliedCoupon) {
            localStorage.setItem('elforat_coupon', JSON.stringify(appliedCoupon));
        } else {
            localStorage.removeItem('elforat_coupon');
        }
    }

    function getCartSubtotal() {
        return cart.reduce((s, i) => s + (i.price * i.qty), 0);
    }

    // يرجع قيمة الخصم بالجنيه بناءً على الكوبون المطبّق حالياً
    function getCartDiscount(subtotal) {
        if (!appliedCoupon || !appliedCoupon.discount_percentage) return 0;
        const discount = (subtotal * appliedCoupon.discount_percentage) / 100;
        return Math.round(discount * 100) / 100;
    }

    // ==========================================
    // شريط تقدّم الشحن المجاني: يتدرّج لونه من الذهبي إلى الأخضر
    // كل ما اقترب إجمالي السلة من حد الشحن المجاني (FREE_SHIPPING_THRESHOLD)
    // ==========================================
    let FREE_SHIPPING_THRESHOLD = 1000;

    function lerpHexColor(fromHex, toHex, t) {
        const clampedT = Math.min(Math.max(t, 0), 1);
        const f = fromHex.replace('#', ''), to = toHex.replace('#', '');
        const fr = parseInt(f.substring(0, 2), 16), fg = parseInt(f.substring(2, 4), 16), fb = parseInt(f.substring(4, 6), 16);
        const tr = parseInt(to.substring(0, 2), 16), tg = parseInt(to.substring(2, 4), 16), tb = parseInt(to.substring(4, 6), 16);
        const r = Math.round(fr + (tr - fr) * clampedT);
        const g = Math.round(fg + (tg - fg) * clampedT);
        const b = Math.round(fb + (tb - fb) * clampedT);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // ذهبي (لون العلامة التجارية) عند 0% ← أخضر زاهي كل ما اقتربت النسبة من 100%
    function getShippingBarColor(pct) {
        return lerpHexColor('#c59b3f', '#10b981', pct / 100);
    }

    // إعادة التحقق من صلاحية الكوبون المحفوظ محلياً كل مرة يُفتح فيها السلة
    // (في حالة الآدمن أوقف الكوبون أو انتهت صلاحيته من وقت ما اتحفظ في المتصفح)
    async function revalidateCoupon() {
        if (!appliedCoupon) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await _supabase
                .from('coupons')
                .select('code,discount_percentage,min_amount,max_uses,used_count,expiry_date')
                .eq('code', appliedCoupon.code)
                .eq('is_active', true)
                .gte('expiry_date', today)
                .maybeSingle();

            if (error || !data) {
                appliedCoupon = null;
                saveCoupon();
            } else {
                const usesOk = (data.max_uses == null) || (Number(data.used_count) || 0) < Number(data.max_uses);
                const pctOk = data.discount_percentage === appliedCoupon.discount_percentage;
                if (!usesOk || !pctOk) {
                    appliedCoupon = null;
                    saveCoupon();
                } else {
                    appliedCoupon = { code: data.code, discount_percentage: data.discount_percentage };
                    saveCoupon();
                }
            }
            renderCart();
        } catch (e) {
            console.warn('revalidateCoupon error:', e);
        }
    }

    function renderCouponUI() {
        const inputWrap = document.getElementById('coupon-input-wrap');
        const appliedWrap = document.getElementById('coupon-applied-wrap');
        const msg = document.getElementById('coupon-message');
        if (!inputWrap || !appliedWrap) return;

        if (appliedCoupon) {
            inputWrap.classList.add('hidden');
            appliedWrap.classList.remove('hidden');
            appliedWrap.classList.add('flex');
            const codeEl = appliedWrap.querySelector('[data-coupon-code]');
            if (codeEl) codeEl.textContent = appliedCoupon.code;
        } else {
            inputWrap.classList.remove('hidden');
            appliedWrap.classList.add('hidden');
            appliedWrap.classList.remove('flex');
        }
        if (msg) { msg.classList.add('hidden'); msg.textContent = ''; }
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

    // دالة إصلاح المسارات لضمان ظهور الصور من فولدر uploads (النسخة الأصلية بالحجم الكامل)
    function getFullImg(path) {
        if (!path) return 'logo.png';
        if (path.startsWith('http')) return path;
        const cleanPath = path.replace('uploads/', '');
        return `${supabaseUrl}/storage/v1/object/public/products/uploads/${cleanPath}`;
    }

    // [تحسين أداء]: نسخة مصغّرة ومضغوطة من الصورة عبر خدمة wsrv.nl المجانية
    // (بروكسي تصغير صور مجاني وبدون تسجيل، بيشتغل مع أي صورة عامة على الإنترنت)
    // - استخدمنا الخدمة دي بدل Supabase Image Transformations لأنها مش مفعّلة
    // في خطة Supabase الحالية. لو الخدمة اتأخرت أو فشلت لأي سبب، الـ onerror
    // في الـ <img> (شوفي handleImgError تحت) بيرجع تلقائياً للصورة الأصلية
    // بالحجم الكامل، فمفيش أي كسر في العرض حتى لو الخدمة الخارجية وقعت.
    function getOptimizedImg(path, width = 500, quality = 70) {
        const fullUrl = getFullImg(path);
        if (!fullUrl.startsWith('http')) return fullUrl; // لوجو محلي مثلاً - سيبه زي ما هو
        return `https://wsrv.nl/?url=${encodeURIComponent(fullUrl)}&w=${width}&q=${quality}&output=webp`;
    }

    // معالج موحّد لفشل تحميل الصور: أول محاولة فشل بترجع للصورة الأصلية،
    // ولو دي كمان فشلت بيرجع للوجو كحل أخير (بدل ما تفضل مكسورة).
    function handleImgError(imgEl, fallbackUrl) {
        if (!imgEl) return;
        if (imgEl.dataset.imgFallback === '1') {
            imgEl.onerror = null;
            imgEl.src = 'logo.png';
            return;
        }
        imgEl.dataset.imgFallback = '1';
        imgEl.src = fallbackUrl || 'logo.png';
    }
    window.handleImgError = handleImgError;

    const PRODUCTS_CACHE_KEY = 'elforat_products_cache_v3';
    // الكاش بيتعرض فوراً حتى لو قديم (لحد 7 أيام)، وبعدها بيتحدّث من السيرفر في الخلفية
    const PRODUCTS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
    // [تعديل أداء]: قبل كده كل فتح للصفحة كان بيعمل تحديث كامل من سوبابيز في
    // الخلفية حتى لو الكاش لسه طازة (نفس اللحظة تقريباً)، وده بيضاعف الحمل على
    // قاعدة البيانات مع أي زيادة في الزوار بدون أي فايدة حقيقية للمستخدم (هو
    // أصلاً شايف نفس البيانات من الكاش). دلوقتي: لو آخر تحديث حصل من أقل من
    // 5 دقايق، منعملش طلب شبكة تاني ونكتفي بالكاش المعروض بالفعل.
    const PRODUCTS_REFRESH_THROTTLE = 5 * 60 * 1000;

    function getProductsCacheAge() {
        try {
            const cached = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || 'null');
            if (!cached || !cached.savedAt) return Infinity;
            return Date.now() - cached.savedAt;
        } catch (e) {
            return Infinity;
        }
    }

    // تقييمات متفاوتة وثابتة لكل منتج (بدل ما تبقى كلها 4.9)
    function computeRatingForId(id) {
        const ratings = [4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9];
        const str = String(id);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) % 100000;
        }
        return ratings[hash % ratings.length];
    }

    function normalizeProducts(data) {
        return (data || []).filter(p => p.is_active !== false).map(p => ({
            id: p.id,
            name: p.name,
            category: p.category || 'عام',
            price: parseFloat(p.price) || 0,
            oldPrice: p.oldPrice || null,
            img: getFullImg(p.img),
            imgThumb: getOptimizedImg(p.img, 500, 70),
            badge: p.badge || '',
            desc: p.desc || '',
            ingredients: p.ingredients || '',
            size: p.size || '',
            stock: parseInt(p.stock) || 100,
            rating: p.rating || computeRatingForId(p.id),
            images: p.images || []
        }));
    }

    function readProductsCache() {
        try {
            const cached = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || 'null');
            if (!cached || !Array.isArray(cached.data)) return null;
            if (Date.now() - cached.savedAt > PRODUCTS_CACHE_TTL) return null;
            return cached.data;
        } catch (e) {
            return null;
        }
    }

    function writeProductsCache(data) {
        try {
            localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
        } catch (e) { }
    }

    function optimizePageImages(root = document) {
        root.querySelectorAll('img').forEach((img, index) => {
            if (!img.hasAttribute('loading')) img.loading = index < 3 ? 'eager' : 'lazy';
            if (!img.hasAttribute('decoding')) img.decoding = 'async';
            if (index === 0 && !img.hasAttribute('fetchpriority')) img.fetchPriority = 'high';
        });
    }

    function arabicProductCountLabel(count) {
        if (count === 0) return 'استكشفي المنتجات قريباً';
        if (count === 1) return 'استكشفي منتج واحد';
        if (count === 2) return 'استكشفي منتجين';
        if (count >= 3 && count <= 10) return `استكشفي ${count} منتجات`;
        return `استكشفي ${count} منتج`;
    }

    function updateCategoryCounts() {
        const products = productsDB.filter(p => !p.isGift);
        const counts = {};
        products.forEach(p => {
            counts[p.category] = (counts[p.category] || 0) + 1;
        });
        document.querySelectorAll('[data-category-count]').forEach(el => {
            const category = el.getAttribute('data-category-count');
            el.textContent = arabicProductCountLabel(counts[category] || 0);
        });
    }

    async function fetchProducts() {
        AppState.setState({ status: 'loading' });
        const cachedProducts = readProductsCache();
        const hadCache = !!cachedProducts;
        let dataChanged = false;
        if (hadCache) {
            productsDB = cachedProducts;
            renderCatalog(null, '');
            updateCategoryCounts();
        } else {
            renderSkeletonLoading();
        }

        // لو عندنا كاش وسنّه لسه تحت حد التحديث (5 دقايق)، منعملش أي طلب
        // شبكة لسوبابيز خالص - نكتفي باللي اتعرض بالفعل من الكاش فوق.
        const cacheAge = hadCache ? getProductsCacheAge() : Infinity;
        const shouldSkipNetworkRefresh = hadCache && cacheAge < PRODUCTS_REFRESH_THROTTLE;

        const refresh = shouldSkipNetworkRefresh ? (async () => {
            AppState.setState({ status: 'success' });
        })() : (async () => {
        try {
            // [تعديل الترتيب]: جلب المنتجات مرتبة حسب الـ ID لضمان الترتيب القديم
            // [تعديل Pagination]: سوبابيز/PostgREST بيرجع 1000 صف بحد أقصى في أي
            // طلب واحد (limit افتراضي)، فلو عدد المنتجات زاد عن كده هتتقطع بصمت
            // من غير أي خطأ. الحل: جلب البيانات على دفعات بـ .range() لحد ما
            // نوصل لآخر صفحة (بترجع صفوف أقل من حجم الصفحة).
            const PRODUCTS_PAGE_SIZE = 1000;
            async function fetchAllProductsPaged() {
                // [تسريع]: index.html بيبدأ طلب المنتجات قبل ما الصفحة تخلّص تحميل،
                // فنستخدم نتيجته لو نجح (ولو فشل بنكمل بالطريقة العادية تحت).
                try {
                    if (window.__productsPrefetch) {
                        const early = await window.__productsPrefetch;
                        window.__productsPrefetch = null; // مرة واحدة بس
                        if (Array.isArray(early) && early.length < PRODUCTS_PAGE_SIZE) return early;
                    }
                } catch (_) { window.__productsPrefetch = null; }

                let all = [];
                let from = 0;
                while (true) {
                    const to = from + PRODUCTS_PAGE_SIZE - 1;
                    const { data: page, error } = await _supabase
                        .from('products')
                        .select('*')
                        .order('priority', { ascending: false })
                        // ترتيب ثانوي ثابت: لو كذا منتج ليهم نفس الـ priority، من غيره الترتيب
                        // بين الصفحات مش مضمون وممكن منتج يتكرر أو يتفوّت. (بيطابق index: idx_products_priority_id)
                        .order('id', { ascending: true })
                        .range(from, to);

                    if (error) throw error;
                    if (!page || page.length === 0) break;

                    all = all.concat(page);
                    if (page.length < PRODUCTS_PAGE_SIZE) break; // ده آخر صفحة
                    from += PRODUCTS_PAGE_SIZE;
                }
                return all;
            }

            const fetchWithRetry = ErrorHandler.retry(async () => {
                return await fetchAllProductsPaged();
            }, AppState.maxRetries);

            const data = await fetchWithRetry();

            const freshProducts = normalizeProducts(data);
            dataChanged = !hadCache || JSON.stringify(freshProducts) !== JSON.stringify(cachedProducts);
            productsDB = freshProducts;
            writeProductsCache(productsDB);

            AppState.setState({ status: 'success' });
        } catch (err) {
            ErrorHandler.handle(err, 'fetchProducts');
            console.warn('تعذر الاتصال بالسيرفر، سيتم استخدام البيانات المحلية الاحتياطية.');
            // ملحوظة: الـ IDs دي (p1/b1/b2/b3) مش موجودة فعلياً في جدول products
            // وبالتالي أي محاولة شراء منها هتترفض من الـ trigger الأمني على السيرفر.
            // دي بيانات احتياطية للعرض فقط في حالة انقطاع الاتصال بالكامل بقاعدة البيانات.
            if (!hadCache) productsDB = [
                { id: 'p1', name: 'Guzel Gold Serum', category: 'العناية بالشعر', price: 250, oldPrice: 350, img: getFullImg('guzel_gold.png'), badge: 'خصم 28%', rating: 4.8 },
                { id: 'b1', name: 'مجموعة الديتوكس والترطيب', category: 'مجموعات متكاملة', price: 125, oldPrice: 175, img: getFullImg('group1.png'), badge: 'توفير', rating: 4.5 },
                { id: 'b2', name: 'مجموعة العناية الفائقة بالمناطق الحساسة', category: 'مجموعات متكاملة', price: 280, oldPrice: 380, img: getFullImg('group2.png'), badge: 'عرض خاص', rating: 4.7 },
                { id: 'b3', name: 'مجموعة النعومة وعلاج جلد الوزة', category: 'مجموعات متكاملة', price: 350, oldPrice: 470, img: getFullImg('group3.png'), badge: 'الأكثر طلباً', rating: 4.9 }
            ];
        } finally {

            // الهدايا تُجلب ديناميكياً من سوبابيز عبر loadGifts()

            if (!hadCache || dataChanged) {
                // نحافظ على الفلتر/البحث اللي الزائر فيهم دلوقتي بدل ما نرجّعه لكل المنتجات
                const key = catalogLastFilterKey || '|';
                const sep = key.indexOf('|');
                const curFilter = sep === -1 ? '' : key.slice(0, sep);
                const curSearch = sep === -1 ? '' : key.slice(sep + 1);
                renderCatalog(curFilter || null, curSearch, { keepPage: true });
                updateCategoryCounts();
                // لو الزائر فاتح رابط منتج جديد مش موجود في الكاش القديم
                if (hadCache && /^#product/.test(location.hash) && typeof window.restoreViewFromHash === 'function') {
                    window.restoreViewFromHash();
                }
            }
        }
        })();

        // لو فيه نسخة محفوظة: نعرضها فوراً ونكمّل التحديث في الخلفية بدون ما نأخّر باقي الصفحة.
        // لو مفيش (أول زيارة): نستنى الجلب من السيرفر زي الأول.
        return hadCache ? undefined : refresh;
    }

    const imageObserver = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.tagName === 'IMG') optimizePageImages(node.parentElement || document);
                else if (node.querySelectorAll) optimizePageImages(node);
            });
        });
    });
    imageObserver.observe(document.documentElement, { childList: true, subtree: true });
    optimizePageImages();

    // دالة عرض Skeleton Loading
    function renderSkeletonLoading() {
        const grid = document.getElementById('catalog-grid');
        if (!grid) return;

        grid.innerHTML = Array(8).fill(0).map((_, i) => `
            <div class="product-card opacity-0 animate-fade-in-up" style="animation-delay: ${i * 50}ms">
                <div class="product-visual-glass mb-6 skeleton-img aspect-square"></div>
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

    function updateNavMorph(activeId, activeParam = null) {
        const activeKey = activeParam ? `${activeId}:${activeParam}` : activeId;
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkTarget = link.getAttribute('data-target');
            if (linkTarget === activeKey || (!activeParam && linkTarget === activeId)) {
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
        banner.className = "fixed top-0 left-0 right-0 bg-gradient-to-r from-primary via-secondary to-primary text-white py-3 px-4 z-[9998] flex items-center justify-center gap-4 overflow-hidden shadow-purple-glow";
        banner.innerHTML = `
            <div class="animate-pulse">🎉</div>
            <span class="font-bold text-sm md:text-base">شحن مجاني للطلبات فوق 1000 ج.م! | خصم 20% على المجموعات المتكاملة</span>
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

        document.getElementById("close-promo-btn").addEventListener("click", function () {
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
    // ==========================================
    // نظام التواصل المباشر (إرسال إلى جدول messages)
    // ==========================================
    async function submitContactMessage(name, phone, message) {
        if (!name || !phone || !message) {
            throw new Error('يرجى ملء جميع الحقول المطلوبة');
        }
        const { error } = await _supabase.from('messages').insert([{
            name: name.trim(),
            phone: phone.trim(),
            message: message.trim(),
            status: 'new'
        }]);
        if (error) throw error;
        return true;
    }

    function openContactModal() {
        if (typeof Swal === 'undefined') {
            window.open('https://wa.me/201146809133', '_blank');
            return;
        }
        Swal.fire({
            title: '<div class="flex items-center gap-2 justify-center text-primary font-bold text-lg"><i class="fa-solid fa-headset"></i> تواصل مع الفريق الطبي</div>',
            html: `
                <div class="space-y-3 text-right text-xs" dir="rtl">
                    <p class="text-slate-500 mb-3">يسعدنا استقبال استفساراتكم ومتابعاتكم الطبية، وسيتواصل معكم فريقنا المتخصص فوراً.</p>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">الاسم بالكامل *</label>
                        <input id="contact-name" class="swal2-input !w-full !m-0 !text-sm !h-11 !rounded-xl" placeholder="أدخل اسمك الكريم">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">رقم الهاتف أو الواتساب *</label>
                        <input id="contact-phone" type="tel" class="swal2-input !w-full !m-0 !text-sm !h-11 !rounded-xl text-left" dir="ltr" placeholder="01xxxxxxxxx">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">رسالتك أو استفسارك الطبي *</label>
                        <textarea id="contact-msg" class="swal2-textarea !w-full !m-0 !text-sm !rounded-xl" rows="3" placeholder="اكتب سؤالك أو استفسارك هنا..."></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إرسال الرسالة الآن ✉️',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#3312d5',
            focusConfirm: false,
            preConfirm: async () => {
                const name = document.getElementById('contact-name').value.trim();
                const phone = document.getElementById('contact-phone').value.trim();
                const msg = document.getElementById('contact-msg').value.trim();
                if (!name || !phone || !msg) {
                    Swal.showValidationMessage('يرجى ملء جميع الحقول المطلوبة');
                    return false;
                }
                try {
                    await submitContactMessage(name, phone, msg);
                    return true;
                } catch(err) {
                    Swal.showValidationMessage('تعذر إرسال الرسالة: ' + (err.message || 'حاول مجدداً'));
                    return false;
                }
            }
        }).then(res => {
            if (res.isConfirmed) {
                Swal.fire({
                    icon: 'success',
                    title: 'تم إرسال رسالتك بنجاح! 🌸',
                    text: 'سيتواصل معك أحد صيادلتنا المتخصصين في أقرب وقت عبر الواتساب أو الهاتف.',
                    confirmButtonText: 'حسناً',
                    confirmButtonColor: '#3312d5'
                });
            }
        });
    }

    // ==========================================
    // نظام تقييمات المنتجات المتصل بقاعدة البيانات (reviews)
    // ==========================================
    function openAddReviewModal(productId, productName) {
        if (typeof Swal === 'undefined') return;
        Swal.fire({
            title: `<div class="text-base font-bold text-darkNavy">إضافة تقييم لـ ${productName || 'المنتج'}</div>`,
            html: `
                <div class="space-y-3 text-right text-xs" dir="rtl">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">اسمك الكريم *</label>
                        <input id="rev-name" class="swal2-input !w-full !m-0 !text-sm !h-11 !rounded-xl" placeholder="مثال: ياسمين أحمد">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">تقييمك للمنتج (النجوم) *</label>
                        <select id="rev-stars" class="swal2-input !w-full !m-0 !text-sm !h-11 !rounded-xl font-bold">
                            <option value="5" selected>★★★★★ (5 نجوم - ممتاز جداً)</option>
                            <option value="4">★★★★☆ (4 نجوم - جيد جداً)</option>
                            <option value="3">★★★☆☆ (3 نجوم - جيد)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">اكتبي تجربتك مع المنتج *</label>
                        <textarea id="rev-comment" class="swal2-textarea !w-full !m-0 !text-sm !rounded-xl" rows="3" placeholder="ما رأيك في النتيجة والفاعلية وسرعة التوصيل؟"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'نشر التقييم ⭐',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#3312d5',
            focusConfirm: false,
            preConfirm: async () => {
                const name = document.getElementById('rev-name').value.trim();
                const stars = document.getElementById('rev-stars').value;
                const comment = document.getElementById('rev-comment').value.trim();
                if (!name || !comment) {
                    Swal.showValidationMessage('يرجى ملء الاسم والتجربة');
                    return false;
                }
                try {
                    const { error } = await _supabase.from('reviews').insert([{
                        product_id: String(productId),
                        customer_name: name,
                        rating: Number(stars),
                        comment: comment,
                        is_approved: true
                    }]);
                    if (error) throw error;
                    return true;
                } catch(err) {
                    Swal.showValidationMessage('تعذر حفظ التقييم: ' + (err.message || 'حاول مجدداً'));
                    return false;
                }
            }
        }).then(res => {
            if (res.isConfirmed) {
                Swal.fire({
                    icon: 'success',
                    title: 'شكراً لمشاركتك تجربتك! 🌸',
                    text: 'تم نشر تقييمك بنجاح وسيفيد العملاء الآخرين.',
                    confirmButtonText: 'حسناً',
                    confirmButtonColor: '#3312d5'
                });
            }
        });
    }

    window.app = {
        searchTerm: '',
        // [تحسين أداء]: زرار "عرض المزيد" - بيزوّد عدد المنتجات الظاهرة
        // بدل ما كل المنتجات (وصورها) تتحمل مرة واحدة في الكتالوج
        loadMoreCatalog: function () {
            catalogVisibleCount += CATALOG_PAGE_SIZE;
            const activeTab = document.querySelector('.catalog-tab-btn.active');
            const currentFilter = activeTab ? (activeTab.getAttribute('data-filter') || null) : null;
            renderCatalog(currentFilter, this.searchTerm, { keepPage: true });
        },
        navigate: function (viewId, param = null, addToHistory = true) {
            const doNav = () => {
                if (addToHistory) history.pushState({ viewId, param }, "", param ? `#${viewId}?item=${param}` : `#${viewId}`);
                document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

                updateNavMorph(viewId, viewId === 'catalog' ? param : null);

                if (['home', 'catalog', 'about'].includes(viewId)) {
                    document.getElementById('view-main').classList.add('active');
                    if (viewId === 'catalog') renderCatalog(param, this.searchTerm); else renderCatalog(null, this.searchTerm);
                    const target = document.getElementById(viewId);
                    if (target) window.scrollTo({ top: target.offsetTop - 80, behavior: "smooth" });
                } else {
                    document.getElementById('view-' + viewId).classList.add('active');
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    if (viewId === 'product') renderProductDetails(param);
                    if (viewId === 'cart') { renderCart(); revalidateCoupon(); }
                    if (viewId === 'favorites') renderFavorites();
                }

                if (viewId === 'product') document.body.classList.add('show-mobile-bar');
                else document.body.classList.remove('show-mobile-bar');
            };

            if (document.startViewTransition) {
                document.startViewTransition(() => doNav());
            } else {
                doNav();
            }
            trackStoreEvent('page_view', { metadata: { view: viewId, item: param } });
        },
        handleSearch: function (query) {
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
        showSearchSuggestions: function (query) {
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
                        <div onclick="app.navigate('product', '${sanitize(p.id)}'); app.hideSearchSuggestions();" 
                             class="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 cursor-pointer transition-colors group">
                            <img src="${sanitize(getOptimizedImg(p.img, 80, 70))}" loading="lazy" class="w-10 h-10 object-contain rounded-lg bg-gray-50 group-hover:scale-110 transition-transform" onerror="handleImgError(this, '${sanitize(p.img)}')">
                            <div class="flex-1 text-right">
                                <p class="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">${sanitize(p.name)}</p>
                                <p class="text-xs text-gray-500">${sanitize(p.category)}</p>
                            </div>
                            <span class="text-xs font-bold text-primary">${sanitize(p.price)} ج.م</span>
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
        hideSearchSuggestions: function () {
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
            trackStoreEvent('add_to_cart', {
                product_id: String(product.id),
                product_name: product.name,
                cart_total: getCartSubtotal(),
                metadata: { qty: Number(qty) || 1 }
            });

            if (!silent) {
                playCartSound();
                showCartPopup();
            }
        },
        buyNow: function (id, qty = 1) {
            const product = productsDB.find(p => p.id === id);
            trackStoreEvent('buy_now', { product_id: String(id), product_name: product?.name || null, metadata: { qty: Number(qty) || 1 } });
            this.addToCart(id, qty, true);
            this.navigate('cart');
        },
        // ==========================================
        // تطبيق كود الكوبون في صفحة السلة
        // ==========================================
        applyCoupon: async function () {
            const input = document.getElementById('coupon-code-input');
            const msg = document.getElementById('coupon-message');
            const btn = document.getElementById('apply-coupon-btn');
            if (!input) return;

            const code = input.value.trim().toUpperCase();
            const showMsg = (text, ok) => {
                if (!msg) return;
                msg.textContent = text;
                msg.className = `text-xs font-bold mt-2 ${ok ? 'text-emerald-600' : 'text-red-500'}`;
                msg.classList.remove('hidden');
            };

            if (!code) { showMsg('برجاء إدخال كود الكوبون', false); return; }

            // كوبون الترحيب (WELCOME10) صالح لأول زيارة فقط
            if (window.WelcomeOffer) {
                const wg = window.WelcomeOffer.guard(code);
                if (!wg.ok) { showMsg(wg.message, false); return; }
            }

            if (btn) { btn.disabled = true; btn.innerText = 'جاري التحقق...'; }

            try {
                const today = new Date().toISOString().split('T')[0];
                const { data, error } = await _supabase
                    .from('coupons')
                    .select('code,discount_percentage,min_amount,max_uses,used_count')
                    .eq('code', code)
                    .eq('is_active', true)
                    .gte('expiry_date', today)
                    .maybeSingle();

                if (error || !data) {
                    appliedCoupon = null;
                    saveCoupon();
                    showMsg('كود الكوبون غير صالح أو منتهي الصلاحية', false);
                    renderCart();
                    return;
                }

                if (data.max_uses != null && (Number(data.used_count) || 0) >= Number(data.max_uses)) {
                    showMsg('تم استنفاد استخدامات هذا الكوبون ❌', false);
                    renderCart();
                    return;
                }

                appliedCoupon = { code: data.code, discount_percentage: data.discount_percentage };
                saveCoupon();
                input.value = '';
                renderCart();
                trackStoreEvent('coupon_applied', {
                    coupon_code: data.code,
                    cart_total: getCartSubtotal(),
                    metadata: { discount_percentage: data.discount_percentage }
                });
                showMsg(`تم تطبيق خصم ${data.discount_percentage}% بنجاح 🎉`, true);
            } catch (e) {
                console.error('applyCoupon error:', e);
                showMsg('حدث خطأ أثناء التحقق من الكوبون، حاولي مرة أخرى', false);
            } finally {
                if (btn) { btn.disabled = false; btn.innerText = 'تطبيق'; }
            }
        },
        removeCoupon: function () {
            appliedCoupon = null;
            saveCoupon();
            renderCart();
        },
        // تطبيق كوبون الترحيب من البانر (بيتنادى من welcome-offer.js)
        applyWelcomeCoupon: async function () {
            const wo = window.WelcomeOffer;
            if (!wo || !wo.isEligible()) return { ok: false, message: 'كوبون الترحيب صالح لأول زيارة فقط' };
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data, error } = await _supabase
                    .from('coupons')
                    .select('code,discount_percentage,min_amount,max_uses,used_count')
                    .eq('code', wo.code)
                    .eq('is_active', true)
                    .gte('expiry_date', today)
                    .maybeSingle();
                if (error || !data) return { ok: false, message: 'الكوبون غير متاح حالياً' };
                if (data.max_uses != null && (Number(data.used_count) || 0) >= Number(data.max_uses)) {
                    return { ok: false, message: 'تم استنفاد استخدامات هذا الكوبون' };
                }
                appliedCoupon = { code: data.code, discount_percentage: data.discount_percentage };
                saveCoupon();
                renderCart();
                trackStoreEvent('coupon_applied', {
                    coupon_code: data.code,
                    cart_total: getCartSubtotal(),
                    metadata: { discount_percentage: data.discount_percentage, source: 'welcome_banner' }
                });
                return { ok: true, discount_percentage: data.discount_percentage };
            } catch (e) {
                console.error('applyWelcomeCoupon error:', e);
                return { ok: false, message: 'حدث خطأ، حاولي مرة أخرى' };
            }
        },
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
        toggleMobileMenu: function () {
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
        initCarousel: function () {
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

        updateCarousel: function (index) {
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

        nextSlide: function () {
            const newIndex = (this.carouselIndex + 1) % this.carouselSlides.length;
            this.goToSlide(newIndex);
        },

        prevSlide: function () {
            const newIndex = (this.carouselIndex - 1 + this.carouselSlides.length) % this.carouselSlides.length;
            this.goToSlide(newIndex);
        },

        goToSlide: function (index) {
            this.carouselIndex = index;
            this.updateCarousel(index);
        },

        startCarousel: function () {
            if (this.carouselInterval) clearInterval(this.carouselInterval);
            this.carouselInterval = setInterval(() => this.nextSlide(), this.carouselPauseTime);
        },

        pauseCarousel: function () {
            if (this.carouselInterval) clearInterval(this.carouselInterval);
            if (this.carouselProgress) {
                this.carouselProgress.style.animationPlayState = 'paused';
            }
        },

        resetCarouselTimer: function () {
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
    function buildProductCard(p, index) {
        const isFavorite = FavoritesManager.isFavorite(p.id);
        return `
<article class="pro-product-card p-3 sm:p-4 border border-purple-100/90 shadow-purple-soft flex flex-col justify-between relative group opacity-0 animate-fade-in-up cursor-pointer" style="animation-delay: ${index * 50}ms" onclick="app.navigate('product', '${sanitize(p.id)}')">
    <div class="flex items-center justify-between w-full mb-3 z-10">
        ${p.badge ? `<span class="badge-gold-shimmer text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">${sanitize(p.badge)}</span>` : `<span class="w-8"></span>`}
        <button onclick="event.stopPropagation();" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn btn-fav w-8 h-8 rounded-full bg-white/95 shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all z-20">
            ${isFavorite
                ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                : `<i class="fa-regular fa-heart text-xs"></i>`
            }
        </button>
    </div>
    <div class="relative w-full aspect-square rounded-2xl bg-gradient-to-tr from-purple-50/80 to-purple-100/40 p-3 sm:p-4 mb-3.5 flex items-center justify-center overflow-hidden">
        <img src="${sanitize(p.imgThumb || p.img)}" loading="lazy" class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-500" onerror="handleImgError(this, '${sanitize(p.img)}')">
        <span class="hidden sm:flex absolute bottom-2 left-2 items-center bg-white/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400 font-mono tracking-widest">ELFORAT</span>
    </div>
    <div class="flex flex-col flex-1">
        <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-primary">${sanitize(p.category || 'العناية')}</span>
            <div class="flex items-center gap-1 text-amber-400 text-xs">
                <i class="fa-solid fa-star"></i>
                <span class="text-xs font-bold text-slate-700">${p.rating || '4.9'}</span>
            </div>
        </div>
        <h3 class="font-extrabold text-darkNavy text-sm line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
            ${sanitize(p.name)}
        </h3>
        <div class="mt-auto pt-3 border-t border-slate-100">
            <div class="flex items-baseline justify-between mb-3">
                <div class="flex items-baseline gap-2">
                    <span class="text-lg sm:text-xl font-black text-darkNavy font-display">${sanitize(p.price)} <span class="text-xs font-bold text-slate-500">ج.م</span></span>
                    ${p.oldPrice ? `<span class="text-xs text-slate-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="event.stopPropagation(); app.buyNow('${sanitize(p.id)}')" class="btn-dark py-2.5 text-xs font-bold shadow-sm">اشتري الآن</button>
                <button onclick="event.stopPropagation(); app.addToCart('${sanitize(p.id)}')" class="btn-add-cart py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:gap-2 transition-all">
                    <i class="fa-solid fa-cart-plus text-xs"></i>
                    <span>أضف للسلة</span>
                </button>
            </div>
        </div>
    </div>
</article>`;
    }

    // [تحسين أداء]: عرض المنتجات على دفعات بدل تحميل الكتالوج كله وصوره
    // مرة واحدة في الـ DOM. مهم لما عدد المنتجات يكبر (مئات/آلاف).
    const CATALOG_PAGE_SIZE = 24;
    let catalogVisibleCount = CATALOG_PAGE_SIZE;
    let catalogLastFilterKey = null;

    function buildLoadMoreControl(totalCount, visibleCount) {
        if (totalCount <= visibleCount) return '';
        const remaining = totalCount - visibleCount;
        return `
            <div class="col-span-full flex justify-center pt-4 pb-2">
                <button onclick="app.loadMoreCatalog()" class="btn-outline px-8 py-3.5 rounded-full font-bold text-sm flex items-center gap-2.5">
                    <i class="fa-solid fa-arrow-down"></i>
                    عرض المزيد (متبقي ${remaining} منتج)
                </button>
            </div>`;
    }

    function renderCatalog(filter = null, searchTerm = '', options = {}) {
        const grid = document.getElementById('catalog-grid');
        const bundlesSection = document.getElementById('bundles-section');
        const bundlesGrid = document.getElementById('bundles-grid');
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

        // إعادة ضبط الصفحة الأولى تلقائياً كل ما الفلتر أو البحث يتغيّر فعلياً
        // (استدعاء "عرض المزيد" بيبعت keepPage:true عشان يحافظ على العدد الحالي)
        const filterKey = `${filter || ''}|${searchTerm || ''}`;
        if (!options.keepPage || filterKey !== catalogLastFilterKey) {
            catalogVisibleCount = CATALOG_PAGE_SIZE;
        }
        catalogLastFilterKey = filterKey;

        // تحديث عنوان القسم وتفعيل التبويب المطابق
        const heading = document.getElementById('catalog-heading');
        if (heading) {
            heading.textContent = filter === 'مجموعات متكاملة' ? 'المجموعات العلاجية المتكاملة' : 'منتجاتنا المتميزة';
        }
        document.querySelectorAll('.catalog-tab-btn').forEach(btn => {
            btn.classList.toggle('active', (btn.getAttribute('data-filter') || '') === (filter || ''));
        });

        if (products.length === 0) {
            if (grid) {
                grid.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center py-32 text-center animate-fade-in-up">
                        <div class="w-48 h-48 bg-gradient-to-br from-primary/10 to-secondary rounded-full flex items-center justify-center mb-8 shadow-inner">
                            <svg class="w-24 h-24 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-900 mb-3">لم يتم العثور على نتائج</h3>
                        <p class="text-gray-500 text-lg mb-6 max-w-md">لا توجد منتجات تطابق بحثك "<span class="font-bold text-primary">${sanitize(searchTerm)}</span>"</p>
                        <button onclick="app.handleSearch(''); document.getElementById('desktop-search-input').value=''; document.getElementById('mobile-search-input').value='';" 
                                class="px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-full font-bold hover:brightness-110 transition-all shadow-purple-glow flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                            </svg>
                            عرض كل المنتجات
                        </button>
                    </div>`;
            }
            if (bundlesSection) bundlesSection.style.display = 'none';
            if (bundlesGrid) bundlesGrid.innerHTML = '';
            return;
        }

        // عند فلترة المجموعات فقط، تُعرض كلها في الشبكة الرئيسية بدون صف منفصل
        if (filter === 'مجموعات متكاملة') {
            const visibleBundles = products.slice(0, catalogVisibleCount);
            if (grid) {
                grid.innerHTML = visibleBundles.map((p, index) => buildProductCard(p, index)).join('')
                    + buildLoadMoreControl(products.length, catalogVisibleCount);
            }
            if (bundlesSection) bundlesSection.style.display = 'none';
            if (bundlesGrid) bundlesGrid.innerHTML = '';
        } else {
            // فصل المجموعات المتكاملة (زي مجموعة الديتوكس وما بعدها) عن المنتجات الفردية
            const individualProducts = products.filter(p => p.category !== 'مجموعات متكاملة');
            const bundleProducts = products.filter(p => p.category === 'مجموعات متكاملة');
            const visibleIndividual = individualProducts.slice(0, catalogVisibleCount);

            if (grid) {
                grid.innerHTML = visibleIndividual.map((p, index) => buildProductCard(p, index)).join('')
                    + buildLoadMoreControl(individualProducts.length, catalogVisibleCount);
            }

            if (bundleProducts.length > 0 && bundlesGrid && bundlesSection) {
                bundlesGrid.innerHTML = bundleProducts.map((p, index) => buildProductCard(p, index)).join('');
                bundlesSection.style.display = '';
            } else {
                if (bundlesGrid) bundlesGrid.innerHTML = '';
                if (bundlesSection) bundlesSection.style.display = 'none';
            }
        }

        // إضافة مستمعي الأحداث لأزرار المفضلة (للشبكتين معاً)
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

    // بنك مراجعات عملاء بالعامية المصرية (أسماء وتقييمات متنوعة)
    const REVIEW_POOL = [
        { name: 'نورا أحمد', text: 'المنتج فعلاً روعة، حسيت بالفرق من أول أسبوع، شكراً الفرات فارما 🌸', stars: 5 },
        { name: 'ياسمين محمد', text: 'بجد ما كنتش متوقعة النتيجة دي، جربت كتير قبل كده ومحدش وصل للنتيجة دي، تسلم إيديكم 🌟', stars: 5 },
        { name: 'مريم سامي', text: 'حبيته أوي، ريحته حلوة وملمسه خفيف على البشرة، هطلب تاني أكيد 💕', stars: 5 },
        { name: 'سارة عادل', text: 'المنتج ممتاز والتغليف كان جامد جداً، ووصل بسرعة كمان. تسلموا 🙏', stars: 4 },
        { name: 'دينا حسن', text: 'من أحسن حاجات جربتها في العناية، حاسة إن بشرتي بقت أنعم بشكل واضح', stars: 5 },
        { name: 'رنا إبراهيم', text: 'خدمة عملاء محترمة جداً وردوا عليا بسرعة، والمنتج فوق الوصف 👌', stars: 5 },
        { name: 'إيمان طارق', text: 'كنت خايفة يبوظلي بشرتي بس الحمد لله اتفاجئت بنتيجة حلوة جداً', stars: 4 },
        { name: 'هبة الله كريم', text: 'تجربتي معاكم كانت جميلة من الأول للآخر، ربنا يبارك في شغلكم 🌸', stars: 5 },
        { name: 'نهى فؤاد', text: 'حسيت إني لقيت المنتج اللي كنت بدور عليه من زمان، شكراً ليكم ❤️', stars: 5 },
        { name: 'آية جمال', text: 'الجودة عالية والسعر مناسب جداً بالنسبالها، هرشحه لكل صحابي', stars: 5 },
        { name: 'منة الله شعبان', text: 'أول مرة أثق في منتج مصري بالشكل ده، فعلاً بيعمل اللي بيقوله', stars: 5 },
        { name: 'ريهام صلاح', text: 'التوصيل كان سريع والمنتج أحلى من الصور، مبسوطة جداً بيه', stars: 4 },
        { name: 'شيماء عبد الله', text: 'استخدمته أسبوعين بس وحاسة بفرق حقيقي، ميرسي لتعبكم معانا 🌸', stars: 5 },
        { name: 'أسماء رمضان', text: 'كل اللي كتبوه في الوصف حقيقي، مش دعاية وبس. شكراً جداً 🙏', stars: 5 },
        { name: 'جنى وليد', text: 'كنت مترددة أطلب الأول بس بجد يستاهل كل قرش فيه', stars: 4 }
    ];

    function computeReviewSeed(id) {
        const str = String(id);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) % 100000;
        }
        return hash;
    }

    function getReviewsForProduct(id, count = 3) {
        const seed = computeReviewSeed(id);
        const start = seed % REVIEW_POOL.length;
        const selected = [];
        for (let i = 0; i < count; i++) {
            selected.push(REVIEW_POOL[(start + i) % REVIEW_POOL.length]);
        }
        return selected;
    }

    function computeReviewCountForId(id) {
        const seed = computeReviewSeed(id);
        return 42 + (seed % 190); // عدد تقييمات متفاوت بين المنتجات
    }

    function renderProductDetails(id) {
        const p = productsDB.find(prod => prod.id == id);
        const container = document.getElementById('product-details-container');
        if (!container || !p) return;
        trackStoreEvent('product_view', {
            product_id: String(p.id),
            product_name: p.name,
            metadata: { category: p.category, price: p.price, stock: p.stock }
        });

        // خريطة الصور الإضافية لكل منتج (معرض صور متعدد)
        const productGalleries = {
            'كريم لعلاج جلد الوزة': [
                p.img,
                'product-gallery/keratosis-1.png',
                'product-gallery/keratosis-2.png',
                'product-gallery/keratosis-3.jpg'
            ],
            'keratosis': [
                p.img,
                'product-gallery/keratosis-1.png',
                'product-gallery/keratosis-2.png',
                'product-gallery/keratosis-3.jpg'
            ],
            'ليب بالم': [
                p.img,
                'product-gallery/lip-balm-1.png',
                'product-gallery/lip-balm-2.png'
            ],
            'balm': [
                p.img,
                'product-gallery/lip-balm-1.png',
                'product-gallery/lip-balm-2.png'
            ],
            'بالم': [
                p.img,
                'product-gallery/lip-balm-1.png',
                'product-gallery/lip-balm-2.png'
            ],
            'تنت': [
                p.img,
                'product-gallery/lip-balm-1.png',
                'product-gallery/lip-balm-2.png'
            ],
            'مرطب شفايف': [
                p.img,
                'product-gallery/lip-balm-1.png',
                'product-gallery/lip-balm-2.png'
            ],
            'lip': [
                p.img,
                'product-gallery/lip-balm-1.png',
                'product-gallery/lip-balm-2.png'
            ],
            'سيروم': [
                p.img,
                'product-gallery/guzel-gold-1.jpg',
                'product-gallery/guzel-gold-2.jpg',
                'product-gallery/guzel-gold-3.jpg',
                'product-gallery/guzel-gold-4.jpg',
                'product-gallery/guzel-gold-5.jpg'
            ],
            'guzel': [
                p.img,
                'product-gallery/guzel-gold-1.jpg',
                'product-gallery/guzel-gold-2.jpg',
                'product-gallery/guzel-gold-3.jpg',
                'product-gallery/guzel-gold-4.jpg',
                'product-gallery/guzel-gold-5.jpg'
            ],
            'serum': [
                p.img,
                'product-gallery/guzel-gold-1.jpg',
                'product-gallery/guzel-gold-2.jpg',
                'product-gallery/guzel-gold-3.jpg',
                'product-gallery/guzel-gold-4.jpg',
                'product-gallery/guzel-gold-5.jpg'
            ]
        };

        // فحص ما إذا كان للمنتج معرض صور مخصص بالاسم أو المعرف
        let extraImgs = null;
        const pNameLower = (p.name || '').toLowerCase();
        for (const [key, imgs] of Object.entries(productGalleries)) {
            if (pNameLower.includes(key.toLowerCase()) || (p.desc && p.desc.toLowerCase().includes(key.toLowerCase()))) {
                extraImgs = imgs;
                break;
            }
        }

        // إذا لم يكن له صور إضافية خاصة، يتم عرض صورته الرسمية فقط
        // [تصحيح]: صور معرض المنتج اللي بتتضاف من لوحة التحكم (inventory.html)
        // بتتخزن في عمود "gallery" في Supabase، مش "images"، فكان الكود هنا
        // بيدوّر على عمود فاضي دايمًا وبالتالي صور المعرض الجديدة ما كانتش
        // بتظهر في المتجر رغم إنها بتتحفظ صح في قاعدة البيانات.
        function parseGalleryField(val) {
            if (!val) return [];
            if (Array.isArray(val)) return val.filter(Boolean);
            if (typeof val === 'string') {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) return parsed.filter(Boolean);
                } catch (e) {
                    if (val.trim().startsWith('http')) return [val.trim()];
                }
            }
            return [];
        }
        let dbImgs = parseGalleryField(p.gallery);
        if (dbImgs.length === 0) dbImgs = parseGalleryField(p.images); // توافق مع أي بيانات قديمة كانت مخزنة باسم images
        const candidateImgs = dbImgs.length > 0 ? dbImgs : (extraImgs || []);
        let mergedImgs = [];
        if (p.img) mergedImgs.push(getFullImg(p.img));
        candidateImgs.forEach(im => {
            if (im && typeof im === 'string') {
                const full = getFullImg(im);
                if (!mergedImgs.includes(full)) mergedImgs.push(full);
            }
        });
        const images = mergedImgs.length > 0 ? mergedImgs : (p.img ? [getFullImg(p.img)] : ['logo.png']);

        // تهيئة حالة المعرض مباشرة (بدون الاعتماد على سكربت مضمّن داخل innerHTML)
        window.productImages = images;
        window.currentImageIndex = 0;
        window.zoomImageIndex = 0;

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
                <!-- معرض الصور -->
                <div class="space-y-4">
                    <div class="product-visual-glass aspect-square flex items-center justify-center p-4 sm:p-6 md:p-8 rounded-3xl overflow-hidden group relative bg-white/50 border border-purple-100/60 shadow-lg">
                        <img id="main-product-img" src="${sanitize(images[0])}" loading="lazy" class="max-h-full max-w-full object-contain transition-all duration-500 hover:scale-105 cursor-zoom-in drop-shadow-xl" onerror="this.src='logo.png'" onclick="openImageZoom('${sanitize(images[0])}')">
                        <!-- أزرار التنقل للمعرض (تظهر فقط عند وجود أكثر من صورة) -->
                        ${images.length > 1 ? `
                        <button onclick="changeProductImage('prev')" class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/95 text-darkNavy backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-primary hover:text-white active:scale-90 z-20" title="الصورة السابقة">
                            <i class="fa-solid fa-chevron-left text-sm"></i>
                        </button>
                        <button onclick="changeProductImage('next')" class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/95 text-darkNavy backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-primary hover:text-white active:scale-90 z-20" title="الصورة التالية">
                            <i class="fa-solid fa-chevron-right text-sm"></i>
                        </button>
                        <div class="absolute top-4 left-4 bg-darkNavy/70 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full z-10">
                            <span id="gallery-current-idx">1</span> / ${images.length}
                        </div>
                        ` : ''}
                        <!-- زر التكبير -->
                        <button onclick="openImageZoom(window.productImages ? window.productImages[window.currentImageIndex || 0] : '${sanitize(images[0])}')" class="absolute bottom-4 right-4 w-10 h-10 bg-white/95 text-darkNavy backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-primary hover:text-white z-20" title="تكبير الصورة">
                            <i class="fa-solid fa-expand text-xs"></i>
                        </button>
                    </div>
                    ${images.length > 1 ? `
                    <div class="flex gap-3 justify-center flex-wrap pt-2">
                        ${images.map((img, idx) => `
                            <button onclick="changeProductImage(${idx})" 
                                    class="thumbnail-btn w-14 h-14 sm:w-20 sm:h-20 bg-white/80 rounded-2xl p-1.5 border-2 ${idx === 0 ? 'border-primary shadow-purple-soft scale-105' : 'border-purple-100 hover:border-primary/50'} transition-all overflow-hidden relative group"
                                    data-index="${idx}">
                                <img src="${sanitize(img)}" loading="lazy" class="w-full h-full object-contain rounded-xl thumbnail-img group-hover:scale-105 transition-transform" onerror="this.src='logo.png'">
                            </button>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
                
                <!-- معلومات المنتج مع تابات -->
                <div class="flex flex-col text-right space-y-6">
                    <div class="space-y-3">
                        <p class="text-primary font-bold text-[10px] uppercase tracking-[0.3em]">${sanitize(p.category)}</p>
                        <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-black leading-tight tracking-tight">${sanitize(p.name)}</h1>
                        <div class="flex items-center gap-4 pt-2 flex-wrap">
                            <span class="text-2xl sm:text-3xl font-bold text-primary">${sanitize(p.price)} ج.م</span>
                            ${p.oldPrice ? `<span class="text-lg text-gray-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                            ${p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0 ? `<span class="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full font-bold low-stock-alert shadow-sm">⚠️ متبقي ${p.stock} فقط!</span>` : ''}
                            ${p.stock === 0 ? `<span class="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-full font-bold shadow-sm">❌ نفذ من المخزون</span>` : ''}
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                            <button id="main-fav-btn" 
                                    onclick="handleMainFavorite('${sanitize(p.id)}'); event.stopPropagation();" 
                                    class="w-12 h-12 rounded-full flex items-center justify-center transition-all ${FavoritesManager.isFavorite(p.id) ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-400'}">
                                <svg class="w-6 h-6" fill="${FavoritesManager.isFavorite(p.id) ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                                </svg>
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
                            <span class="text-sm font-bold">(${p.rating || '4.9'}/5 من ${computeReviewCountForId(p.id)} تقييم)</span>
                        </div>
                        <div class="space-y-4">
                            ${getReviewsForProduct(p.id, 3).map(r => `
                            <div class="bg-gray-50 p-4 rounded-2xl">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">${sanitize(r.name.charAt(0))}</div>
                                    <span class="font-bold text-sm">${sanitize(r.name)}</span>
                                    <div class="flex text-yellow-400 text-xs mr-auto">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
                                </div>
                                <p class="text-sm text-gray-600">${sanitize(r.text)}</p>
                            </div>`).join('')}
                        </div>
                        <button onclick="app.openAddReviewModal(`${p.id}`, `${sanitize(p.name)}`)" class="mt-4 w-full py-3 border-2 border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition-all text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-star text-amber-400"></i> إضافة تقييمك وتجربتك</button>
                    </div>
                    
                    <!-- أزرار الإجراء -->
                    <div class="space-y-3 pt-4 border-t border-gray-100">
                        <div class="flex items-center gap-4">
                            <div class="flex border-2 border-gray-200 rounded-full" dir="ltr">
                                <button onclick="const qtyInput = document.getElementById('product-qty'); const newVal = Math.max(1, parseInt(qtyInput.value) - 1); qtyInput.value = newVal;" class="px-4 py-3 text-primary font-bold hover:bg-primary/10 transition-colors rounded-l-full active:scale-95">-</button>
                                <input id="product-qty" type="number" value="1" min="1" max="${p.stock}" class="w-12 text-center font-bold border-x-2 border-gray-200 focus:outline-none" readonly>
                                <button onclick="const qtyInput = document.getElementById('product-qty'); const newVal = Math.min(${p.stock}, parseInt(qtyInput.value) + 1); qtyInput.value = newVal;" class="px-4 py-3 text-primary font-bold hover:bg-primary/10 transition-colors rounded-r-full active:scale-95">+</button>
                            </div>
                            <button onclick="app.addToCart('${p.id}', document.getElementById('product-qty').value)" class="flex-1 bg-secondary text-white font-bold uppercase text-sm tracking-widest py-4 rounded-full hover:opacity-90 transition-all shadow-lg shadow-secondary/30 active:scale-95">أضف للحقيبة</button>
                        </div>
                        <button onclick="app.buyNow('${p.id}', document.getElementById('product-qty').value)" class="btn-dark w-full text-white font-bold uppercase text-sm tracking-widest py-4 active:scale-95">اشتري الآن</button>
                    </div>
                </div>
            </div>
            
            <!-- شريط شراء ثابت للموبايل -->
            <div id="mobile-buy-bar" class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-purple-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col shrink-0 pl-1">
                        <span class="text-base font-extrabold text-primary leading-tight">${sanitize(p.price)} <span class="text-[11px] font-bold text-slate-500">ج.م</span></span>
                        ${p.oldPrice ? `<span class="text-[11px] text-slate-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                    </div>
                    <button onclick="app.addToCart('${p.id}', document.getElementById('product-qty').value)" class="flex-1 bg-secondary text-white font-bold text-xs uppercase tracking-widest py-3.5 rounded-full hover:opacity-90 transition-all shadow-lg shadow-secondary/30 active:scale-95">أضف للحقيبة</button>
                    <button onclick="app.buyNow('${p.id}', document.getElementById('product-qty').value)" class="btn-dark text-white font-bold text-xs uppercase tracking-widest py-3.5 px-5 active:scale-95">اشتري الآن</button>
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
            </div>`;

        // تحديث Breadcrumb
        const breadcrumbCategory = document.getElementById('breadcrumb-category');
        if (breadcrumbCategory) {
            breadcrumbCategory.textContent = p.category;
        }

        // عرض المنتجات ذات الصلة
        renderRelatedProducts(p.id, p.category);

        // تفعيل دعم لوحة المفاتيح للمعرض المكبر
        initProductGalleryKeyboard();

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

    // ==========================================
    // دوال معرض منتج واحدة (Global scope) لتجنب مشاكل السكربتات المضمّنة
    // ==========================================
    function changeProductImage(arg) {
        const imgs = Array.isArray(window.productImages) ? window.productImages : [];
        if (imgs.length === 0) return;

        if (arg === 'prev') {
            window.currentImageIndex = (window.currentImageIndex - 1 + imgs.length) % imgs.length;
        } else if (arg === 'next') {
            window.currentImageIndex = (window.currentImageIndex + 1) % imgs.length;
        } else {
            window.currentImageIndex = Number(arg) % imgs.length;
        }

        const mainImg = document.getElementById('main-product-img');
        if (!mainImg) return;
        mainImg.style.opacity = '0';
        mainImg.style.transform = 'scale(0.95)';

        setTimeout(() => {
            mainImg.src = window.productImages[window.currentImageIndex];
            mainImg.style.opacity = '1';
            mainImg.style.transform = 'scale(1)';
        }, 200);

        // تحديث الثمبنيلز والعداد
        const counter = document.getElementById('gallery-current-idx');
        if (counter) counter.textContent = (window.currentImageIndex % window.productImages.length) + 1;

        document.querySelectorAll('.thumbnail-btn').forEach((btn, idx) => {
            if (idx === window.currentImageIndex) {
                btn.classList.add('border-primary', 'shadow-purple-soft', 'scale-105');
                btn.classList.remove('border-purple-100');
            } else {
                btn.classList.remove('border-primary', 'shadow-purple-soft', 'scale-105');
                btn.classList.add('border-purple-100');
            }
        });
    }

    function openImageZoom(imgSrc) {
        const modal = document.getElementById('image-zoom-modal');
        const zoomedImg = document.getElementById('zoomed-image');
        const counter = document.getElementById('zoom-counter');
        if (!modal || !zoomedImg || !Array.isArray(window.productImages) || window.productImages.length === 0) return;

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
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }

    function changeZoomImage(direction) {
        const zoomedImg = document.getElementById('zoomed-image');
        const counter = document.getElementById('zoom-counter');
        if (!zoomedImg || !Array.isArray(window.productImages) || window.productImages.length === 0) return;

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

    function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('tab-' + tabName).classList.remove('hidden');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-primary', 'text-primary');
            btn.classList.add('border-transparent', 'text-gray-500');
            btn.setAttribute('aria-selected', 'false');
        });

        const activeBtn = document.getElementById('tab-btn-' + tabName);
        if (activeBtn) {
            activeBtn.classList.remove('border-transparent', 'text-gray-500');
            activeBtn.classList.add('border-primary', 'text-primary');
            activeBtn.setAttribute('aria-selected', 'true');
        }
    }

    function initProductGalleryKeyboard() {
        document.removeEventListener('keydown', productGalleryKeyHandler);
        document.addEventListener('keydown', productGalleryKeyHandler);
    }

    function productGalleryKeyHandler(e) {
        const modal = document.getElementById('image-zoom-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft') changeZoomImage(1);
        if (e.key === 'ArrowRight') changeZoomImage(-1);
        if (e.key === 'Escape') closeImageZoom();
    }

    // تصدير دوال المعرض للاستخدام في onclicks المضمّنة داخل innerHTML
    window.changeProductImage = changeProductImage;
    window.openImageZoom = openImageZoom;
    window.closeImageZoom = closeImageZoom;
    window.changeZoomImage = changeZoomImage;
    window.switchTab = switchTab;
    window.initProductGalleryKeyboard = initProductGalleryKeyboard;
    window.renderRelatedProducts = renderRelatedProducts;

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
<article class="pro-product-card p-3 sm:p-4 border border-purple-100/90 shadow-purple-soft flex flex-col justify-between relative group opacity-0 animate-fade-in-up cursor-pointer" style="animation-delay: ${index * 50}ms" onclick="app.navigate('product', '${sanitize(p.id)}')">
    <div class="flex items-center justify-between w-full mb-3 z-10">
        ${p.badge ? `<span class="badge-gold-shimmer text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">${sanitize(p.badge)}</span>` : `<span class="w-8"></span>`}
        <button onclick="event.stopPropagation(); FavoritesManager.toggle('${sanitize(p.id)}');" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn btn-fav w-8 h-8 rounded-full bg-white/95 shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all z-20" title="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
            ${isFav
                    ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                    : `<i class="fa-regular fa-heart text-xs"></i>`
                }
        </button>
    </div>
    <div class="relative w-full aspect-square rounded-2xl bg-gradient-to-tr from-purple-50/80 to-purple-100/40 p-3 sm:p-4 mb-3.5 flex items-center justify-center overflow-hidden">
        <img src="${sanitize(p.imgThumb || p.img)}" loading="lazy" alt="${sanitize(p.name)}" class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-500" onerror="handleImgError(this, '${sanitize(p.img)}')">
        <span class="hidden sm:flex absolute bottom-2 left-2 items-center bg-white/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400 font-mono tracking-widest">ELFORAT</span>
    </div>
    <div class="flex flex-col flex-1">
        <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-primary">${sanitize(p.category || 'العناية')}</span>
            ${isOutOfStock
                    ? '<span class="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">نفذت الكمية</span>'
                    : p.stock <= LOW_STOCK_THRESHOLD
                        ? `<span class="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-bold">متبقي ${p.stock}</span>`
                        : ''
                }
        </div>
        <h3 class="font-extrabold text-darkNavy text-sm line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
            ${sanitize(p.name)}
        </h3>
        <div class="mt-auto pt-3 border-t border-slate-100">
            <div class="flex items-baseline justify-between mb-3">
                <div class="flex items-baseline gap-2">
                    <span class="text-lg sm:text-xl font-black text-darkNavy font-display">${sanitize(p.price)} <span class="text-xs font-bold text-slate-500">ج.م</span></span>
                    ${p.oldPrice ? `<span class="text-xs text-slate-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                </div>
            </div>
            ${!isOutOfStock ? `
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="event.stopPropagation(); app.buyNow('${sanitize(p.id)}')" class="btn-dark py-2.5 text-xs font-bold shadow-sm">اشتري الآن</button>
                    <button onclick="event.stopPropagation(); app.addToCart('${sanitize(p.id)}', 1)" class="btn-add-cart py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:gap-2 transition-all">
                        <i class="fa-solid fa-cart-plus text-xs"></i>
                        <span>أضف للحقيبة</span>
                    </button>
                </div>
            ` : ''}
        </div>
    </div>
</article>`;
        }).join('');
    }

    function renderCart() {
        const container = document.getElementById('cart-items-container');
        const summary = document.getElementById('cart-summary-totals');
        if (!container) return;
        if (cart.length === 0) {
            container.innerHTML = '<div class="py-32 text-center text-gray-400 uppercase tracking-widest">حقيبة التسوق فارغة</div>';
            if (summary) summary.innerHTML = '';
            const countLabelEmpty = document.getElementById('cart-summary-count');
            if (countLabelEmpty) countLabelEmpty.textContent = '';
            renderCouponUI();
            return;
        }
        let subtotal = getCartSubtotal();
        container.innerHTML = cart.map(item => {
            if (item.isGift) {
                return `
                <div class="flex gap-4 sm:gap-8 border-b border-gray-100 pb-10 text-right group relative">
                    <div class="w-20 h-20 sm:w-24 sm:h-24 bg-[#fdf2f5] p-3 sm:p-4 rounded-2xl relative shrink-0">
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
            <div class="flex gap-4 sm:gap-8 border-b border-gray-100 pb-10 text-right group relative">
                <div class="w-20 h-20 sm:w-24 sm:h-24 bg-[#f9f9f9] p-3 sm:p-4 rounded-2xl relative"><img src="${sanitize(item.img)}" class="w-full h-full object-contain mix-blend-multiply"></div>
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

        const discount = getCartDiscount(subtotal);
        const finalTotal = Math.max(subtotal - discount, 0);
        const itemsCount = cart.reduce((s, i) => s + i.qty, 0);
        const freeShippingLeft = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
        const freeShippingPct = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
        const freeShippingColor = getShippingBarColor(freeShippingPct);

        const countLabel = document.getElementById('cart-summary-count');
        if (countLabel) countLabel.textContent = `${itemsCount} ${itemsCount === 1 ? 'منتج' : 'منتجات'} في الحقيبة`;

        if (summary) {
            summary.innerHTML = `
                <div class="flex items-center justify-between text-sm text-slate-600">
                    <span class="flex items-center gap-2"><i class="fa-solid fa-bag-shopping text-slate-300 w-4 text-center"></i> الإجمالي الفرعي</span>
                    <span class="font-bold text-darkNavy">${sanitize(subtotal)} ج.م</span>
                </div>
                ${discount > 0 ? `
                <div class="flex items-center justify-between text-sm">
                    <span class="flex items-center gap-2 text-emerald-600 font-bold"><i class="fa-solid fa-tag w-4 text-center"></i> خصم كود <span class="font-mono" dir="ltr">${sanitize(appliedCoupon.code)}</span></span>
                    <span class="font-bold text-emerald-600">- ${sanitize(discount)} ج.م</span>
                </div>` : ''}
                <div class="flex items-center justify-between text-sm text-slate-600">
                    <span class="flex items-center gap-2"><i class="fa-solid fa-truck-fast text-slate-300 w-4 text-center"></i> الشحن</span>
                    <span class="font-bold text-emerald-600">${freeShippingLeft > 0 ? 'يُحسب لاحقاً' : 'مجاني 🎉'}</span>
                </div>
                <div class="pt-1">
                    <div class="flex items-center justify-between text-[11px] font-bold mb-1.5">
                        <span class="flex items-center gap-1.5" style="color:${freeShippingColor}">
                            <i class="fa-solid fa-truck-fast"></i>
                            ${freeShippingLeft > 0 ? `أضيفي ${sanitize(freeShippingLeft)} ج.م كمان واحصلي على شحن مجاني` : 'مبروك! حصلتِ على شحن مجاني 🎉'}
                        </span>
                        <span class="text-slate-400">${Math.round(freeShippingPct)}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500 ease-out" style="width:${freeShippingPct}%; background-color:${freeShippingColor};"></div>
                    </div>
                </div>
                <div class="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary to-secondary text-white px-4 py-4 flex items-center justify-between mt-1">
                    <div class="absolute -top-6 -left-6 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <span class="relative font-bold text-sm">الإجمالي</span>
                    <span class="relative text-xl font-black">${sanitize(finalTotal)} <span class="text-xs font-bold">ج.م</span></span>
                </div>
            `;
        }
        renderCouponUI();
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
<article class="pro-product-card p-3 sm:p-4 border border-purple-100/90 shadow-purple-soft flex flex-col justify-between relative group opacity-0 animate-fade-in-up cursor-pointer" style="animation-delay: ${index * 50}ms" onclick="app.navigate('product', '${sanitize(p.id)}')">
    <div class="flex items-center justify-between w-full mb-3 z-10">
        ${p.badge ? `<span class="badge-gold-shimmer text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">${sanitize(p.badge)}</span>` : `<span class="w-8"></span>`}
        <button onclick="event.stopPropagation(); FavoritesManager.toggle('${sanitize(p.id)}');" data-favorite-btn="${sanitize(p.id)}" class="favorite-btn btn-fav w-8 h-8 rounded-full bg-white/95 shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all z-20" title="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
            ${isFav
                    ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                    : `<i class="fa-regular fa-heart text-xs"></i>`
                }
        </button>
    </div>
    <div class="relative w-full aspect-square rounded-2xl bg-gradient-to-tr from-purple-50/80 to-purple-100/40 p-3 sm:p-4 mb-3.5 flex items-center justify-center overflow-hidden">
        <img src="${sanitize(p.imgThumb || p.img)}" loading="lazy" class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-500" onerror="handleImgError(this, '${sanitize(p.img)}')">
        <span class="hidden sm:flex absolute bottom-2 left-2 items-center bg-white/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400 font-mono tracking-widest">ELFORAT</span>
    </div>
    <div class="flex flex-col flex-1">
        <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-primary">${sanitize(p.category || 'العناية')}</span>
        </div>
        <h3 class="font-extrabold text-darkNavy text-sm line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
            ${sanitize(p.name)}
        </h3>
        <div class="mt-auto pt-3 border-t border-slate-100">
            <div class="flex items-baseline justify-between mb-3">
                <div class="flex items-baseline gap-2">
                    <span class="text-lg sm:text-xl font-black text-darkNavy font-display">${sanitize(p.price)} <span class="text-xs font-bold text-slate-500">ج.م</span></span>
                    ${p.oldPrice ? `<span class="text-xs text-slate-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="event.stopPropagation(); app.buyNow('${sanitize(p.id)}')" class="btn-dark py-2.5 text-xs font-bold shadow-sm">اشتري الآن</button>
                <button onclick="event.stopPropagation(); app.addToCart('${sanitize(p.id)}', 1)" class="btn-add-cart py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:gap-2 transition-all">
                    <i class="fa-solid fa-cart-plus text-xs"></i>
                    <span>أضف للسلة</span>
                </button>
            </div>
        </div>
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
    if (checkoutForm) {
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
            const phone = normalizeEgyptPhone(phoneEl.value);
            const address = addressEl.value;
            const payment = paymentEl.value;

            // [حماية من السبام]: فحص حقل المصيدة (Honeypot) - إذا تم ملؤه فهو روبوت سبام
            const honeypotEl = document.getElementById('cust-fax-verify');
            if (honeypotEl && honeypotEl.value.trim() !== '') {
                console.warn('تم حظر محاولة إرسال روبوتية عبر Honeypot');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }


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

            // كوبون الترحيب انتهت زيارته الأولى → نشيله ونوقف الطلب عشان العميلة تشوف السعر الحقيقي
            if (appliedCoupon && window.WelcomeOffer && !window.WelcomeOffer.guard(appliedCoupon.code).ok) {
                appliedCoupon = null;
                saveCoupon();
                renderCart();
                showCustomAlert('كوبون الترحيب صالح لأول زيارة فقط وقد انتهى، تم إزالته من السلة. راجعي الإجمالي وأكملي الطلب.', 'error');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            // ===== InstaPay: تحويل يدوي + إرسال الإيصال على واتساب =====
            // بنجيب رقم التحويل الحالي من الإعدادات قبل تسجيل الطلب؛ لو مش متاح مفيش طلب بيتسجل.
            const isInstapay = payment === 'instapay';
            let instapayConfig = null;
            if (isInstapay) {
                try {
                    if (!window.InstaPayCheckout) throw new Error('ملف الدفع عبر InstaPay (instapay.js) غير محمل.');
                    submitBtn.innerText = 'جاري تجهيز بيانات التحويل...';
                    instapayConfig = await window.InstaPayCheckout.loadConfig(_supabase);
                } catch (ipErr) {
                    showCustomAlert(ipErr.message || 'الدفع عبر InstaPay غير متاح حاليًا.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }
            }
            // الحالة والكود بييجوا من المصدر الموحّد (order-status.js) بدل نصوص متفرقة
            const orderStatusCode = window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending';
            const orderStatus = isInstapay
                ? window.InstaPayCheckout.ORDER_STATUS
                : (window.OrderStatus ? window.OrderStatus.label(orderStatusCode, 'cod') : 'قيد التنفيذ');
            let instapayOrderNo = null;

            // [تحديث أمان]: إعادة جلب الأسعار الحقيقية من قاعدة البيانات والتحقق من الكوبون
            // لمنع أي تلاعب محتمل في localStorage أو أدوات المطور (DevTools)
            const dbPriceMap = new Map();
            if (Array.isArray(productsDB)) {
                productsDB.forEach(p => {
                    if (p && p.id != null) dbPriceMap.set(String(p.id), Number(p.price) || 0);
                });
            }

            try {
                const itemIds = cart.filter(i => !i.isGift && i.id).map(i => i.id);
                if (itemIds.length) {
                    const { data: verifiedProducts, error: pErr } = await _supabase
                        .from('products')
                        .select('id, price')
                        .in('id', itemIds);
                    if (!pErr && Array.isArray(verifiedProducts)) {
                        verifiedProducts.forEach(p => {
                            if (p && p.id != null) dbPriceMap.set(String(p.id), Number(p.price) || 0);
                        });
                    }
                }
            } catch (pFetchErr) {
                console.warn('تعذر جلب الأسعار الحية، الاعتماد على productsDB الموثوقة:', pFetchErr);
            }

            let subtotal = 0;
            const orderItems = [];

            cart.forEach(item => {
                let verifiedPrice = Number(item.price || 0);
                if (!item.isGift && item.id != null && dbPriceMap.has(String(item.id))) {
                    verifiedPrice = dbPriceMap.get(String(item.id));
                }
                const qty = Math.max(1, parseInt(item.qty) || 1);
                const itemTotal = item.isGift ? 0 : (verifiedPrice * qty);
                subtotal += itemTotal;
                orderItems.push({
                    id: item.id,
                    name: item.name,
                    qty: qty,
                    price: item.isGift ? 0 : verifiedPrice,
                    isGift: item.isGift || false
                });
            });

            // ===== التحقق من الكوبون مباشرة من قاعدة البيانات =====
            let verifiedDiscountAmount = 0;
            let verifiedCouponCode = null;
            if (appliedCoupon && appliedCoupon.code) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const { data: dbCoupon } = await _supabase
                        .from('coupons')
                        .select('code, discount_percentage, min_amount, max_uses, used_count')
                        .eq('code', String(appliedCoupon.code).trim())
                        .eq('is_active', true)
                        .gte('expiry_date', today)
                        .maybeSingle();

                    if (dbCoupon && Number(dbCoupon.discount_percentage) > 0) {
                        const usesOk = (dbCoupon.max_uses == null) || (Number(dbCoupon.used_count) || 0) < Number(dbCoupon.max_uses);
                        if (usesOk) {
                            verifiedCouponCode = dbCoupon.code;
                            const pct = Number(dbCoupon.discount_percentage);
                            verifiedDiscountAmount = Math.round(((subtotal * pct) / 100) * 100) / 100;
                        }
                    }
                } catch (cErr) {
                    console.warn('تعذر التحقق من الكوبون من السيرفر:', cErr);
                    verifiedDiscountAmount = getCartDiscount(subtotal);
                    verifiedCouponCode = appliedCoupon.code;
                }
            }

            const discountAmount = verifiedDiscountAmount;
            const finalTotal = Math.max(subtotal - discountAmount, 0);
            const couponCode = verifiedCouponCode;
            const traffic = getTrafficParams();

            try {
                trackStoreEvent('checkout_started', {
                    coupon_code: couponCode,
                    cart_total: finalTotal,
                    metadata: { payment, items_count: orderItems.length }
                });
                const paymentLabel = isInstapay ? window.InstaPayCheckout.PAYMENT_LABEL : payment;
                // merchant_order_id ثابت لنفس محاولة الشراء (حتى لو حصل reload/مشكلة شبكة)
                // بدل توليد رقم جديد كل submit، عشان الحماية من تكرار الطلب تبقى فعلية
                const merchantId = window.OrderStatus
                    ? window.OrderStatus.getOrCreateMerchantOrderId()
                    : ('elforat-' + Date.now());
                const orderData = {
                    customerName: name,
                    phone: phone,
                    address: address,
                    total: finalTotal,
                    status: orderStatus,
                    status_code: orderStatusCode,
                    payment_status: 'pending',
                    date: new Date().toLocaleString('ar-EG'),
                    items: orderItems,
                    payment_method: paymentLabel,
                    merchant_order_id: merchantId,
                    coupon_code: couponCode,
                    discount_amount: discountAmount,
                    session_id: getVisitorSessionId(),
                    traffic_source: traffic.source,
                    traffic_campaign: traffic.campaign
                };

                // إدخال idempotent: لو نفس merchant_order_id اتسجل قبل كده (retry بعد
                // reload/مشكلة شبكة)، بيرجّع الطلب الموجود بدل ما يعمل نسخة تانية.
                // محتاج unique constraint على عمود merchant_order_id (شوفي migration.sql)
                const insertOnce = window.OrderStatus
                    ? (data) => window.OrderStatus.insertOrderIdempotent(_supabase, data)
                    : (data) => _supabase.from('orders').insert([data]).select('id').single()
                        .then(r => ({ data: r.data, error: r.error }));

                const { data: insertedOrder, error: orderError } = await insertOnce(orderData);

                if (!orderError && insertedOrder) {
                    orderData.id = insertedOrder.id;
                    trackStoreEvent('order_created', { coupon_code: couponCode, cart_total: finalTotal, metadata: { payment, items_count: orderItems.length } });
                } else if (orderError && /WELCOME10_ALREADY_USED/.test(orderError.message || '')) {
                    // السيرفر رفض الطلب: كوبون الترحيب استُخدم قبل كده بنفس رقم الهاتف.
                    // مفيش fallback هنا (كان هيسجّل الطلب بالخصم من غير كود الكوبون).
                    window.WelcomeOffer?.expire('already_used');
                    appliedCoupon = null;
                    saveCoupon();
                    renderCart();
                    showCustomAlert('كوبون الترحيب WELCOME10 استُخدم قبل كده بنفس رقم الهاتف، تم إلغاؤه. راجعي الإجمالي وأكملي الطلب.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                } else if (orderError) {
                    console.warn('فشل إدخال الطلب بالحقول الكاملة، جاري المحاولة بالحد الأدنى:', orderError.message);
                    const minimalData = {
                        customerName: name,
                        phone: phone,
                        address: address,
                        total: finalTotal,
                        status: orderStatus,
                        // بنحافظ على merchant_order_id حتى في أقل نسخة من الطلب عشان
                        // الحماية من التكرار تفضل شغالة لو النسخة الكاملة فشلت
                        merchant_order_id: merchantId,
                        date: new Date().toLocaleString('ar-EG'),
                        items: orderItems
                    };
                    const { data: minOrder, error: minError } = await insertOnce(minimalData);
                    if (!minError && minOrder) orderData.id = minOrder.id;
                }

                // رقم الطلب المعروض للعميل في رسالة InstaPay
                instapayOrderNo = (orderData.id != null && /^\d{1,10}$/.test(String(orderData.id))) ? orderData.id : merchantId;

                // كوبون الترحيب: أول طلب ناجح بيه = يتلغي فوراً
                if (couponCode && orderData.id != null && window.WelcomeOffer
                    && String(couponCode).toUpperCase() === window.WelcomeOffer.code) {
                    window.WelcomeOffer.markUsed();
                }

                // زيادة عداد استخدام الكوبون بعد نجاح الطلب
                if (couponCode) {
                    _supabase.rpc('increment_coupon_use', { p_code: couponCode })
                        .then(() => { })
                        .catch((e) => console.warn('زيادة استخدام الكوبون فشلت:', e));
                }

                // ملحوظة: إشعار تيليجرام بقى بيتبعت تلقائيًا من Supabase نفسها
                // (Database Webhook على INSERT في جدول orders) بدل ما يتبعت من هنا.
                // ده أأمن لأنه مش محتاج أي سر يتحط في كود الموقع العام، وأضمن لأنه
                // بيشتغل حتى لو المتصفح قفل الصفحة فورًا بعد إتمام الطلب.
            } catch (err) {
                console.error("خطأ في تسجيل الطلب بسوبابيز، جاري استكمال التحويل للواتساب...", err);
            }

            if (isInstapay) {
                const paidTotal = finalTotal;
                window.OrderStatus?.clearPendingMerchantOrderId?.();
                cart = [];
                saveCart();
                appliedCoupon = null;
                saveCoupon();
                updateBadge();
                checkoutForm.reset();
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;

                trackStoreEvent('payment_started', {
                    coupon_code: couponCode,
                    cart_total: paidTotal,
                    metadata: { provider: 'instapay' }
                });

                window.InstaPayCheckout.showPopup({
                    orderNo: instapayOrderNo,
                    total: paidTotal,
                    config: instapayConfig,
                    onClose: () => app.navigate('home')
                });
                return;
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

            message += `\n🧾 *الإجمالي الفرعي:* ${subtotal} ج.م\n`;
            if (discountAmount > 0) {
                message += `🏷️ *خصم كود (${couponCode}):* -${discountAmount} ج.م\n`;
            }
            message += `💰 *الإجمالي المطلوب:* ${finalTotal} ج.م\n`;
            message += `\nشكراً لاختيارك الفرات فارما! 🌺`;

            window.OrderStatus?.clearPendingMerchantOrderId?.();
            cart = [];
            saveCart(); // [جديد] مسح المنتجات من التخزين بعد إرسال الطلب بنجاح
            appliedCoupon = null;
            saveCoupon(); // مسح الكوبون بعد إتمام الطلب بنجاح
// صوت التنبيه مخصص للوحة التحكم فقط
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
    // بيجيب IP الزائر من خدمة خارجية مجانية
    async function getVisitorIP() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch (e) {
            return null; // لو فشل النت، هنرجع لأسلوب localStorage العادي
        }
    }

    // بيجيب أو بيتحقق من نافذة العرض الخاصة بالـ IP ده من Supabase
    // (جدول offer_countdowns: ip (text, primary key), end_time (bigint))
    // القاعدة: نافذة الـ 24 ساعة تتحدد مرة واحدة بس لكل IP وقت أول ظهور ليه.
    // لو خلصت، بتفضل خلصت للأبد لنفس الـ IP - من غير أي تجديد تلقائي.
    async function getOfferWindowForIP(ip) {
        const DURATION = 24 * 60 * 60 * 1000; // 24 ساعة بالظبط
        const localKey = 'elforat_offer_end_' + ip;
        const localExpiredKey = 'elforat_offer_expired_' + ip;
        const now = Date.now();

        // 1) السيرفر هو مصدر الحقيقة (بيفضل صحيح حتى لو الزائر مسح الكاش)
        const { data, error } = await _supabase
            .from('offer_countdowns')
            .select('end_time')
            .eq('ip', ip)
            .maybeSingle();

        if (!error && data && data.end_time) {
            if (data.end_time > now) {
                localStorage.setItem(localKey, data.end_time);
                return { endTime: data.end_time, expired: false };
            }
            // خلصت فعلاً على السيرفر - تفضل خلصت، من غير تجديد
            localStorage.setItem(localExpiredKey, '1');
            return { endTime: data.end_time, expired: true };
        }

        // 2) السيرفر ما رجّعش نتيجة (مشكلة شبكة/RLS)، نستأنس بالنسخة المحلية لنفس الـ IP
        if (localStorage.getItem(localExpiredKey)) {
            return { endTime: now, expired: true };
        }
        const cached = localStorage.getItem(localKey);
        if (cached) {
            const cachedEndTime = parseInt(cached, 10);
            if (cachedEndTime > now) {
                _supabase.from('offer_countdowns')
                    .upsert({ ip: ip, end_time: cachedEndTime }, { onConflict: 'ip' })
                    .then(() => { });
                return { endTime: cachedEndTime, expired: false };
            }
            localStorage.setItem(localExpiredKey, '1');
            return { endTime: cachedEndTime, expired: true };
        }

        // 3) أول ظهور فعلي لهذا الـ IP على الإطلاق: ننشئ نافذة 24 ساعة جديدة (مرة واحدة بس)
        const newEndTime = now + DURATION;
        localStorage.setItem(localKey, newEndTime);
        const { error: upsertError } = await _supabase
            .from('offer_countdowns')
            .upsert({ ip: ip, end_time: newEndTime }, { onConflict: 'ip' });
        if (upsertError) {
            console.warn('تعذر حفظ العداد على السيرفر، هيتحفظ محليًا فقط:', upsertError.message);
        }

        return { endTime: newEndTime, expired: false };
    }

    // بيخفي عنصر العداد وبطاقات العروض المرتبطة بيه لما الوقت يخلص
    function hideOfferCountdown() {
        const countdownWrap = document.getElementById('offer-countdown-wrap');
        const offersWrap = document.getElementById('offer-badges-wrap');
        if (countdownWrap) countdownWrap.style.display = 'none';
        if (offersWrap) offersWrap.style.display = 'none';
    }

    async function startCountdown() {
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        const DURATION = 24 * 60 * 60 * 1000;
        let endTime = null;
        let expired = false;
        let ip = null;

        try {
            ip = await getVisitorIP();
            if (ip) {
                const win = await getOfferWindowForIP(ip);
                endTime = win.endTime;
                expired = win.expired;
            }
        } catch (e) {
            console.warn('فشل ربط العداد بالـ IP، هيشتغل بالطريقة المحلية:', e);
        }

        // لو معرفناش الـ IP (مفيش نت مثلاً)، نرجع لأسلوب localStorage القديم كبديل مؤقت بس
        // (ده أضعف من الربط بالـ IP لأنه بيتصفّر لو الزائر مسح الكاش، لكن أحسن من مفيش حاجة)
        if (endTime == null) {
            if (localStorage.getItem('elforat_offer_expired')) {
                expired = true;
                endTime = Date.now();
            } else {
                const stored = localStorage.getItem('elforat_offer_end');
                if (!stored) {
                    endTime = Date.now() + DURATION;
                    localStorage.setItem('elforat_offer_end', endTime);
                } else if (parseInt(stored, 10) <= Date.now()) {
                    expired = true;
                    endTime = parseInt(stored, 10);
                    localStorage.setItem('elforat_offer_expired', '1');
                } else {
                    endTime = parseInt(stored, 10);
                }
            }
        }

        // كوبون الترحيب مربوط بنفس نافذة الـ 24 ساعة: نافذة واحدة لكل زائر (IP) للعرض والكوبون معاً
        if (window.WelcomeOffer && typeof window.WelcomeOffer.reconcile === 'function') {
            window.WelcomeOffer.reconcile(endTime, expired);
        }

        if (!hoursEl || !minutesEl || !secondsEl) return;

        if (expired) {
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            hideOfferCountdown(); // العداد بيتخفي بالكامل، فمفيش داعي لإظهاره
            return;
        }

        // الداتا الحقيقية جاهزة دلوقتي - نظهر العداد (كان مخفي بـ opacity:0 في style.css)
        document.getElementById('offer-countdown-wrap')?.classList.add('is-ready');

        const countdownTimer = setInterval(() => {
            const now = Date.now();
            const timeRemaining = Math.floor((endTime - now) / 1000);

            if (timeRemaining <= 0) {
                hoursEl.textContent = '00';
                minutesEl.textContent = '00';
                secondsEl.textContent = '00';
                hideOfferCountdown();
                clearInterval(countdownTimer);
                window.WelcomeOffer?.expire?.('offer_ended');
                return;
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
    // 8.5 جلب هوية المتجر (اللوجو + صورة الهيرو) من جدول settings
    // بيسمح للأدمن يتحكم في اللوجو وصورة الهيرو من لوحة التحكم (صفحة الإعدادات)
    // من غير ما نحتاج نعدّل ملفات HTML يدوياً - أي صورة موجودة محلياً (logo.png / hero-products.jpg)
    // هتتستبدل تلقائياً لو الأدمن رفع صورة بديلة، ولو لأ هتفضل الصورة المحلية شغالة عادي.
    // ==========================================
    async function applyStoreBranding() {
        // نظهر صورة الهيرو (كانت مخفية بـ opacity:0 في style.css) بمجرد ما نعرف
        // src النهائي بتاعها - سواء من الكاش/السيرفر أو لو فضلت الصورة المحلية
        // زي ما هي - عشان الزائر ميشوفش صورة تتقلب قدامه.
        const revealHero = () => {
            document.querySelectorAll('.hero-main-image').forEach(el => el.classList.add('is-ready'));
        };

        try {
            const cacheKey = 'elforat_store_settings_cache_v1';
            const applySettings = (s) => {
                if (!s) return;
                if (s.logo_url) {
                    document.querySelectorAll('img[src="logo.png"]').forEach(el => { el.src = s.logo_url; });
                    const favicon = document.querySelector('link[rel="icon"][href="logo.png"]');
                    if (favicon) favicon.href = s.logo_url;
                }

                if (s.hero_image_url) {
                    document.querySelectorAll('img[src="hero-products.webp"], img[src="hero-products.jpg"]').forEach(el => { el.src = s.hero_image_url; });
                }

                if (s.store_name) {
                    document.title = document.title.replace(/الفُرات فارما|الفرات فارما/g, s.store_name);
                }

                // تحديث الحد الأدنى للشحن المجاني ديناميكياً من لوحة التحكم
                if (s.free_shipping_threshold != null && Number(s.free_shipping_threshold) > 0) {
                    FREE_SHIPPING_THRESHOLD = Number(s.free_shipping_threshold);
                    if (typeof app !== 'undefined' && app.renderCart && cart && cart.length) {
                        app.renderCart();
                    }
                }

                // تحديث جميع روابط الواتساب في المتجر ديناميكياً برقم خدمة العملاء
                if (s.whatsapp) {
                    let cleanWa = String(s.whatsapp).replace(/\D/g, '');
                    if (cleanWa.startsWith('0')) cleanWa = '20' + cleanWa.slice(1);
                    if (cleanWa) {
                        document.querySelectorAll('a[href*="wa.me"]').forEach(el => {
                            el.href = `https://wa.me/${cleanWa}`;
                        });
                    }
                }

                // تحديث أرقام الاتصال المباشر في المتجر
                if (s.phone) {
                    document.querySelectorAll('a[href*="tel:"]').forEach(el => {
                        el.href = `tel:${s.phone}`;
                    });
                }
            };

            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
                if (cached && cached.data && Date.now() - cached.savedAt < 10 * 60 * 1000) {
                    applySettings(cached.data);
                    revealHero(); // عندنا نسخة حديثة كفاية من الكاش - نظهرها فوراً من غير ما ننتظر السيرفر
                }
            } catch (e) { }

            const { data, error } = await _supabase
                .from('settings')
                .select('data')
                .eq('id', 1)
                .maybeSingle();

            if (error || !data || !data.data) return; // مفيش إعدادات محفوظة، نسيب الصور المحلية زي ما هي

            applySettings(data.data);
            try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: data.data })); } catch (e) { }
        } catch (e) {
            console.warn('تعذر تحميل هوية المتجر من الإعدادات، هتفضل الصور المحلية الافتراضية:', e);
        } finally {
            revealHero(); // في كل الأحوال (نجاح/فشل/مفيش إعدادات) لازم تتظهر في الآخر
        }
    }

    // ==========================================
    // 9. تشغيل النظام بالكامل
    // ==========================================
    function getVisitorSessionId() {
        let id = sessionStorage.getItem('elforat_session_id');
        if (!id) {
            id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem('elforat_session_id', id);
        }
        return id;
    }

    function getDeviceType() {
        const w = window.innerWidth;
        if (w < 768) return 'mobile';
        if (w < 1024) return 'tablet';
        return 'desktop';
    }

    function getTrafficParams() {
        const params = new URLSearchParams(location.search);
        const ref = document.referrer || '';
        const host = (() => { try { return ref ? new URL(ref).hostname.toLowerCase() : ''; } catch (e) { return ''; } })();
        let detectedSource = 'direct';
        if (params.get('utm_source')) {
            detectedSource = params.get('utm_source').toLowerCase();
        } else if (host.includes('facebook') || host.includes('fb.me')) {
            detectedSource = 'facebook';
        } else if (host.includes('instagram')) {
            detectedSource = 'instagram';
        } else if (host.includes('tiktok')) {
            detectedSource = 'tiktok';
        } else if (host.includes('snapchat')) {
            detectedSource = 'snapchat';
        } else if (host.includes('google')) {
            detectedSource = 'google';
        } else if (host.includes('whatsapp') || host.includes('wa.me')) {
            detectedSource = 'whatsapp';
        } else if (host.includes('t.me') || host.includes('telegram')) {
            detectedSource = 'telegram';
        } else if (host) {
            detectedSource = host;
        }

        return {
            source: detectedSource,
            medium: params.get('utm_medium') || (ref ? 'referral' : 'direct'),
            campaign: params.get('utm_campaign') || null
        };
    }

    function normalizeEgyptPhone(phone) {
        let value = String(phone || '').replace(/\D/g, '');
        if (value.startsWith('20') && value.length === 12) value = '0' + value.slice(2);
        return value;
    }

    async function trackStoreEvent(eventName, payload = {}) {
        try {
            const traffic = getTrafficParams();
            await _supabase.from('store_events').insert([{
                session_id: getVisitorSessionId(),
                event_name: eventName,
                product_id: payload.product_id || null,
                product_name: payload.product_name || null,
                coupon_code: payload.coupon_code || null,
                cart_total: payload.cart_total == null ? null : Number(payload.cart_total),
                page_path: location.pathname + location.hash,
                source: traffic.source,
                medium: traffic.medium,
                campaign: traffic.campaign,
                device_type: getDeviceType(),
                metadata: payload.metadata || {}
            }]);
        } catch (e) {
            console.warn('analytics event skipped:', eventName, e.message || e);
        }
    }
    window.ElforatAnalytics = { getVisitorSessionId, getTrafficParams, getDeviceType, trackStoreEvent };

    // تسجيل زيارة جديدة في السيرفر
    async function trackVisitor() {
        try {
            const alreadyTracked = sessionStorage.getItem('elforat_visitor_event_tracked');
            const traffic = getTrafficParams();
            if (!alreadyTracked) {
                const eventPayload = {
                    session_id: getVisitorSessionId(),
                    page_path: location.pathname || '/',
                    referrer: document.referrer || null,
                    source: traffic.source,
                    medium: traffic.medium,
                    campaign: traffic.campaign,
                    device_type: getDeviceType(),
                    user_agent: navigator.userAgent || null
                };
                const { error: eventError } = await _supabase.from('visitor_events').insert([eventPayload]);
                if (!eventError) sessionStorage.setItem('elforat_visitor_event_tracked', 'true');
            }

            // [تعديل أداء]: بدل ما نجيب العدد ونزوده يدوي (read-then-write بيعمل
            // race condition لو حصلت زيارتين في نفس اللحظة)، بنستخدم دالة ذرية
            // (atomic RPC) في قاعدة البيانات بتزوّد العداد في خطوة واحدة آمنة.
            const { error } = await _supabase.rpc('increment_visitor_count');
            if (error) throw error;
        } catch (e) {
            console.warn('visitor tracking skipped:', e.message || e);
        }
    }

    trackVisitor();
    applyStoreBranding();

    // [جديد] استرجاع السلة وتحديث الرقم في الناف بار فوراً
    checkCartExpiry(); // التحقق من انتهاء صلاحية السلة
    loadCart();
    loadCoupon(); // استرجاع كود الخصم المطبّق سابقاً (لو لسه صالح هيتحقق منه تاني عند العرض)
    if (window.WelcomeOffer) window.WelcomeOffer.setApplyHandler(() => window.app.applyWelcomeCoupon());
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
        restoreViewFromHash();
    }).catch(() => {
        hideGlobalLoader();
    });

    // [جديد] استعادة الصفحة التي كان عليها الزائر عند إعادة التحميل من رابط الصفحة
    function parseHash() {
        const raw = location.hash.slice(1);
        if (!raw) return null;
        const [viewId, queryPart] = raw.split('?');
        if (!viewId) return null;
        let param = null;
        if (queryPart) {
            const params = new URLSearchParams(queryPart);
            param = params.get('item') || params.get('category');
        }
        return { viewId, param };
    }

    function restoreViewFromHash() {
        const target = parseHash();
        if (!target || !['home', 'catalog', 'about', 'product', 'cart', 'favorites'].includes(target.viewId)) return;
        if (target.viewId === 'home' || target.viewId === 'about') {
            app.navigate(target.viewId, null, false);
        } else if (target.viewId === 'catalog') {
            app.navigate('catalog', target.param, false);
        } else if (target.viewId === 'product') {
            if (target.param) app.navigate('product', target.param, false);
        } else {
            app.navigate(target.viewId, null, false);
        }
    }
    window.restoreViewFromHash = restoreViewFromHash;

    // دعم أزرار الرجوع والتقدم في المتصفح
    window.addEventListener('popstate', () => {
        const target = parseHash();
        if (target && target.viewId) {
            app.navigate(target.viewId, target.param, false);
        }
    });

    // Timeout احتياطي لإخفاء اللودر حتى لو حدث خطأ
    setTimeout(hideGlobalLoader, 5000);

    checkLowStock();
    startCountdown();

    /* تم إلغاء إظهار شريط العروض الترويجية بناءً على طلب العميل */

    // دالة معالجة زر المفضلة الرئيسي في صفحة المنتج
    window.handleMainFavorite = function (id) {
        // 1. تغيير الحالة في التخزين المحلي
        const isNowFavorite = FavoritesManager.favorites.includes(id)
            ? (FavoritesManager.favorites = FavoritesManager.favorites.filter(fid => fid !== id), false)
            : (FavoritesManager.favorites.push(id), true);
        FavoritesManager.save();

        // 2. تحديث شكل الزر في الصفحة الحالية فوراً
        const btn = document.getElementById('main-fav-btn');
        if (btn) {
            const svg = btn.querySelector('svg');
            if (isNowFavorite) {
                btn.classList.remove('bg-gray-100', 'text-gray-400');
                btn.classList.add('bg-primary', 'text-white', 'shadow-lg');
                svg.setAttribute('fill', 'currentColor');
                ToastManager.showSuccess('تمت الإضافة للمفضلة ❤️', 3000);
            } else {
                btn.classList.remove('bg-primary', 'text-white', 'shadow-lg');
                btn.classList.add('bg-gray-100', 'text-gray-400');
                svg.setAttribute('fill', 'none');
                ToastManager.showSuccess('تمت الإزالة من المفضلة', 3000);
            }
        }

        // 3. تحديث أيقونات المنتجات في الخلفية (الكتالوج)
        const otherBtns = document.querySelectorAll(`[data-favorite-btn="${id}"]`);
        otherBtns.forEach(b => {
            const isFav = FavoritesManager.isFavorite(id);
            b.classList.toggle('favorite-active', isFav);
            b.innerHTML = isFav
                ? `<svg class="heart-icon w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                : `<svg class="heart-icon w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
        });

        updateBadge();
        return isNowFavorite;
    };
});
