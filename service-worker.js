// ============================================================
// Service Worker - نسخة مُصححة (v3)
// ============================================================
// التغييرات الرئيسية عن النسخة السابقة:
// 1) إضافة كل صفحات وملفات الأقسام (قراءة/استماع/كتابة) للكاش الأساسي
//    لمنع ظهور صفحة "لا يوجد اتصال" الافتراضية من المتصفح عند فقدان الإنترنت.
// 2) إصلاح تخزين الملفات الصوتية القادمة من مصادر خارجية (GitHub):
//    الردود من نطاقات خارجية بدون CORS تكون من نوع "opaque" بحالة status = 0،
//    والشرط القديم (status !== 200) كان يمنع تخزينها للأبد. تم تصحيح ذلك.
// 3) إضافة صفحة بديلة (offline.html) تظهر عند فتح أي رابط غير مُخزَّن
//    أثناء انقطاع الإنترنت، بنفس هوية التطبيق بدل صفحة Chrome الافتراضية.
// 4) إستراتيجية "Stale-While-Revalidate" للملفات العادية: تعرض النسخة
//    المخزنة فوراً (سريع) وتحدّثها بصمت في الخلفية عند توفر الإنترنت.
// ============================================================

const CACHE_NAME = 'korean-app-v3';

// ✅ كل الملفات والصفحات الأساسية التي يحتاجها التطبيق ليعمل بدون إنترنت
const STATIC_ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'data.js',
  'data2.js',
  'data3.js',
  'data4.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'offline.html',

  // أقسام التطبيق الفرعية (كانت ناقصة سابقاً)
  'reading-menu.html',
  'reading-system.html',
  'reading-data.js',
  'listening-system.html',
  'listening-data.js',
  'listening-engine.js',
  'writing-system.html',
  'writing-data.js',
  'writing-engine.js',
  'chat.html'
];

// ========== حدث التثبيت: تخزين الملفات الأساسية ==========
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 جارٍ تخزين الملفات الأساسية...');
      // نستخدم allSettled بدل addAll حتى لو فشل تخزين ملف واحد
      // لا يفشل تثبيت الـ Service Worker كله
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('⚠️ تعذر تخزين الملف:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ========== حدث التفعيل: تنظيف الكاش القديم ==========
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ========== حدث الجلب ==========
self.addEventListener('fetch', event => {
  const request = event.request;

  // نتجاهل أي طلب غير GET (مثل POST) لتجنب أخطاء caches.put
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);

  // -----------------------------------------------------------
  // 1) طلبات التنقل بين الصفحات (فتح صفحة HTML جديدة)
  //    إذا تعذّر الاتصال ولم تكن الصفحة مخزنة => نعرض offline.html
  // -----------------------------------------------------------
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // تحديث الكاش بالنسخة الجديدة من الصفحة
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('offline.html'))
        )
    );
    return;
  }

  // -----------------------------------------------------------
  // 2) الملفات الصوتية (mp3, wav, ogg, m4a, aac) - من GitHub أو أي مصدر خارجي
  // -----------------------------------------------------------
  if (requestUrl.pathname.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            // ✅ الإصلاح المهم: الردود القادمة من نطاقات خارجية بدون
            // ضبط crossOrigin تكون من نوع "opaque" وقيمة status لها 0،
            // لكنها صالحة تماماً للتشغيل والتخزين. لذلك نقبل الحالتين:
            // status === 200 (نفس المصدر/CORS) أو type === 'opaque' (عبر مصدر خارجي)
            if (response && (response.status === 200 || response.type === 'opaque')) {
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clonedResponse));
            }
            return response;
          })
          .catch(() => new Response(null, { status: 408, statusText: 'Offline' }));
      })
    );
    return;
  }

  // -----------------------------------------------------------
  // 3) باقي الملفات (CSS, JS, خطوط, صور...): Stale-While-Revalidate
  //    تعرض النسخة المخزنة فوراً، وتحدّثها بصمت في الخلفية إن وُجد إنترنت
  // -----------------------------------------------------------
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached); // عند فقد الاتصال: استخدم النسخة المخزنة كحل أخير

      return cached || networkFetch;
    })
  );
});
