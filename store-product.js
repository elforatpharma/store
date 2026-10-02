/**
 * ELFORAT PHARMA - Product Details Page (lazy chunk)
 * ================================================================
 * صفحة تفاصيل المنتج كانت جزء من analysis.js (نص الملف تقريباً: المعرض،
 * التابات، المراجعات، المنتجات ذات الصلة). فُصلت لملف مستقل بيتحمّل وقت
 * الحاجة، لأن أغلب الزوار بيفتحوا الهيرو/الكتالوج بس ومش بيوصلوا لصفحة
 * المنتج - فالكود كان بيتحمّل ويتقرا ويتحلّل من غير ما حد يستخدمه
 * (Lighthouse "Reduce unused JavaScript").
 *
 * بيتحمّل من analysis.js أول ما حد يطلب صفحة منتج، ومتسخّم مسبقاً عند
 * الـ hover/tap على أي بطاقة منتج.
 *
 * المتغيرات المشتركة (productsDB, sanitize, FavoritesManager, ...) بتيجي من
 * window.ElforatStore اللي analysis.js بيعرّفه.
 */
(function () {
    var S = window.ElforatStore;
    var FavoritesManager = S.FavoritesManager;
    var LOW_STOCK_THRESHOLD = S.LOW_STOCK_THRESHOLD;
    var sanitize = S.sanitize;
    var jsArg = S.jsArg;
    var getFullImg = S.getFullImg;
    var renderFormattedText = S.renderFormattedText;
    var trackStoreEvent = S.trackStoreEvent;
    // ملاحظة: productsDB بيتقرا من S كل مرة (مش نسخة ثابتة) لأن analysis.js
    // بيعيد تعيينه لما يجيب المنتجات من السيرفر.

    // بنك مراجعات عملاء بالعامية المصرية وتجارب حقيقية موثقة
    const REVIEW_POOL = [
        { name: 'نورا أحمد', text: 'المنتج فعلاً روعة، حسيت بالفرق من أول أسبوع، شكراً الفرات فارما 🌸', stars: 5 },
        { name: 'ياسمين محمد', text: 'بجد ما كنتش متوقعة النتيجة دي، جربت كتير قبل كده ومحدش وصل للنتيجة دي، تسلم إيديكم 🌟', stars: 5 },
        { name: 'مريم سامي', text: 'حبيته أوي، ريحته حلوة وملمسه خفيف على البشرة، هطلب تاني أكيد 💕', stars: 5 },
        { name: 'Hagar Nader', text: 'الاسكراب تحفة جداً للبشرة وعجب ماما وأخواتي كلهم، تسلم إيدك بجد ❤️', stars: 5 },
        { name: 'HeBa Gaber', text: 'الغسول جميل أوي بينضف البشرة وحلو أوي عشان المسام الواسعة والفرشة تحسيها بتعمل مساج للوش كده. تسلم إيدك بجد 🌸', stars: 5 },
        { name: 'دينا حسن', text: 'من أحسن حاجات جربتها في العناية، حاسة إن بشرتي بقت أنعم بشكل واضح', stars: 5 },
        { name: 'رنا إبراهيم', text: 'خدمة عملاء محترمة جداً وردوا عليا بسرعة، والمنتج فوق الوصف 👌', stars: 5 },
        { name: 'Alaa Ashraf', text: 'عايزة أشكرك على لوشن جلد الوزة.. جميل جداً ويفضل مرطب الجسم فترة طويلة، وفعلاً جلد الوزة بدأ يقل عندي الحمدلله وكمية قليلة بترطب جزء كبير 🌸', stars: 5 },
        { name: 'هبة الله كريم', text: 'تجربتي معاكم كانت جميلة من الأول للآخر، ربنا يبارك في شغلكم 🌸', stars: 5 },
        { name: 'نهى فؤاد', text: 'حسيت إني لقيت المنتج اللي كنت بدور عليه من زمان، شكراً ليكم ❤️', stars: 5 },
        { name: 'الأميرة جودي', text: 'بالنسبة لكريم الهالات، ماشاء الله لاحظت إن فيه تفتيح بسيط تحت العين ودي حاجة كويسة جداً في أول أيام.. ربنا يحسن ما بين إيديكي 🌺', stars: 5 },
        { name: 'آية جمال', text: 'الجودة عالية والسعر مناسب جداً بالنسبالها، هرشحه لكل صحابي', stars: 5 },
        { name: 'منة الله شعبان', text: 'أول مرة أثق في منتج مصري بالشكل ده، فعلاً بيعمل اللي بيقوله', stars: 5 },
        { name: 'Amany Abdelrahim', text: 'السيروم كويس ومختلف فعلاً عن أي سيروم استخدمته قبل كده، ملمسه ناعم جميل ومبيلزقش زي الباقي، وبيطري الشعر ورائحته هادية وجميلة 💕', stars: 5 },
        { name: 'شيماء عبد الله', text: 'استخدمته أسبوعين بس وحاسة بفرق حقيقي، ميرسي لتعبكم معانا 🌸', stars: 5 },
        { name: 'أسماء رمضان', text: 'كل اللي كتبوه في الوصف حقيقي، مش دعاية وبس. شكراً جداً 🙏', stars: 5 },
        { name: 'زهرة البنفسجي', text: 'السيرم تحفة بجد كفاية ريحته وسرعة ترطيبه للشعر، الريحة مش مزعجة خالص هادية وجميلة وبيرطب الشعر جداً 🌸', stars: 5 },
        { name: 'عميلة موثقة', text: 'جل الترطيب والنضارة ده خطير بأمانة.. لمعة كوري ونضارة مش طبيعية، وبيفتح أنسجة البشرة جداً وخلّصني من الهالات السودة ✨', stars: 5 },
        { name: 'عميلة موثقة', text: 'الليپ بالم بجد عالجلي تشققات الشفاه قسماً بالله، وبقت موردة ولامعة وشكلها جذاب جداً 💄', stars: 5 },
        { name: 'عميلة موثقة', text: 'استخدمت سيرم Guzel-Gold كذا يوم، بيساعد فعلاً على تقليل الهيشان ومش بيسيب طبقة دهنية، وريحته خفيفة ومقبولة والتركيبة مدروسة جداً 🌿', stars: 5 },
        { name: 'عميلة موثقة', text: 'جل تقشير الرجل اختراع بجد، بيشيل كل الجلد الميت من الرجل تحفة تحفة 🦶✨', stars: 5 },
        { name: 'Eman Abdellatif', text: 'السيرم حلو أوي تسلمي، تحسيه كله مواد طبيعية كده وريحته هادية وبيطري الشعر 🌿', stars: 5 },
        { name: 'جنى وليد', text: 'كنت مترددة أطلب الأول بس بجد يستاهل كل قرش فيه', stars: 5 },
        { name: 'عميلة موثقة', text: 'جربت كريم النضارة تحفة فنية.. والغسول اختراع عشان الفرشة بتنضف من القلب وتخلي الوش منور 🌸', stars: 5 },
        { name: 'عميلة موثقة', text: 'قلل تساقط الشعر عندي الحمد لله أخد حوالي أسبوعين وجاب نتيجة ممتازة.. تسلم إيدك ع المنتج القمر ده ❤️', stars: 5 },
        { name: 'عميلة موثقة', text: 'ملمسه زي اللوشن وخفيف، استخدمته قبل النوم وصحيت شعري طري وناعم ومترطب عن كل يوم 💆‍♀️', stars: 5 }
    ];

    function computeReviewSeed(id) {
        const str = String(id);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) % 100000;
        }
        return hash;
    }

    function getReviewsForProduct(id, count = 4) {
        const seed = computeReviewSeed(id);
        const start = seed % REVIEW_POOL.length;
        const selected = [];
        for (let i = 0; i < count; i++) {
            selected.push(REVIEW_POOL[(start + i) % REVIEW_POOL.length]);
        }
        return selected;
    }

    function computeReviewCountForId(id) {
        const seed = computeReviewSeed(id);
        return 42 + (seed % 190); // عدد تقييمات متفاوت بين المنتجات
    }

    function renderProductDetails(id) {
        const p = S.productsDB.find(prod => prod.id == id);
        const container = document.getElementById('product-details-container');
        if (!container || !p) return;
        trackStoreEvent('product_view', {
            product_id: String(p.id),
            product_name: p.name,
            metadata: { category: p.category, price: p.price, stock: p.stock }
        });

        // خريطة الصور الإضافية لكل منتج (معرض صور متعدد)
        const productGalleries = {
            'كريم لعلاج جلد الوزة': [
                p.img,
                'product-gallery/keratosis-1.webp',
                'product-gallery/keratosis-2.webp',
                'product-gallery/keratosis-3.webp'
            ],
            'keratosis': [
                p.img,
                'product-gallery/keratosis-1.webp',
                'product-gallery/keratosis-2.webp',
                'product-gallery/keratosis-3.webp'
            ],
            'ليب بالم': [
                p.img,
                'product-gallery/lip-balm-1.webp',
                'product-gallery/lip-balm-2.webp'
            ],
            'balm': [
                p.img,
                'product-gallery/lip-balm-1.webp',
                'product-gallery/lip-balm-2.webp'
            ],
            'بالم': [
                p.img,
                'product-gallery/lip-balm-1.webp',
                'product-gallery/lip-balm-2.webp'
            ],
            'تنت': [
                p.img,
                'product-gallery/lip-balm-1.webp',
                'product-gallery/lip-balm-2.webp'
            ],
            'مرطب شفايف': [
                p.img,
                'product-gallery/lip-balm-1.webp',
                'product-gallery/lip-balm-2.webp'
            ],
            'lip': [
                p.img,
                'product-gallery/lip-balm-1.webp',
                'product-gallery/lip-balm-2.webp'
            ],
            'سيروم': [
                p.img,
                'product-gallery/guzel-gold-1.jpg',
                'product-gallery/guzel-gold-2.webp',
                'product-gallery/guzel-gold-3.webp',
                'product-gallery/guzel-gold-4.webp',
                'product-gallery/guzel-gold-5.webp'
            ],
            'guzel': [
                p.img,
                'product-gallery/guzel-gold-1.jpg',
                'product-gallery/guzel-gold-2.webp',
                'product-gallery/guzel-gold-3.webp',
                'product-gallery/guzel-gold-4.webp',
                'product-gallery/guzel-gold-5.webp'
            ],
            'serum': [
                p.img,
                'product-gallery/guzel-gold-1.jpg',
                'product-gallery/guzel-gold-2.webp',
                'product-gallery/guzel-gold-3.webp',
                'product-gallery/guzel-gold-4.webp',
                'product-gallery/guzel-gold-5.webp'
            ]
        };

        // فحص ما إذا كان للمنتج معرض صور مخصص بالاسم أو المعرف
        let extraImgs = null;
        const pNameLower = (p.name || '').toLowerCase();
        for (const [key, imgs] of Object.entries(productGalleries)) {
            if (pNameLower.includes(key.toLowerCase()) || (p.desc && p.desc.toLowerCase().includes(key.toLowerCase()))) {
                extraImgs = imgs;
                break;
            }
        }

        // إذا لم يكن له صور إضافية خاصة، يتم عرض صورته الرسمية فقط
        // [تصحيح]: صور معرض المنتج اللي بتتضاف من لوحة التحكم (inventory.html)
        // بتتخزن في عمود "gallery" في Supabase، مش "images"، فكان الكود هنا
        // بيدوّر على عمود فاضي دايمًا وبالتالي صور المعرض الجديدة ما كانتش
        // بتظهر في المتجر رغم إنها بتتحفظ صح في قاعدة البيانات.
        function parseGalleryField(val) {
            if (!val) return [];
            if (Array.isArray(val)) return val.filter(Boolean);
            if (typeof val === 'string') {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) return parsed.filter(Boolean);
                } catch (e) {
                    if (val.trim().startsWith('http')) return [val.trim()];
                }
            }
            return [];
        }
        let dbImgs = parseGalleryField(p.gallery);
        if (dbImgs.length === 0) dbImgs = parseGalleryField(p.images); // توافق مع أي بيانات قديمة كانت مخزنة باسم images
        const candidateImgs = dbImgs.length > 0 ? dbImgs : (extraImgs || []);
        let mergedImgs = [];
        if (p.img) mergedImgs.push(getFullImg(p.img));
        candidateImgs.forEach(im => {
            if (im && typeof im === 'string') {
                const full = getFullImg(im);
                if (!mergedImgs.includes(full)) mergedImgs.push(full);
            }
        });
        const images = mergedImgs.length > 0 ? mergedImgs : (p.img ? [getFullImg(p.img)] : ['logo.png']);

        // تهيئة حالة المعرض مباشرة (بدون الاعتماد على سكربت مضمّن داخل innerHTML)
        window.productImages = images;
        window.currentImageIndex = 0;
        window.zoomImageIndex = 0;

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
                <!-- معرض الصور -->
                <div class="space-y-4">
                    <div class="product-visual-glass aspect-square flex items-center justify-center p-4 sm:p-6 md:p-8 rounded-3xl overflow-hidden group relative bg-white/50 border border-purple-100/60 shadow-lg">
                        <img id="main-product-img" src="${sanitize(images[0])}" loading="lazy" class="max-h-full max-w-full object-contain transition-all duration-500 hover:scale-105 cursor-zoom-in drop-shadow-xl" onerror="this.src='logo.png'" onclick="openImageZoom('${jsArg(images[0])}')">
                        <!-- أزرار التنقل للمعرض (تظهر فقط عند وجود أكثر من صورة) -->
                        ${images.length > 1 ? `
                        <button onclick="changeProductImage('prev')" class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/95 text-darkNavy backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-primary hover:text-white active:scale-90 z-20" title="الصورة السابقة">
                            <i class="fa-solid fa-chevron-left text-sm"></i>
                        </button>
                        <button onclick="changeProductImage('next')" class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/95 text-darkNavy backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-primary hover:text-white active:scale-90 z-20" title="الصورة التالية">
                            <i class="fa-solid fa-chevron-right text-sm"></i>
                        </button>
                        <div class="absolute top-4 left-4 bg-darkNavy/70 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full z-10">
                            <span id="gallery-current-idx">1</span> / ${images.length}
                        </div>
                        ` : ''}
                        <!-- زر التكبير -->
                        <button onclick="openImageZoom(window.productImages ? window.productImages[window.currentImageIndex || 0] : '${jsArg(images[0])}')" class="absolute bottom-4 right-4 w-10 h-10 bg-white/95 text-darkNavy backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-primary hover:text-white z-20" title="تكبير الصورة">
                            <i class="fa-solid fa-expand text-xs"></i>
                        </button>
                    </div>
                    ${images.length > 1 ? `
                    <div class="flex gap-3 justify-center flex-wrap pt-2">
                        ${images.map((img, idx) => `
                            <button onclick="changeProductImage(${idx})" 
                                    class="thumbnail-btn w-14 h-14 sm:w-20 sm:h-20 bg-white/80 rounded-2xl p-1.5 border-2 ${idx === 0 ? 'border-primary shadow-purple-soft scale-105' : 'border-purple-100 hover:border-primary/50'} transition-all overflow-hidden relative group"
                                    data-index="${idx}">
                                <img src="${sanitize(img)}" loading="lazy" class="w-full h-full object-contain rounded-xl thumbnail-img group-hover:scale-105 transition-transform" onerror="this.src='logo.png'">
                            </button>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
                
                <!-- معلومات المنتج مع تابات -->
                <div class="flex flex-col text-right space-y-6">
                    <div class="space-y-3">
                        <p class="text-primary font-bold text-[10px] uppercase tracking-[0.3em]">${sanitize(p.category)}</p>
                        <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-black leading-tight tracking-tight">${sanitize(p.name)}</h1>
                        <div class="flex items-center gap-4 pt-2 flex-wrap">
                            <span class="text-2xl sm:text-3xl font-bold text-primary">${sanitize(p.price)} ج.م</span>
                            ${p.oldPrice ? `<span class="text-lg text-gray-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                            ${p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0 ? `<span class="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full font-bold low-stock-alert shadow-sm">⚠️ متبقي ${p.stock} فقط!</span>` : ''}
                            ${p.stock === 0 ? `<span class="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-full font-bold shadow-sm">❌ نفذ من المخزون</span>` : ''}
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                            <button id="main-fav-btn" 
                                    onclick="handleMainFavorite('${jsArg(p.id)}'); event.stopPropagation();" 
                                    class="w-12 h-12 rounded-full flex items-center justify-center transition-all ${FavoritesManager.isFavorite(p.id) ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-400'}">
                                <svg class="w-6 h-6" fill="${FavoritesManager.isFavorite(p.id) ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- نظام التابات المحسن -->
                    <div class="border-b border-gray-200">
                        <div class="flex gap-6" role="tablist">
                            <button onclick="switchTab('desc')" 
                                    id="tab-btn-desc"
                                    class="tab-btn pb-3 border-b-2 border-primary text-primary font-bold text-sm transition-all relative"
                                    role="tab"
                                    aria-selected="true"
                                    aria-controls="tab-desc">
                                الوصف
                                <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary transform scale-x-100 transition-transform"></span>
                            </button>
                            <button onclick="switchTab('ingredients')" 
                                    id="tab-btn-ingredients"
                                    class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-bold text-sm transition-all hover:text-gray-700"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="tab-ingredients">
                                المكونات
                            </button>
                            <button onclick="switchTab('reviews')" 
                                    id="tab-btn-reviews"
                                    class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-bold text-sm transition-all hover:text-gray-700"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="tab-reviews">
                                التقييمات
                            </button>
                        </div>
                    </div>
                    
                    <div id="tab-desc" class="tab-content text-gray-600 leading-relaxed animate-fade-in-up">
                        ${renderFormattedText(p.desc, 'أفضل منتجات العناية المختارة بعناية فائقة لضمان أفضل النتائج لبشرتك وشعرك.')}
                        ${p.size ? `<p class="mt-4 text-sm font-medium"><strong>الحجم:</strong> ${sanitize(p.size)}</p>` : ''}
                    </div>
                    
                    <div id="tab-ingredients" class="tab-content hidden text-gray-600 leading-relaxed">
                        ${renderFormattedText(p.ingredients, 'مكونات طبيعية 100% بدون مواد حافظة أو كحول. مناسب لجميع أنواع البشرة والشعر.')}
                    </div>
                    
                    <div id="tab-reviews" class="tab-content hidden text-gray-600 leading-relaxed">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="flex text-yellow-400 text-lg">★★★★★</div>
                            <span class="text-sm font-bold">(${p.rating || '4.9'}/5 من ${computeReviewCountForId(p.id)} تقييم)</span>
                        </div>
                        <div class="space-y-4">
                            ${getReviewsForProduct(p.id, 4).map(r => `
                            <div class="bg-gray-50 p-4 rounded-2xl">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">${sanitize(r.name.charAt(0))}</div>
                                    <span class="font-bold text-sm">${sanitize(r.name)}</span>
                                    <div class="flex text-yellow-400 text-xs mr-auto">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
                                </div>
                                <p class="text-sm text-gray-600">${sanitize(r.text)}</p>
                            </div>`).join('')}
                        </div>
                        <button onclick="app.openAddReviewModal('${jsArg(p.id)}', '${jsArg(p.name)}')" class="mt-4 w-full py-3 border-2 border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition-all text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-star text-amber-400"></i> إضافة تقييمك وتجربتك</button>
                    </div>
                    
                    <!-- أزرار الإجراء -->
                    <div class="space-y-3 pt-4 border-t border-gray-100">
                        <div class="flex items-center gap-4">
                            <div class="flex border-2 border-gray-200 rounded-full" dir="ltr">
                                <button onclick="const qtyInput = document.getElementById('product-qty'); const newVal = Math.max(1, parseInt(qtyInput.value) - 1); qtyInput.value = newVal;" class="px-4 py-3 text-primary font-bold hover:bg-primary/10 transition-colors rounded-l-full active:scale-95">-</button>
                                <input id="product-qty" type="number" value="1" min="1" max="${p.stock}" class="w-12 text-center font-bold border-x-2 border-gray-200 focus:outline-none" readonly>
                                <button onclick="const qtyInput = document.getElementById('product-qty'); const newVal = Math.min(${p.stock}, parseInt(qtyInput.value) + 1); qtyInput.value = newVal;" class="px-4 py-3 text-primary font-bold hover:bg-primary/10 transition-colors rounded-r-full active:scale-95">+</button>
                            </div>
                            <button onclick="app.addToCart('${jsArg(p.id)}', document.getElementById('product-qty').value)" class="flex-1 bg-secondary text-white font-bold uppercase text-sm tracking-widest py-4 rounded-full hover:opacity-90 transition-all shadow-lg shadow-secondary/30 active:scale-95">أضف للحقيبة</button>
                        </div>
                        <button onclick="app.buyNow('${jsArg(p.id)}', document.getElementById('product-qty').value)" class="btn-dark w-full text-white font-bold uppercase text-sm tracking-widest py-4 active:scale-95">اشتري الآن</button>
                    </div>
                </div>
            </div>
            
            <!-- شريط شراء ثابت للموبايل -->
            <div id="mobile-buy-bar" class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-purple-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col shrink-0 pl-1">
                        <span class="text-base font-extrabold text-primary leading-tight">${sanitize(p.price)} <span class="text-[11px] font-bold text-slate-500">ج.م</span></span>
                        ${p.oldPrice ? `<span class="text-[11px] text-slate-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                    </div>
                    <button onclick="app.addToCart('${jsArg(p.id)}', document.getElementById('product-qty').value)" class="flex-1 bg-secondary text-white font-bold text-xs uppercase tracking-widest py-3.5 rounded-full hover:opacity-90 transition-all shadow-lg shadow-secondary/30 active:scale-95">أضف للحقيبة</button>
                    <button onclick="app.buyNow('${jsArg(p.id)}', document.getElementById('product-qty').value)" class="btn-dark text-white font-bold text-xs uppercase tracking-widest py-3.5 px-5 active:scale-95">اشتري الآن</button>
                </div>
            </div>
            
            <!-- نافذة تكبير الصور (Modal) -->
            <div id="image-zoom-modal" class="fixed inset-0 bg-black/95 z-[9999] hidden items-center justify-center" onclick="closeImageZoom()">
                <button onclick="closeImageZoom()" class="absolute top-6 right-6 text-white hover:text-primary transition-colors">
                    <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <button onclick="changeZoomImage(-1)" class="absolute left-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <button onclick="changeZoomImage(1)" class="absolute right-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <img id="zoomed-image" src="" class="max-w-[90vw] max-h-[90vh] object-contain" onclick="event.stopPropagation()">
                <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                    <span id="zoom-counter">1 / 3</span>
                </div>
            </div>`;

        // تحديث Breadcrumb
        const breadcrumbCategory = document.getElementById('breadcrumb-category');
        if (breadcrumbCategory) {
            breadcrumbCategory.textContent = p.category;
        }

        // عرض المنتجات ذات الصلة
        renderRelatedProducts(p.id, p.category);

        // تفعيل دعم لوحة المفاتيح للمعرض المكبر
        initProductGalleryKeyboard();

    }

    // ==========================================
    // دوال معرض منتج واحدة (Global scope) لتجنب مشاكل السكربتات المضمّنة
    // ==========================================
    function changeProductImage(arg) {
        const imgs = Array.isArray(window.productImages) ? window.productImages : [];
        if (imgs.length === 0) return;

        if (arg === 'prev') {
            window.currentImageIndex = (window.currentImageIndex - 1 + imgs.length) % imgs.length;
        } else if (arg === 'next') {
            window.currentImageIndex = (window.currentImageIndex + 1) % imgs.length;
        } else {
            window.currentImageIndex = Number(arg) % imgs.length;
        }

        const mainImg = document.getElementById('main-product-img');
        if (!mainImg) return;
        mainImg.style.opacity = '0';
        mainImg.style.transform = 'scale(0.95)';

        setTimeout(() => {
            mainImg.src = window.productImages[window.currentImageIndex];
            mainImg.style.opacity = '1';
            mainImg.style.transform = 'scale(1)';
        }, 200);

        // تحديث الثمبنيلز والعداد
        const counter = document.getElementById('gallery-current-idx');
        if (counter) counter.textContent = (window.currentImageIndex % window.productImages.length) + 1;

        document.querySelectorAll('.thumbnail-btn').forEach((btn, idx) => {
            if (idx === window.currentImageIndex) {
                btn.classList.add('border-primary', 'shadow-purple-soft', 'scale-105');
                btn.classList.remove('border-purple-100');
            } else {
                btn.classList.remove('border-primary', 'shadow-purple-soft', 'scale-105');
                btn.classList.add('border-purple-100');
            }
        });
    }

    function openImageZoom(imgSrc) {
        const modal = document.getElementById('image-zoom-modal');
        const zoomedImg = document.getElementById('zoomed-image');
        const counter = document.getElementById('zoom-counter');
        if (!modal || !zoomedImg || !Array.isArray(window.productImages) || window.productImages.length === 0) return;

        // البحث عن индекс الصورة الحالية
        window.zoomImageIndex = window.productImages.indexOf(imgSrc);
        if (window.zoomImageIndex === -1) window.zoomImageIndex = 0;

        zoomedImg.src = window.productImages[window.zoomImageIndex];
        counter.textContent = (window.zoomImageIndex + 1) + ' / ' + window.productImages.length;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    function closeImageZoom() {
        const modal = document.getElementById('image-zoom-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }

    function changeZoomImage(direction) {
        const zoomedImg = document.getElementById('zoomed-image');
        const counter = document.getElementById('zoom-counter');
        if (!zoomedImg || !Array.isArray(window.productImages) || window.productImages.length === 0) return;

        if (direction === -1) {
            window.zoomImageIndex = (window.zoomImageIndex - 1 + window.productImages.length) % window.productImages.length;
        } else {
            window.zoomImageIndex = (window.zoomImageIndex + 1) % window.productImages.length;
        }

        zoomedImg.style.opacity = '0';
        zoomedImg.style.transform = 'scale(0.95)';

        setTimeout(() => {
            zoomedImg.src = window.productImages[window.zoomImageIndex];
            zoomedImg.style.opacity = '1';
            zoomedImg.style.transform = 'scale(1)';
            counter.textContent = (window.zoomImageIndex + 1) + ' / ' + window.productImages.length;
        }, 150);
    }

    function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('tab-' + tabName).classList.remove('hidden');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-primary', 'text-primary');
            btn.classList.add('border-transparent', 'text-gray-500');
            btn.setAttribute('aria-selected', 'false');
        });

        const activeBtn = document.getElementById('tab-btn-' + tabName);
        if (activeBtn) {
            activeBtn.classList.remove('border-transparent', 'text-gray-500');
            activeBtn.classList.add('border-primary', 'text-primary');
            activeBtn.setAttribute('aria-selected', 'true');
        }
    }

    function initProductGalleryKeyboard() {
        document.removeEventListener('keydown', productGalleryKeyHandler);
        document.addEventListener('keydown', productGalleryKeyHandler);
    }

    function productGalleryKeyHandler(e) {
        const modal = document.getElementById('image-zoom-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft') changeZoomImage(1);
        if (e.key === 'ArrowRight') changeZoomImage(-1);
        if (e.key === 'Escape') closeImageZoom();
    }

    // تصدير دوال المعرض للاستخدام في onclicks المضمّنة داخل innerHTML
    window.changeProductImage = changeProductImage;
    window.openImageZoom = openImageZoom;
    window.closeImageZoom = closeImageZoom;
    window.changeZoomImage = changeZoomImage;
    window.switchTab = switchTab;
    window.initProductGalleryKeyboard = initProductGalleryKeyboard;
    window.renderRelatedProducts = renderRelatedProducts;

    // دالة عرض المنتجات ذات الصلة
    function renderRelatedProducts(currentId, category) {
        const relatedSection = document.getElementById('related-products');
        const relatedGrid = document.getElementById('related-products-grid');

        if (!relatedSection || !relatedGrid) return;

        // جلب منتجات من نفس الفئة باستثناء المنتج الحالي
        const relatedProducts = S.productsDB
            .filter(p => p.category === category && p.id !== currentId)
            .slice(0, 4);

        if (relatedProducts.length === 0) {
            relatedSection.classList.add('hidden');
            return;
        }

        relatedSection.classList.remove('hidden');
        relatedGrid.innerHTML = relatedProducts.map((p, index) => {
            const isFav = FavoritesManager.isFavorite(p.id);
            const isOutOfStock = p.stock <= 0;

            return `
<article class="pro-product-card p-3 sm:p-4 border border-purple-100/90 shadow-purple-soft flex flex-col justify-between relative group cursor-pointer" onclick="app.navigate('product', '${jsArg(p.id)}')">
    <div class="flex items-center justify-between w-full mb-3 z-10">
        ${p.badge ? `<span class="badge-gold-shimmer text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">${sanitize(p.badge)}</span>` : `<span class="w-8"></span>`}
        <button onclick="event.stopPropagation(); FavoritesManager.toggle('${jsArg(p.id)}');" data-favorite-btn="${sanitize(p.id)}" aria-label="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}" aria-pressed="${isFav ? 'true' : 'false'}" class="favorite-btn btn-fav w-8 h-8 rounded-full bg-white/95 shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all z-20" title="${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
            ${isFav
                    ? `<i class="fa-solid fa-heart text-xs text-rose-500"></i>`
                    : `<i class="fa-regular fa-heart text-xs"></i>`
                }
        </button>
    </div>
    <div class="relative w-full aspect-square rounded-2xl bg-gradient-to-tr from-purple-50/80 to-purple-100/40 p-3 sm:p-4 mb-3.5 flex items-center justify-center overflow-hidden">
        <img src="${sanitize(p.imgThumb || p.img)}" loading="lazy" decoding="async" width="320" height="320" alt="${sanitize(p.name)}" class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-500" onerror="handleImgError(this, '${jsArg(p.img)}')">
        <span class="hidden sm:flex absolute bottom-2 left-2 items-center bg-white/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400 font-mono tracking-widest">ELFORAT</span>
    </div>
    <div class="flex flex-col flex-1">
        <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] font-bold text-primary">${sanitize(p.category || 'العناية')}</span>
            ${isOutOfStock
                    ? '<span class="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">نفذت الكمية</span>'
                    : p.stock <= LOW_STOCK_THRESHOLD
                        ? `<span class="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-bold">متبقي ${p.stock}</span>`
                        : ''
                }
        </div>
        <h3 class="font-extrabold text-darkNavy text-sm line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
            ${sanitize(p.name)}
        </h3>
        <div class="mt-auto pt-3 border-t border-slate-100">
            <div class="flex items-baseline justify-between mb-3">
                <div class="flex items-baseline gap-2">
                    <span class="text-lg sm:text-xl font-black text-darkNavy font-display">${sanitize(p.price)} <span class="text-xs font-bold text-slate-500">ج.م</span></span>
                    ${p.oldPrice ? `<span class="text-xs text-slate-400 line-through">${sanitize(p.oldPrice)} ج.م</span>` : ''}
                </div>
            </div>
            ${!isOutOfStock ? `
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="event.stopPropagation(); app.buyNow('${jsArg(p.id)}')" class="btn-dark py-2.5 text-xs font-bold shadow-sm">اشتري الآن</button>
                    <button onclick="event.stopPropagation(); app.addToCart('${jsArg(p.id)}', 1)" class="btn-add-cart py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:gap-2 transition-all">
                        <i class="fa-solid fa-cart-plus text-xs"></i>
                        <span>أضف للحقيبة</span>
                    </button>
                </div>
            ` : ''}
        </div>
    </div>
</article>`;
        }).join('');
    }

    window.ElforatProduct = {
        render: renderProductDetails,
        renderRelatedProducts: renderRelatedProducts
    };
})();
