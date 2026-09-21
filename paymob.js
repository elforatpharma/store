/**
 * Paymob (Intention API) - Frontend helper لمتجر Elforat Pharma
 *
 * الإعداد: عدّل القيمتين دول فقط 👇
 * 1) SUPABASE_URL ثابت عندك
 * 2) FUNCTION_URL بعد ما تعمل deploy للـ Edge Function
 * 3) PAYMOB_PUBLIC_KEY مفتاحك العلني (آمن يظهر في المتصفح)
 */
window.PAYMOB_CONFIG = window.PAYMOB_CONFIG || {
  SUPABASE_URL: "https://sidtdxchiqiogfkwbdui.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZHRkeGNoaXFpb2dma3diZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTEyMTAsImV4cCI6MjA4OTY4NzIxMH0.QF1-67Qu2HfWJt3ANSegM87fykOYQBwqC7ggLG8LTVU",
  // مثال: https://sidtdxchiqiogfkwbdui.supabase.co/functions/v1/paymob-create-intention
  FUNCTION_URL: "https://sidtdxchiqiogfkwbdui.supabase.co/functions/v1/paymob-create-intention",
  PAYMOB_PUBLIC_KEY: "egy_pk_test_sUkeX09sfj2qssvSdPyfglMJFj7m2N62",
  // ⚠️ لاحظي إن ده لسه مفتاح TEST — لازم يتحول لمفتاح egy_pk_live_... قبل الحملة
  // (ORDER_NOTIFY_SECRET اتشال من هنا؛ إشعار تيليجرام بقى بيتبعت سيرفر-لسيرفر
  // عن طريق Database Webhook في Supabase، مش من كود الموقع العام)
};

