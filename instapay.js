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
 *   instapay_phone : رقم الهاتف اللي العميل يحوّل عليه (لو مش موجود بنستخدم DEFAULT_PHONE تحت)
 *   store_whatsapp : رقم واتساب المتجر (اختياري - لو مش موجود بنستخدم الرقم الافتراضي تحت)
 *   instapay_link  : رابط الدفع الخاص بحسابك من تطبيق InstaPay (https://ipn.eg/S/.../instapay/...)
 *                    اختياري، لكنه بيخلي زر "فتح تطبيق InstaPay" يفتح التطبيق فعلاً على الموبايل
 */
window.InstaPayCheckout = (() => {
  const PAYMENT_VALUE = "instapay";
  const PAYMENT_LABEL = "InstaPay";
  // النص بييجي من المصدر الموحّد (order-status.js) بدل ما يتكرر هنا لوحده
  const ORDER_STATUS = window.OrderStatus
    ? window.OrderStatus.label(window.OrderStatus.CODES.PENDING, 'instapay')
    : "بانتظار تأكيد الدفع - InstaPay";
  const ORDER_STATUS_CODE = window.OrderStatus ? window.OrderStatus.CODES.PENDING : 'pending';

  const DEFAULT_WHATSAPP = "201146809133";
  // حطي رابط الدفع بتاع حسابك بين علامتي التنصيص، مثال: "https://ipn.eg/S/name/instapay/AbC123"
  const DEFAULT_LINK = "";
  const DEFAULT_PHONE = "01065863803"; // رقم التحويل الافتراضي (لو مفيش instapay_phone صالح في الإعدادات)
  const ANDROID_PACKAGE = "com.egyptianbanks.instapay";
  const PLAY_URL = "https://play.google.com/store/apps/details?id=" + ANDROID_PACKAGE;
  const IOS_URL = "https://apps.apple.com/eg/app/instapay-egypt/id1592108795";
  const WEB_URL = "https://www.instapay.eg";
  const LOGO_SRC = "instapay-logo.png";

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
    const phone = normalizePhone(row.instapay_phone) || DEFAULT_PHONE;
    return {
      phone,
      whatsapp: normalizeWhatsApp(row.store_whatsapp) || DEFAULT_WHATSAPP,
      link: normalizeLink(row.instapay_link) || normalizeLink(DEFAULT_LINK),
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
   *  - لو فيه رابط دفع صحيح (instapay_link / DEFAULT_LINK): أندرويد بيفتحه في التطبيق مباشرة
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
  background:rgba(20,27,43,.58);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
  font-family:'Tajawal','Cairo',sans-serif;animation:ipx-fade .18s ease-out}
.ipx-overlay *,.ipx-overlay *::before,.ipx-overlay *::after{box-sizing:border-box}
.ipx-sheet{position:relative;width:100%;max-width:440px;max-height:calc(100dvh - 8px);overflow-y:auto;
  background:#f3f6f4;border-radius:28px 28px 0 0;color:#141b2b;box-shadow:0 -12px 48px rgba(20,27,43,.28);
  outline:none;animation:ipx-up .26s cubic-bezier(.2,.8,.2,1)}
@media(min-width:640px){
  .ipx-overlay{align-items:center;padding:24px}
  .ipx-sheet{border-radius:28px;max-height:calc(100dvh - 48px);box-shadow:0 30px 80px rgba(20,27,43,.35)}
}
.ipx-close{position:absolute;top:14px;left:14px;width:40px;height:40px;border:0;border-radius:50%;
  background:#fff;color:#404943;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 1px 0 #eadbb6,0 2px 8px rgba(20,27,43,.08);font-size:15px}
.ipx-close:hover{background:#faf7ee}
.ipx-head{padding:30px 24px 18px;text-align:center}
.ipx-logo{display:inline-flex;align-items:center;justify-content:center;background:#fff;border:1px solid #eadbb6;
  border-radius:20px;padding:12px 22px;box-shadow:0 6px 18px -8px rgba(90,45,130,.25)}
.ipx-logo img{display:block;height:52px;width:auto}
.ipx-title{margin:16px 0 8px;font-size:21px;font-weight:800;line-height:1.3}
.ipx-status{display:inline-flex;align-items:center;gap:7px;margin:0;padding:6px 14px;border-radius:999px;
  background:#fff6df;border:1px solid #eadbb6;color:#7a5a10;font-size:12.5px;font-weight:700;line-height:1.5}
.ipx-status b{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-weight:800;direction:ltr;unicode-bidi:isolate}
.ipx-body{padding:0 18px calc(20px + env(safe-area-inset-bottom,0px))}

.ipx-ticket{position:relative;background:#fff;border:1px solid #eadbb6;border-radius:20px;
  box-shadow:0 14px 30px -18px rgba(154,115,28,.45)}
.ipx-amount{padding:20px 20px 18px;text-align:center}
.ipx-label{display:block;color:#5b6473;font-size:13px;font-weight:700;margin-bottom:4px}
.ipx-amount-val{display:block;font-size:19px;font-weight:800;color:#141b2b}
.ipx-amount-val span{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:44px;font-weight:800;
  letter-spacing:-.02em;line-height:1.1;margin-inline-start:6px;direction:ltr;unicode-bidi:isolate}
.ipx-perf{position:relative;height:0;border-top:2px dashed #eadbb6;margin:0 14px}
.ipx-perf::before,.ipx-perf::after{content:"";position:absolute;top:-11px;width:20px;height:20px;border-radius:50%;
  background:#f3f6f4;border:1px solid #eadbb6}
.ipx-perf::before{right:-25px;clip-path:inset(0 50% 0 0)}
.ipx-perf::after{left:-25px;clip-path:inset(0 0 0 50%)}
.ipx-rows{margin:0;padding:6px 20px 8px}
.ipx-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0}
.ipx-row+.ipx-row{border-top:1px solid #f0ebdc}
.ipx-row dt{display:flex;align-items:center;gap:8px;margin:0;color:#5b6473;font-size:13.5px;font-weight:700;white-space:nowrap}
.ipx-row dt i{color:#c59b3f;width:16px;text-align:center}
.ipx-row dd{margin:0;font-size:15px;font-weight:800;color:#141b2b}
.ipx-phone{display:flex;align-items:center;gap:10px}
.ipx-phone span{font-family:'Plus Jakarta Sans','Cairo',sans-serif;font-size:17px;letter-spacing:.02em;direction:ltr;unicode-bidi:isolate}
.ipx-copy{flex:none;width:38px;height:38px;padding:0;border:1px solid #eadbb6;background:#faf7ee;color:#7a5a10;
  border-radius:12px;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  transition:background .15s,color .15s,border-color .15s}
.ipx-copy:hover{background:#f6efd9}
.ipx-copy.is-done{background:#e6f4ec;border-color:#b9dfc9;color:#1e7b54}
.ipx-copy.is-error{background:#fdecec;border-color:#f3c0c0;color:#b42318}
.ipx-phone-num{display:inline-block;text-align:center}
.ipx-phone-num.is-copied{color:#1e7b54;font-family:'Tajawal','Cairo',sans-serif;font-size:15px;font-weight:800;direction:rtl;letter-spacing:0}
.ipx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.ipx-steps{list-style:none;margin:18px 4px 0;padding:0;counter-reset:ipx}
.ipx-steps li{position:relative;padding:0 38px 0 0;margin:0 0 12px;font-size:13.5px;line-height:1.75;color:#404943;counter-increment:ipx}
.ipx-steps li::before{content:counter(ipx);position:absolute;right:0;top:1px;width:26px;height:26px;border-radius:50%;
  background:#141b2b;color:#fff;font:800 13px 'Plus Jakarta Sans','Cairo',sans-serif;display:flex;align-items:center;justify-content:center}

.ipx-actions{display:grid;gap:10px;margin-top:18px}
.ipx-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;padding:0 20px;
  border:0;border-radius:999px;font:800 15.5px 'Tajawal','Cairo',sans-serif;color:#fff;text-decoration:none;cursor:pointer;
  transition:filter .15s,transform .15s}
.ipx-btn i{font-size:18px}
.ipx-btn:hover{filter:brightness(1.08)}
.ipx-btn:active{transform:scale(.98)}
.ipx-btn-app{background:#5a2d82;box-shadow:0 10px 22px -10px rgba(90,45,130,.7)}
.ipx-btn-wa{background:#128c4e;box-shadow:0 10px 22px -10px rgba(18,140,78,.7)}
.ipx-note{margin:14px 6px 0;text-align:center;font-size:12px;line-height:1.7;color:#5b6473}
.ipx-note i{color:#c59b3f;margin-inline-end:5px}
.ipx-sheet :focus-visible{outline:3px solid #c59b3f;outline-offset:2px}
@keyframes ipx-fade{from{opacity:0}to{opacity:1}}
@keyframes ipx-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.ipx-overlay,.ipx-sheet{animation:none}.ipx-btn{transition:none}}
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

    const overlay = document.createElement("div");
    overlay.id = "ipx-overlay";
    overlay.className = "ipx-overlay";
    overlay.setAttribute("dir", "rtl");
    overlay.innerHTML = `
      <div class="ipx-sheet" role="dialog" aria-modal="true" aria-labelledby="ipx-title" tabindex="-1">
        <button type="button" class="ipx-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>

        <header class="ipx-head">
          <div class="ipx-logo"><img src="${LOGO_SRC}" alt="InstaPay" width="80" height="52"></div>
          <h2 class="ipx-title" id="ipx-title">الدفع عبر InstaPay</h2>
          <p class="ipx-status"><i class="fa-regular fa-clock"></i> الطلب رقم <b>#${esc(orderNo)}</b> بانتظار تأكيد الدفع</p>
        </header>

        <div class="ipx-body">
          <section class="ipx-ticket" aria-label="بيانات التحويل">
            <div class="ipx-amount">
              <span class="ipx-label">المبلغ المطلوب</span>
              <strong class="ipx-amount-val"><span>${esc(formatAmount(total))}</span> جنيه</strong>
            </div>
            <div class="ipx-perf" aria-hidden="true"></div>
            <dl class="ipx-rows">
              <div class="ipx-row">
                <dt><i class="fa-regular fa-credit-card"></i> طريقة الدفع</dt>
                <dd>${PAYMENT_LABEL}</dd>
              </div>
              <div class="ipx-row">
                <dt><i class="fa-solid fa-mobile-screen"></i> رقم الهاتف للتحويل</dt>
                <dd class="ipx-phone">
                  <span class="ipx-phone-num">${esc(config.phone)}</span>
                  <button type="button" class="ipx-copy" aria-label="نسخ رقم الهاتف" title="نسخ الرقم"><i class="fa-regular fa-copy"></i></button>
                  <span class="ipx-sr" role="status" aria-live="polite"></span>
                </dd>
              </div>
            </dl>
          </section>

          <ol class="ipx-steps">
            <li>حوّل المبلغ المطلوب إلى رقم الهاتف الموضح بالأعلى باستخدام تطبيق InstaPay.</li>
            <li>بعد إتمام التحويل، قم بتصوير إيصال الدفع وأرسله على واتساب المتجر لتأكيد الطلب.</li>
          </ol>

          <div class="ipx-actions">
            <button type="button" class="ipx-btn ipx-btn-app"><i class="fa-solid fa-mobile-screen-button"></i> فتح تطبيق InstaPay</button>
            <a class="ipx-btn ipx-btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> إرسال إيصال الدفع على WhatsApp</a>
          </div>

          <p class="ipx-note"><i class="fa-solid fa-shield-halved"></i>لا يُعتبر الطلب مدفوعًا إلا بعد مراجعة إيصال التحويل وتأكيده من المتجر.</p>
        </div>
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
      // التأكيد بيظهر مكان الرقم نفسه (بنفس العرض) عشان مفيش حاجة تتحرك أو تتغطى
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

  return { PAYMENT_VALUE, PAYMENT_LABEL, ORDER_STATUS, ORDER_STATUS_CODE, loadConfig, showPopup, buildWhatsAppUrl, getOpenAppTarget, normalizeLink };
})();
