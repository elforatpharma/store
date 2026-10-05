/**
 * Vodafone Cash (تحويل يدوي + تأكيد بالإيصال على واتساب) - متجر Elforat Pharma
 * نفس فكرة وهيكلة instapay.js بالظبط، بس لطريقة دفع فودافون كاش.
 *
 * الفكرة:
 *  1) العميل يختار Vodafone Cash في الـ Checkout ويضغط "تأكيد الطلب".
 *  2) الطلب بيتسجل في جدول orders بحالة "بانتظار تأكيد الدفع - فودافون كاش" (مش مدفوع).
 *  3) بتظهر Popup فيها المبلغ + رقم التحويل + زر فتح تطبيق فودافون كاش + زر إرسال الإيصال على واتساب.
 *  4) الأدمن بيراجع الإيصال ويحوّل حالة الطلب يدوياً من لوحة التحكم.
 *
 * الإعدادات بتتقرأ من جدول settings (الصف id = 1، عمود data) — نفس مكان إعدادات InstaPay:
 *   vodafone_cash_phone : رقم الهاتف اللي العميل يحوّل عليه (لو مش موجود/صالح الدفع بيتوقف)
 *   store_whatsapp       : رقم واتساب المتجر (نفس الرقم المستخدم في InstaPay - اختياري)
 */
