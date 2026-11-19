const CACHE = "sima-shell-v2";

function esDeLaApp(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (/hmr|webpack|turbopack|__nextjs/.test(url.pathname)) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!esDeLaApp(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
          if (request.mode === "navigate" && url.pathname.startsWith("/dashboard/llenado")) {
            await cache.put(new Request(`${url.origin}/dashboard/llenado`), response.clone());
          }
        }
        return response;
      } catch {
        const guardada = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
        if (guardada) return guardada;
        if (request.mode === "navigate") {
          const llenado = await cache.match("/dashboard/llenado");
          if (llenado) return llenado;
        }
        return Response.error();
      }
    })(),
  );
});
