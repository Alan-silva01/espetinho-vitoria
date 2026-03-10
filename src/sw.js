import { precacheAndRoute } from 'workbox-precaching';

// Precaching from Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST || []);

// Import OneSignal SDK Worker (com proteção contra falha de CDN)
try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
    console.warn('[SW] OneSignal SDK falhou ao carregar — ignorando:', e.message);
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
