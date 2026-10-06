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
    const _supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    // ==========================================
    // [مهم] دعم الريفريش وأزرار الرجوع/التقدم في المتصفح
    // اتنقل لهنا (أول حاجة بعد إنشاء supabase client) بدل آخر الملف،
    // عشان يفضل شغال حتى لو حصل أي خطأ JS في أي حتة تانية في الملف ده.
    // لو الكود ده فضل في آخر الملف وحصل error قبله، مكانش بيتسجل خالص،
    // فكانت كل صفحة بترجع للهوم بعد الريفريش أو زرار رجوع/تقدم.
    // ==========================================
    // بنقفل استرجاع السكرول الأوتوماتيكي بتاع المتصفح نفسه، عشان يفضل الكنترول
    // بالكامل لكودنا (history.replaceState / scrollY تحت). لو سبناه شغال، المتصفح
    // بيحاول يرجّع مكان السكرول بنفسه *قبل* ما renderCatalog (أو ملف
    // store-product.js للصفحة) يعيدوا بناء المحتوى، فبيرجع لمكان غلط أو لأول
    // الصفحة، وكودنا بيتعارض معاه.
    if ('scrollRestoration' in history) {
        try { history.scrollRestoration = 'manual'; } catch (_) { }
    }

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

    // ==========================================
    // تحميل الكود اللي مش محتاجه لحد ما يبقى مطلوب (Lazy chunks)
    // ==========================================
    // analysis.js كان فيه كود صفحات لسه الزائر ماوصلش ليها (صفحة المنتج
    // كانت ~10 KiB مضغوط لوحدها، وصفحة الدفع ~5 KiB). فقلناه لملفات مستقلة
    // بيتحمّلوا أول ماحد يطلبها.
    // الطريقة بسيطة: نفس الـ Promise بيرجّع لكل نداءات لنفس الملف، والـ prefetch
    // بيحط <link rel="prefetch"> عشان المتصفح يجيبه في الخلفية قبل الضغط.
    const STORE_CHUNKS = {
        product: 'store-product.js?v=38',
        checkout: 'store-checkout.js?v=37'
    };
    const __storeChunkPromises = Object.create(null);

    function loadStoreChunk(src) {
        if (__storeChunkPromises[src]) return __storeChunkPromises[src];
        __storeChunkPromises[src] = new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () {
                delete __storeChunkPromises[src]; // خلّيه يجرب تاني لو فشل
                reject(new Error('تعذّر تحميل ' + src));
            };
            document.head.appendChild(s);
        });
        return __storeChunkPromises[src];
    }

    function prefetchStoreChunk(src) {
        if (__storeChunkPromises[src]) return;
        if (document.querySelector('link[data-prefetch="' + src + '"]')) return;
        const l = document.createElement('link');
        l.rel = 'prefetch';
        l.as = 'script';
        l.href = src;
        l.setAttribute('data-prefetch', src);
        document.head.appendChild(l);
    }

    // تسخين ملف صفحة المنتج قبل ما العميلة تضغط فعلاً: أول ما مؤشرها/
    // إيدها بتعدّي على أي بطاقة منتج، نحمّل الملف في الخلفية.
    // (على الموبايل: touchstart. على الديسكتوب: pointerenter/focusin.
    //  pointerdown كمان مهم لأنه بيسبق click، فبيدي chance إن الطلب يطلع
    //  قبل ما navigate يستنى الملف أصلاً - مهم على شبكة بطيئة.)
    function warmProductChunk(e) {
        const t = e.target;
        if (t && t.closest && t.closest('#catalog-grid, #bundles-grid, #related-products-grid')) {
            prefetchStoreChunk(STORE_CHUNKS.product);
        }
    }
    ['pointerenter', 'pointerdown', 'focusin', 'touchstart'].forEach(function (ev) {
        document.addEventListener(ev, warmProductChunk, { passive: true, capture: true });
    });

    function releaseRouteRestoring() {
        requestAnimationFrame(() => document.documentElement.classList.remove('route-restoring'));
    }

    async function restoreViewFromHash() {
        try {
            const target = parseHash();
            if (!target || !['home', 'catalog', 'about', 'product', 'cart', 'favorites'].includes(target.viewId)) return;
            // بنستنى لحد ما القسم يبان فعلاً (صفحة المنتج محتاجة lazy chunk)
            // عشان شاشة الاسترجاع تفضل مخفية لحد ما المحتوى يتبني، بدل ما
            // البانتير يتفك ويبان قسم فاضي.
            if (target.viewId === 'home' || target.viewId === 'about') {
                await app.navigate(target.viewId, null, false);
            } else if (target.viewId === 'catalog') {
                await app.navigate('catalog', target.param, false);
            } else if (target.viewId === 'product') {
                if (target.param) await app.navigate('product', target.param, false);
            } else {
                await app.navigate(target.viewId, null, false);
            }
        } catch (err) {
            console.warn('تعذّر استرجاع الصفحة من الرابط:', err);
        } finally {
            releaseRouteRestoring();
        }
    }
    window.restoreViewFromHash = restoreViewFromHash;

    window.addEventListener('popstate', () => {
        try {
            const target = parseHash();
            // لو السجل اللي المتصفح رجعلنا له من غير هاش (أول صفحة قبل أي pushState)،
            // نعتبره الهوم صراحة بدل ما نسيب الشكل زي ما هو (كان ده سبب إن أول
            // ضغطة رجوع مكنتش بترجع لحاجة مفهومة، وبعدين ضغطة تانية كانت بتقفل الموقع).
            const resolved = target && target.viewId ? target : { viewId: 'home', param: null };
            if (window.app && typeof window.app.navigate === 'function') {
                app.navigate(resolved.viewId, resolved.param, false);
            }
        } catch (err) {
            console.warn('تعذّر تنفيذ رجوع/تقدم المتصفح:', err);
        }
    });

    // نثبّت "#home" كأول سجل في تاريخ التصفح من غير ما نضيف سجل زيادة (replaceState
    // مش pushState)، عشان أول رجوع للخلف من أي صفحة تاني يبقى له مكان واضح يرجعله.
    if (!parseHash()) {
        try { history.replaceState({ viewId: 'home', param: null, scrollY: 0 }, '', '#home'); } catch (_) { }
    }


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
    // بيهرّب & < > " ' (الدالة القديمة كانت بتهرّب < > & بس، فعلامات الاقتباس كانت بتفلت من الـ attributes)
    function sanitize(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    // لقيمة جوه '...' في onclick/onerror inline: الـ HTML entities بتتفك قبل ما JS يشتغل،
    // فـ sanitize لوحدها مش كفاية هناك. هنا كل حرف غير حرف/رقم/شرطة بيتحول لـ \uXXXX.
    function jsArg(str) {
        return String(str ?? '').replace(/[^A-Za-z0-9_\-]/g, ch =>
            '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
    }

    // تنسيق النصوص متسلسلة الأسطر والنقاط والقوائم
    function renderFormattedText(str, defaultFallback = '') {
        const raw = (str != null && String(str).trim()) ? String(str).trim() : defaultFallback;
        if (!raw) return '';
        const safe = sanitize(raw);
        const lines = safe.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        
        let html = '';
        let inList = false;

        lines.forEach(line => {
            const isBullet = /^[•\-\*–—]\s*/.test(line) || /^\d+[\.\-\)]\s*/.test(line);
            if (isBullet) {
                if (!inList) {
                    html += '<ul class="space-y-2 my-2 pr-1 list-none">';
                    inList = true;
                }
                const cleanedText = line.replace(/^([•\-\*–—]|\d+[\.\-\)])\s*/, '');
                html += `<li class="flex items-start gap-2 text-sm leading-relaxed"><span class="text-primary mt-1 flex-shrink-0 text-xs">●</span><span>${cleanedText}</span></li>`;
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                html += `<p class="leading-relaxed mb-2 text-sm">${line}</p>`;
            }
        });

        if (inList) {
            html += '</ul>';
        }
        return html;
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
    window.ToastManager = ToastManager; // مطلوب لأن زر الإغلاق في التوست بيستدعيه من onclick جوه الـ HTML

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
            const message = (error && error.message) || String(error);
            // ملاحظة مهمة: عميل Supabase (اللي بنستخدمه هنا) بيرجّع أخطاء السيرفر
            // كـ { error } جوّه الـ result ومش بيعمل throw. فلازم نقرأ res.error
            // صريح - لو اعتمدنا على catch بس، الخطأ كان هيتحسب "نجح" والتسجيل
            // مش هيكمّل للـ fallback. (ده كان سبب ضياع كل أخطاء الموقع)
            let firstError = null;
            try {
                const res = await _supabase.from('error_logs').insert([{
                    error_message: message,
                    error_stack: error && error.stack,
                    context: context,
                    timestamp: new Date().toISOString(),
                    user_agent: navigator.userAgent
                }]);
                if (res && res.error) firstError = res.error;
            } catch (e) {
                firstError = e;
            }
            if (!firstError) return; // اتسجل في error_logs تمام

            // جدول error_logs مش موجود في المشروع دلوقتي، فالتسجيل كان
            // بيضيع على الصمت. بنكتب في store_events كمان - هي شغالة فعلاً -
            // عشان الخطأ يبقى ظاهر في الداتابيز.
            console.warn('error_logs unavailable, falling back to store_events:', firstError.message || firstError);
            try {
                const traffic = getTrafficParams();
                const res2 = await _supabase.from('store_events').insert([{
                    session_id: getVisitorSessionId(),
                    event_name: 'js_error',
                    page_path: location.pathname + location.hash,
                    source: traffic.source,
                    medium: traffic.medium,
                    campaign: traffic.campaign,
                    device_type: getDeviceType(),
                    metadata: {
                        context: context || null,
                        error_message: String(message).slice(0, 500),
                        error_stack: error && error.stack ? String(error.stack).slice(0, 1000) : null,
                        visitor_id: getVisitorId()
                    }
                }]);
                if (res2 && res2.error) console.warn('store_events fallback failed:', res2.error.message || res2.error);
            } catch (e2) {
                console.warn('failed to log error anywhere:', e2.message || e2);
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
            try {
                const saved = localStorage.getItem('elforat_favorites');
                const parsed = saved ? JSON.parse(saved) : [];
                this.favorites = Array.isArray(parsed) ? parsed : [];
            } catch (e) { this.favorites = []; }
        },

        save() {
            try { localStorage.setItem('elforat_favorites', JSON.stringify(this.favorites)); } catch (e) { }
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
            const isFav = this.isFavorite(productId);
            document.querySelectorAll(`[data-favorite-btn="${productId}"]`).forEach(btn => {
                btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
                btn.innerHTML = isFav
                    ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                    : `<i class="fa-regular fa-heart text-xs"></i>`;
            });
        },

        getCount() {
            return this.favorites.length;
        }
    };
    // أزرار المفضلة في بطاقات المنتجات (الكتالوج/المفضلة/ذات صلة) بتربط
    // onclick="FavoritesManager.toggle('...')" جوه الـ HTML، فلازم الكائن يبقى
    // global - من غير السطر ده الـ onclick بيرمي ReferenceError.
    // (التعريف هنا مش فوق، عشان الـ const بيتبني فعلاً قبل ما نقرأه - TDZ.)
    window.FavoritesManager = FavoritesManager;

    // مستمع واحد للمفضلة (capture) بدل إضافة مستمعين جدد مع كل re-render.
    // كان التكرار بيخلي الضغطة الواحدة تعمل toggle مرتين (يعني ولا حاجة) في صفحة المفضلة والمنتجات المشابهة،
    // وكمان onclick الـ inline كان بيستدعي FavoritesManager وهو مش global فبيرمي ReferenceError.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.favorite-btn[data-favorite-btn]');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        const productId = btn.getAttribute('data-favorite-btn');
        FavoritesManager.toggle(productId);
        if (document.getElementById('view-favorites')?.classList.contains('active')) {
            updateBadge();
            renderFavorites();
        }
    }, true);

    let productsDB = [];
    let cart = [];
    // مواصفات شاشة الموبايل (كارت المجموعات) + آخر فلتر اتعرض، عشان إعادة الرسم لو الشاشة اتغيّرت
    const bundleMQ = window.matchMedia ? window.matchMedia('(max-width: 767.98px)') : { matches: false };
    let lastCatalogArgs = null;
    let appliedCoupon = null; // { code, discount_percentage }

    // ==========================================
    // دوال حفظ واسترجاع السلة (الجديدة)
    // ==========================================
    function loadCart() {
        try {
            const savedCart = localStorage.getItem('elforat_cart');
            const parsed = savedCart ? JSON.parse(savedCart) : [];
            // localStorage للعرض بس (مش مصدر ثقة): نفلتر أي عنصر شكله غلط، والأسعار بتتحدّث
            // من الكتالوج بعد تحميله (syncCartWithCatalog)، وسعر الطلب الحقيقي بييجي من السيرفر وقت التأكيد.
            cart = (Array.isArray(parsed) ? parsed : [])
                .filter(i => i && typeof i === 'object' && i.id != null && typeof i.name === 'string')
                .map(i => Object.assign({}, i, {
                    qty: Math.min(Math.max(parseInt(i.qty) || 1, 1), 99),
                    price: Math.max(Number(i.price) || 0, 0)
                }))
                .filter(i => !i.isGift || String(i.id).indexOf('gift_') === 0);
        } catch (e) { cart = []; }
    }

    // تحديث سعر وكمية عناصر السلة المحفوظة من الكتالوج (اللي جاي من السيرفر) - للعرض بس
    function syncCartWithCatalog() {
        if (!cart.length || !Array.isArray(productsDB) || !productsDB.length) return;
        let changed = false;
        cart.forEach(function (it) {
            if (it.isGift) return;
            const p = productsDB.find(function (x) { return String(x.id) === String(it.id); });
            if (!p) return;
            if (it.price !== p.price) { it.price = p.price; changed = true; }
            if (p.stock > 0 && it.qty > p.stock) { it.qty = p.stock; changed = true; }
        });
        if (changed) saveCart();
    }

    function saveCart() {
        // حفظ السلة لمدة 60 يوم
        try {
            localStorage.setItem('elforat_cart', JSON.stringify(cart));
            localStorage.setItem('elforat_cart_expiry', Date.now() + (60 * 24 * 60 * 60 * 1000));
        } catch (e) { }
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
        try {
            if (appliedCoupon) {
                localStorage.setItem('elforat_coupon', JSON.stringify(appliedCoupon));
            } else {
                localStorage.removeItem('elforat_coupon');
            }
        } catch (e) { }
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

    // ==========================================
    // الشحن حسب المحافظة: الأسعار من جدول shipping_rates في Supabase
    // (نفس الجدول اللي الـ trigger بيتحقق منه في السيرفر، فمفيش أرقام مكررة).
    // ==========================================
    let shippingRates = null;        // Map: اسم المحافظة -> سعر الشحن
    let shippingRatesPromise = null;

    function fillGovernorateSelect(names) {
        const sel = document.getElementById('cust-governorate');
        if (!sel) return;
        const current = sel.value;
        sel.length = 1; // أول option = "اختاري المحافظة"
        names.forEach(function (n) {
            const o = document.createElement('option');
            o.value = n;
            o.textContent = n;
            sel.appendChild(o);
        });
        if (current && names.indexOf(current) !== -1) sel.value = current;
    }

    function loadShippingRates() {
        if (shippingRatesPromise) return shippingRatesPromise;
        shippingRatesPromise = Promise.resolve(_supabase.from('shipping_rates').select('governorate,fee'))
            .then(function (res) {
                const rows = res && res.data;
                if (!res || res.error || !Array.isArray(rows) || !rows.length) { shippingRatesPromise = null; return null; }
                rows.sort(function (x, y) { return String(x.governorate).localeCompare(String(y.governorate), 'ar'); });
                shippingRates = new Map(rows.map(function (r) { return [r.governorate, Number(r.fee) || 0]; }));
                fillGovernorateSelect(rows.map(function (r) { return r.governorate; }));
                if (cart.length) renderCart();
                return shippingRates;
            })
            .catch(function () { shippingRatesPromise = null; return null; });
        return shippingRatesPromise;
    }

    const SHIPPING_CALC_LATER = true;

    // ok=false يعني مينفعش نكمل الطلب (محافظة مش مختارة / مش متاحة / الأسعار لسه ما حمّلتش)
    function getShipping(subtotal, governorate) {
        const free = subtotal >= FREE_SHIPPING_THRESHOLD;
        if (!governorate) return { ok: false, reason: 'pick', free: free, fee: 0 };
        if (!shippingRates) return { ok: false, reason: 'loading', free: free, fee: 0 };
        if (!shippingRates.has(governorate)) return { ok: false, reason: 'unavailable', free: free, fee: 0 };
        // الشحن بيتحسب لاحقاً حسب شركة الشحن: مفيش رقم ثابت بيتضاف على الإجمالي.
        // (لو رجعتي للأسعار الثابتة من جدول shipping_rates خلّي SHIPPING_CALC_LATER = false)
        if (SHIPPING_CALC_LATER) return { ok: true, free: free, fee: 0, later: !free };
        return { ok: true, free: free, fee: free ? 0 : shippingRates.get(governorate) };
    }

    (function () {
        const govSelect = document.getElementById('cust-governorate');
        if (govSelect) govSelect.addEventListener('change', function () { renderCart(); });
    })();

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
        try {
            const expiry = localStorage.getItem('elforat_cart_expiry');
            if (expiry && Date.now() > parseInt(expiry)) {
                localStorage.removeItem('elforat_cart');
                localStorage.removeItem('elforat_cart_expiry');
                cart = [];
            }
        } catch (e) { }
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
    function getOptimizedImg(path, width = 320, quality = 72) {
        const fullUrl = getFullImg(path);
        if (!fullUrl.startsWith('http')) return fullUrl; // لوجو محلي مثلاً - سيبه زي ما هو
        return `https://wsrv.nl/?url=${encodeURIComponent(fullUrl)}&w=${width}&q=${quality}&output=webp`;
    }

    // معالج موحّد لفشل تحميل الصور: أول محاولة فشل بترجع للصورة الأصلية،
    // ولو دي كمان فشلت بيرجع للوجو كحل أخير (بدل ما تفضل مكسورة).
    function handleImgLoad(imgEl) {
        if (!imgEl) return;
        imgEl.classList.remove('image-loading', 'opacity-0');
        imgEl.classList.add('image-loaded', 'opacity-100');
        imgEl.style.opacity = '1';
        imgEl.style.visibility = 'visible';
        const skeletonHost = imgEl.closest('[data-image-skeleton]');
        if (skeletonHost) skeletonHost.classList.remove('skeleton-img');
    }
    window.handleImgLoad = handleImgLoad;

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

    const PRODUCTS_CACHE_KEY = 'elforat_products_cache_v4';
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
            imgThumb: getOptimizedImg(p.img, 320, 72),
            badge: p.badge || '',
            desc: p.desc || '',
            ingredients: p.ingredients || '',
            size: p.size || '',
            // NaN/null (مفيش قيمة) = 100 احتياطي، لكن 0 لازم يفضل 0 (كان `|| 100` بيحوّل "نفذ" لـ 100)
            stock: Number.isFinite(parseInt(p.stock)) ? Math.max(parseInt(p.stock), 0) : 100,
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
            if (!img.hasAttribute('decoding')) img.decoding = 'async';
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
                        // [تحسين أداء]: بنجيب بس الأعمدة اللي الواجهة فعلاً بتستخدمها
                        // بدل select('*') اللي كان بيجيب كل عمود في الجدول (لو فيه
                        // عمود نص طويل زي created_at أو أي حقل إداري مش مستخدم هنا،
                        // كان بيتنقل مع كل منتج من غير داعي ويبطّئ الاستعلام والتحميل).
                        .select('id,name,category,price,oldPrice,img,badge,desc,ingredients,size,stock,images,gallery,is_active')
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

    optimizePageImages(); // مرة واحدة فقط (الكروت بتتولّد بـ loading=lazy/decoding=async جاهزين)

    // دالة عرض Skeleton Loading
    function renderSkeletonLoading() {
        const grid = document.getElementById('catalog-grid');
        if (!grid) return;

        grid.__lastHtml = null;
        grid.innerHTML = Array(8).fill(0).map((_, i) => `
            <div class="product-card">
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
            audio.play().catch(() => {});
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
        let activeLink = null;

        // مرحلة الكتابة (Write): تغيير الكلاسات بس، من غير أي قراءة لأبعاد العنصر
        // جوه نفس اللوب - ده اللي كان بيسبب Forced Reflow (قراءة offsetWidth
        // فورًا بعد تغيير هيقلب الـ layout).
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkTarget = link.getAttribute('data-target');
            if (linkTarget === activeKey || (!activeParam && linkTarget === activeId)) {
                link.classList.add('text-primary');
                link.classList.remove('text-gray-900');
                activeLink = link;
            } else {
                link.classList.add('text-gray-900');
                link.classList.remove('text-primary');
            }
        });

        // مرحلة القراءة (Read): بعد الفريم الجاي، لما الـ layout يكون خلص أصلاً
        // (مش هيحصل Forced Synchronous Reflow جوه نفس الـ tick).
        if (morphLine && activeLink) {
            requestAnimationFrame(() => {
                morphLine.style.width = `${activeLink.offsetWidth}px`;
                morphLine.style.left = `${activeLink.offsetLeft}px`;
            });
        }

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
            console.warn("تعذر جلب الهدايا من سوبابيز");
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

    let __swalPromise = null;
    function ensureSwal() {
        if (typeof Swal !== 'undefined') return Promise.resolve(true);
        if (__swalPromise) return __swalPromise;
        __swalPromise = new Promise(resolve => {
            const sc = document.createElement('script');
            sc.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js';
            sc.onload = () => resolve(true);
            sc.onerror = () => { __swalPromise = null; resolve(false); };
            document.head.appendChild(sc);
        });
        return __swalPromise;
    }

    function openContactModal() {
        return ensureSwal().then(() => _openContactModal());
    }

    function _openContactModal() {
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
        return ensureSwal().then(() => _openAddReviewModal(productId, productName));
    }

    function _openAddReviewModal(productId, productName) {
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
                        is_approved: false
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
                if (addToHistory) {
                    // نحفظ مكان السكرول الحالي على السجل اللي هنسيبه، عشان لو
                    // رجعنا له بعدين بزرار "رجوع" يرجعنا لنفس المكان بدل أول الصفحة
                    try { history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, ""); } catch (_) { }
                    history.pushState({ viewId, param, scrollY: 0 }, "", param ? `#${viewId}?item=${param}` : `#${viewId}`);
                }
                const mainWasActive = !!document.getElementById('view-main')?.classList.contains('active');
                document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

                updateNavMorph(viewId, viewId === 'catalog' ? param : null);

                // لو جايين من زرار رجوع/تقدم وعندنا مكان سكرول محفوظ لنفس السجل ده،
                // نرجّع لمكانه بالظبط بدل ما نطلّع دايماً لأول الصفحة
                const restoreScrollY = (!addToHistory && history.state && typeof history.state.scrollY === 'number')
                    ? history.state.scrollY : null;

                if (['home', 'catalog', 'about'].includes(viewId)) {
                    document.getElementById('view-main').classList.add('active');
                    if (viewId === 'catalog') renderCatalog(param, this.searchTerm); else renderCatalog(null, this.searchTerm);
                    if (restoreScrollY !== null) {
                        window.scrollTo({ top: restoreScrollY, behavior: "instant" });
                    } else if (!addToHistory) {
                        // استرجاع من الريفريش/الرجوع: قفزة فورية بدل سكرول متحرك بيبان كأن الصفحة بتتحرك
                        const target = document.getElementById(viewId);
                        window.scrollTo({ top: viewId === 'home' || !target ? 0 : Math.max(target.offsetTop - 80, 0), behavior: "instant" });
                    } else {
                        // قراءة offsetTop بتتأجل لفريم جاي عشان مش نقرأها فورًا بعد
                        // إضافة كلاس 'active' (تغيير هيقلب الـ layout) في نفس الـ tick
                        requestAnimationFrame(() => {
                            const target = document.getElementById(viewId);
                            if (target) window.scrollTo({ top: target.offsetTop - 80, behavior: mainWasActive ? "smooth" : "instant" });
                        });
                    }
                } else {
                    const viewEl = document.getElementById('view-' + viewId);
                    if (viewEl) viewEl.classList.add('active');
                    if (viewId === 'product') {
                        // صفحة المنتج في ملف lazy (store-product.js): بنقفل
                        // القسم المسجّل الأول لحد ما يتبني المحتوى، وبعدها بنرسم
                        // ونعمل سكرول. الـ prefetch بيجيب الملف قبل كده من أول
                        // hover/tap على بطاقة منتج، فالتأخير بيبقى غير محسوس.
                        document.body.classList.add('show-mobile-bar');
                        return loadStoreChunk(STORE_CHUNKS.product).then(function () {
                            window.ElforatProduct.render(param);
                            window.scrollTo({ top: restoreScrollY !== null ? restoreScrollY : 0, behavior: 'instant' });
                        }).catch(function (err) {
                            console.error('product chunk failed', err);
                            showCustomAlert('تعذّر تحميل صفحة المنتج، برجاء تحديث الصفحة.', 'error');
                        });
                    }
                    if (viewId === 'cart') {
                        // ملفات الدفع + منطق التأكيد: كلهم lazy، بنبدأ تحميلهم
                        // بمجرد فتح السلة عشان يكونوا جاهزين لحظة الضغط على تأكيد.
                        loadStoreChunk(STORE_CHUNKS.checkout);
                        loadPaymentScripts();
                        loadShippingRates();
                        renderCart();
                        revalidateCoupon();
                    }
                    if (viewId === 'favorites') renderFavorites();
                    window.scrollTo({
                        top: restoreScrollY !== null ? restoreScrollY : 0,
                        behavior: "instant" // تبديل قسم كامل: سكرول متحرك من مكان قديم بيبان كأن الصفحة بتقفز
                    });
                }

                if (viewId !== 'product') document.body.classList.remove('show-mobile-bar');
            };

            // ترتيب مهم: doNav الأول لأنه يحدّث الـ hash (pushState) وtrackStoreEvent
            // بيسجّل location.hash في الحدث.
            const viewReady = doNav();
            trackStoreEvent('page_view', { metadata: { view: viewId, item: param } });
            // بيرجّع Promise دايماً (حتى لو القسم اترسم على طول) عشان
            // restoreViewFromHash يقدر يستنى لحد ما المحتوى يبقى جاهز.
            return Promise.resolve(viewReady);
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
                        <div onclick="app.navigate('product', '${jsArg(p.id)}'); app.hideSearchSuggestions();" 
                             class="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 cursor-pointer transition-colors group">
                            <img src="${sanitize(getOptimizedImg(p.img, 80, 70))}" loading="lazy" class="w-10 h-10 object-contain rounded-lg bg-gray-50 group-hover:scale-110 transition-transform" onerror="handleImgError(this, '${jsArg(p.img)}')">
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

            // لو العميل داخل صفحة السلة، أعد رسم السلة فوراً بعد الإضافة
            // عشان المنتج المقترح يدخل في نفس الطلب، ويتحدث الإجمالي
            // والـ checkout total بدون انتظار فتح السلة مرة ثانية.
            renderCart();

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
        // زرار "اكتب تقييمك" في صفحة المنتج بيناديها من onclick جوه الـ HTML،
        // والـ openAddReviewModal جوه الـ IIFE مش شايف من برّه من غير السطر ده.
        openContactModal: function () {
            return openContactModal();
        },
        openAddReviewModal: function (productId, productName) {
            return openAddReviewModal(productId, productName);
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
        // تفريغ السلة (زر موبايل): بيشيل المنتجات والهدايا المرتبطة بيها
        clearCartItems: function () {
            if (!cart.length) return;
            if (!window.confirm('هل تريدين تفريغ سلة المشتريات؟')) return;
            cart = [];
            checkOffers();
            saveCart();
            renderCart();
            updateBadge();
        },
        quickApplyWelcome: function () {
            const input = document.getElementById('coupon-code-input');
            if (input) input.value = 'WELCOME10';
            return this.applyCoupon();
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
            const btn = document.getElementById('mobile-menu-btn');
            if (!panel || !overlay) return;

            const isClosed = panel.classList.contains('translate-x-full');
            if (isClosed) {
                // فتح القائمة
                panel.classList.remove('translate-x-full');
                panel.classList.add('translate-x-0');
                overlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
                if (btn) { btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', 'إغلاق قائمة التصفح'); }
            } else {
                // إغلاق القائمة
                panel.classList.add('translate-x-full');
                panel.classList.remove('translate-x-0');
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
                if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'فتح قائمة التصفح'); }
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
<article class="pro-product-card p-3 sm:p-4 border border-purple-100/90 shadow-purple-soft flex flex-col justify-between relative group cursor-pointer" onclick="app.navigate('product', '${jsArg(p.id)}')">
    <div class="flex items-center justify-between w-full mb-3 z-10">
        ${p.badge ? `<span class="badge-gold-shimmer text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">${sanitize(p.badge)}</span>` : `<span class="w-8"></span>`}
        <button onclick="event.stopPropagation();" data-favorite-btn="${sanitize(p.id)}" aria-label="${isFavorite ? 'إزالة من المفضلة' : 'أضف للمفضلة'}" aria-pressed="${isFavorite ? 'true' : 'false'}" title="${isFavorite ? 'إزالة من المفضلة' : 'أضف للمفضلة'}" class="favorite-btn btn-fav w-8 h-8 rounded-full bg-white/95 shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all z-20">
            ${isFavorite
                ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                : `<i class="fa-regular fa-heart text-xs"></i>`
            }
        </button>
    </div>
    <div class="relative w-full aspect-square rounded-2xl bg-gradient-to-tr from-purple-50/80 to-purple-100/40 p-3 sm:p-4 mb-3.5 flex items-center justify-center overflow-hidden skeleton-img" data-image-skeleton>
        <img src="${sanitize(p.imgThumb || p.img)}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'auto'}" width="320" height="320" alt="${sanitize(p.name)}" class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-all duration-200 image-loading opacity-0" style="opacity:0 !important;visibility:hidden !important" onload="handleImgLoad(this)" onerror="handleImgError(this, '${jsArg(p.img)}')">
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
                <button onclick="event.stopPropagation(); app.buyNow('${jsArg(p.id)}')" class="btn-dark py-2.5 text-xs font-bold shadow-sm">اشتري الآن</button>
                <button onclick="event.stopPropagation(); app.addToCart('${jsArg(p.id)}')" class="btn-add-cart py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:gap-2 transition-all">
                    <i class="fa-solid fa-cart-plus text-xs"></i>
                    <span>أضف<span class="add-suffix"> للسلة</span></span>
                </button>
            </div>
        </div>
    </div>
</article>`;
    }

    // كارت المجموعة (شكل الموبايل: صف أفقي بصورة 80px + شارة التوفير + زر "طلب المجموعة").
    // بيتستخدم على الموبايل بس؛ الديسكتوب لسه بيستخدم buildProductCard.
    function buildBundleCard(p) {
        const price = Number(p.price) || 0;
        const old = Number(p.oldPrice) || 0;
        const saved = old > price ? Math.round(old - price) : 0;
        const badge = saved
            ? `<span class="bundle-card__badge">وفرتي ${saved} ج.م</span>`
            : (p.badge ? `<span class="bundle-card__badge bundle-card__badge--tag">${sanitize(p.badge)}</span>` : `<span></span>`);
        return `
<article class="bundle-card col-span-full" onclick="app.navigate('product', '${jsArg(p.id)}')">
    <div class="bundle-card__top">
        ${badge}
        <div class="bundle-card__rating"><i class="fa-solid fa-star"></i><span>${p.rating || '4.9'}</span></div>
    </div>
    <div class="bundle-card__body">
        <div class="bundle-card__img skeleton-img" data-image-skeleton>
            <img src="${sanitize(p.imgThumb || p.img)}" loading="lazy" decoding="async" fetchpriority="low" width="80" height="80" alt="${sanitize(p.name)}" class="image-loading opacity-0 transition-opacity duration-200" style="opacity:0 !important;visibility:hidden !important" onload="handleImgLoad(this)" onerror="handleImgError(this, '${jsArg(p.img)}')">
        </div>
        <div class="bundle-card__text">
            <h3 class="bundle-card__title">${sanitize(p.name)}</h3>
            ${p.desc ? `<p class="bundle-card__desc">${sanitize(p.desc)}</p>` : ''}
        </div>
    </div>
    <div class="bundle-card__footer">
        <div class="bundle-card__prices">
            <span class="bundle-card__price">${sanitize(p.price)} ج.م</span>
            ${old > price ? `<span class="bundle-card__old">${sanitize(p.oldPrice)} ج.م</span>` : ''}
        </div>
        <button type="button" class="bundle-card__btn" onclick="event.stopPropagation(); app.buyNow('${jsArg(p.id)}')">
            <i class="fa-solid fa-cart-plus"></i>
            <span>طلب المجموعة</span>
        </button>
    </div>
</article>`;
    }
    function buildBundleOrProductCard(p, index) {
        return bundleMQ.matches ? buildBundleCard(p) : buildProductCard(p, index);
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

    function setHtmlIfChanged(el, html) {
        if (!el) return;
        if (el.__lastHtml === html && el.firstChild) return;
        el.innerHTML = html;
        el.__lastHtml = html;
    }

    function renderCatalog(filter = null, searchTerm = '', options = {}) {
        lastCatalogArgs = [filter, searchTerm];
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
                grid.__lastHtml = null;
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
                setHtmlIfChanged(grid, visibleBundles.map((p, index) => buildBundleOrProductCard(p, index)).join('')
                    + buildLoadMoreControl(products.length, catalogVisibleCount));
            }
            if (bundlesSection) bundlesSection.style.display = 'none';
            if (bundlesGrid) bundlesGrid.innerHTML = '';
        } else {
            // فصل المجموعات المتكاملة (زي مجموعة الديتوكس وما بعدها) عن المنتجات الفردية
            const individualProducts = products.filter(p => p.category !== 'مجموعات متكاملة');
            const bundleProducts = products.filter(p => p.category === 'مجموعات متكاملة');
            const visibleIndividual = individualProducts.slice(0, catalogVisibleCount);

            if (grid) {
                setHtmlIfChanged(grid, visibleIndividual.map((p, index) => buildProductCard(p, index)).join('')
                    + buildLoadMoreControl(individualProducts.length, catalogVisibleCount));
            }

            if (bundleProducts.length > 0 && bundlesGrid && bundlesSection) {
                setHtmlIfChanged(bundlesGrid, bundleProducts.map((p, index) => buildBundleOrProductCard(p, index)).join(''));
                bundlesSection.style.display = '';
            } else {
                if (bundlesGrid) bundlesGrid.innerHTML = '';
                if (bundlesSection) bundlesSection.style.display = 'none';
            }
        }

    }

    if (bundleMQ.addEventListener) {
        bundleMQ.addEventListener('change', () => {
            if (lastCatalogArgs) renderCatalog(lastCatalogArgs[0], lastCatalogArgs[1], { keepPage: true });
        });
    }

    // ==========================================
    // صفحة تفاصيل المنتج + المعرض + المراجعات + المنتجات ذات الصلة انتقلت
    // لملف مستقل (store-product.js): بيتحمّل أول ما حد يفتح منتج، ومتسخّم
    // مسبقاً عند الـ hover/tap على أي بطاقة منتج (prefetchStoreChunk).
    // ==========================================

    function renderCart() {
        const container = document.getElementById('cart-items-container');
        const summary = document.getElementById('cart-summary-totals');
        if (!container) return;
        if (cart.length === 0) {
            container.innerHTML = '<div class="py-32 text-center text-gray-400 uppercase tracking-widest cart-empty">حقيبة التسوق فارغة</div>';
            if (summary) summary.innerHTML = '';
            const viewCartE = document.getElementById('view-cart');
            if (viewCartE) viewCartE.classList.add('cart-is-empty');
            ['cart-ship-card', 'cart-cross', 'cart-m-count'].forEach(function (id) { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
            const countLabelEmpty = document.getElementById('cart-summary-count');
            if (countLabelEmpty) countLabelEmpty.textContent = '';
            renderCouponUI();
            return;
        }
        let subtotal = getCartSubtotal();
        container.innerHTML = cart.map(item => {
            if (item.isGift) {
                return `
                <div class="cart-card cart-card--gift flex gap-4 sm:gap-8 border-b border-gray-100 pb-10 text-right group relative">
                    <div class="cart-card__img w-20 h-20 sm:w-24 sm:h-24 bg-[#fdf2f5] p-3 sm:p-4 rounded-2xl relative shrink-0">
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
            <div class="cart-card flex gap-4 sm:gap-8 border-b border-gray-100 pb-10 text-right group relative">
                <div class="cart-card__img w-20 h-20 sm:w-24 sm:h-24 bg-[#f9f9f9] p-3 sm:p-4 rounded-2xl relative"><img src="${sanitize(item.img)}" alt="${sanitize(item.name)}" class="w-full h-full object-contain mix-blend-multiply"></div>
                <div class="cart-card__body flex-grow space-y-1">
                    <div class="m-only cart-card__tags"><span class="cart-card__cat">${sanitize(item.category || '')}</span>${item.badge ? `<span class="cart-card__badge">${sanitize(item.badge)}</span>` : ''}</div>
                    <h3 class="text-sm font-extrabold uppercase text-black">${sanitize(item.name)}</h3>
                    <div class="cart-card__row flex flex-row-reverse justify-between items-center pt-4">
                        <span class="text-base font-bold text-primary">${sanitize(item.price * item.qty)} ج.م</span>
                        <div class="flex border border-gray-100 rounded-full" dir="ltr">
                            <button onclick="app.updateQty('${jsArg(item.id)}', 1)" class="px-3 py-1 text-primary font-bold">+</button>
                            <span class="px-4 py-1 text-xs font-bold">${item.qty}</span>
                            <button onclick="app.updateQty('${jsArg(item.id)}', -1)" class="px-3 py-1 text-primary font-bold">-</button>
                        </div>
                    </div>
                </div>
                <button onclick="app.removeItem('${jsArg(item.id)}')" aria-label="حذف المنتج" class="cart-card__x text-gray-300 hover:text-red-500 transition-colors">×</button>
            </div>`;
        }).join('');

        const discount = getCartDiscount(subtotal);
        const govEl = document.getElementById('cust-governorate');
        const shipping = getShipping(subtotal, govEl ? govEl.value : '');
        const finalTotal = Math.round((Math.max(subtotal - discount, 0) + (shipping.ok ? shipping.fee : 0)) * 100) / 100;
        const shippingLabel = shipping.free ? 'مجاني 🎉' : (shipping.later ? 'يُحسب لاحقاً' : (shipping.ok ? `${sanitize(shipping.fee)} ج.م` : 'اختاري المحافظة'));
        const itemsCount = cart.reduce((s, i) => s + i.qty, 0);
        const freeShippingLeft = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
        const freeShippingPct = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
        const freeShippingColor = getShippingBarColor(freeShippingPct);

        const countLabel = document.getElementById('cart-summary-count');
        if (countLabel) countLabel.textContent = `${itemsCount} ${itemsCount === 1 ? 'منتج' : 'منتجات'} في الحقيبة`;

        if (summary) {
            summary.innerHTML = `
                <div class="m-only cart-sum__head"><b>ملخص الحساب الدقيق</b><span><i class="fa-solid fa-receipt" aria-hidden="true"></i> فاتورة الطلب</span></div>
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
                    <span class="font-bold ${shipping.free ? 'text-emerald-600' : 'text-darkNavy'}">${shippingLabel}</span>
                </div>
                <div class="pt-1 cart-sum__ship">
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
                <div class="cart-sum__total relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary to-secondary text-white px-4 py-4 flex items-center justify-between mt-1">
                    <div class="absolute -top-6 -left-6 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <span class="relative font-bold text-sm">الإجمالي<small class="cart-sum__note block text-[10px] font-medium text-white/80 mt-0.5">${shipping.free ? 'شحن مجاني' : 'غير شامل مصاريف الشحن'}</small></span>
                    <span class="relative text-xl font-black">${sanitize(finalTotal)} <span class="text-xs font-bold">ج.م</span></span>
                </div>
            `;
        }
        renderCouponUI();
        renderCartMobileExtras({ subtotal: subtotal, itemsCount: itemsCount, freeShippingLeft: freeShippingLeft, freeShippingPct: freeShippingPct, finalTotal: finalTotal });
    }

    // موبايل فقط (العناصر دي m-only: مخفية على الديسكتوب ومبتظهرش غير من mobile.css):
    // كارت الشحن المجاني + عدّاد المنتجات + "قد يعجبكِ أيضاً" + إجمالي زر التأكيد.
    function renderCartMobileExtras(d) {
        const viewCart = document.getElementById('view-cart');
        if (viewCart) viewCart.classList.remove('cart-is-empty');

        const countEl = document.getElementById('cart-m-count');
        if (countEl) countEl.textContent = `${d.itemsCount} ${d.itemsCount === 1 ? 'منتج' : 'منتجات'}`;

        const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
        if (submitBtn) submitBtn.setAttribute('data-total', String(d.finalTotal));

        const pct = Math.round(d.freeShippingPct);
        const shipEl = document.getElementById('cart-ship-card');
        if (shipEl) {
            let welcomeOk = false;
            try { welcomeOk = !appliedCoupon && !!(window.WelcomeOffer && window.WelcomeOffer.guard('WELCOME10').ok); } catch (_) { }
            shipEl.innerHTML = `
                <div class="cart-ship__top">
                    <span class="cart-ship__ico"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i></span>
                    <div class="cart-ship__txt">
                        <h3>شحن مجاني للطلبات فوق ${sanitize(FREE_SHIPPING_THRESHOLD)} ج.م</h3>
                        <p>${d.freeShippingLeft > 0 ? `أضيفي ${sanitize(d.freeShippingLeft)} ج.م إضافية واحصلي على شحن مجاني لكافة المحافظات!` : 'مبروك! مؤهلة للشحن المجاني 🚚'}</p>
                    </div>
                    <span class="cart-ship__pct">${pct}%</span>
                </div>
                <div class="cart-ship__bar"><i style="width:${pct}%"></i></div>
                ${welcomeOk ? `<div class="cart-ship__coupon">
                    <p>خصم <b>10% إضافي</b> لكود: <code dir="ltr">WELCOME10</code></p>
                    <button type="button" onclick="app.quickApplyWelcome()">تطبيق الكود</button>
                </div>` : ''}`;
        }

        const crossEl = document.getElementById('cart-cross');
        if (crossEl) {
            const inCart = new Set(cart.map(i => i.id));
            const picks = productsDB.filter(p => !inCart.has(p.id) && p.price > 0 && p.stock > 0 && p.category !== 'مجموعات متكاملة').slice(0, 6);
            crossEl.innerHTML = picks.length ? `
                <div class="cart-cross__head"><div><h3>قد يعجبكِ أيضاً</h3><p>منتجات مختارة بعناية لإكمال روتينكِ اليومي</p></div></div>
                <div class="cart-cross__row">${picks.map(p => `
                    <div class="cart-cross__card">
                        <div class="cart-cross__img"><img src="${sanitize(p.imgThumb || p.img)}" alt="${sanitize(p.name)}" loading="lazy"></div>
                        <span class="cart-cross__cat">${sanitize(p.category)}</span>
                        <h4>${sanitize(p.name)}</h4>
                        <p class="cart-cross__price">${sanitize(p.price)} <small>ج.م</small></p>
                        <button type="button" onclick="app.addToCart('${jsArg(p.id)}')">+ أضيفي للسلة</button>
                    </div>`).join('')}</div>` : '';
        }
    }

    function updateBadge() {
        const totalItems = cart.reduce((s, i) => s + i.qty, 0);
        const b = document.getElementById('cart-badge');
        if (b) b.innerText = totalItems;
        const bBottom = document.getElementById('cart-badge-bottom');
        if (bBottom) bBottom.innerText = totalItems;

        // تحديث شارة المفضلة
        const favCount = FavoritesManager.getCount();
        const favBadge = document.getElementById('favorites-badge');
        if (favBadge) favBadge.innerText = favCount;
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
<article class="pro-product-card p-3 sm:p-4 border border-purple-100/90 shadow-purple-soft flex flex-col justify-between relative group cursor-pointer" onclick="app.navigate('product', '${jsArg(p.id)}')">
    <div class="flex items-center justify-between w-full mb-3 z-10">
        ${p.badge ? `<span class="badge-gold-shimmer text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">${sanitize(p.badge)}</span>` : `<span class="w-8"></span>`}
        <button onclick="event.stopPropagation(); FavoritesManager.toggle('${jsArg(p.id)}');" data-favorite-btn="${sanitize(p.id)}" aria-label="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}" aria-pressed="${isFav ? 'true' : 'false'}" class="favorite-btn btn-fav w-8 h-8 rounded-full bg-white/95 shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all z-20" title="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
            ${isFav
                    ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                    : `<i class="fa-regular fa-heart text-xs"></i>`
                }
        </button>
    </div>
    <div class="relative w-full aspect-square rounded-2xl bg-gradient-to-tr from-purple-50/80 to-purple-100/40 p-3 sm:p-4 mb-3.5 flex items-center justify-center overflow-hidden">
        <img src="${sanitize(p.imgThumb || p.img)}" loading="lazy" decoding="async" width="320" height="320" alt="${sanitize(p.name)}" class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-500" onerror="handleImgError(this, '${jsArg(p.img)}')">
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
                <button onclick="event.stopPropagation(); app.buyNow('${jsArg(p.id)}')" class="btn-dark py-2.5 text-xs font-bold shadow-sm">اشتري الآن</button>
                <button onclick="event.stopPropagation(); app.addToCart('${jsArg(p.id)}', 1)" class="btn-add-cart py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:gap-2 transition-all">
                    <i class="fa-solid fa-cart-plus text-xs"></i>
                    <span>أضف<span class="add-suffix"> للسلة</span></span>
                </button>
            </div>
        </div>
    </div>
</article>`;
        }).join('');

    }



    // ==========================================
    // تحميل ملفات الدفع عند الحاجة فقط (Lazy)
    // ==========================================
    // instapay.js + vodafone-cash.js + order-status.js (~45 KiB خام) كانوا
    // <script defer> بيحمّلوا مع الصفحة، ومعظم الزوار مش بيضغطوا "تأكيد الطلب"
    // أصلاً، فكانت بايتة نايمة في الشبكة. دلوقتي بنحمّلهم لحظة ما العميلة تفتح
    // صفحة السلة/الدفع (أو لحظة التأكيد كشبكة أمان)، والتلاتة بالتوازي.
    // ترتيب التحميل مش مهم لأن instapay/vodafone-cash بقوا يقرأوا حالة الطلب
    // وقت الطلب (getters) مش وقت تحميل الملف.
    const PAYMENT_SCRIPTS = ['order-status.js?v=38', 'instapay.js?v=37', 'vodafone-cash.js?v=37'];
    let __paymentScriptsPromise = null;
    function loadPaymentScripts() {
        if (__paymentScriptsPromise) return __paymentScriptsPromise;
        __paymentScriptsPromise = Promise.all(PAYMENT_SCRIPTS.map(function (src) {
            return new Promise(function (resolve) {
                if ((window.OrderStatus && src.indexOf('order-status') === 0)
                    || (window.InstaPayCheckout && src.indexOf('instapay') === 0)
                    || (window.VodafoneCashCheckout && src.indexOf('vodafone-cash') === 0)) {
                    resolve(); return;
                }
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = resolve; // لو فشل ملف، الكود القديم هيطلّع رسالة واضحة للمستخدم
                document.head.appendChild(s);
            });
        }));
        return __paymentScriptsPromise;
    }

    // ==========================================
    // 6. كود إرسال الطلب للسيرفر انتقل لملف مستقل (store-checkout.js)
    // ==========================================
    // معالج "تأكيد الطلب" كان ~400 سطر جوا analysis.js وبيتحمّل مع الصفحة
    // مع إن أغلب الزائرين بيفرجوا بس ومش بيوصلوا مرحلة الدفع. بقى chunk بيتحمّل
    // أول ما العميلة تفتح صفحة السلة، والـ bindings المشتركة معاه من هنا.
    window.ElforatStore = {
        supabase: _supabase,
        ErrorHandler: ErrorHandler,
        FavoritesManager: FavoritesManager,
        LOW_STOCK_THRESHOLD: LOW_STOCK_THRESHOLD,
        sanitize: sanitize,
        jsArg: jsArg,
        getFullImg: getFullImg,
        renderFormattedText: renderFormattedText,
        renderCart: renderCart,
        saveCart: saveCart,
        saveCoupon: saveCoupon,
        updateBadge: updateBadge,
        showCustomAlert: showCustomAlert,
        normalizeEgyptPhone: normalizeEgyptPhone,
        getCartDiscount: getCartDiscount,
        trackStoreEvent: trackStoreEvent,
        getTrafficParams: getTrafficParams,
        getVisitorSessionId: getVisitorSessionId,
        loadPaymentScripts: loadPaymentScripts,
        loadShippingRates: loadShippingRates,
        getShipping: getShipping,
        fetchProducts: fetchProducts,
        get productsDB() { return productsDB; },
        get cart() { return cart; },
        set cart(v) { cart = v; },
        get appliedCoupon() { return appliedCoupon; },
        set appliedCoupon(v) { appliedCoupon = v; }
    };

    // حارس الإرسال: لازم يفضل هنا (مش في الـ chunk) عشان لو ملف الدفعة لسه
    // بيحمّل ما يحصلش submit عادي من المتصفح (reload + ضياع بيانات العميلة).
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', function (e) {
            e.preventDefault();
            loadStoreChunk(STORE_CHUNKS.checkout).then(function () {
                if (window.ElforatCheckout) window.ElforatCheckout.handleSubmit(checkoutForm, e);
            }).catch(function (err) {
                console.error('checkout chunk failed', err);
                showCustomAlert('تعذّر تحميل بيانات الدفع. برجاء تحديث الصفحة والمحاولة مرة أخرى.', 'error');
            });
        }, true);
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
    // متأجّل بـ requestAnimationFrame (throttling) بدل ما يتنفذ في كل حدث scroll
    // مباشرة - عشان قراءة offsetHeight متتكررش عشرات المرات في الثانية وتسبب
    // Forced Reflow متكرر، وكمان passive:true عشان ميعطلش الـ scroll نفسه.
    let scrollSpyTicking = false;
    window.addEventListener('scroll', () => {
        if (scrollSpyTicking) return;
        scrollSpyTicking = true;
        requestAnimationFrame(() => {
            if (Math.ceil(window.innerHeight + window.scrollY) >= document.body.offsetHeight - 30) {
                updateNavMorph('about');
            }
            scrollSpyTicking = false;
        });
    }, { passive: true });

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
    // ==========================================
    // 8. كود العداد الذكي (مربوط بالـ IP الحقيقي من Supabase)
    // ==========================================
    // مفيش اعتماد على localStorage/cookies لتحديد أهلية كوبون الترحيب.
    // get_welcome_offer_status() يقرأ X-Forwarded-For داخل Supabase
    // ويقارن الـ IP بطلبات WELCOME10 السابقة.
    async function getOfferWindowForIP() {
        const { data, error } = await _supabase
            .rpc('get_welcome_offer_status');

        if (error) {
            console.warn('تعذر التحقق من كوبون الترحيب على السيرفر:', error.message);
            return { endTime: Date.now(), expired: true, verified: false };
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
            return { endTime: Date.now(), expired: true, verified: false };
        }

        const endTime = row.end_time != null ? Number(row.end_time) : Date.now();
        const used = row.used === true;
        const expired = used || row.expired === true || endTime <= Date.now();

        // نسخة محلية للعداد فقط كتحسين للأداء؛ القرار النهائي من السيرفر.
        try {
            const localKey = 'elforat_offer_end_server_ip';
            const localExpiredKey = 'elforat_offer_expired_server_ip';
            if (expired) {
                localStorage.setItem(localExpiredKey, '1');
                localStorage.removeItem(localKey);
            } else {
                localStorage.setItem(localKey, String(endTime));
                localStorage.removeItem(localExpiredKey);
            }
        } catch (_) {}

        return { endTime, expired, used, verified: true };
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

        let endTime = null;
        let expired = true;
        let verified = false;

        try {
            const win = await getOfferWindowForIP();
            endTime = win.endTime;
            expired = win.expired;
            verified = win.verified === true;
        } catch (e) {
            console.warn('فشل التحقق من عرض الترحيب على السيرفر:', e);
        }

        // لا نسمح بإظهار WELCOME10 اعتماداً على localStorage إذا فشل
        // التحقق من الـ IP الحقيقي على السيرفر.
        if (!verified) {
            endTime = Date.now();
            expired = true;
        }

        // كوبون الترحيب مربوط بنفس نافذة الـ 24 ساعة وبحالة الاستخدام على السيرفر.
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
                    // نعدّي صورة البراندنج على wsrv.nl برضه (زي باقي صور
                    // المنتجات) بدل ما تتحمّل بحجمها الخام من Supabase مباشرة
                    const optimizedHero = getOptimizedImg(s.hero_image_url, 900, 75);
                    document.querySelectorAll('.hero-main-image').forEach(el => {
                        if (el.getAttribute('src') === optimizedHero) return;
                        const pre = new Image();
                        pre.onload = () => { el.src = optimizedHero; }; // نبدّل بعد التحميل فقط عشان ميبقاش فيه وميض
                        pre.src = optimizedHero;
                    });
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

    // معرّف زائر دائم (localStorage) عشان نفرّق الزائر الجديد عن العائد عبر الجلسات.
    // session_id (sessionStorage) بيتغير كل جلسة، أما ده فبيفضل ثابت لنفس المتصفح.
    // ملحوظة: لو الزائر مسح بيانات المتصفح أو استخدم متصفح/وضع خصوصية تاني هيتحسب جديد.
    const VISITOR_ID_KEY = 'elforat_visitor_id';
    const VISITOR_FIRST_SEEN_KEY = 'elforat_visitor_first_seen';
    let __visitorInfo = null;
    function getVisitorInfo() {
        if (__visitorInfo) return __visitorInfo;
        const mk = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : `vis_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        let id = null, firstSeen = null, storable = true;
        try {
            id = localStorage.getItem(VISITOR_ID_KEY);
            firstSeen = localStorage.getItem(VISITOR_FIRST_SEEN_KEY);
        } catch (e) { storable = false; }
        // "عائد" = كان عنده معرّف محفوظ من قبل الجلسة دي. بنحدد ده مرة واحدة أول ما الصفحة تشتغل،
        // فباقي أحداث نفس الجلسة (حتى بعد ما نكتب المعرّف) تفضل بنفس التصنيف.
        let returning = !!id;
        if (!id) {
            id = mk();
            firstSeen = new Date().toISOString();
            try {
                localStorage.setItem(VISITOR_ID_KEY, id);
                localStorage.setItem(VISITOR_FIRST_SEEN_KEY, firstSeen);
            } catch (e) { storable = false; }
        }
        // لو التخزين ممنوع مش هنقدر نميّز → نسجّل 'unknown' بدل ما نعد كل زيارة "جديد"
        __visitorInfo = {
            id,
            firstSeen: firstSeen || null,
            type: storable ? (returning ? 'returning' : 'new') : 'unknown'
        };
        return __visitorInfo;
    }
    function getVisitorId() { return getVisitorInfo().id; }
    function isReturningVisitor() { return getVisitorInfo().type === 'returning'; }
    getVisitorInfo(); // نثبّت التصنيف بدري قبل أي حدث

    // [تعديل أداء - Forced Reflow]: getDeviceType() كانت بتقرأ window.innerWidth
    // مباشرة وقت ما بتتنادى (من trackStoreEvent/trackVisitor)، وده بيحصل بعد
    // ما الصفحة تكون عملت رندر كبير (منتجات/هيرو)، فقراءة innerWidth في اللحظة
    // دي بتجبر المتصفح يعمل reflow متزامن (forced synchronous layout) عشان
    // يحسب القياسات الجديدة. بدل كده، بنقرأ العرض مرة واحدة بدري (قبل أي DOM
    // تعديلات) ونحدّثها بس عند resize، وgetDeviceType() بقى بيقرأ من المتغير
    // المخزّن ده بدل ما يعمل قراءة تفرض reflow في نص تنفيذ السكريبت.
    let __cachedViewportWidth = window.innerWidth;
    window.addEventListener('resize', () => { __cachedViewportWidth = window.innerWidth; }, { passive: true });

    function getDeviceType() {
        const w = __cachedViewportWidth;
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
                metadata: Object.assign({}, payload.metadata || {}, {
                    visitor_id: getVisitorId(),
                    visitor_type: getVisitorInfo().type
                })
            }]);
        } catch (e) {
            console.warn('analytics event skipped:', eventName, e.message || e);
        }
    }
    window.ElforatAnalytics = { getVisitorSessionId, getVisitorId, isReturningVisitor, getTrafficParams, getDeviceType, trackStoreEvent };

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
                // visitor_id / visitor_type أعمدة اختيارية: لو مش متضافة في الجدول لسه، نعيد الإدخال من غيرها
                // بدل ما نخسر تسجيل الزيارة كله (خطأ عمود ناقص = 42703 أو PGRST204).
                const vi = getVisitorInfo();
                let { error: eventError } = await _supabase.from('visitor_events')
                    .insert([Object.assign({}, eventPayload, { visitor_id: vi.id, visitor_type: vi.type })]);
                if (eventError && (eventError.code === '42703' || eventError.code === 'PGRST204' || /visitor_(id|type)/.test(eventError.message || ''))) {
                    ({ error: eventError } = await _supabase.from('visitor_events').insert([eventPayload]));
                }
                if (!eventError) sessionStorage.setItem('elforat_visitor_event_tracked', 'true');
            }

            // [تعديل أداء]: بدل ما نجيب العدد ونزوده يدوي (read-then-write بيعمل
            // race condition لو حصلت زيارتين في نفس اللحظة)، بنستخدم دالة ذرية
            // (atomic RPC) في قاعدة البيانات بتزوّد العداد في خطوة واحدة آمنة.
            const { error } = await _supabase.rpc('increment_visitor_count', { p_session_id: getVisitorSessionId() });
            if (error) throw error;
        } catch (e) {
            console.warn('visitor tracking skipped:', e.message || e);
        }
    }

    // [تعديل أداء - LCP Render Delay]: الحاجات دي (تتبع الزيارة، جلب هوية
    // البراندنج، الهدايا، تنبيه المخزون المنخفض، عداد العرض) مالهاش تأثير على
    // أول حاجة الزائر بيشوفها (نص الهيرو)، لكن كانت بتتنفذ فورًا في نفس اللحظة
    // اللي المتصفح محتاج يرسم فيها الصفحة، فبتاخد نصيب من الـ main thread وقت
    // أهم فريم. runWhenIdle بتأجلها لحد ما المتصفح يفضى (أو أقصى مهلة كحماية)
    // عشان الرسم الأول ميتأخرش وراهم.
    function runWhenIdle(fn, timeout = 2000) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(fn, { timeout });
        } else {
            setTimeout(fn, 200);
        }
    }

    runWhenIdle(trackVisitor);
    runWhenIdle(applyStoreBranding);

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

    runWhenIdle(loadGifts);
    FavoritesManager.init(); // تهيئة نظام المفضلة
    updateBadge(); // تحديث شارة المفضلة عند التحميل
    fetchProducts().then(() => {
        hideGlobalLoader();
        syncCartWithCatalog();
        restoreViewFromHash();
        setTimeout(checkLowStock, 4000);
    }).catch(() => {
        hideGlobalLoader();
    });

    // (استعادة الصفحة عند التحديث + دعم أزرار الرجوع/التقدم: بقت مسجّلة فوق
    // في أول السكريبت عشان تشتغل مهما حصل أي خطأ في باقي الكود تحت)
    setTimeout(hideGlobalLoader, 5000);

    runWhenIdle(startCountdown);

    // تجهيز صفحة المنتج في الخلفية وقت الخمول حتى تكون الاستجابة للضغط فورية.
    runWhenIdle(() => prefetchStoreChunk(STORE_CHUNKS.product), 2500);

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
