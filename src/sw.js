import { precacheAndRoute } from 'workbox-precaching';

// Precaching from Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST || []);

// Import OneSignal SDK Worker
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
