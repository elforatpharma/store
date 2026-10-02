/**
 * InstaPay (تحويل يدوي + تأكيد بالإيصال على واتساب) - متجر Elforat Pharma
 *
 * الفكرة:
 *  1) العميل يختار InstaPay في الـ Checkout ويضغط "تأكيد الطلب".
 *  2) الطلب بيتسجل في جدول orders بحالة "بانتظار تأكيد الدفع - InstaPay" (مش مدفوع).
 *  3) بتظهر Popup فيها المبلغ + رقم التحويل + زر فتح التطبيق + زر إرسال الإيصال على واتساب.
 *  4) الأدمن بيراجع الإيصال ويحوّل حالة الطلب يدوياً من لوحة التحكم.
 *
 * الإعدادات بتتقرأ من جدول settings (الصف id = 1، عمود data) — نفس مكان اللوجو وصورة الهيرو:
 *   instapay_phone : رقم الهاتف اللي العميل يحوّل عليه (لو مش موجود/صالح الدفع بيتوقف)
 *   store_whatsapp : رقم واتساب المتجر (اختياري - لو مش موجود بنستخدم الرقم الافتراضي تحت)
 *   instapay_link  : رابط الدفع الخاص بحسابك من تطبيق InstaPay (https://ipn.eg/S/.../instapay/...)
 *                    اختياري، لكنه بيخلي زر "فتح تطبيق InstaPay" يفتح التطبيق فعلاً على الموبايل
 */
