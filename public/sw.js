// Minimal service worker for PWA installability requirements with safe pass-through fetching
const CACHE_NAME = 'islamfood-pwa-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches to free space and prevent blank page issues
          console.log('Clearing old service worker cache: ', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Use professional safe pass-through fetching to guarantee always-fresh, direct network assets
  event.respondWith(fetch(event.request));
});

// Handle push notification clicks and action click events
self.addEventListener('push', (event) => {
  let payload = {
    title: 'طلب جديد وارد! 🔔',
    body: 'لديك طلب جديد قيد الانتظار في مطعم إسلام فود.',
    icon: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=192&h=192&fit=crop',
    url: '/'
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.icon,
    vibrate: [200, 100, 200, 100, 400, 100, 500], // Strong vibration alert to catch attention
    data: {
      url: payload.url
    },
    actions: [
      { action: 'open', title: 'عرض تفاصيل الطلب 🛒' }
    ],
    tag: 'new-order-alert',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (action === 'unsubscribe') {
        // Show a success message for unsubscribed alerts
        return self.registration.showNotification('تم إلغاء التنبيه 🔕', {
          body: 'تم إلغاء اشتراكك في تنبيهات مواعيد العمل هذه بنجاح.',
          icon: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=192&h=192&fit=crop',
          badge: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=192&h=192&fit=crop'
        });
      }

      // Default click or 'edit_hours' action -> Focus or open the website
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(notificationData.url || '/');
      }
    })
  );
});

