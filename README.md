# تحويل Tailwind من CDN لملف CSS ثابت

الجزء ده لازم يتعمل على جهازك (محتاج إنترنت لتحميل حزمة Tailwind من npm، وده مش متاح في بيئة Claude الحالية).

## الخطوات

1. حملي مجلد `tailwind-build` ده جنب ملف `index.html` بتاعك (نفس مستوى الملف).
2. افتحي Terminal جوه مجلد `tailwind-build` ونفذي:

```bash
npm install
npm install -D @tailwindcss/forms @tailwindcss/container-queries
npm run build
```

3. الأمر ده هيطلعلك ملف اسمه `tailwind-built.css` **جنب `index.html` مباشرة** (برا مجلد tailwind-build) — ده بالظبط المكان اللي `index.html` بيدور عليه الملف فيه، لأني ظبطت مسار الـ `<link>` في الصفحة على كده خلاص.
4. ارفعي `tailwind-built.css` مع باقي ملفات الموقع (جنب index.html و style.css).

## ملاحظات
- ملف `tailwind.config.js` فيه بالظبط نفس الألوان والخطوط والأنيميشن اللي كانت متظبطة جوه `<script>` في الصفحة، فمفيش أي فرق بصري متوقع.
- الإعداد `content` جوه tailwind.config.js بيمسح `index.html` و`analysis.js` و`paymob.js` عشان يلقط كل الكلاسات اللي بتتولّد ديناميكياً من الجافاسكريبت (كروت المنتجات، السلة، إلخ) مش بس اللي في الـ HTML الثابت.
- لو ضفتي كلاسات Tailwind جديدة في المستقبل (مثلاً كلاس مش مستخدم قبل كده)، لازم تعملي `npm run build` تاني عشان يتضاف للملف النهائي.
- لو حابة، أقدر أظبطلك GitHub Action صغيرة تعمل الـ build ده تلقائياً كل ما تعدّلي حاجة وتعمليها push، بدل ما تعمليها يدوي كل مرة — قولّيلي لو تحبي.
