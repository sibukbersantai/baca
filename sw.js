const V = 'baca-v4';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './lib/jszip.min.js', './lib/epub.min.js', './lib/pdf.min.js', './lib/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V && k !== 'share' && k !== 'cdn').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);

  // Berkas yang dibagikan dari aplikasi lain (menu Bagikan Android)
  if (r.method === 'POST' && u.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await r.formData();
        const f = fd.get('book');
        if (f && f.size) {
          const c = await caches.open('share');
          await c.put('shared-file', new Response(f, {
            headers: { 'x-name': encodeURIComponent(f.name), 'content-type': f.type || 'application/octet-stream' }
          }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  // Mesin terjemah (onnxruntime/transformers.js dari jsDelivr): simpan agar jalan offline
  if (r.method === 'GET' && u.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open('cdn').then(async c => {
      const hit = await c.match(r); if (hit) return hit;
      const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res;
    }));
    return;
  }

  if (r.method !== 'GET' || u.origin !== location.origin) return;

  // Cache dulu (offline instan), lalu perbarui di latar belakang
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
