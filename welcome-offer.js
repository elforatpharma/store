/**
 * WelcomeOffer - كوبون WELCOME10 لأول 24 ساعة من زيارة الزائر
 * الفرات فارما (يوضع في المتجر، مش في لوحة التحكم)
 *
 * المنطق:
 *  - أول مرة يفتح الزائر المتجر → نافذة 24 ساعة بتبدأ وبيظهر بانر الكوبون.
 *  - نافذة الـ 24 ساعة دي هي نفسها نافذة عداد العرض في أعلى الصفحة (جدول
 *    offer_countdowns في Supabase، مربوطة بـ IP الزائر)، عشان الاتنين يخلصوا
 *    مع بعض بالظبط، ومتفضلش تتصفّر لو الزائر مسح الكاش (السيرفر هو المرجع).
 *  - لو الـ 24 ساعة خلصت ولسه ما اشتراش → الكوبون يتلغي تلقائياً ولا يرجع
 *    يفتح تاني لنفس الـ IP.
 *  - بعد إتمام أول طلب بالكوبون → يتلغي فوراً (markUsed)، قبل ما الوقت يخلص.
 *  - ملحوظة أمان: الحماية الحقيقية من إعادة الاستخدام مش هنا، دي في السيرفر
 *    (رقم الهاتف وقت الطلب - شوفي welcome_coupon.sql). النافذة دي بس تحدد
 *    "متاح وللا لأ" في واجهة المتجر، وممكن تتصفّر لو الزائر غيّر IP (VPN)
 *    مع مسح الكاش مع بعض، لأن مفيش هوية تانية أقوى من كده للزائر المجهول.
 *
 * الاستخدام في المتجر:
 *   <script src="welcome-offer.js"></script>          // قبل analysis.js
 *
 *   WelcomeOffer.isEligible()        // true لو لسه جوه نافذة الـ 24 ساعة
 *   WelcomeOffer.guard(code)         // {ok:false,message} لو الكود WELCOME10 والزائر مش مؤهل
 *   WelcomeOffer.markUsed()          // نادِها بعد نجاح الطلب
 *   WelcomeOffer.expire(reason)      // إلغاء يدوي (بينادى تلقائياً برضه)
 *   WelcomeOffer.reconcile(endTime, expired) // بتنادى من analysis.js بعد ما ياخد
 *                                     // نافذة الـ IP الحقيقية من السيرفر
 *   WelcomeOffer.setApplyHandler(fn) // fn() ترجع {ok, message} — بتفعّل زرار "طبّقي الكوبون" في البانر
 */
