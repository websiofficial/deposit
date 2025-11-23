// Nama cache untuk versi saat ini. Ubah nama ini setiap kali ada pembaruan file.
const CACHE_NAME = 'kas-deposit-v1.0.0'; 

// Daftar file yang akan di-cache saat Service Worker diinstal (App Shell).
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    // CDN assets (Penting untuk fungsionalitas offline)
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    // Catatan: Ikon tidak disertakan di sini karena ini adalah lingkungan virtual.
];

// Event: Install (Menginstal Service Worker dan melakukan pre-caching)
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install event: Pre-caching resources...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Event: Activate (Membersihkan cache lama)
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate event: Cleaning up old caches...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Mengklaim semua klien agar Service Worker segera mengontrol halaman
    return self.clients.claim();
});

// Event: Fetch (Melayani konten, termasuk saat offline)
self.addEventListener('fetch', (event) => {
    // Strategi Cache-First untuk App Shell
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Jika ditemukan di cache, kembalikan dari cache
                if (response) {
                    // console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
                    return response;
                }
                
                // Jika tidak ditemukan di cache, fetch dari jaringan
                // console.log(`[Service Worker] Fetching from network: ${event.request.url}`);
                return fetch(event.request).then(
                    (response) => {
                        // Periksa apakah kami menerima respons yang valid
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Kloning respons karena stream hanya bisa dibaca sekali
                        const responseToCache = response.clone();
                        
                        // Simpan respons baru ke cache jika ini adalah GET request dan bukan data internal (chrome-extension, dll)
                        if (event.request.method === 'GET' && !event.request.url.startsWith('chrome-extension://')) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    // Hanya cache file penting dan CDN yang aman
                                    const isCDN = urlsToCache.some(url => event.request.url.includes(url));
                                    const isLocalFile = event.request.url.includes('/index.html') || event.request.url.endsWith('/manifest.json');
                                    
                                    if (isCDN || isLocalFile) {
                                        cache.put(event.request, responseToCache);
                                    }
                                });
                        }
                        
                        return response;
                    }
                );
            })
            // Fallback: Jika fetch gagal (offline total) dan tidak ada di cache
            .catch(() => {
                // Jika permintaan HTML, berikan fallback ke index.html yang di-cache
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});