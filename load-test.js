import http from 'k6/http';
import { check, sleep } from 'k6';

// =====================================================================
// اختبار ضغط - الفرات فارما (Read-Only, آمن)
// =====================================================================
// بيحاكي زائر حقيقي: تحميل الصفحة الرئيسية + جلب المنتجات من Supabase
// (نفس query اللي في analysis.js: .from('products').select('*'))
//
// عن قصد متضمنش: إدخال طلبات (orders)، تتبع الزوار (visitor_events/
// store_events)، أو أي استدعاء لـ Paymob/InstaPay - دي كتابة حقيقية
// في قاعدة بياناتك وهتلوّث الإحصائيات أو تعمل مشاكل مع بوابة الدفع.
// =====================================================================

const SITE_URL = 'https://elforatpharma.github.io/store/';

const SUPABASE_URL = 'https://sidtdxchiqiogfkwbdui.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZHRkeGNoaXFpb2dma3diZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTEyMTAsImV4cCI6MjA4OTY4NzIxMH0.QF1-67Qu2HfWJt3ANSegM87fykOYQBwqC7ggLG8LTVU';

export const options = {
  // ابدئي بحمل خفيف واتأكدي إن السكريبت شغال قبل ما تزوّدي
  stages: [
    { duration: '30s', target: 10 },  // تصعيد تدريجي لـ 10 مستخدمين
    { duration: '1m', target: 10 },   // ثبات على 10 لمدة دقيقة
    { duration: '30s', target: 30 },  // تصعيد لـ 30
    { duration: '1m', target: 30 },   // ثبات على 30
    { duration: '30s', target: 0 },   // تهدئة
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% من الطلبات لازم تحت 2 ثانية
    http_req_failed: ['rate<0.05'],     // معدل الفشل لازم أقل من 5%
  },
};

export default function () {
  // 1. تحميل الصفحة الرئيسية (زي ما بيحصل مع أي زائر)
  const pageRes = http.get(SITE_URL, {
    tags: { name: 'homepage' },
  });
  check(pageRes, {
    'الصفحة الرئيسية رجعت 200': (r) => r.status === 200,
  });

  sleep(1); // محاكاة وقت قراءة الزائر للصفحة

  // 2. جلب المنتجات من Supabase (نفس query اللي في fetchProducts())
  const productsRes = http.get(
    `${SUPABASE_URL}/rest/v1/products?select=*&order=priority.desc,id.asc&limit=1000`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      tags: { name: 'fetch_products' },
    }
  );
  check(productsRes, {
    'جلب المنتجات رجع 200': (r) => r.status === 200,
    'فيه منتجات في الرد': (r) => {
      try {
        return JSON.parse(r.body).length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  sleep(2); // محاكاة تصفح الزائر للمنتجات قبل ما يحمّل تاني
}
