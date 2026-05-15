const SW_VERSION = '1.1.0';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Receive notification requests from the main page
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, taskId } = e.data;
    self.registration.showNotification(title, {
      body,
      tag: tag || ('task-' + taskId),
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%233d6ff8"/><path d="M16 7L5 16h3v9h7v-5h2v5h7v-9h3z" fill="white"/></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%233d6ff8"/></svg>',
      vibrate: [200, 100, 200],
      data: { taskId }
    });
  }
});

// Open/focus the app when notification is tapped
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Web Push (for future server-side push support)
self.addEventListener('push', e => {
  const d = e.data?.json?.() || {};
  e.waitUntil(
    self.registration.showNotification(d.title || 'Buildora Erinnerung', {
      body: d.body || '',
      tag: d.tag || 'buildora-push',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%233d6ff8"/><path d="M16 7L5 16h3v9h7v-5h2v5h7v-9h3z" fill="white"/></svg>',
      data: d
    })
  );
});