window.VodafoneCashCheckout = (() => {
  const PAYMENT_VALUE = "vodafone_cash";
  const PAYMENT_LABEL = "فودافون كاش";
  // النص بييجي من المصدر الموحّد (order-status.js) بدل ما يتكرر هنا لوحده.
  // getters مش ثوابت عشان الملفين دول بيتحمّلوا مع بعض وبأى ترتيب (loadPaymentScripts
  // في analysis.js بيحمّلهم بالتوازي)، والقراءة كلها وقت تأكيد الطلب.
  const FALLBACK_STATUS = "بانتظار تأكيد الدفع - فودافون كاش";
  function orderStatus() {
    return window.OrderStatus
      ? window.OrderStatus.label(window.OrderStatus.CODES.PENDING, 'vodafone_cash')
      : FALLBACK_STATUS;
  }

  const DEFAULT_WHATSAPP = "201146809133";
  // مفيش رقم تحويل افتراضي عن قصد: لو vodafone_cash_phone مش متظبط في settings الدفع بيتوقف.
  const ANDROID_PACKAGE = "com.emeint.android.myservices"; // تطبيق فودافون كاش الصحيح (مؤكد من صاحبة المتجر)
  const PLAY_URL = "https://play.google.com/store/apps/details?id=" + ANDROID_PACKAGE;
  const IOS_URL = "https://apps.apple.com/eg/search?term=vodafone%20cash"; // مفيش آيدي آيفون مؤكد عندي - بيفتح نتيجة بحث بدل تخمين غلط
  const WEB_URL = "https://www.vodafone.com/eg/vodafone-cash";
  const LOGO_SRC = "vodafone-cash-logo.webp";

  /* ---------- أدوات صغيرة ---------- */

  function normalizePhone(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.startsWith("20") && d.length === 12) d = "0" + d.slice(2);
    return /^01[0-9]{9}$/.test(d) ? d : "";
  }

  function normalizeWhatsApp(v) {
    const d = String(v || "").replace(/\D/g, "");
    if (/^01[0-9]{9}$/.test(d)) return "2" + d;
    if (/^20[0-9]{10}$/.test(d)) return d;
    return "";
  }

  function formatAmount(n) {
    const x = Math.round(Number(n || 0) * 100) / 100;
    return Number.isInteger(x) ? String(x) : x.toFixed(2);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* ---------- الإعدادات (دايماً من قاعدة البيانات، من غير كاش) ---------- */
  async function loadConfig(supabaseClient) {
    let row = null;
    try {
      const { data, error } = await supabaseClient
        .from("settings").select("data").eq("id", 1).maybeSingle();
      if (error) throw error;
      row = data && data.data ? data.data : {};
    } catch (e) {
      console.warn("VodafoneCash: تعذر تحميل الإعدادات", e);
      throw new Error("تعذر تحميل بيانات الدفع الآن، حاولي مرة أخرى بعد قليل.");
    }
    const phone = normalizePhone(row.vodafone_cash_phone);
    if (!phone) {
      console.error("VodafoneCash: vodafone_cash_phone مش متظبط أو مش صالح في settings");
      throw new Error("طريقة الدفع غير متاحة مؤقتًا، اختاري طريقة دفع أخرى أو تواصلي معنا على واتساب.");
    }
    return {
      phone,
      whatsapp: normalizeWhatsApp(row.store_whatsapp) || DEFAULT_WHATSAPP,
    };
  }

  /* ---------- رسالة واتساب الجاهزة ---------- */
  function buildWhatsAppUrl({ whatsapp, orderNo, total }) {
    const text = [
      `مرحبًا، أريد تأكيد دفع الطلب رقم #${orderNo}`,
      `طريقة الدفع: ${PAYMENT_LABEL}`,
      `المبلغ: ${formatAmount(total)} جنيه`,
      "سأرسل إيصال الدفع هنا.",
    ].join("\n");
    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
  }

  /* ---------- فتح تطبيق Vodafone Cash ----------
   * مفيش رابط دفع مباشر زي InstaPay (ipn.eg)، فبنستخدم رابط Vodafone الرسمي
   * لفتح تطبيق أنا فودافون مباشرة على أندرويد، مع بقاء الـ fallback الرسمي للرابط. */
  function detectPlatform() {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    return "desktop";
  }

  // رابط Vodafone Dynamic Link الرسمي الذي تم اختباره على الهاتف ويفتح تطبيق "أنا فودافون".
  // نستخدم /home فقط لأنه المسار المؤكد أنه يعمل، ولا نفترض مسارًا داخليًا لشاشة Vodafone Cash.
  const VODAFONE_DYNAMIC_LINK = "https://vf.eg/p?9";

  function getOpenAppTarget(platform) {
    if (platform === "android") {
      return { mode: "navigate", url: VODAFONE_DYNAMIC_LINK };
    }
    if (platform === "ios") return { mode: "open", url: IOS_URL };
    return { mode: "open", url: WEB_URL };
  }

  function openVodafoneCashApp() {
    const t = getOpenAppTarget(detectPlatform());
    if (t.mode === "navigate") window.location.href = t.url;
    else window.open(t.url, "_blank", "noopener");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* نكمل على الطريقة البديلة */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- التنسيق (نفس تصميم نافذة instapay.js، بادئة vcx- هنا) ----------
   * ملحوظة: ماستخدمناش <section> جوه النافذة لأن style.css بيفرض section{background:transparent !important}. */
  function injectStyles() {
    if (document.getElementById("vcx-styles")) return;
    const css = `
.vcx-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(11,61,38,.55);font-family:'Tajawal','Cairo',sans-serif;animation:vcx-fade .18s ease-out}
.vcx-overlay *,.vcx-overlay *::before,.vcx-overlay *::after{box-sizing:border-box}
.vcx-sheet{position:relative;width:100%;max-width:440px;max-height:calc(100dvh - 8px);overflow-y:auto;overscroll-behavior:contain;
  background:#f6faf7;border-radius:24px 24px 0 0;color:#1a2e26;box-shadow:0 -12px 48px rgba(11,61,38,.3);
  outline:none;animation:vcx-up .26s cubic-bezier(.2,.8,.2,1)}
@media(min-width:640px){
  .vcx-overlay{align-items:center;padding:24px}
  .vcx-sheet{border-radius:24px;max-height:calc(100dvh - 48px);box-shadow:0 30px 80px rgba(11,61,38,.35)}
}
.vcx-close{position:absolute;top:12px;left:12px;z-index:3;width:40px;height:40px;border:0;border-radius:50%;
  background:#fff;color:#404942;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 1px 6px rgba(11,61,38,.12);font-size:15px}
.vcx-close:hover{background:#ebefec}
.vcx-body{display:flex;flex-direction:column;gap:14px;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px))}
.vcx-card{background:#fff;border-radius:16px;box-shadow:0 1px 6px rgba(11,61,38,.08);padding:16px}

/* بطاقة الرأس */
.vcx-top{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:40px}
.vcx-top::before{content:"";position:absolute;top:-40px;left:-40px;width:112px;height:112px;border-radius:50%;background:#ebf5f0;pointer-events:none}
.vcx-pillrow{position:relative;display:flex;align-items:center;justify-content:center;width:100%;margin-bottom:10px}
.vcx-pill{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:#ebefec;
  color:#1a2e26;font-size:12px;font-weight:700;line-height:1.5}
.vcx-pill b{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-weight:800;direction:ltr;unicode-bidi:isolate}
.vcx-dot{width:8px;height:8px;border-radius:50%;background:#25d366;animation:vcx-pulse 1.6s ease-in-out infinite}
.vcx-brand{position:relative;width:64px;height:64px;margin:6px auto 0;border-radius:16px;background:#592c82;color:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 6px 16px -6px rgba(89,44,130,.6)}
.vcx-brand i{font-size:24px;line-height:1}
.vcx-brand span{font:900 10px/1 'Plus Jakarta Sans','Cairo',sans-serif;letter-spacing:-.01em}
.vcx-title{position:relative;margin:12px 0 0;font-size:20px;font-weight:800;line-height:1.4;color:#1a2e26}
.vcx-sub{position:relative;margin:2px 0 0;max-width:280px;font-size:12px;line-height:1.6;color:#5a6d64}

/* بطاقة المبلغ */
.vcx-amount{display:flex;flex-direction:column;gap:12px;color:#fff;border-radius:16px;padding:16px;
  background:linear-gradient(135deg,#0f5132,#0b3d26);box-shadow:0 10px 24px -12px rgba(11,61,38,.7)}
.vcx-amount-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;color:rgba(255,255,255,.92)}
.vcx-amount-top > span:first-child{display:flex;align-items:center;gap:6px}
.vcx-amount-top i{color:#66ff8e}
.vcx-tag{background:rgba(255,255,255,.15);padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:500;white-space:nowrap}
.vcx-amount-val{display:flex;align-items:baseline;justify-content:center;gap:8px;padding:4px 0}
.vcx-amount-val strong{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.1;direction:ltr;unicode-bidi:isolate}
.vcx-amount-val span{font-size:14px;font-weight:700;color:#ebf5f0}
.vcx-btn-copyamt{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 12px;border:0;border-radius:8px;
  background:#fff;color:#0b3d26;font:700 14px 'Tajawal','Cairo',sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.vcx-btn-copyamt:hover{background:#f0f5f2}
.vcx-btn-copyamt:active{transform:scale(.98)}

/* رؤوس البطاقات */
.vcx-chead{display:flex;align-items:center;gap:8px;padding-bottom:4px}
.vcx-chead-ico{flex:none;width:32px;height:32px;border-radius:8px;background:#ebf5f0;color:#0b3d26;display:flex;align-items:center;justify-content:center;font-size:15px}
.vcx-chead h3{margin:0;font-size:14px;font-weight:700;color:#1a2e26;line-height:1.4}
.vcx-chead p{margin:0;font-size:12px;color:#5a6d64;line-height:1.5}

/* رقم الهاتف */
.vcx-recipient{display:flex;flex-direction:column;gap:10px}
.vcx-phonebox{background:#ebefec;border-radius:12px;padding:14px}
.vcx-phonebox > span{display:block;font-size:11px;font-weight:700;color:#5a6d64}
.vcx-phone{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
.vcx-phone-num{display:inline-block;font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:19px;font-weight:800;letter-spacing:.06em;
  direction:ltr;unicode-bidi:isolate;color:#1a2e26}
.vcx-phone-num.is-copied{color:#1e7b54;font-family:'Tajawal','Cairo',sans-serif;font-size:15px;font-weight:800;direction:rtl;letter-spacing:0}
.vcx-copy{flex:none;width:36px;height:36px;padding:0;border:0;background:#fff;color:#1a2e26;border-radius:8px;font-size:15px;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.1);transition:background .15s,color .15s}
.vcx-copy:active{transform:scale(.92)}
.vcx-copy.is-done{background:#e6f4ec;color:#1e7b54}
.vcx-copy.is-error{background:#fdecec;color:#b42318}
.vcx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* الخطوات */
.vcx-steps{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.vcx-step{display:flex;align-items:flex-start;gap:8px;padding:12px;border-radius:12px;background:#f0f5f2}
.vcx-step-n{flex:none;width:28px;height:28px;margin-top:2px;border-radius:50%;background:#003820;color:#fff;font:800 12px 'Plus Jakarta Sans','Cairo',sans-serif;
  display:flex;align-items:center;justify-content:center}
.vcx-step:nth-child(2) .vcx-step-n{background:#1da851}
.vcx-step b{display:block;font-size:12px;font-weight:700;color:#1a2e26;line-height:1.5}
.vcx-step p{margin:2px 0 0;font-size:12px;line-height:1.6;color:#5a6d64}

/* الأزرار */
.vcx-actions{display:grid;gap:8px}
.vcx-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;padding:0 16px;border:0;border-radius:12px;
  font:800 16px 'Cairo','Tajawal',sans-serif;color:#fff;text-decoration:none;cursor:pointer;box-shadow:0 6px 14px -8px rgba(0,0,0,.5);
  transition:filter .15s,transform .15s}
.vcx-btn i{font-size:19px}
.vcx-btn:hover{filter:brightness(1.07)}
.vcx-btn:active{transform:scale(.98)}
.vcx-btn-app{background:#592c82}
.vcx-btn-wa{background:#1da851}

/* شارات الثقة */
.vcx-trust{display:grid;gap:8px}
.vcx-tcard{display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;background:rgba(235,245,240,.7);border:1px solid #e2ebe5}
.vcx-tcard-ico{flex:none;width:36px;height:36px;border-radius:50%;background:#ebf5f0;color:#0b3d26;display:flex;align-items:center;justify-content:center;font-size:16px}
.vcx-tcard h4{margin:0;font-size:12px;font-weight:700;color:#1a2e26;line-height:1.5}
.vcx-tcard p{margin:0;font-size:12px;color:#5a6d64;line-height:1.5}

/* Toast */
.vcx-toast{position:absolute;left:50%;bottom:18px;z-index:4;transform:translate(-50%,16px);display:flex;align-items:center;gap:8px;
  max-width:calc(100% - 32px);padding:10px 18px;border-radius:999px;background:#2d3130;color:#eef2ef;font-size:12px;font-weight:600;
  box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.vcx-toast i{color:#66ff8e;font-size:15px}
.vcx-toast.is-on{opacity:1;transform:translate(-50%,0)}
.vcx-sheet :focus-visible{outline:3px solid #c59b3f;outline-offset:2px}
@keyframes vcx-fade{from{opacity:0}to{opacity:1}}
@keyframes vcx-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes vcx-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media(prefers-reduced-motion:reduce){.vcx-overlay,.vcx-sheet,.vcx-dot{animation:none}.vcx-btn,.vcx-toast{transition:none}}

/* ===== خاص بفودافون كاش ===== */
.vcx-body{padding-top:56px}
.vcx-meta{display:flex;align-items:center;gap:6px;padding:10px 14px;border-radius:16px;background:#f0f5f2;font-size:12px;font-weight:700;color:#1a2e26}
.vcx-meta span{font-weight:400;color:#5a6d64}
.vcx-meta b{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-weight:800;color:#003820;direction:ltr;unicode-bidi:isolate}
.vcx-hero{text-align:center;padding:2px 0}
.vcx-hero-ico{width:56px;height:56px;margin:0 auto;border-radius:16px;background:rgba(230,0,0,.1);color:#e60000;display:flex;align-items:center;justify-content:center;font-size:28px}
.vcx-exch{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;width:max-content;max-width:100%;margin:6px auto 0}
.vcx-logo{flex:none;display:flex;align-items:center;justify-content:center;width:72px;height:72px;padding:8px;border-radius:18px;background:#fff;border:1px solid #e3ebe6;box-shadow:0 6px 16px -8px rgba(0,0,0,.28);overflow:hidden}
.vcx-logo img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.vcx-arrows{flex:none;display:block;align-self:center;width:22px;height:19px;color:#0f5132}
.vcx-arrows path{fill:none;stroke:currentColor;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round}
.vcx-hero h2{margin:10px 0 0;font-size:24px;font-weight:800;line-height:1.4;color:#1a2e26}
.vcx-hero p{margin:6px auto 0;max-width:300px;font-size:14px;line-height:1.7;color:#5a6d64}
.vcx-amount{background:linear-gradient(135deg,#003820,#0b3d26);border-radius:16px;box-shadow:0 10px 24px -12px rgba(0,56,32,.8)}
.vcx-amount-top{flex-direction:column;gap:8px;color:#e8d5a3}
.vcx-amount-top i{color:#e8d5a3}
.vcx-amount-val span{color:#e8d5a3}
.vcx-btn-copyamt{border-radius:999px;color:#003820;max-width:320px;margin:0 auto}
.vcx-chead-pill{margin-inline-start:auto;padding:2px 10px;border-radius:999px;background:rgba(230,0,0,.1);color:#e60000;font-size:11px;font-weight:700;white-space:nowrap}
.vcx-phonebox{background:#f0f5f2}
.vcx-phonebox > span{font-weight:500}
.vcx-phone-num{font-size:24px;letter-spacing:.05em;color:#0b3d26}
.vcx-copy{width:auto;height:40px;padding:0 14px;gap:6px;border-radius:12px;background:#003820;color:#fff;font:700 12px 'Tajawal','Cairo',sans-serif}
.vcx-copy.is-done{background:#e6f4ec;color:#1e7b54}
.vcx-copy.is-error{background:#fdecec;color:#b42318}
.vcx-step:nth-child(2) .vcx-step-n{background:#003820}
.vcx-btn-app{background:#e60000}
.vcx-btn-wa{background:#1da851}
`;
    const el = document.createElement("style");
    el.id = "vcx-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ---------- الـ Popup ---------- */
  function showPopup({ orderNo, total, config, onClose }) {
    injectStyles();
    document.getElementById("vcx-overlay")?.remove();

    const previouslyFocused = document.activeElement;
    const waUrl = buildWhatsAppUrl({ whatsapp: config.whatsapp, orderNo, total });
    const amountText = formatAmount(total);

    const overlay = document.createElement("div");
    overlay.id = "vcx-overlay";
    overlay.className = "vcx-overlay";
    overlay.setAttribute("dir", "rtl");
    overlay.innerHTML = `
      <div class="vcx-sheet" role="dialog" aria-modal="true" aria-labelledby="vcx-title" tabindex="-1">
        <button type="button" class="vcx-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>

        <div class="vcx-body">
          <div class="vcx-meta"><span>طلب رقم</span><b>#${esc(orderNo)}</b></div>

          <div class="vcx-hero">
            <div class="vcx-exch" role="img" aria-label="الفرات فارما وفودافون كاش">
              <span class="vcx-logo vcx-logo-store" aria-hidden="true"><picture><source srcset="logo-96.webp" type="image/webp"><img src="logo-96.png" alt="" width="56" height="56" decoding="async"></picture></span>
              <svg class="vcx-arrows" viewBox="0 0 34 30" aria-hidden="true" focusable="false"><path d="M3 8h26M23 2.5 29 8l-6 5.5"/><path d="M31 22H5M11 16.5 5 22l6 5.5"/></svg>
              <span class="vcx-logo vcx-logo-partner" aria-hidden="true"><img src="${LOGO_SRC}" alt="" width="56" height="56" decoding="async"></span>
            </div>
            <h2 id="vcx-title">الدفع عبر فودافون كاش</h2>
            <p>معاملة آمنة ومباشرة معتمدة لحساب شركة الفرات فارما الرسمي</p>
          </div>

          <div class="vcx-amount" role="region" aria-label="المبلغ المطلوب">
            <div class="vcx-amount-top">
              <span><i class="fa-solid fa-circle-check"></i>المبلغ المطلوب تحويله بالكامل</span>
              <span class="vcx-tag">شامل الخصم والشحن</span>
            </div>
            <div class="vcx-amount-val"><strong>${esc(amountText)}</strong><span>جنيه مصري</span></div>
            <button type="button" class="vcx-btn-copyamt"><i class="fa-regular fa-copy"></i><span>نسخ المبلغ (${esc(amountText)} ج.م)</span></button>
          </div>

          <div class="vcx-card vcx-recipient" role="region" aria-label="بيانات التحويل">
            <div class="vcx-chead">
              <div>
                <h3>بيانات الحساب المعتمد للاستلام</h3>
                <p>حوّلي على المحفظة التالية عبر فودافون كاش</p>
              </div>
              <span class="vcx-chead-pill">فودافون كاش</span>
            </div>
            <div class="vcx-phonebox">
              <span>رقم محفظة فودافون كاش:</span>
              <div class="vcx-phone">
                <span class="vcx-phone-num">${esc(config.phone)}</span>
                <button type="button" class="vcx-copy" aria-label="نسخ رقم المحفظة"><i class="fa-regular fa-copy"></i><span class="vcx-copy-lbl">نسخ الرقم</span></button>
                <span class="vcx-sr" role="status" aria-live="polite"></span>
              </div>
            </div>
          </div>

          <div class="vcx-card" role="region" aria-label="خطوات التحويل">
            <div class="vcx-chead">
              <div class="vcx-chead-ico"><i class="fa-solid fa-circle-info"></i></div>
              <div><h3>خطوات تأكيد الطلب</h3></div>
            </div>
            <div class="vcx-steps">
              <div class="vcx-step">
                <span class="vcx-step-n">1</span>
                <div><b>حوّل المبلغ المطلوب</b><p>حوّل المبلغ المطلوب إلى رقم المحفظة الموضح بالأعلى عبر تطبيق أنا فودافون</p></div>
              </div>
              <div class="vcx-step">
                <span class="vcx-step-n">2</span>
                <div><b>إرسال إيصال الدفع</b><p>بعد إتمام التحويل قم بحفظ إيصال الدفع وأرسله على واتساب المتجر لتأكيد الطلب</p></div>
              </div>
            </div>
          </div>

          <div class="vcx-actions">
            <button type="button" class="vcx-btn vcx-btn-app"><i class="fa-solid fa-bolt"></i><span>فتح تطبيق أنا فودافون</span></button>
            <a class="vcx-btn vcx-btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i><span>إرسال إيصال الدفع على واتساب</span></a>
          </div>

          <div class="vcx-trust">
            <div class="vcx-tcard">
              <div class="vcx-tcard-ico"><i class="fa-solid fa-lock"></i></div>
              <div><h4>دفع آمن ومعاملات مشفرة</h4><p>معاملات خاضعة للرقابة والبنك المركزي المصري</p></div>
            </div>
            <div class="vcx-tcard">
              <div class="vcx-tcard-ico"><i class="fa-solid fa-truck-fast"></i></div>
              <div><h4>تأكيد الطلب بعد مراجعة الإيصال</h4><p>لا يُعتبر الطلب مدفوعًا إلا بعد تأكيده من المتجر، ثم يبدأ التجهيز والشحن</p></div>
            </div>
            <div class="vcx-tcard">
              <div class="vcx-tcard-ico"><i class="fa-solid fa-shield-heart"></i></div>
              <div><h4>استبدال واسترجاع خلال 14 يوماً</h4><p>وفق سياسة الاسترجاع بالمتجر</p></div>
            </div>
          </div>
        </div>

        <div class="vcx-toast" role="status" aria-live="polite"><i class="fa-solid fa-circle-check"></i><span class="vcx-toast-msg"></span></div>
      </div>`;

    const sheet = overlay.querySelector(".vcx-sheet");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    sheet.focus();

    function close() {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      overlay.remove();
      if (previouslyFocused && previouslyFocused.focus) { try { previouslyFocused.focus(); } catch (e) {} }
      if (typeof onClose === "function") onClose();
    }

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const f = sheet.querySelectorAll("button, a[href]");
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);

    // مقصود: الضغط على الخلفية مبيقفلش الـ Popup، عشان العميل ميضيعش بيانات التحويل بالغلط.
    overlay.querySelector(".vcx-close").onclick = close;
    overlay.querySelector(".vcx-btn-app").onclick = () => openVodafoneCashApp();

    const toast = overlay.querySelector(".vcx-toast");
    const toastMsg = overlay.querySelector(".vcx-toast-msg");
    let toastTimer = null;
    function showToast(msg) {
      toastMsg.textContent = msg;
      toast.classList.add("is-on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2400);
    }

    overlay.querySelector(".vcx-btn-copyamt").onclick = async () => {
      const ok = await copyText(amountText);
      showToast(ok ? "تم نسخ المبلغ: " + amountText + " ج.م" : "تعذر النسخ، انسخي المبلغ يدوياً");
    };

    const copyBtn = overlay.querySelector(".vcx-copy");
    const copyLbl = overlay.querySelector(".vcx-copy-lbl");
    const copyLive = overlay.querySelector(".vcx-phone .vcx-sr");
    let copyTimer = null;
    copyBtn.onclick = async () => {
      const ok = await copyText(config.phone);
      const icon = copyBtn.querySelector("i");
      const msg = ok ? "تم النسخ" : "تعذر النسخ";
      copyBtn.classList.toggle("is-done", ok);
      copyBtn.classList.toggle("is-error", !ok);
      copyLbl.textContent = msg;
      copyLive.textContent = ok ? "تم نسخ رقم المحفظة" : "تعذر نسخ الرقم";
      icon.className = ok ? "fa-solid fa-check" : "fa-regular fa-copy";
      showToast(ok ? "تم نسخ رقم المحفظة: " + config.phone : "تعذر النسخ، انسخي الرقم يدوياً");
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyBtn.classList.remove("is-done", "is-error");
        copyLbl.textContent = "نسخ الرقم";
        copyLive.textContent = "";
        icon.className = "fa-regular fa-copy";
      }, 2000);
    };

    return { close };
  }

  return {
    PAYMENT_VALUE, PAYMENT_LABEL, loadConfig, showPopup, buildWhatsAppUrl,
    get ORDER_STATUS() { return orderStatus(); },
    get ORDER_STATUS_CODE() { return window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending'; }
  };
})();