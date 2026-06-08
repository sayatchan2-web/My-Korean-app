// إصدار الكاش (غيّره إذا أردت تحديث الملفات)
const CACHE_NAME = 'korean-app-v2';

// الملفات الأساسية التي ستُخزَّن فور تثبيت التطبيق
const STATIC_ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'data.js',
  'data2.js',
  'data3.js',
  'data4.js',
  'reading-menu.html',
  'writing-system.html',
  'listening-system.html',
  'chat.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// ========== حدث التثبيت: تخزين الملفات الأساسية ==========
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 جارٍ تخزين الملفات الأساسية...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // تفعيل الـ Service Worker فوراً بدون انتظار إغلاق التبويبات القديمة
  self.skipWaiting();
});

// ========== حدث التفعيل: تنظيف الكاش القديم ==========
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ========== حدث الجلب: استراتيجية ذكية للملفات ==========
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // ✅ إذا كان الملف صوتي (mp3, wav, ogg) من GitHub أو أي مصدر
  if (requestUrl.pathname.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // إذا موجود بالكاش أرجعه فوراً
        if (cached) {
          return cached;
        }
        // إذا مش موجود، حمّله من الشبكة وخزّنه للمرات القادمة
        return fetch(event.request).then(response => {
          // لا نخزّن الردود غير الصالحة
          if (!response || response.status !== 200) return response;
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        }).catch(() => {
          // في حالة عدم وجود إنترنت ولم يُخزَّن، أرجع خطأ صوتي صامت
          return new Response(null, { status: 408 });
        });
      })
    );
    return; // خرجنا من الدالة بعد معالجة الصوتيات
  }
  
  // ✅ لبقية الملفات (HTML, CSS, JS, ...): استراتيجية Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});