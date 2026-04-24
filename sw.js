const CACHE = “gymtrack-v1”;

const PRECACHE = [
“/”,
“/index.html”,
“/manifest.json”,
“https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js”,
“https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js”,
“https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js”,
“https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap”,
];

// Install: cache everything upfront
self.addEventListener(“install”, (e) => {
e.waitUntil(
caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
);
self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener(“activate”, (e) => {
e.waitUntil(
caches.keys().then((keys) =>
Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
)
);
self.clients.claim();
});

// Fetch: cache-first for CDN + local assets, network-first for HTML
self.addEventListener(“fetch”, (e) => {
const { request } = e;
const url = new URL(request.url);

// Skip non-GET and browser-extension requests
if (request.method !== “GET” || url.protocol === “chrome-extension:”) return;

// Network-first for same-origin HTML (so deploys update fast)
if (url.origin === self.location.origin && request.destination === “document”) {
e.respondWith(
fetch(request)
.then((res) => {
const clone = res.clone();
caches.open(CACHE).then((c) => c.put(request, clone));
return res;
})
.catch(() => caches.match(request))
);
return;
}

// Cache-first for everything else (CDN scripts, fonts, local assets)
e.respondWith(
caches.match(request).then(
(cached) =>
cached ||
fetch(request).then((res) => {
const clone = res.clone();
caches.open(CACHE).then((c) => c.put(request, clone));
return res;
})
)
);
});
