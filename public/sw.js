const shell = "yarumo-shell-v1";
self.addEventListener("install", event => event.waitUntil(caches.open(shell).then(cache => cache.addAll(["/"]))));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Capability URLs and every API/auth/save response are never cached by this worker.
  if (url.origin !== location.origin || url.pathname.startsWith("/v1") || url.pathname.startsWith("/r/")) return;
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/")));
});
