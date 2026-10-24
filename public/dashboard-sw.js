// Management app shell only. Never cache tenant records, authenticated responses or credentials.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

// Network only: never retain tenant data, sessions or credentials offline.
self.addEventListener("fetch", event => { if (event.request.mode === "navigate") event.respondWith(fetch(event.request)); });
self.addEventListener("push", event => {
  let payload={title:"OpsVision",body:"لديك تنبيه جديد",url:"/ar/dashboard"};
  try { if(event.data) payload={...payload,...event.data.json()}; } catch {}
  event.waitUntil(Promise.all([self.navigator.setAppBadge?self.navigator.setAppBadge(payload.unreadCount||1).catch(()=>{}):Promise.resolve(),self.registration.showNotification(payload.title,{body:payload.body,tag:payload.notificationId||"opsvision-alert",icon:"/apps/opsvision-pink-192.png",badge:"/apps/opsvision-pink-192.png",data:{url:payload.url}})]));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url=new URL(event.notification.data?.url||"/ar/dashboard",self.location.origin);
  if(url.origin!==self.location.origin)return;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
    const existing=clients.find(client=>client.url.startsWith(url.origin+url.pathname));
    if(existing)return existing.focus();
    return self.clients.openWindow(url.href);
  }));
});
