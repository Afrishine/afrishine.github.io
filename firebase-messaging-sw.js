// Service worker for Afrishine Hub push notifications (Firebase Cloud Messaging).
// Keep this file at the ROOT of the website: https://afrishinegithubio.vercel.app/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBnrdoguyhUd_E3I5RHqcQxHNVLa6kIMX4',
  authDomain: 'afrishine-hub.firebaseapp.com',
  projectId: 'afrishine-hub',
  storageBucket: 'afrishine-hub.firebasestorage.app',
  messagingSenderId: '553901207884',
  appId: '1:553901207884:web:81d4dce86149267ae59fe9'
});

const messaging = firebase.messaging();

// Messages that contain a "notification" block are shown by the browser itself.
// This handles data-only messages.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Afrishine Hub', { body: d.body || '', data: { link: d.link || '/#inbox' } });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/#inbox';
  event.waitUntil(clients.openWindow(link));
});