window.PaymobCheckout = (() => {
  function getCart() {
    try {
      const raw = localStorage.getItem("elforat_cart");
      const cart = raw ? JSON.parse(raw) : [];
      return cart.filter((i) => !i.isGift);
    } catch { return []; }
  }

  /** يقرأ كود الكوبون المطبّق حالياً من المتجر (نفس اللي بيحفظه analysis.js) */
  function getCoupon() {
    try {
      const raw = localStorage.getItem("elforat_coupon");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function cartSubtotal(cart) {
    return cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
  }

  /** يرجع قيمة الخصم بالجنيه بناءً على الكوبون المطبّق (لو موجود) */
  function couponDiscount(subtotal, coupon) {
    if (!coupon || !coupon.discount_percentage) return 0;
    return Math.round((subtotal * coupon.discount_percentage / 100) * 100) / 100;
  }

  /** الإجمالي بعد تطبيق الخصم (للتوافق مع أي استدعاء قديم لـ cartTotal) */
  function cartTotal(cart) {
    const subtotal = cartSubtotal(cart);
    const discount = couponDiscount(subtotal, getCoupon());
    return Math.max(subtotal - discount, 0);
  }

  function splitName(full) {
    const parts = String(full || "Customer Elforat").trim().split(/\s+/);
    return { first: parts[0] || "Customer", last: parts.slice(1).join(" ") || "Elforat" };
  }

  /** ينشئ Intention عبر الـ Edge Function ويرجع رابط الدفع */
  async function createIntention({ name, phone, address, email }) {
    const cart = getCart();
    if (!cart.length) throw new Error("السلة فارغة");

    const coupon = getCoupon();
    // merchant_order_id ثابت لنفس محاولة الدفع (حتى لو حصل reload) بدل توليد
    // رقم جديد كل مرة، عشان ما نبعتش أكتر من intention/طلب لنفس المحاولة
    const merchant_order_id = window.OrderStatus
      ? window.OrderStatus.getOrCreateMerchantOrderId()
      : `elforat-${Date.now()}`;

    // [تحديث أمان] بنبعت id/qty/isGift بس - السيرفر هو اللي بيحدد السعر
    // الحقيقي من جدول products، مش بنبعتله سعر جاهز يقدر حد يتلاعب فيه
    // عن طريق تعديل localStorage قبل الدفع.
    const cart_items = cart.map((i) => ({
      id: i.id,
      qty: Number(i.qty || 1),
      isGift: !!i.isGift,
    }));

    const { first, last } = splitName(name);
    const redirection_url =
      window.location.origin + window.location.pathname +
      `?paymob=return&merchant_order_id=${encodeURIComponent(merchant_order_id)}`;

    const res = await fetch(window.PAYMOB_CONFIG.FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": window.PAYMOB_CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${window.PAYMOB_CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        cart_items,
        billing_data: {},
        customer: { name, phone, address, email },
        merchant_order_id,
        redirection_url,
        coupon_code: coupon ? coupon.code : null,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.details?.detail || "فشل إنشاء جلسة الدفع (Paymob)");
    }

    // [تحديث أمان] بنستخدم total/discount_amount/coupon_code الراجعين من
    // السيرفر (الحقيقيين) بدل ما نحسبهم تاني في المتصفح - هما المصدر الموثوق
    // خزّن بيانات الطلب مؤقتاً لاستكماله بعد الرجوع من Paymob
    sessionStorage.setItem("paymob_pending_order", JSON.stringify({
      merchant_order_id,
      name, phone, address,
      total: data.total,
      subtotal: cartSubtotal(cart),
      coupon_code: data.coupon_code || null,
      discount_amount: data.discount_amount || 0,
      items: cart.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, isGift: !!i.isGift })),
      intention_id: data.intention_id,
      paymob_order_id: data.paymob_order_id,
      created_at: new Date().toISOString(),
    }));

    return data; // {checkout_url, client_secret, total, discount_amount, coupon_code, ...}
  }

  /** حفظ طلب مبدئي في جدول orders بحالة "بانتظار الدفع" */
  async function savePendingOrder(supabaseClient, pending) {
    const statusLabel = window.OrderStatus
      ? window.OrderStatus.label(window.OrderStatus.CODES.PENDING, 'paymob')
      : "بانتظار الدفع - Paymob";
    const statusCode = window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending';

    // منع تكرار الطلب: لو الطلب ده (نفس merchant_order_id) اتسجل قبل كده
    // (مثلاً retry بعد مشكلة شبكة)، هنرجّع الموجود بدل ما نعمل نسخة تانية
    const insertOne = window.OrderStatus
      ? (data) => window.OrderStatus.insertOrderIdempotent(supabaseClient, data)
      : (data) => supabaseClient.from("orders").insert([data]).select("id").single().then(r => ({ data: r.data, error: r.error }));

    try {
      const full = {
        customerName: pending.name,
        phone: pending.phone,
        address: pending.address,
        total: pending.total,
        status: statusLabel,
        status_code: statusCode,
        payment_status: "pending",
        payment_method: "بطاقة بنكية (Paymob)",
        merchant_order_id: pending.merchant_order_id,
        paymob_order_id: pending.paymob_order_id ? String(pending.paymob_order_id) : null,
        coupon_code: pending.coupon_code || null,
        discount_amount: pending.discount_amount || 0,
        session_id: window.ElforatAnalytics?.getVisitorSessionId?.() || null,
        traffic_source: window.ElforatAnalytics?.getTrafficParams?.()?.source || null,
        traffic_campaign: window.ElforatAnalytics?.getTrafficParams?.()?.campaign || null,
        date: new Date().toLocaleString("ar-EG"),
        items: pending.items,
      };
      let { data, error } = await insertOne(full);
      if (error) {
        // fallback لو أعمدة الكوبون أو status_code لسه متضافتش في الجدول
        console.warn("savePendingOrder full failed, retry without coupon/status_code fields:", error.message);
        const withoutCoupon = {
          customerName: pending.name,
          phone: pending.phone,
          address: pending.address,
          total: pending.total,
          status: statusLabel,
          payment_status: "pending",
          payment_method: "بطاقة بنكية (Paymob)",
          merchant_order_id: pending.merchant_order_id,
          paymob_order_id: pending.paymob_order_id ? String(pending.paymob_order_id) : null,
          session_id: window.ElforatAnalytics?.getVisitorSessionId?.() || null,
          traffic_source: window.ElforatAnalytics?.getTrafficParams?.()?.source || null,
          traffic_campaign: window.ElforatAnalytics?.getTrafficParams?.()?.campaign || null,
          date: new Date().toLocaleString("ar-EG"),
          items: pending.items,
        };
        const r2 = await insertOne(withoutCoupon);
        data = r2.data; error = r2.error;
        if (error) {
          // fallback أخير: أقل حقول ممكنة (بس مع الحفاظ على merchant_order_id
          // عشان الحماية من التكرار تفضل شغالة حتى في أسوأ الحالات)
          console.warn("savePendingOrder retry failed, minimal:", error.message);
          const minimal = {
            customerName: pending.name,
            phone: pending.phone,
            address: pending.address,
            total: pending.total,
            status: statusLabel,
            merchant_order_id: pending.merchant_order_id,
            date: new Date().toLocaleString("ar-EG"),
            items: pending.items,
          };
          const r3 = await insertOne(minimal);
          data = r3.data; error = r3.error;
          if (error) console.warn("savePendingOrder minimal:", error.message);
        }
      }
      // لا يوجد نداء مباشر للدالة هنا — الإشعار يتم تلقائياً عبر DB Trigger
      // (INSERT في orders يطلق Webhook/Trigger بِـ Authorization: Bearer service_role،
      //  ولا يتم كشف أي سر في الكود الأمامي).

      return data;
    } catch (e) {
      console.warn("savePendingOrder failed:", e);
      return null;
    }
  }

  /** الدالة الرئيسية: تُستدعى من فورم الـ checkout */
  async function startCardPayment({ name, phone, address, supabaseClient, submitBtn, onBeforeRedirect }) {
    const btnText = submitBtn ? submitBtn.innerText : "";
    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "جاري تحويلك لبوابة الدفع الآمنة..."; }
      const data = await createIntention({ name, phone, address });
      window.ElforatAnalytics?.trackStoreEvent?.("payment_started", {
        cart_total: data.total,
        coupon_code: data.coupon_code || null,
        metadata: { provider: "paymob" }
      });

      const pending = JSON.parse(sessionStorage.getItem("paymob_pending_order") || "{}");
      if (supabaseClient && pending.merchant_order_id) {
        await savePendingOrder(supabaseClient, pending);
      }
      if (typeof onBeforeRedirect === "function") await onBeforeRedirect(pending);

      // تحويل العميل لصفحة Paymob
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error(err);
      window.ElforatAnalytics?.trackStoreEvent?.("payment_failed", {
        metadata: { provider: "paymob", stage: "create_intention", message: err.message || "unknown" }
      });
      if (window.showToast) window.showToast(err.message || "تعذر بدء الدفع الإلكتروني", "error");
      else alert(err.message || "تعذر بدء الدفع الإلكتروني");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = btnText; }
      throw err;
    }
  }

  /** تُستدعى تلقائياً عند تحميل الصفحة للتعامل مع الرجوع من Paymob */
  async function handleReturn(supabaseClient) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paymob") !== "return") return false;

    const success = params.get("success") === "true" || params.get("success") === "True";
    const merchantOrderId = params.get("merchant_order_id") || params.get("special_reference") || "";
    const transactionId = params.get("id") || params.get("transaction_id") || "";

    // نظّف الرابط من باراميترات Paymob
    const cleanUrl = window.location.origin + window.location.pathname + "#cart";
    window.history.replaceState({}, "", cleanUrl);

    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem("paymob_pending_order") || "null"); } catch {}

    // المحاولة دي خلصت (نجحت أو فشلت) - أي محاولة جديدة تاخد merchant_order_id جديد
    window.OrderStatus?.clearPendingMerchantOrderId?.();

    if (success) {
      window.ElforatAnalytics?.trackStoreEvent?.("payment_success", {
        cart_total: pending?.total || null,
        coupon_code: pending?.coupon_code || null,
        metadata: { provider: "paymob", merchant_order_id: merchantOrderId, transaction_id: transactionId }
      });

      // [أمان] حالة الدفع في قاعدة البيانات يتم تحديثها حصرياً بواسطة الـ Webhook
      // (paymob-webhook Edge Function) بعد التحقق من توقيع HMAC، ولا يتم السماح للمتصفح بعمل UPDATE.

      // ابعت الطلب واتساب زي باقي طرق الدفع + فضّي السلة
      const order = pending || { name: "", phone: "", address: "", total: "", items: [] };
      let message = `*طلب جديد مدفوع أونلاين - Elforat Pharma* ✅💳\n\n`;
      message += `👤 *الاسم:* ${order.name || ""}\n📞 *الهاتف:* ${order.phone || ""}\n📍 *العنوان:* ${order.address || ""}\n`;
      message += `🆔 *رقم الطلب:* ${merchantOrderId}\n💳 *المعاملة:* ${transactionId}\n\n*المنتجات:*\n`;
      (order.items || []).forEach((item) => {
        message += `▫️ ${item.name} (x${item.qty}) = ${item.price * item.qty} ج.م\n`;
      });
      if (order.subtotal) message += `\n🧾 *الإجمالي الفرعي:* ${order.subtotal} ج.م\n`;
      if (order.discount_amount) message += `🏷️ *خصم كود (${order.coupon_code || ""}):* -${order.discount_amount} ج.م\n`;
      message += `💰 *الإجمالي المدفوع:* ${order.total} ج.م\nشكراً لاختيارك الفرات فارما! 🌺`;

      localStorage.removeItem("elforat_cart");
      localStorage.removeItem("elforat_cart_expiry");
      localStorage.removeItem("elforat_coupon");
      sessionStorage.removeItem("paymob_pending_order");
      if (window.app?.navigate) { try { window.app.navigate("home"); } catch {} }

      showReturnModal(true, merchantOrderId, transactionId);

      // افتح واتساب للتأكيد (اختياري - بعد ثانيتين عشان العميل يشوف رسالة النجاح)
      setTimeout(() => {
        window.open(`https://wa.me/201146809133?text=${encodeURIComponent(message)}`, "_blank");
      }, 2500);
    } else {
      window.ElforatAnalytics?.trackStoreEvent?.("payment_failed", {
        cart_total: pending?.total || null,
        coupon_code: pending?.coupon_code || null,
        metadata: { provider: "paymob", merchant_order_id: merchantOrderId, transaction_id: transactionId, stage: "return" }
      });
      showReturnModal(false, merchantOrderId, transactionId);
    }
    return true;
  }

  function showReturnModal(ok, orderId, txnId) {
    let modal = document.getElementById("paymob-return-modal");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "paymob-return-modal";
    modal.className = "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm";
    modal.innerHTML = `
      <div class="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl" dir="rtl">
        <div class="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl mb-4 ${ok ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}">
          <i class="fa-solid ${ok ? "fa-check" : "fa-xmark"}"></i>
        </div>
        <h3 class="text-xl font-black text-gray-900 mb-2">${ok ? "تم الدفع بنجاح! 🎉" : "فشلت عملية الدفع"}</h3>
        <p class="text-sm text-gray-500 mb-1">${ok ? "شكراً لطلبك، سنتواصل معك قريباً لتأكيد الشحن." : "لم يتم خصم أي مبلغ. يمكنك المحاولة مرة أخرى أو اختيار الدفع عند الاستلام."}</p>
        ${orderId ? `<p class="text-xs text-gray-400 font-mono mt-2" dir="ltr">Order: ${orderId}${txnId ? ` | Txn: ${txnId}` : ""}</p>` : ""}
        <button id="paymob-modal-close" class="mt-6 w-full py-3 rounded-full font-black text-white bg-gradient-to-r from-primary to-secondary">تمام</button>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("paymob-modal-close").onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }

  return { createIntention, startCardPayment, handleReturn };
})();
