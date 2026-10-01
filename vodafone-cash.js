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
   * مفيش رابط دفع مباشر زي InstaPay (ipn.eg)، فبنحاول نفتح التطبيق عن طريق
   * الباكدج، ولو مش متاح بيفتح صفحة التطبيق في المتجر (Play/App Store). */
  function detectPlatform() {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    return "desktop";
  }

  // محاولة تشغيل تطبيق "أنا فودافون" مباشرة على أندرويد عن طريق intent بالباكدج (MAIN/LAUNCHER)،
  // ولو فشلت (التطبيق مش مركّب، أو المتصفح رفض intent من غير BROWSABLE) بيفتح صفحة Play زي الأول.
  // ملحوظة: كروم بيضيف BROWSABLE تلقائياً، وأغلب التطبيقات مش بتعلنه على شاشتها الرئيسية، فالتشغيل
  // المباشر مش مضمون على كل متصفح/جهاز. الحل المضمون: لو عرفتي الـ scheme الحقيقي للتطبيق
  // (شوفي الشرح) حطيه في APP_SCHEME_URL وهيتستخدم بدل التشغيل بالباكدج.
  const APP_SCHEME_URL = ""; // مثال: "someScheme://home" - سيبيه فاضي لحد ما تتأكدي منه

  function getOpenAppTarget(platform) {
    if (platform === "android") {
      const fb = "S.browser_fallback_url=" + encodeURIComponent(PLAY_URL);
      const m = APP_SCHEME_URL.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
      if (m) {
        return { mode: "navigate", url: `intent://${m[2]}#Intent;scheme=${m[1]};package=${ANDROID_PACKAGE};${fb};end` };
      }
      return {
        mode: "navigate",
        url: `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${ANDROID_PACKAGE};${fb};end`,
      };
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

  /* ---------- التنسيق (نفس كلاسات ipx-* في instapay.js، بادئة vcx- هنا) ---------- */
  function injectStyles() {
    if (document.getElementById("vcx-styles")) return;
    const css = `
.vcx-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(20,27,43,.58);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
  font-family:'Tajawal','Cairo',sans-serif;animation:vcx-fade .18s ease-out}
.vcx-overlay *,.vcx-overlay *::before,.vcx-overlay *::after{box-sizing:border-box}
.vcx-sheet{position:relative;width:100%;max-width:440px;max-height:calc(100dvh - 8px);overflow-y:auto;
  background:#f3f6f4;border-radius:28px 28px 0 0;color:#141b2b;box-shadow:0 -12px 48px rgba(20,27,43,.28);
  outline:none;animation:vcx-up .26s cubic-bezier(.2,.8,.2,1)}
@media(min-width:640px){
  .vcx-overlay{align-items:center;padding:24px}
  .vcx-sheet{border-radius:28px;max-height:calc(100dvh - 48px);box-shadow:0 30px 80px rgba(20,27,43,.35)}
}
.vcx-close{position:absolute;top:14px;left:14px;width:40px;height:40px;border:0;border-radius:50%;
  background:#fff;color:#404943;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 1px 0 #eadbb6,0 2px 8px rgba(20,27,43,.08);font-size:15px}
.vcx-close:hover{background:#faf7ee}
.vcx-head{padding:30px 24px 18px;text-align:center}
.vcx-logo{display:inline-flex;align-items:center;justify-content:center;background:#fff;border:1px solid #eadbb6;
  border-radius:20px;padding:12px 22px;box-shadow:0 6px 18px -8px rgba(230,0,0,.2)}
.vcx-logo img{display:block;height:52px;width:auto}
.vcx-title{margin:16px 0 8px;font-size:21px;font-weight:800;line-height:1.3}
.vcx-status{display:inline-flex;align-items:center;gap:7px;margin:0;padding:6px 14px;border-radius:999px;
  background:#fff6df;border:1px solid #eadbb6;color:#7a5a10;font-size:12.5px;font-weight:700;line-height:1.5}
.vcx-status b{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-weight:800;direction:ltr;unicode-bidi:isolate}
.vcx-body{padding:0 18px calc(20px + env(safe-area-inset-bottom,0px))}

.vcx-ticket{position:relative;background:#fff;border:1px solid #eadbb6;border-radius:20px;
  box-shadow:0 14px 30px -18px rgba(154,115,28,.45)}
.vcx-amount{padding:20px 20px 18px;text-align:center}
.vcx-label{display:block;color:#5b6473;font-size:13px;font-weight:700;margin-bottom:4px}
.vcx-amount-val{display:block;font-size:19px;font-weight:800;color:#141b2b}
.vcx-amount-val span{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:44px;font-weight:800;
  letter-spacing:-.02em;line-height:1.1;margin-inline-start:6px;direction:ltr;unicode-bidi:isolate}
.vcx-perf{position:relative;height:0;border-top:2px dashed #eadbb6;margin:0 14px}
.vcx-perf::before,.vcx-perf::after{content:"";position:absolute;top:-11px;width:20px;height:20px;border-radius:50%;
  background:#f3f6f4;border:1px solid #eadbb6}
.vcx-perf::before{right:-25px;clip-path:inset(0 50% 0 0)}
.vcx-perf::after{left:-25px;clip-path:inset(0 0 0 50%)}
.vcx-rows{margin:0;padding:6px 20px 8px}
.vcx-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0}
.vcx-row+.vcx-row{border-top:1px solid #f0ebdc}
.vcx-row dt{display:flex;align-items:center;gap:8px;margin:0;color:#5b6473;font-size:13.5px;font-weight:700;white-space:nowrap}
.vcx-row dt i{color:#c59b3f;width:16px;text-align:center}
.vcx-row dd{margin:0;font-size:15px;font-weight:800;color:#141b2b}
.vcx-phone{display:flex;align-items:center;gap:10px}
.vcx-phone span{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:17px;letter-spacing:.02em;direction:ltr;unicode-bidi:isolate}
.vcx-copy{flex:none;width:38px;height:38px;padding:0;border:1px solid #eadbb6;background:#faf7ee;color:#7a5a10;
  border-radius:12px;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  transition:background .15s,color .15s,border-color .15s}
.vcx-copy:hover{background:#f6efd9}
.vcx-copy.is-done{background:#e6f4ec;border-color:#b9dfc9;color:#1e7b54}
.vcx-copy.is-error{background:#fdecec;border-color:#f3c0c0;color:#b42318}
.vcx-phone-num{display:inline-block;text-align:center}
.vcx-phone-num.is-copied{color:#1e7b54;font-family:'Tajawal','Cairo',sans-serif;font-size:15px;font-weight:800;direction:rtl;letter-spacing:0}
.vcx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.vcx-steps{list-style:none;margin:18px 4px 0;padding:0;counter-reset:vcx}
.vcx-steps li{position:relative;padding:0 38px 0 0;margin:0 0 12px;font-size:13.5px;line-height:1.75;color:#404943;counter-increment:vcx}
.vcx-steps li::before{content:counter(vcx);position:absolute;right:0;top:1px;width:26px;height:26px;border-radius:50%;
  background:#141b2b;color:#fff;font:800 13px 'Plus Jakarta Sans','Cairo',sans-serif;display:flex;align-items:center;justify-content:center}

.vcx-actions{display:grid;gap:10px;margin-top:18px}
.vcx-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;padding:0 20px;
  border:0;border-radius:999px;font:800 15.5px 'Tajawal','Cairo',sans-serif;color:#fff;text-decoration:none;cursor:pointer;
  transition:filter .15s,transform .15s}
.vcx-btn i{font-size:18px}
.vcx-btn:hover{filter:brightness(1.08)}
.vcx-btn:active{transform:scale(.98)}
.vcx-btn-app{background:#e60000;box-shadow:0 10px 22px -10px rgba(230,0,0,.7)}
.vcx-btn-wa{background:#128c4e;box-shadow:0 10px 22px -10px rgba(18,140,78,.7)}
.vcx-note{margin:14px 6px 0;text-align:center;font-size:12px;line-height:1.7;color:#5b6473}
.vcx-note i{color:#c59b3f;margin-inline-end:5px}
.vcx-sheet :focus-visible{outline:3px solid #c59b3f;outline-offset:2px}
@keyframes vcx-fade{from{opacity:0}to{opacity:1}}
@keyframes vcx-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.vcx-overlay,.vcx-sheet{animation:none}.vcx-btn{transition:none}}
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

    const overlay = document.createElement("div");
    overlay.id = "vcx-overlay";
    overlay.className = "vcx-overlay";
    overlay.setAttribute("dir", "rtl");
    overlay.innerHTML = `
      <div class="vcx-sheet" role="dialog" aria-modal="true" aria-labelledby="vcx-title" tabindex="-1">
        <button type="button" class="vcx-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>

        <header class="vcx-head">
          <div class="vcx-logo"><img src="${LOGO_SRC}" alt="Vodafone Cash" width="80" height="52"></div>
          <h2 class="vcx-title" id="vcx-title">الدفع عبر فودافون كاش</h2>
          <p class="vcx-status"><i class="fa-regular fa-clock"></i> الطلب رقم <b>#${esc(orderNo)}</b> بانتظار تأكيد الدفع</p>
        </header>

        <div class="vcx-body">
          <section class="vcx-ticket" aria-label="بيانات التحويل">
            <div class="vcx-amount">
              <span class="vcx-label">المبلغ المطلوب</span>
              <strong class="vcx-amount-val"><span>${esc(formatAmount(total))}</span> جنيه</strong>
            </div>
            <div class="vcx-perf" aria-hidden="true"></div>
            <dl class="vcx-rows">
              <div class="vcx-row">
                <dt><i class="fa-regular fa-credit-card"></i> طريقة الدفع</dt>
                <dd>${PAYMENT_LABEL}</dd>
              </div>
              <div class="vcx-row">
                <dt><i class="fa-solid fa-mobile-screen"></i> رقم الهاتف للتحويل</dt>
                <dd class="vcx-phone">
                  <span class="vcx-phone-num">${esc(config.phone)}</span>
                  <button type="button" class="vcx-copy" aria-label="نسخ رقم الهاتف" title="نسخ الرقم"><i class="fa-regular fa-copy"></i></button>
                  <span class="vcx-sr" role="status" aria-live="polite"></span>
                </dd>
              </div>
            </dl>
          </section>

          <ol class="vcx-steps">
            <li>حوّل المبلغ المطلوب إلى رقم الهاتف الموضح بالأعلى باستخدام تطبيق فودافون كاش.</li>
            <li>بعد إتمام التحويل، قم بتصوير إيصال الدفع وأرسله على واتساب المتجر لتأكيد الطلب.</li>
          </ol>

          <div class="vcx-actions">
            <button type="button" class="vcx-btn vcx-btn-app"><i class="fa-solid fa-mobile-screen-button"></i> فتح تطبيق فودافون كاش</button>
            <a class="vcx-btn vcx-btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> إرسال إيصال الدفع على WhatsApp</a>
          </div>

          <p class="vcx-note"><i class="fa-solid fa-shield-halved"></i>لا يُعتبر الطلب مدفوعًا إلا بعد مراجعة إيصال التحويل وتأكيده من المتجر.</p>
        </div>
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

    const copyBtn = overlay.querySelector(".vcx-copy");
    const copyLive = overlay.querySelector(".vcx-phone .vcx-sr");
    const numEl = overlay.querySelector(".vcx-phone-num");
    let copyTimer = null;
    copyBtn.onclick = async () => {
      const ok = await copyText(config.phone);
      const icon = copyBtn.querySelector("i");
      const msg = ok ? "تم نسخ الرقم" : "تعذر النسخ";
      copyBtn.classList.toggle("is-done", ok);
      copyBtn.classList.toggle("is-error", !ok);
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
    PAYMENT_VALUE, PAYMENT_LABEL, loadConfig, showPopup, buildWhatsAppUrl,
    get ORDER_STATUS() { return orderStatus(); },
    get ORDER_STATUS_CODE() { return window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending'; }
  };
})();
