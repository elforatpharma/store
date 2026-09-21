/**
 * ELFORAT PHARMA - Canonical Order Status + Idempotent Checkout Helper
 * =====================================================================
 * مصدر واحد لكل حاجة متعلقة بحالة الطلب و merchant_order_id، بيتحمّل قبل
 * paymob.js و instapay.js و analysis.js عشان الكل يستخدم نفس التعريف بدل
 * ما كل ملف يكتب نصوص عربية حرة لوحده (كانت السبب في تضارب الحالات).
 *
 * الأنابيب المعتمدة لحالة الطلب (status_code):
 *   pending → paid → processing → shipped → delivered   (+ cancelled)
 *
 * ملحوظة مهمة: عمود status_code هيحتاج يتضاف لجدول orders في سوبابيز
 * (شوفي ملف migration.sql). عمود status القديم (نص عربي حر) اتسيب زي ما هو
 * عشان بوت التليجرام ولوحة التحكم الحاليين بيعتمدوا عليه، وبقى بيتحسب دلوقتي
 * من مكان واحد (label) بدل ما يتكرر في 3 ملفات مختلفين.
 */
window.OrderStatus = (() => {
  const CODES = {
    PENDING: 'pending',       // الطلب اتسجل، لسه مستني تأكيد أو دفع
    PAID: 'paid',             // الدفع اتأكد (أونلاين أو تحويل InstaPay)
    PROCESSING: 'processing', // بيتجهز للشحن
    SHIPPED: 'shipped',       // خرج للشحن
    DELIVERED: 'delivered',   // اتسلم للعميل
    CANCELLED: 'cancelled',   // اتلغى
  };

  // النص العربي المعروض حسب طريقة الدفع - مكان واحد بس لتعديله مستقبلاً
  const LABELS = {
    [CODES.PENDING]: {
      cod: 'قيد التنفيذ',
      instapay: 'بانتظار تأكيد الدفع - InstaPay',
      paymob: 'بانتظار الدفع - Paymob',
    },
    [CODES.PAID]: { default: 'تم الدفع' },
    [CODES.PROCESSING]: { default: 'قيد التجهيز في الصيدلية 📦' },
    [CODES.SHIPPED]: { default: 'تم الشحن' },
    [CODES.DELIVERED]: { default: 'تم التوصيل بنجاح ✅' },
    [CODES.CANCELLED]: { default: 'ملغي' },
  };

  function label(code, method) {
    const entry = LABELS[code] || LABELS[CODES.PENDING];
    return entry[method] || entry.default || entry.cod;
  }

  // =====================================================================
  // Idempotency: merchant_order_id ثابت لكل "محاولة شراء" حتى لو حصل
  // reload أو مشكلة شبكة في نص العملية، عشان ما يتسجلش الطلب مرتين.
  // =====================================================================
  const PENDING_KEY = 'elforat_pending_merchant_id';
  const TTL_MS = 15 * 60 * 1000; // 15 دقيقة - بعدها بيتحسب attempt جديد

  function getOrCreateMerchantOrderId() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.id && (Date.now() - saved.ts) < TTL_MS) {
          return saved.id;
        }
      }
    } catch (_) { /* sessionStorage غير متاح - نكمل عادي */ }

    const id = 'elforat-' + Date.now();
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id, ts: Date.now() }));
    } catch (_) { }
    return id;
  }

  function clearPendingMerchantOrderId() {
    try { sessionStorage.removeItem(PENDING_KEY); } catch (_) { }
  }

  /**
   * يحاول إدخال الطلب، ولو السيرفر رفضه بسبب تكرار merchant_order_id
   * (نفس المحاولة اتبعتت قبل كده - مشكلة شبكة/reload)، بيجيب الطلب
   * الموجود بالفعل بدل ما يعمل نسخة تانية. لازم unique constraint على
   * عمود merchant_order_id في قاعدة البيانات (شوفي migration.sql).
   */
  async function isDuplicateOrderError(error) {
    if (!error) return false;
    const code = error.code || '';
    const msg = (error.message || '') + ' ' + (error.details || '');
    return code === '23505' || /duplicate key|already exists/i.test(msg);
  }

  async function insertOrderIdempotent(supabaseClient, orderData) {
    let { data, error } = await supabaseClient
      .from('orders')
      .insert([orderData])
      .select('id')
      .single();

    if (error && await isDuplicateOrderError(error) && orderData.merchant_order_id) {
      console.warn('الطلب ده اتسجل قبل كده بنفس merchant_order_id (محاولة متكررة) - جاري استرجاعه بدل التكرار.');
      const existing = await supabaseClient
        .from('orders')
        .select('id')
        .eq('merchant_order_id', orderData.merchant_order_id)
        .maybeSingle();
      if (existing.data) {
        return { data: existing.data, error: null, wasDuplicate: true };
      }
    }
    return { data, error, wasDuplicate: false };
  }

  return {
    CODES,
    label,
    getOrCreateMerchantOrderId,
    clearPendingMerchantOrderId,
    insertOrderIdempotent,
  };
})();
