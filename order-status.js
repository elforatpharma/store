/**
 * ELFORAT PHARMA - Canonical Order Status + Idempotent Checkout Helper
 * =====================================================================
 * مصدر واحد لكل حاجة متعلقة بحالة الطلب و merchant_order_id، بيتحمّل قبل
 * instapay.js و analysis.js عشان الكل يستخدم نفس التعريف بدل
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
      vodafone_cash: 'بانتظار تأكيد الدفع - فودافون كاش',
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

  function newId() {
    try { if (crypto && crypto.randomUUID) return 'elforat-' + crypto.randomUUID(); } catch (_) { }
    return 'elforat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // fingerprint (اختياري): بصمة محتوى الطلب (تليفون + إجمالي + منتجات). لو السلة اتغيرت
  // بين محاولتين، بيتولّد رقم جديد بدل ما نرجّع طلب قديم بمحتوى مختلف.
  function getOrCreateMerchantOrderId(fingerprint) {
    const fp = fingerprint == null ? '' : String(fingerprint);
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.id && (Date.now() - saved.ts) < TTL_MS && (saved.fp || '') === fp) {
          return saved.id;
        }
      }
    } catch (_) { /* sessionStorage غير متاح - نكمل عادي */ }

    const id = newId();
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id, ts: Date.now(), fp }));
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
    // الطلبات العامة تُنشأ من المتجر مباشرة عبر INSERT واحد فقط.
    // RLS يسمح للـanon بـINSERT فقط على orders، بينما SELECT/UPDATE/DELETE
    // ممنوعة عليه. كده العميل يقدر ينشئ الطلب، لكنه لا يستطيع قراءة أو
    // تعديل أو حذف طلبات العملاء الآخرين.
    //
    // مهم: لا نستخدم .select() هنا، لأن RETURNING يحتاج SELECT policy
    // وقد يحوّل الطلب الناجح إلى permission denied. نجاح العملية يعتمد
    // على عدم وجود error من INSERT نفسه.
    const { error } = await supabaseClient
      .from('orders')
      .insert([orderData]);

    if (!error) {
      return {
        data: { id: null },
        error: null,
        wasDuplicate: false
      };
    }

    if (await isDuplicateOrderError(error) && orderData.merchant_order_id) {
      // نفس merchant_order_id يعني أن محاولة الشراء نفسها وصلت للسيرفر بالفعل.
      // لا نعمل نسخة ثانية، ونعتبرها نجاحاً من ناحية الـcheckout.
      console.warn('الطلب ده اتسجل قبل كده بنفس merchant_order_id - مش هنضيف نسخة تانية.');
      return { data: { id: null }, error: null, wasDuplicate: true };
    }

    return { data: null, error, wasDuplicate: false };
  }

  return {
    CODES,
    label,
    getOrCreateMerchantOrderId,
    clearPendingMerchantOrderId,
    insertOrderIdempotent,
  };
})();