(function () {
  'use strict';

  var CODE = 'WELCOME10';
  var KEY = 'elforat_welcome_offer_v1'; // localStorage: حالة العرض للزائر
  var DURATION = 24 * 60 * 60 * 1000;   // 24 ساعة بالظبط

  function storageWorks() {
    try {
      localStorage.setItem('__wo_test', '1');
      var ok = localStorage.getItem('__wo_test') === '1';
      localStorage.removeItem('__wo_test');
      return ok;
    } catch (e) { return false; }
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }

  var canStore = storageWorks();
  var state = canStore ? read() : null;
  var expiryTimer = null;

  if (!canStore) {
    // لو المتصفح مانع التخزين مقدرش أحدد نافذة الـ 24 ساعة بثبات → مفيش عرض
    state = { status: 'expired', reason: 'no_storage' };
  } else if (!state || typeof state.endTime !== 'number') {
    // أول زيارة على الإطلاق (أو نسخة قديمة من التخزين قبل التحديث ده):
    // تخمين محلي مؤقت لحد ما analysis.js يجيب نافذة الـ IP الحقيقية من السيرفر
    // عبر reconcile() ويظبطها لو مختلفة.
    state = { status: 'active', endTime: Date.now() + DURATION };
    write(state);
  }

  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  function clearScheduledExpiry() {
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
  }

  // بيجدول إلغاء تلقائي بالظبط في لحظة انتهاء الـ 24 ساعة حتى لو التاب فاضل مفتوح
  function scheduleExpiry() {
    clearScheduledExpiry();
    if (state.status !== 'active' || typeof state.endTime !== 'number') return;
    var ms = state.endTime - Date.now();
    if (ms <= 0) { expire('time_up'); return; }
    // setTimeout بحد أقصى آمن (لو الفرق كبير جداً لأي سبب)
    expiryTimer = setTimeout(function () { expire('time_up'); }, Math.min(ms, 2147000000));
  }

  function isEligible() {
    if (state.status !== 'active') return false;
    if (typeof state.endTime === 'number' && Date.now() >= state.endTime) {
      expire('time_up');
      return false;
    }
    return true;
  }

  // بتزامن النافذة المحلية مع نافذة الـ IP الحقيقية الجاية من السيرفر (analysis.js).
  // لو الزائر مسح الكاش، دي اللي بترجّع الحالة الصحيحة بدل ما تتصفّر من الأول.
  function reconcile(serverEndTime, serverExpired) {
    if (!canStore) return;
    if (state.status === 'expired') {
      // لو اتلغى فعلاً بعد إتمام طلب، سيبيه زي ما هو - مايرجعش يتفتح
      return;
    }
    if (serverExpired) {
      expire('offer_ended');
      return;
    }
    if (typeof serverEndTime === 'number' && serverEndTime !== state.endTime) {
      state.endTime = serverEndTime;
      write(state);
      scheduleExpiry();
      emit();
    }
  }

  function expire(reason) {
    if (state.status === 'expired') return;
    clearScheduledExpiry();
    state.status = 'expired';
    state.reason = reason || 'manual';
    state.expiredAt = Date.now();
    if (canStore) write(state);
    hideBanner();
    emit();
  }

  function guard(code) {
    if (String(code || '').trim().toUpperCase() !== CODE) return { ok: true };
    if (isEligible()) return { ok: true };
    return { ok: false, message: 'كوبون الترحيب صالح لأول زيارة فقط وقد انتهى' };
  }

  // ---------- البانر ----------
  var bannerEl = null;
  var applyHandler = null;
  var textEl = null;
  var actionBtn = null;
  var BASE_TEXT = '🎁 أهلاً بكِ! خصم 10% على زيارتك الأولى بكود ';

  function hideBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null; textEl = null; actionBtn = null;
  }

  function fillText(msg) {
    if (!textEl) return;
    textEl.textContent = '';
    if (msg) { textEl.appendChild(document.createTextNode(msg)); return; }
    textEl.appendChild(document.createTextNode(BASE_TEXT));
    var b = document.createElement('b');
    b.setAttribute('dir', 'ltr');
    b.textContent = CODE;
    textEl.appendChild(b);
  }

  function refreshAction() {
    if (!actionBtn) return;
    actionBtn.disabled = false;
    actionBtn.textContent = applyHandler ? 'طبّقي الكوبون' : 'نسخ الكود';
  }

  function onAction() {
    if (!actionBtn) return;
    if (applyHandler) {
      actionBtn.disabled = true;
      actionBtn.textContent = 'جاري التطبيق...';
      Promise.resolve()
        .then(function () { return applyHandler(); })
        .then(function (res) {
          if (res && res.ok) {
            actionBtn.textContent = 'تم التطبيق ✓';
            fillText('تم تطبيق خصم ' + (res.discount_percentage || 10) + '% على سلتك 🎉');
            setTimeout(hideBanner, 2500);
          } else {
            fillText((res && res.message) || 'تعذر تطبيق الكوبون');
            refreshAction();
            setTimeout(function () { fillText(null); }, 3500);
          }
        })
        .catch(function () { fillText('تعذر تطبيق الكوبون'); refreshAction(); });
    } else {
      // البانر يختفي فورًا بعد نسخ الكود - الكوبون نفسه يفضل صالح للاستخدام
      // في الشيك أوت (isEligible مابيتغيّرش هنا)، البانر بس هو اللي بيختفي.
      var done = function () {
        if (actionBtn) actionBtn.textContent = 'تم النسخ ✓';
        setTimeout(hideBanner, 700);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CODE).then(done, done);
      } else { done(); }
    }
  }

  function showBanner() {
    if (bannerEl || !isEligible()) return;
    var el = document.createElement('div');
    el.setAttribute('dir', 'rtl');
    el.className = 'welcome-offer-banner';
    el.style.cssText =
      'position:fixed;bottom:16px;right:16px;left:16px;max-width:420px;margin-inline:auto;z-index:99999;' +
      'background:linear-gradient(90deg,#4d3ceb 0%,#8536ff 100%);color:#fff;border-radius:16px;' +
      'padding:14px 16px;box-shadow:0 10px 30px rgba(77,60,235,.35);font-family:Tajawal,sans-serif;' +
      'display:flex;align-items:center;gap:12px;';

    textEl = document.createElement('div');
    textEl.style.cssText = 'flex:1;font-size:14px;line-height:1.6;';

    actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.style.cssText =
      'background:#fff;color:#4d3ceb;border:0;border-radius:999px;padding:8px 14px;font-weight:800;cursor:pointer;font-size:13px;white-space:nowrap;';
    actionBtn.onclick = onAction;

    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'إغلاق');
    close.textContent = '×';
    close.style.cssText = 'background:transparent;color:#fff;border:0;font-size:22px;cursor:pointer;line-height:1;';
    close.onclick = hideBanner;

    el.appendChild(textEl);
    el.appendChild(actionBtn);
    el.appendChild(close);
    document.body.appendChild(el);
    bannerEl = el;
    fillText(null);
    refreshAction();
  }

  function init() {
    if (isEligible()) { showBanner(); scheduleExpiry(); }
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  window.WelcomeOffer = {
    code: CODE,
    isEligible: isEligible,
    guard: guard,
    markUsed: function () { expire('order_placed'); },
    expire: expire,
    reconcile: reconcile,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    setApplyHandler: function (fn) {
      applyHandler = (typeof fn === 'function') ? fn : null;
      refreshAction();
    }
  };
})();
