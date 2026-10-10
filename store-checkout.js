/**
 * ELFORAT PHARMA - Checkout submit handler (lazy chunk)
 * ================================================================
 * منطق "تأكيد الطلب" (تسجيل الطلب في Supabase + تحويلة على واتساب + نوافذ
 * الدفع) كان ~400 سطر جوا analysis.js وبيتحمّلوا مع الصفحة، مع إن أغلب
 * الزائرين بيفرجوا بس ومش بيوصلوا مرحلة الدفع. بقى chunk بيتحمّل أول ما
 * العميلة تفتح صفحة السلة (loadStoreChunk) - والـ bindings المشتركة معاه
 * من analysis.js.
 *
 * حارس الإرسال (submit listener) بيفضل في analysis.js عن قصد، عشان لو الملف
 * لسه بيحمّل ما يحصلش submit عادي من المتصفح (reload + ضياع بيانات العميلة).
 */
(function () {
    var S = window.ElforatStore;
    var _supabase = S.supabase;
    var renderCart = S.renderCart;
    var saveCart = S.saveCart;
    var saveCoupon = S.saveCoupon;
    var updateBadge = S.updateBadge;
    var showCustomAlert = S.showCustomAlert;
    var normalizeEgyptPhone = S.normalizeEgyptPhone;
    var getCartDiscount = S.getCartDiscount;
    var trackStoreEvent = S.trackStoreEvent;
    var getTrafficParams = S.getTrafficParams;
    var getVisitorSessionId = S.getVisitorSessionId;
    var loadPaymentScripts = S.loadPaymentScripts;
    var loadShippingRates = S.loadShippingRates;
    var getShipping = S.getShipping;

    // رقم الطلب المعروض للعميلة: آخر 8 حروف من merchant_order_id بحروف كبيرة.
    // نفس التعريف في عمود order_ref (generated) في SQL، فبيظهر في الداشبورد ويتدوّر بيه.
    function shortOrderNo(merchantId) {
        return String(merchantId || '').slice(-8).toUpperCase();
    }
    var ErrorHandler = S.ErrorHandler;
    var app = window.app;

    // تسجيل الأخطاء في جدول error_logs على السيرفر.
    // قبل كده أي فشل في تسجيل الطلب كان بيختفي في console المتصفح بس
    // (العميلة بتيجي تاخد رسالة واتساب عادية والمتجر ميعرفش إن الطلب
    //  متسجلش في الداشبورد) - فأي عميلة بتعمل طلب ضايعة طلبها على الصمت.
    function reportCheckoutError(err, context) {
        try { console.error('[' + context + ']', err); } catch (_) { }
        try { if (ErrorHandler && ErrorHandler.logError) ErrorHandler.logError(err, context); } catch (_) { }
    }

    // نافذة نجاح خاصة بالدفع عند الاستلام: لا تفتح واتساب لأن الطلب مسجل بالفعل في الداشبورد.
    function showCashOnDeliverySuccess(orderNo) {
        const existing = document.getElementById('cod-order-success-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'cod-order-success-modal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.62);backdrop-filter:blur(5px);';

        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'cod-order-success-title');
        dialog.style.cssText = 'width:min(100%,390px);background:#fff;border-radius:24px;padding:30px 24px 24px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.24);direction:rtl;animation:codSuccessPop .22s ease-out;';

        const style = document.createElement('style');
        style.textContent = '@keyframes codSuccessPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@media(prefers-reduced-motion:reduce){#cod-order-success-modal>div{animation:none!important}}';
        overlay.appendChild(style);

        const icon = document.createElement('div');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '✓';
        icon.style.cssText = 'display:flex;align-items:center;justify-content:center;width:76px;height:76px;margin:0 auto 18px;border-radius:50%;background:#dcfce7;border:3px solid #22c55e;color:#15803d;font-size:46px;font-weight:900;line-height:1;box-shadow:0 0 0 8px #f0fdf4;';
        dialog.appendChild(icon);

        const title = document.createElement('h2');
        title.id = 'cod-order-success-title';
        title.textContent = 'تم استلام طلبك بنجاح';
        title.style.cssText = 'margin:0 0 10px;color:#0f172a;font-size:22px;font-weight:900;line-height:1.5;';
        dialog.appendChild(title);

        const description = document.createElement('p');
        description.textContent = 'شكراً لثقتك في الفرات فارما. تم تسجيل طلبك وسيظهر لفريقنا لتجهيزه.';
        description.style.cssText = 'margin:0;color:#64748b;font-size:14px;line-height:1.9;';
        dialog.appendChild(description);

        if (orderNo) {
            const number = document.createElement('p');
            number.textContent = 'رقم الطلب: #' + orderNo;
            number.style.cssText = 'margin:14px 0 0;padding:10px 12px;border-radius:12px;background:#f8fafc;color:#334155;font-size:14px;font-weight:800;';
            dialog.appendChild(number);
        }

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'متابعة التسوق';
        closeButton.style.cssText = 'display:block;width:100%;margin-top:22px;padding:13px 18px;border:0;border-radius:14px;background:#15803d;color:#fff;font-size:15px;font-weight:800;cursor:pointer;';
        dialog.appendChild(closeButton);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const onKeyDown = (event) => {
            if (event.key === 'Escape' && document.getElementById('cod-order-success-modal') === overlay) close();
        };
        const close = () => {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
            if (app && typeof app.navigate === 'function') app.navigate('home');
        };
        closeButton.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });
        document.addEventListener('keydown', onKeyDown);
        closeButton.focus({ preventScroll: true });
    }

    async function handleSubmit(checkoutForm, e) {
            e.preventDefault();

            const submitBtn = checkoutForm.querySelector('button[type="submit"]');
            // حارس متزامن: يمنع ضغطتين/حدثي submit قبل اكتمال أول طلب.
            if (!submitBtn || submitBtn.disabled) return;
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'جاري تسجيل طلبك...';
            submitBtn.disabled = true;

            // مفيش نت = مفيش طلب: منبدأش أي حاجة ولا نمسح السلة
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                showCustomAlert('مفيش اتصال بالإنترنت، لم يتم تسجيل طلبك. سلتك محفوظة، حاولي مرة أخرى بعد رجوع الاتصال.', 'error');
                return;
            }

            // ملفات الدفع بتتحمّل مع أول فتح لصفحة السلة، بس لو العميلة فتحت
            // السلة ريفيتش أو ضغطت تأكيد بسرعة بنستناها هنا قبل ما نقرأ منها.
            await loadPaymentScripts();
            await loadShippingRates();

            const nameEl = document.getElementById('cust-name');
            const phoneEl = document.getElementById('cust-phone');
            const addressEl = document.getElementById('cust-address');
            const paymentEl = document.getElementById('cust-payment');
            const governorateEl = document.getElementById('cust-governorate');

            if (!nameEl || !phoneEl || !addressEl || !paymentEl || !governorateEl) {
                showCustomAlert('يوجد خطأ في النموذج. يرجى التأكد من الحقول.', 'error');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            const name = nameEl.value.trim();
            const phone = normalizeEgyptPhone(phoneEl.value);
            const address = addressEl.value.trim();
            const payment = paymentEl.value;
            const governorate = governorateEl.value;

            // [حماية من السبام]: فحص حقل المصيدة (Honeypot) - إذا تم ملؤه فهو روبوت سبام
            const honeypotEl = document.getElementById('cust-fax-verify');
            if (honeypotEl && honeypotEl.value.trim() !== '') {
                console.warn('تم حظر محاولة إرسال روبوتية عبر Honeypot');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }


            if (S.cart.length === 0) {
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

            // بيانات التوصيل: حد أدنى بسيط يمنع طلبات مش بتتوصل (اسم وعنوان ناقصين)
            const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;
            if (name.length < 5 || wordCount(name) < 2 || /^[\d\s+\-]+$/.test(name)) {
                showCustomAlert('برجاء كتابة الاسم بالكامل (الاسم الأول واسم العائلة).', 'error');
                nameEl.focus();
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            if (!governorate) {
                showCustomAlert('اختاري المحافظة عشان نوصّل الطلب.', 'error');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            if (address.length < 15 || wordCount(address) < 3) {
                showCustomAlert('برجاء كتابة العنوان بالتفصيل (المنطقة واسم الشارع ورقم المبنى أو أقرب علامة مميزة).', 'error');
                addressEl.focus();
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            // كوبون الترحيب انتهت زيارته الأولى → نشيله ونوقف الطلب عشان العميلة تشوف السعر الحقيقي
            if (S.appliedCoupon && window.WelcomeOffer && !window.WelcomeOffer.guard(S.appliedCoupon.code).ok) {
                S.appliedCoupon = null;
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
            const isVodafoneCash = payment === 'vodafone_cash';
            let instapayConfig = null;
            let vodafoneCashConfig = null;
            if (isInstapay) {
                try {
                    if (!window.InstaPayCheckout) throw new Error('ملف الدفع عبر InstaPay (instapay.js) غير محمل.');
                    submitBtn.innerText = 'جاري تجهيز بيانات التحويل...';
                    instapayConfig = await window.InstaPayCheckout.loadConfig(_supabase);
                } catch (ipErr) {
                    trackStoreEvent('payment_failed', { metadata: { provider: 'instapay', reason: 'config_unavailable', error: String(ipErr && ipErr.message || ipErr).slice(0, 200) } });
                    showCustomAlert(ipErr.message || 'الدفع عبر InstaPay غير متاح حاليًا.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }
            } else if (isVodafoneCash) {
                try {
                    if (!window.VodafoneCashCheckout) throw new Error('ملف الدفع عبر فودافون كاش (vodafone-cash.js) غير محمل.');
                    submitBtn.innerText = 'جاري تجهيز بيانات التحويل...';
                    vodafoneCashConfig = await window.VodafoneCashCheckout.loadConfig(_supabase);
                } catch (vcErr) {
                    trackStoreEvent('payment_failed', { metadata: { provider: 'vodafone_cash', reason: 'config_unavailable', error: String(vcErr && vcErr.message || vcErr).slice(0, 200) } });
                    showCustomAlert(vcErr.message || 'الدفع عبر فودافون كاش غير متاح حاليًا.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }
            }
            // الحالة والكود بييجوا من المصدر الموحّد (order-status.js) بدل نصوص متفرقة
            const orderStatusCode = window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending';
            const orderStatus = isInstapay
                ? window.InstaPayCheckout.ORDER_STATUS
                : isVodafoneCash
                    ? window.VodafoneCashCheckout.ORDER_STATUS
                    : (window.OrderStatus ? window.OrderStatus.label(orderStatusCode, 'cod') : 'قيد التنفيذ');
            let instapayOrderNo = null;
            let orderWasSaved = false;

            // [أمان] localStorage مش مصدر ثقة: السعر والاسم بيتجابوا من قاعدة البيانات دايماً،
            // ولو ماقدرناش نتحقق (خطأ شبكة) الطلب بيقف بدل ما نكمل بسعر السلة المحفوظ في المتصفح.
            const isRealGift = (i) => !!(i && i.isGift && String(i.id == null ? '' : i.id).indexOf('gift_') === 0);
            const abortCheckout = (msg) => {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                showCustomAlert(msg, 'error');
            };
            const dbPriceMap = new Map();
            const dbNameMap = new Map();
            const realIds = S.cart.filter(i => !isRealGift(i) && i.id != null).map(i => i.id);
            if (realIds.length) {
                let verifiedProducts = null, pErr = null;
                try {
                    const r = await _supabase.from('products').select('id, name, price').in('id', realIds);
                    verifiedProducts = r.data; pErr = r.error;
                } catch (e) { pErr = e; }
                if (pErr || !Array.isArray(verifiedProducts)) {
                    reportCheckoutError(new Error('price verification failed: ' + String(pErr && pErr.message || pErr)), 'checkout:verify_prices');
                    abortCheckout('تعذر التحقق من الأسعار الآن، لم يتم تسجيل طلبك. سلتك محفوظة، حاولي مرة أخرى.');
                    return;
                }
                verifiedProducts.forEach(p => {
                    if (p && p.id != null) {
                        dbPriceMap.set(String(p.id), Number(p.price) || 0);
                        dbNameMap.set(String(p.id), String(p.name || ''));
                    }
                });
                const missing = S.cart.filter(i => !isRealGift(i) && !dbPriceMap.has(String(i.id)));
                if (missing.length) {
                    const names = missing.map(i => i.name).join('، ');
                    S.cart = S.cart.filter(i => isRealGift(i) || dbPriceMap.has(String(i.id)));
                    saveCart();
                    renderCart();
                    abortCheckout('منتجات مبقتش متاحة وتم حذفها من السلة: ' + names + '. راجعي السلة وأكدي الطلب تاني.');
                    return;
                }
            }

            let subtotal = 0;
            let shownSubtotal = 0; // اللي كان ظاهر للعميلة (من السلة المحفوظة) - للمقارنة بس
            const orderItems = [];

            S.cart.forEach(item => {
                const gift = isRealGift(item);
                const qty = Math.max(1, Math.min(parseInt(item.qty) || 1, 99));
                const verifiedPrice = gift ? 0 : dbPriceMap.get(String(item.id));
                subtotal += verifiedPrice * qty;
                if (!gift) shownSubtotal += (Number(item.price) || 0) * qty;
                orderItems.push({
                    id: item.id,
                    name: gift ? String(item.name || '').slice(0, 120) : dbNameMap.get(String(item.id)),
                    qty: qty,
                    price: verifiedPrice,
                    isGift: gift
                });
            });

            // السعر الحقيقي اختلف عن اللي كانت شايفاه: منكملش الطلب بسعر مفاجئ
            if (Math.abs(shownSubtotal - subtotal) > 0.001) {
                S.cart.forEach(i => { if (!isRealGift(i)) i.price = dbPriceMap.get(String(i.id)); });
                saveCart();
                renderCart();
                abortCheckout('أسعار بعض المنتجات اتحدّثت. راجعي الإجمالي الجديد وأكدي الطلب.');
                return;
            }

            // ===== التحقق من الكوبون مباشرة من قاعدة البيانات =====
            // نسبة الخصم المحفوظة في localStorage للعرض بس. هنا بنقرا من السيرفر،
            // ولو الكوبون مبقاش صالح أو ماقدرناش نتحقق، الطلب بيقف (مفيش خصم من نسخة محلية).
            let verifiedDiscountAmount = 0;
            let verifiedCouponCode = null;
            if (S.appliedCoupon && S.appliedCoupon.code) {
                let dbCoupon = null, cErr = null;
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const r = await _supabase
                        .from('coupons')
                        .select('code, discount_percentage, min_amount, max_uses, used_count')
                        .eq('code', String(S.appliedCoupon.code).trim())
                        .eq('is_active', true)
                        .gte('expiry_date', today)
                        .maybeSingle();
                    dbCoupon = r.data; cErr = r.error;
                } catch (e) { cErr = e; }
                if (cErr) {
                    reportCheckoutError(new Error('coupon verification failed: ' + String(cErr && cErr.message || cErr)), 'checkout:verify_coupon');
                    abortCheckout('تعذر التحقق من الكوبون الآن، لم يتم تسجيل طلبك. سلتك محفوظة، حاولي مرة أخرى.');
                    return;
                }
                const pct = dbCoupon ? Number(dbCoupon.discount_percentage) : 0;
                const usesOk = dbCoupon && ((dbCoupon.max_uses == null) || (Number(dbCoupon.used_count) || 0) < Number(dbCoupon.max_uses));
                const minAmountOk = dbCoupon && subtotal >= (Number(dbCoupon.min_amount) || 0);
                if (dbCoupon && pct > 0 && usesOk && minAmountOk) {
                    verifiedCouponCode = dbCoupon.code;
                    verifiedDiscountAmount = Math.round(((subtotal * pct) / 100) * 100) / 100;
                } else {
                    S.appliedCoupon = null;
                    saveCoupon();
                    renderCart();
                    abortCheckout('الكوبون لم يعد صالحاً وتم إلغاؤه. راجعي الإجمالي وأكدي الطلب تاني.');
                    return;
                }
            }

            const discountAmount = verifiedDiscountAmount;
            const couponCode = verifiedCouponCode;

            // الشحن: السعر من جدول shipping_rates، ومجاني لو الإجمالي الفرعي وصل لحد الشحن المجاني
            const shipping = getShipping(subtotal, governorate);
            if (!shipping.ok) {
                showCustomAlert(
                    shipping.reason === 'unavailable'
                        ? 'عفواً، الشحن لهذه المحافظة غير متاح حالياً. تواصلي معنا على واتساب.'
                        : 'تعذر تحميل أسعار الشحن، برجاء إعادة المحاولة.',
                    'error'
                );
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }
            const shippingFee = shipping.fee;
            const finalTotal = Math.round((Math.max(subtotal - discountAmount, 0) + shippingFee) * 100) / 100;
            // المحافظة بتتكتب في أول العنوان كمان عشان تظهر في الداشبورد وإشعار تليجرام
            // (اللي بيقروا عمود address بس) حتى قبل ما يتعدّلوا يعرضوا عمود governorate.
            const fullAddress = governorate + ' - ' + address;
            const traffic = getTrafficParams();

            try {
                trackStoreEvent('checkout_started', {
                    coupon_code: couponCode,
                    cart_total: finalTotal,
                    metadata: { payment, items_count: orderItems.length }
                });
                const paymentLabel = isInstapay
                    ? window.InstaPayCheckout.PAYMENT_LABEL
                    : isVodafoneCash
                        ? window.VodafoneCashCheckout.PAYMENT_LABEL
                        : payment;
                // merchant_order_id ثابت لنفس محاولة الشراء (حتى لو حصل reload/مشكلة شبكة)
                // بدل توليد رقم جديد كل submit، عشان الحماية من تكرار الطلب تبقى فعلية
                const cartFingerprint = [phone, finalTotal, orderItems.map(i => (i.id ?? i.name) + 'x' + (i.qty ?? 1)).join(',')].join('|');
                const merchantId = window.OrderStatus
                    ? window.OrderStatus.getOrCreateMerchantOrderId(cartFingerprint)
                    : ('elforat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
                const orderData = {
                    customerName: name,
                    phone: phone,
                    address: fullAddress,
                    governorate: governorate,
                    shipping_fee: shippingFee,
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
                    : (data) => _supabase.from('orders').insert([data])
                        .then(r => ({ data: r.error ? null : { id: null }, error: r.error }));

                const { data: insertedOrder, error: orderError } = await insertOnce(orderData);
                let orderSaved = !!(insertedOrder && !orderError);

                if (!orderError && insertedOrder) {
                    orderData.id = insertedOrder.id;
                    trackStoreEvent('order_created', { coupon_code: couponCode, cart_total: finalTotal, metadata: { payment, items_count: orderItems.length } });
                } else if (orderError && /WELCOME10_ALREADY_USED/.test(orderError.message || '')) {
                    // السيرفر رفض الطلب: كوبون الترحيب استُخدم قبل كده بنفس رقم الهاتف.
                    // مفيش fallback هنا (كان هيسجّل الطلب بالخصم من غير كود الكوبون).
                    window.WelcomeOffer?.expire('already_used');
                    S.appliedCoupon = null;
                    saveCoupon();
                    renderCart();
                    showCustomAlert('كوبون الترحيب WELCOME10 استُخدم قبل كده بنفس رقم الهاتف، تم إلغاؤه. راجعي الإجمالي وأكملي الطلب.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                } else if (orderError && /ORDER_(RATE_LIMITED|BLOCKED|INVALID_DATA)/.test(orderError.message || '')) {
                    // رفض من طبقة منع السبام على السيرفر (05_spam_protection.sql). مفيش محاولة تانية بحد أدنى
                    // (هتترفض برضه)، والسلة بتفضل زي ما هي. الرسالة عامة عن قصد (مش بنقول أنهي حد اتجاوز).
                    const spamReason = /RATE_LIMITED/.test(orderError.message) ? 'rate_limited'
                        : /BLOCKED/.test(orderError.message) ? 'blocked' : 'invalid_data';
                    trackStoreEvent('checkout_failed', {
                        coupon_code: couponCode,
                        cart_total: finalTotal,
                        metadata: { payment, items_count: orderItems.length, reason: spamReason }
                    });
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    showCustomAlert(
                        spamReason === 'rate_limited'
                            ? 'تم إرسال عدد كبير من الطلبات من نفس الرقم أو الجهاز في وقت قصير. برجاء المحاولة بعد ساعة أو التواصل معنا على واتساب.'
                            : spamReason === 'blocked'
                                ? 'تعذر إتمام الطلب حالياً. برجاء التواصل معنا على واتساب.'
                                : 'راجعي بيانات الاسم والعنوان ورقم الهاتف وأعيدي المحاولة.',
                        'error'
                    );
                    return;
                } else if (orderError && /ORDER_OUT_OF_STOCK/.test(orderError.message || '')) {
                    // السيرفر رفض الطلب لأن كمية منتج مبقتش متاحة (عميلة تانية اشترت آخر قطعة في نفس الوقت).
                    // الـ trigger على السيرفر هو اللي بيقرر (atomic)، هنا بنحدّث المخزون والسلة بس.
                    trackStoreEvent('checkout_failed', {
                        coupon_code: couponCode,
                        cart_total: finalTotal,
                        metadata: { payment, items_count: orderItems.length, reason: 'out_of_stock' }
                    });
                    window.OrderStatus?.clearPendingMerchantOrderId?.();
                    try { if (S.fetchProducts) await S.fetchProducts(); } catch (_) { }
                    const lacking = [];
                    S.cart = S.cart.filter(function (ci) {
                        if (ci.isGift) return true;
                        const live = (S.productsDB || []).find(function (p) { return String(p.id) === String(ci.id); });
                        if (!live) return true;
                        if (live.stock <= 0) { lacking.push(ci.name + ' (نفذ)'); return false; }
                        if (ci.qty > live.stock) { lacking.push(ci.name + ' (المتاح ' + live.stock + ')'); ci.qty = live.stock; }
                        return true;
                    });
                    saveCart();
                    renderCart();
                    showCustomAlert('للأسف الكمية دي مبقتش متاحة' + (lacking.length ? ': ' + lacking.join('، ') : '') + '. اتعدّلت السلة، راجعيها وأكدي الطلب تاني.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                } else if (orderError && /ORDER_(TOTAL_MISMATCH|INVALID_COUPON|BAD_GOVERNORATE|UNKNOWN_PRODUCT|PRODUCT_INACTIVE|INVALID_ITEMS|INVALID_GIFT)/.test(orderError.message || '')) {
                    // السيرفر رفض الطلب لأن الأسعار/الشحن/الكوبون اتغيروا عن اللي كان ظاهر للعميلة.
                    // مفيش محاولة بحد أدنى هنا (هتترفض برضه) - بنحدّث السلة ونوقف.
                    reportCheckoutError(new Error('order rejected by server: ' + orderError.message), 'checkout:order_rejected');
                    trackStoreEvent('checkout_failed', {
                        coupon_code: couponCode,
                        cart_total: finalTotal,
                        metadata: { payment, items_count: orderItems.length, reason: 'server_rejected' }
                    });
                    if (/ORDER_INVALID_COUPON/.test(orderError.message || '')) {
                        S.appliedCoupon = null;
                        saveCoupon();
                    }
                    renderCart();
                    showCustomAlert(/ORDER_PRODUCT_INACTIVE/.test(orderError.message || '')
                        ? 'أحد المنتجات لم يعد متاحًا للطلب، لم يتم تسجيل الطلب. احذفي المنتج أو اختاري منتجًا آخر.'
                        : /ORDER_TOTAL_MISMATCH/.test(orderError.message || '')
                            ? 'تغيّر سعر منتج أو رسوم الشحن أو قيمة الخصم أثناء إتمام الطلب. لم يتم تسجيل الطلب؛ راجعي الإجمالي الحالي وأكدي مرة أخرى.'
                            : 'الكوبون أو بيانات المنتجات أو الشحن لم تعد صالحة. لم يتم تسجيل الطلب؛ راجعي السلة وأكدي مرة أخرى.', 'error');
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                } else if (orderError) {
                    // console.error (مش warn): غالباً عمود ناقص (status_code..) أو صلاحيات RLS - الطلب هيتسجل ناقص بيانات
                    console.error('فشل إدخال الطلب بالحقول الكاملة، جاري المحاولة بالحد الأدنى:', orderError.code, orderError.message);
                    // وبيتسجل على السيرفر كمان - غير كده الطلب بيضيع على الصمت
                    // (العميلة بتاخد واتساب عادي والمتجر مش شايف حاجة في الداشبورد)
                    reportCheckoutError(
                        new Error('insert orders failed: ' + (orderError.code || '') + ' ' + (orderError.message || '') + ' | ' + (orderError.details || '')),
                        'checkout:insert_orders_full'
                    );
                    const minimalData = {
                        customerName: name,
                        phone: phone,
                        address: fullAddress,
                        governorate: governorate,
                        shipping_fee: shippingFee,
                        total: finalTotal,
                        status: orderStatus,
                        // بنحافظ على merchant_order_id حتى في أقل نسخة من الطلب عشان
                        // الحماية من التكرار تفضل شغالة لو النسخة الكاملة فشلت
                        merchant_order_id: merchantId,
                        date: new Date().toLocaleString('ar-EG'),
                        items: orderItems
                    };
                    const { data: minOrder, error: minError } = await insertOnce(minimalData);
                    if (!minError && minOrder) { orderData.id = minOrder.id; orderSaved = true; }
                    else {
                        console.error('فشل إدخال الطلب نهائياً:', minError);
                        reportCheckoutError(
                            new Error('insert orders (minimal) failed: ' + ((minError && minError.code) || '') + ' ' + ((minError && minError.message) || '') + ' | ' + ((minError && minError.details) || '')),
                            'checkout:insert_orders_minimal'
                        );
                    }
                }

                // العميلة على واتساب بس الطلب مش في الداشبورد = طلب ضايع.
                // بنسجله على السيرفر عشان يبان في error_logs.
                if (!orderSaved) {
                    trackStoreEvent('checkout_failed', {
                        coupon_code: couponCode,
                        cart_total: finalTotal,
                        metadata: { payment, items_count: orderItems.length, reason: 'order_not_saved' }
                    });
                }

                // مفيش نجاح قبل ما السيرفر يأكد الـ INSERT: لو الطلب مش متسجل (أي طريقة دفع)
                // منوقف هنا - مفيش popup دفع، ولا واتساب، ولا رسالة نجاح، والسلة بتفضل زي ما هي.
                // merchant_order_id بيفضل محفوظ فإعادة المحاولة idempotent (مفيش طلب مكرر).
                if (!orderSaved) {
                    if (isInstapay || isVodafoneCash) {
                        trackStoreEvent('payment_failed', {
                            coupon_code: couponCode,
                            cart_total: finalTotal,
                            metadata: { provider: isInstapay ? 'instapay' : 'vodafone_cash', reason: 'order_not_saved' }
                        });
                    }
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    showCustomAlert(
                        (isInstapay || isVodafoneCash)
                            ? 'تعذر تسجيل طلبك الآن، ولم يتم خصم أي مبلغ. برجاء المحاولة مرة أخرى أو التواصل معنا على واتساب.'
                            : 'تعذر تسجيل طلبك الآن ولم يتم إرسال أي شيء. سلتك محفوظة، برجاء المحاولة مرة أخرى أو التواصل معنا على واتساب.',
                        'error'
                    );
                    return;
                }

                // رقم الطلب المعروض للعميل في رسالة InstaPay / فودافون كاش
                instapayOrderNo = shortOrderNo(merchantId);
                orderWasSaved = orderSaved;

                // كوبون الترحيب: أول طلب ناجح بيه = يتلغي فوراً
                if (couponCode && orderSaved && window.WelcomeOffer
                    && String(couponCode).toUpperCase() === window.WelcomeOffer.code) {
                    window.WelcomeOffer.markUsed();
                }

                // عداد استخدام الكوبون بيزيد في السيرفر جوه trigger الطلب نفسه
                // (orders_validate_totals)، فمفيش rpc من المتصفح هنا.

                // ملحوظة: إشعار تيليجرام بقى بيتبعت تلقائيًا من Supabase نفسها
                // (Database Webhook على INSERT في جدول orders) بدل ما يتبعت من هنا.
                // ده أأمن لأنه مش محتاج أي سر يتحط في كود الموقع العام، وأضمن لأنه
                // بيشتغل حتى لو المتصفح قفل الصفحة فورًا بعد إتمام الطلب.
            } catch (err) {
                reportCheckoutError(err, 'checkout:insert_order');
                if (isInstapay || isVodafoneCash) {
                    trackStoreEvent('payment_failed', { metadata: { provider: isInstapay ? 'instapay' : 'vodafone_cash', reason: 'exception', error: String(err && err.message || err).slice(0, 200) } });
                } else {
                    trackStoreEvent('checkout_failed', { metadata: { payment, reason: 'exception', error: String(err && err.message || err).slice(0, 200) } });
                }
                // قبل كده COD كان بيكمل لواتساب ويمسح السلة حتى لو الطلب ما اتسجلش
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                showCustomAlert('تعذر تسجيل طلبك الآن، لم يتم إرسال أي شيء وسلتك محفوظة. برجاء المحاولة مرة أخرى أو التواصل معنا على واتساب.', 'error');
                return;
            }

            if (isInstapay) {
                const paidTotal = finalTotal;
                window.OrderStatus?.clearPendingMerchantOrderId?.();
                S.cart = [];
                saveCart();
                S.appliedCoupon = null;
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

            if (isVodafoneCash) {
                const paidTotal = finalTotal;
                window.OrderStatus?.clearPendingMerchantOrderId?.();
                S.cart = [];
                saveCart();
                S.appliedCoupon = null;
                saveCoupon();
                updateBadge();
                checkoutForm.reset();
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;

                trackStoreEvent('payment_started', {
                    coupon_code: couponCode,
                    cart_total: paidTotal,
                    metadata: { provider: 'vodafone_cash' }
                });

                window.VodafoneCashCheckout.showPopup({
                    orderNo: instapayOrderNo,
                    total: paidTotal,
                    config: vodafoneCashConfig,
                    onClose: () => app.navigate('home')
                });
                return;
            }

            // الدفع عند الاستلام: الطلب محفوظ بالفعل في orders، فلا حاجة لتحويل العميل إلى واتساب.
            if (payment === 'الدفع عند الاستلام') {
                window.OrderStatus?.clearPendingMerchantOrderId?.();
                S.cart = [];
                saveCart();
                S.appliedCoupon = null;
                saveCoupon();
                updateBadge();
                checkoutForm.reset();
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                showCashOnDeliverySuccess(orderWasSaved && instapayOrderNo ? instapayOrderNo : '');
                return;
            }

            let message = `*طلب جديد من موقع Elforat Pharma* 🛍️\n\n`;
            if (orderWasSaved && instapayOrderNo) message += `🔖 *رقم الطلب:* #${instapayOrderNo}\n`;
            message += `👤 *اسم العميل:* ${name}\n`;
            message += `📞 *رقم الهاتف:* ${phone}\n`;
            message += `📍 *المحافظة:* ${governorate}\n`;
            message += `🏠 *العنوان:* ${address}\n`;
            message += `💳 *طريقة الدفع:* ${payment}\n\n`;
            message += `*المنتجات المطلوبة:*\n`;

            orderItems.forEach(item => {
                const itemTotal = item.price * item.qty;
                const priceText = item.isGift ? 'مجاناً 🎁' : `${itemTotal} ج.م`;
                message += `▫️ ${item.name} (الكمية: ${item.qty}) = ${priceText}\n`;
            });

            message += `\n🧾 *الإجمالي الفرعي:* ${subtotal} ج.م\n`;
            if (discountAmount > 0) {
                message += `🏷️ *خصم كود (${couponCode}):* -${discountAmount} ج.م\n`;
            }
            message += `🚚 *الشحن:* ${shipping.later ? 'يُحسب لاحقاً حسب شركة الشحن' : (shippingFee > 0 ? shippingFee + ' ج.م' : 'مجاني')}\n`;
            message += `💰 *الإجمالي المطلوب:* ${finalTotal} ج.م${shipping.later ? ' (غير شامل الشحن)' : ''}\n`;
            message += `\nشكراً لاختيارك الفرات فارما! 🌺`;

            window.OrderStatus?.clearPendingMerchantOrderId?.();
            S.cart = [];
            saveCart(); // [جديد] مسح المنتجات من التخزين بعد إرسال الطلب بنجاح
            S.appliedCoupon = null;
            saveCoupon(); // مسح الكوبون بعد إتمام الطلب بنجاح
// صوت التنبيه مخصص للوحة التحكم فقط
            updateBadge();
            checkoutForm.reset();

            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;

            // رقم الطلب على الشاشة (مش بس في رسالة واتساب) عشان العميلة تلاقيه حتى لو واتساب ما اتفتحش
            if (orderWasSaved && instapayOrderNo) {
                showCustomAlert('تم تسجيل طلبك رقم #' + instapayOrderNo + ' ✅ برجاء الاحتفاظ بالرقم.', 'success');
            }
            const encodedMessage = encodeURIComponent(message);
            const whatsappNumber = "201146809133";

            window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');

            setTimeout(() => {
                app.navigate('home');
            }, 1000);
    }

    window.ElforatCheckout = { handleSubmit: handleSubmit };
})();
