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
    var app = window.app;

    async function handleSubmit(checkoutForm, e) {
            e.preventDefault();

            const submitBtn = checkoutForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'جاري تحويلك للواتساب...';
            submitBtn.disabled = true;

            // ملفات الدفع بتتحمّل مع أول فتح لصفحة السلة، بس لو العميلة فتحت
            // السلة ريفيتش أو ضغطت تأكيد بسرعة بنستناها هنا قبل ما نقرأ منها.
            await loadPaymentScripts();

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

            // [تحديث أمان]: إعادة جلب الأسعار الحقيقية من قاعدة البيانات والتحقق من الكوبون
            // لمنع أي تلاعب محتمل في localStorage أو أدوات المطور (DevTools)
            const dbPriceMap = new Map();
            if (Array.isArray(S.productsDB)) {
                S.productsDB.forEach(p => {
                    if (p && p.id != null) dbPriceMap.set(String(p.id), Number(p.price) || 0);
                });
            }

            try {
                const itemIds = S.cart.filter(i => !i.isGift && i.id).map(i => i.id);
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
                console.warn('تعذر جلب الأسعار الحية، الاعتماد على S.productsDB الموثوقة:', pFetchErr);
            }

            let subtotal = 0;
            const orderItems = [];

            S.cart.forEach(item => {
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
            if (S.appliedCoupon && S.appliedCoupon.code) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const { data: dbCoupon } = await _supabase
                        .from('coupons')
                        .select('code, discount_percentage, min_amount, max_uses, used_count')
                        .eq('code', String(S.appliedCoupon.code).trim())
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
                    verifiedCouponCode = S.appliedCoupon.code;
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
                } else if (orderError) {
                    // console.error (مش warn): غالباً عمود ناقص (status_code..) أو صلاحيات RLS - الطلب هيتسجل ناقص بيانات
                    console.error('فشل إدخال الطلب بالحقول الكاملة، جاري المحاولة بالحد الأدنى:', orderError.code, orderError.message);
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
                    if (!minError && minOrder) { orderData.id = minOrder.id; orderSaved = true; }
                    else console.error('فشل إدخال الطلب نهائياً:', minError);
                }

                // الدفع الإلكتروني: ممنوع نفتح popup الدفع لو الطلب مش متسجل (العميل كان هيدفع على رقم طلب مش موجود)
                if (!orderSaved && (isInstapay || isVodafoneCash)) {
                    trackStoreEvent('payment_failed', {
                        coupon_code: couponCode,
                        cart_total: finalTotal,
                        metadata: { provider: isInstapay ? 'instapay' : 'vodafone_cash', reason: 'order_not_saved' }
                    });
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    showCustomAlert('تعذر تسجيل طلبك الآن، ولم يتم خصم أي مبلغ. برجاء المحاولة مرة أخرى أو التواصل معنا على واتساب.', 'error');
                    return;
                }

                // رقم الطلب المعروض للعميل في رسالة InstaPay / فودافون كاش
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
                if (isInstapay || isVodafoneCash) {
                    trackStoreEvent('payment_failed', { metadata: { provider: isInstapay ? 'instapay' : 'vodafone_cash', reason: 'exception', error: String(err && err.message || err).slice(0, 200) } });
                }
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

            let message = `*طلب جديد من موقع Elforat Pharma* 🛍️\n\n`;
            message += `👤 *اسم العميل:* ${name}\n`;
            message += `📞 *رقم الهاتف:* ${phone}\n`;
            message += `📍 *العنوان:* ${address}\n`;
            message += `💳 *طريقة الدفع:* ${payment}\n\n`;
            message += `*المنتجات المطلوبة:*\n`;

            S.cart.forEach(item => {
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
            S.cart = [];
            saveCart(); // [جديد] مسح المنتجات من التخزين بعد إرسال الطلب بنجاح
            S.appliedCoupon = null;
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
    }

    window.ElforatCheckout = { handleSubmit: handleSubmit };
})();