window.InstaPayCheckout = (() => {
  const PAYMENT_VALUE = "instapay";
  const PAYMENT_LABEL = "InstaPay";
  // النص بييجي من المصدر الموحّد (order-status.js) بدل ما يتكرر هنا لوحده.
  // getters مش ثوابت عشان الملفين دول بيتحمّلوا مع بعض وبأى ترتيب (loadPaymentScripts
  // في analysis.js بيحمّلهم بالتوازي)، والقراءة كلها وقت تأكيد الطلب.
  const FALLBACK_STATUS = "بانتظار تأكيد الدفع - InstaPay";
  function orderStatus() {
    return window.OrderStatus
      ? window.OrderStatus.label(window.OrderStatus.CODES.PENDING, 'instapay')
      : FALLBACK_STATUS;
  }

  const DEFAULT_WHATSAPP = "201146809133";
  // رابط الدفع الخاص بحساب المالك (m.salama.insta@instapay) - بيفتح تطبيق
  // InstaPay مباشرة مع تجهيز المستلم تلقائياً، والعميل بس يكتب المبلغ ويأكد
  // مفيش رقم/رابط تحويل افتراضي هنا عن قصد: الفلوس بتتحول على الرقم ده، فلو مش متظبط
  // في settings (instapay_phone) الدفع بيتوقف بدل ما يتحوّل لرقم قديم متخزّن في الكود.
  const ANDROID_PACKAGE = "com.egyptianbanks.instapay";
  const PLAY_URL = "https://play.google.com/store/apps/details?id=" + ANDROID_PACKAGE;
  const IOS_URL = "https://apps.apple.com/eg/app/instapay-egypt/id1592108795";
  const WEB_URL = "https://www.instapay.eg";
  const LOGO_SRC = "instapay-logo.webp";

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

  // بنقبل بس روابط InstaPay الرسمية (دومين ipn.eg) عشان محدش يقدر يوجّه العميل لموقع تاني
  const LINK_RE = /^https:\/\/ipn\.eg\/S\/[A-Za-z0-9._-]+\/instapay\/[A-Za-z0-9]+$/;
  function normalizeLink(v) {
    const t = String(v || "").trim();
    return LINK_RE.test(t) ? t : "";
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

  /* ---------- الإعدادات (دايماً من قاعدة البيانات، من غير كاش) ----------
   * الرقم ده بتتحول عليه فلوس، فمينفعش نستخدم نسخة قديمة لو الأدمن غيّره.
   * لو الرقم مش متظبط أو مش صالح، بنرفض الطلب قبل ما يتسجل. */
  async function loadConfig(supabaseClient) {
    let row = null;
    try {
      const { data, error } = await supabaseClient
        .from("settings").select("data").eq("id", 1).maybeSingle();
      if (error) throw error;
      row = data && data.data ? data.data : {};
    } catch (e) {
      console.warn("InstaPay: تعذر تحميل الإعدادات", e);
      throw new Error("تعذر تحميل بيانات الدفع الآن، حاولي مرة أخرى بعد قليل.");
    }
    const phone = normalizePhone(row.instapay_phone);
    if (!phone) {
      console.error("InstaPay: instapay_phone مش متظبط أو مش صالح في settings");
      throw new Error("طريقة الدفع غير متاحة مؤقتًا، اختاري طريقة دفع أخرى أو تواصلي معنا على واتساب.");
    }
    return {
      phone,
      whatsapp: normalizeWhatsApp(row.store_whatsapp) || DEFAULT_WHATSAPP,
      link: normalizeLink(row.instapay_link),
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

  /* ---------- فتح تطبيق InstaPay ----------
   * متصفح أندرويد مبيفتحش من صفحة ويب غير الأنشطة المعلنة BROWSABLE، وتطبيق InstaPay
   * الوحيد اللي بيستقبله من المتصفح هو روابط الدفع بتاعته (https://ipn.eg/S/.../instapay/...).
   * وأي رابط ipn.eg مش صحيح بيفتح التطبيق ويكتب جواه "رابط غير صحيح" — عشان كده:
   *  - لو فيه رابط دفع صحيح (instapay_link): أندرويد بيفتحه في التطبيق مباشرة
   *    (ولو التطبيق مش منزّل بيفتح الرابط في المتصفح)، وآيفون/الكمبيوتر بيفتحوا الرابط.
   *  - لو مفيش رابط: مبنبعتش أي رابط للتطبيق (عشان مايظهرش "رابط غير صحيح")، وبنطلب من Google Play
   *    يشغّل التطبيق (market://launch). ده مش موثّق رسمياً لتشغيل التطبيقات المنزّلة،
   *    فلو مشتغلش على الجهاز بيفتح صفحة التطبيق في المتجر (فيها زر "فتح"). */
  function detectPlatform() {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    return "desktop";
  }

  function getOpenAppTarget(link, platform) {
    if (platform === "android") {
      if (!link) {
        // من غير أي رابط أو بيانات للتطبيق: بنطلب من Google Play يشغّل التطبيق (market://launch)،
        // ولو ملقاش/مش بيدعمها بيفتح صفحة التطبيق في المتجر (وفيها زر "فتح").
        return {
          mode: "navigate",
          url: `intent://launch?id=${ANDROID_PACKAGE}#Intent;scheme=market;package=com.android.vending;` +
               `S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`,
        };
      }
      const u = new URL(link);
      return {
        mode: "navigate",
        url: `intent://${u.host}${u.pathname}#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
             `S.browser_fallback_url=${encodeURIComponent(link)};end`,
      };
    }
    if (platform === "ios") return { mode: "open", url: link || IOS_URL };
    return { mode: "open", url: link || WEB_URL };
  }

  function openInstaPayApp(config) {
    const t = getOpenAppTarget(config && config.link, detectPlatform());
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

  /* ---------- التنسيق (مستقل تماماً: مفيش اعتماد على Tailwind build) ---------- */
  function injectStyles() {
    if (document.getElementById("ipx-styles")) return;
    const css = `
.ipx-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(11,61,38,.55);font-family:'Tajawal','Cairo',sans-serif;animation:ipx-fade .18s ease-out}
.ipx-overlay *,.ipx-overlay *::before,.ipx-overlay *::after{box-sizing:border-box}
.ipx-sheet{position:relative;width:100%;max-width:440px;max-height:calc(100dvh - 8px);overflow-y:auto;overscroll-behavior:contain;
  background:#f6faf7;border-radius:24px 24px 0 0;color:#1a2e26;box-shadow:0 -12px 48px rgba(11,61,38,.3);
  outline:none;animation:ipx-up .26s cubic-bezier(.2,.8,.2,1)}
@media(min-width:640px){
  .ipx-overlay{align-items:center;padding:24px}
  .ipx-sheet{border-radius:24px;max-height:calc(100dvh - 48px);box-shadow:0 30px 80px rgba(11,61,38,.35)}
}
.ipx-close{position:absolute;top:12px;left:12px;z-index:3;width:40px;height:40px;border:0;border-radius:50%;
  background:#fff;color:#404942;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 1px 6px rgba(11,61,38,.12);font-size:15px}
.ipx-close:hover{background:#ebefec}
.ipx-body{display:flex;flex-direction:column;gap:14px;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px))}
.ipx-card{background:#fff;border-radius:16px;box-shadow:0 1px 6px rgba(11,61,38,.08);padding:16px}

/* بطاقة الرأس */
.ipx-top{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:40px}
.ipx-top::before{content:"";position:absolute;top:-40px;left:-40px;width:112px;height:112px;border-radius:50%;background:#ebf5f0;pointer-events:none}
.ipx-pillrow{position:relative;display:flex;align-items:center;justify-content:center;width:100%;margin-bottom:10px}
.ipx-pill{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:#ebefec;
  color:#1a2e26;font-size:12px;font-weight:700;line-height:1.5}
.ipx-pill b{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-weight:800;direction:ltr;unicode-bidi:isolate}
.ipx-dot{width:8px;height:8px;border-radius:50%;background:#25d366;animation:ipx-pulse 1.6s ease-in-out infinite}
.ipx-brand{position:relative;width:64px;height:64px;margin:6px auto 0;border-radius:16px;background:#592c82;color:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 6px 16px -6px rgba(89,44,130,.6)}
.ipx-brand i{font-size:24px;line-height:1}
.ipx-brand span{font:900 10px/1 'Plus Jakarta Sans','Cairo',sans-serif;letter-spacing:-.01em}
.ipx-title{position:relative;margin:12px 0 0;font-size:20px;font-weight:800;line-height:1.4;color:#1a2e26}
.ipx-sub{position:relative;margin:2px 0 0;max-width:280px;font-size:12px;line-height:1.6;color:#5a6d64}

/* بطاقة المبلغ */
.ipx-amount{display:flex;flex-direction:column;gap:12px;color:#fff;border-radius:16px;padding:16px;
  background:linear-gradient(135deg,#0f5132,#0b3d26);box-shadow:0 10px 24px -12px rgba(11,61,38,.7)}
.ipx-amount-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;color:rgba(255,255,255,.92)}
.ipx-amount-top > span:first-child{display:flex;align-items:center;gap:6px}
.ipx-amount-top i{color:#66ff8e}
.ipx-tag{background:rgba(255,255,255,.15);padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:500;white-space:nowrap}
.ipx-amount-val{display:flex;align-items:baseline;justify-content:center;gap:8px;padding:4px 0}
.ipx-amount-val strong{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.1;direction:ltr;unicode-bidi:isolate}
.ipx-amount-val span{font-size:14px;font-weight:700;color:#ebf5f0}
.ipx-btn-copyamt{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 12px;border:0;border-radius:8px;
  background:#fff;color:#0b3d26;font:700 14px 'Tajawal','Cairo',sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.ipx-btn-copyamt:hover{background:#f0f5f2}
.ipx-btn-copyamt:active{transform:scale(.98)}

/* رؤوس البطاقات */
.ipx-chead{display:flex;align-items:center;gap:8px;padding-bottom:4px}
.ipx-chead-ico{flex:none;width:32px;height:32px;border-radius:8px;background:#ebf5f0;color:#0b3d26;display:flex;align-items:center;justify-content:center;font-size:15px}
.ipx-chead h3{margin:0;font-size:14px;font-weight:700;color:#1a2e26;line-height:1.4}
.ipx-chead p{margin:0;font-size:12px;color:#5a6d64;line-height:1.5}

/* رقم الهاتف */
.ipx-recipient{display:flex;flex-direction:column;gap:10px}
.ipx-phonebox{background:#ebefec;border-radius:12px;padding:14px}
.ipx-phonebox > span{display:block;font-size:11px;font-weight:700;color:#5a6d64}
.ipx-phone{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
.ipx-phone-num{display:inline-block;font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:19px;font-weight:800;letter-spacing:.06em;
  direction:ltr;unicode-bidi:isolate;color:#1a2e26}
.ipx-phone-num.is-copied{color:#1e7b54;font-family:'Tajawal','Cairo',sans-serif;font-size:15px;font-weight:800;direction:rtl;letter-spacing:0}
.ipx-copy{flex:none;width:36px;height:36px;padding:0;border:0;background:#fff;color:#1a2e26;border-radius:8px;font-size:15px;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.1);transition:background .15s,color .15s}
.ipx-copy:active{transform:scale(.92)}
.ipx-copy.is-done{background:#e6f4ec;color:#1e7b54}
.ipx-copy.is-error{background:#fdecec;color:#b42318}
.ipx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* الخطوات */
.ipx-steps{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.ipx-step{display:flex;align-items:flex-start;gap:8px;padding:12px;border-radius:12px;background:#f0f5f2}
.ipx-step-n{flex:none;width:28px;height:28px;margin-top:2px;border-radius:50%;background:#003820;color:#fff;font:800 12px 'Plus Jakarta Sans','Cairo',sans-serif;
  display:flex;align-items:center;justify-content:center}
.ipx-step:nth-child(2) .ipx-step-n{background:#1da851}
.ipx-step b{display:block;font-size:12px;font-weight:700;color:#1a2e26;line-height:1.5}
.ipx-step p{margin:2px 0 0;font-size:12px;line-height:1.6;color:#5a6d64}

/* الأزرار */
.ipx-actions{display:grid;gap:8px}
.ipx-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;padding:0 16px;border:0;border-radius:12px;
  font:800 16px 'Cairo','Tajawal',sans-serif;color:#fff;text-decoration:none;cursor:pointer;box-shadow:0 6px 14px -8px rgba(0,0,0,.5);
  transition:filter .15s,transform .15s}
.ipx-btn i{font-size:19px}
.ipx-btn:hover{filter:brightness(1.07)}
.ipx-btn:active{transform:scale(.98)}
.ipx-btn-app{background:#592c82}
.ipx-btn-wa{background:#1da851}

/* شارات الثقة */
.ipx-trust{display:grid;gap:8px}
.ipx-tcard{display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;background:rgba(235,245,240,.7);border:1px solid #e2ebe5}
.ipx-tcard-ico{flex:none;width:36px;height:36px;border-radius:50%;background:#ebf5f0;color:#0b3d26;display:flex;align-items:center;justify-content:center;font-size:16px}
.ipx-tcard h4{margin:0;font-size:12px;font-weight:700;color:#1a2e26;line-height:1.5}
.ipx-tcard p{margin:0;font-size:12px;color:#5a6d64;line-height:1.5}

/* Toast */
.ipx-toast{position:absolute;left:50%;bottom:18px;z-index:4;transform:translate(-50%,16px);display:flex;align-items:center;gap:8px;
  max-width:calc(100% - 32px);padding:10px 18px;border-radius:999px;background:#2d3130;color:#eef2ef;font-size:12px;font-weight:600;
  box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.ipx-toast i{color:#66ff8e;font-size:15px}
.ipx-toast.is-on{opacity:1;transform:translate(-50%,0)}
.ipx-sheet :focus-visible{outline:3px solid #c59b3f;outline-offset:2px}
@keyframes ipx-fade{from{opacity:0}to{opacity:1}}
@keyframes ipx-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes ipx-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media(prefers-reduced-motion:reduce){.ipx-overlay,.ipx-sheet,.ipx-dot{animation:none}.ipx-btn,.ipx-toast{transition:none}}
`;
    const el = document.createElement("style");
    el.id = "ipx-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ---------- الـ Popup ---------- */
  function showPopup({ orderNo, total, config, onClose }) {
    injectStyles();
    document.getElementById("ipx-overlay")?.remove();

    const previouslyFocused = document.activeElement;
    const waUrl = buildWhatsAppUrl({ whatsapp: config.whatsapp, orderNo, total });
    const amountText = formatAmount(total);

    const overlay = document.createElement("div");
    overlay.id = "ipx-overlay";
    overlay.className = "ipx-overlay";
    overlay.setAttribute("dir", "rtl");
    overlay.innerHTML = `
      <div class="ipx-sheet" role="dialog" aria-modal="true" aria-labelledby="ipx-title" tabindex="-1">
        <button type="button" class="ipx-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>

        <div class="ipx-body">
          <section class="ipx-card ipx-top">
            <div class="ipx-pillrow">
              <span class="ipx-pill"><span class="ipx-dot"></span>طلب رقم <b>#${esc(orderNo)}</b></span>
            </div>
            <div class="ipx-brand" aria-hidden="true"><i class="fa-solid fa-bolt"></i><span>InstaPay</span></div>
            <h2 class="ipx-title" id="ipx-title">الدفع اللحظي عبر إنستاباي</h2>
            <p class="ipx-sub">معاملة آمنة ومباشرة معتمدة لحساب شركة الفرات فارما الرسمي</p>
          </section>

          <section class="ipx-amount" aria-label="المبلغ المطلوب">
            <div class="ipx-amount-top">
              <span><i class="fa-solid fa-circle-check"></i>المبلغ المطلوب تحويله بالكامل</span>
              <span class="ipx-tag">شامل الخصم والشحن</span>
            </div>
            <div class="ipx-amount-val"><strong>${esc(amountText)}</strong><span>جنيه مصري</span></div>
            <button type="button" class="ipx-btn-copyamt"><i class="fa-regular fa-copy"></i><span>نسخ المبلغ (${esc(amountText)} ج.م)</span></button>
          </section>

          <section class="ipx-card ipx-recipient" aria-label="بيانات التحويل">
            <div class="ipx-chead">
              <div class="ipx-chead-ico"><i class="fa-solid fa-wallet"></i></div>
              <div>
                <h3>بيانات الحساب المعتمد للاستلام</h3>
                <p>حوّلي على الرقم التالي عبر تطبيق InstaPay</p>
              </div>
            </div>
            <div class="ipx-phonebox">
              <span>رقم الهاتف للتحويل:</span>
              <div class="ipx-phone">
                <span class="ipx-phone-num">${esc(config.phone)}</span>
                <button type="button" class="ipx-copy" aria-label="نسخ رقم الهاتف" title="نسخ الرقم"><i class="fa-regular fa-copy"></i></button>
                <span class="ipx-sr" role="status" aria-live="polite"></span>
              </div>
            </div>
          </section>

          <section class="ipx-card" aria-label="خطوات التحويل">
            <div class="ipx-chead">
              <div class="ipx-chead-ico"><i class="fa-solid fa-circle-info"></i></div>
              <div>
                <h3>خطوات وتعليمات التحويل</h3>
                <p>يرجى اتباع الخطوات البسيطة التالية لإتمام الدفع</p>
              </div>
            </div>
            <div class="ipx-steps">
              <div class="ipx-step">
                <span class="ipx-step-n">1</span>
                <div><b>حوّل المبلغ المطلوب</b><p>حوّل المبلغ المطلوب إلى رقم الهاتف الموضح بالأعلى باستخدام تطبيق InstaPay</p></div>
              </div>
              <div class="ipx-step">
                <span class="ipx-step-n">2</span>
                <div><b>إرسال إيصال الدفع</b><p>بعد إتمام التحويل قم بحفظ إيصال الدفع وأرسله على واتساب المتجر لتأكيد الطلب</p></div>
              </div>
            </div>
          </section>

          <div class="ipx-actions">
            <button type="button" class="ipx-btn ipx-btn-app"><i class="fa-solid fa-bolt"></i><span>فتح تطبيق InstaPay للتحويل</span></button>
            <a class="ipx-btn ipx-btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i><span>إرسال إيصال الدفع على واتساب</span></a>
          </div>

          <div class="ipx-trust">
            <div class="ipx-tcard">
              <div class="ipx-tcard-ico"><i class="fa-solid fa-lock"></i></div>
              <div><h4>دفع آمن ومعاملات مشفرة</h4><p>معاملات خاضعة للرقابة والبنك المركزي المصري</p></div>
            </div>
            <div class="ipx-tcard">
              <div class="ipx-tcard-ico"><i class="fa-solid fa-circle-check"></i></div>
              <div><h4>تأكيد الطلب بعد مراجعة الإيصال</h4><p>لا يُعتبر الطلب مدفوعًا إلا بعد تأكيده من المتجر، ثم يبدأ التجهيز والشحن</p></div>
            </div>
            <div class="ipx-tcard">
              <div class="ipx-tcard-ico"><i class="fa-solid fa-shield-heart"></i></div>
              <div><h4>استبدال واسترجاع خلال 14 يوماً</h4><p>وفق سياسة الاسترجاع بالمتجر</p></div>
            </div>
          </div>
        </div>

        <div class="ipx-toast" role="status" aria-live="polite"><i class="fa-solid fa-circle-check"></i><span class="ipx-toast-msg"></span></div>
      </div>`;

    const sheet = overlay.querySelector(".ipx-sheet");
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
    overlay.querySelector(".ipx-close").onclick = close;
    overlay.querySelector(".ipx-btn-app").onclick = () => openInstaPayApp(config);

    // Toast صغير داخل النافذة
    const toast = overlay.querySelector(".ipx-toast");
    const toastMsg = overlay.querySelector(".ipx-toast-msg");
    let toastTimer = null;
    function showToast(msg) {
      toastMsg.textContent = msg;
      toast.classList.add("is-on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2400);
    }

    overlay.querySelector(".ipx-btn-copyamt").onclick = async () => {
      const ok = await copyText(amountText);
      showToast(ok ? "تم نسخ المبلغ: " + amountText + " ج.م" : "تعذر النسخ، انسخي المبلغ يدوياً");
    };

    const copyBtn = overlay.querySelector(".ipx-copy");
    const copyLive = overlay.querySelector(".ipx-phone .ipx-sr");
    const numEl = overlay.querySelector(".ipx-phone-num");
    let copyTimer = null;
    copyBtn.onclick = async () => {
      const ok = await copyText(config.phone);
      const icon = copyBtn.querySelector("i");
      const msg = ok ? "تم نسخ الرقم" : "تعذر النسخ";
      copyBtn.classList.toggle("is-done", ok);
      copyBtn.classList.toggle("is-error", !ok);
      // التأكيد بيظهر مكان الرقم نفسه (بنفس العرض) عشان مفيش حاجة تتحرك
      if (!numEl.style.minWidth) numEl.style.minWidth = numEl.offsetWidth + "px";
      numEl.textContent = msg;
      numEl.classList.add("is-copied");
      copyLive.textContent = msg;
      icon.className = ok ? "fa-solid fa-check" : "fa-regular fa-copy";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyBtn.classList.remove("is-done", "is-error");
        numEl.textContent = config.phone;
        numEl.classList.remove("is-copied");
        copyLive.textContent = "";
        icon.className = "fa-regular fa-copy";
      }, 2000);
    };

    return { close };
  }

  return {
    PAYMENT_VALUE, PAYMENT_LABEL, loadConfig, showPopup, buildWhatsAppUrl, getOpenAppTarget, normalizeLink,
    get ORDER_STATUS() { return orderStatus(); },
    get ORDER_STATUS_CODE() { return window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending'; }
  };
})();
