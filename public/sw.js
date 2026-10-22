/* Defterdar - en küçük service worker: önbellek YOK (bayat uygulama riski yok).
   Yalnızca "telefona kur" ölçütünü karşılar, ağ isteklerine dokunmaz. */
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {
  // Bilerek boş: istekler olduğu gibi ağa gider.
});
