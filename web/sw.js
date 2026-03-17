/**
 * Service Worker for PWA 离线支持
 * 功能:
 * - 缓存核心资源
 * - 离线访问支持
 * - 后台同步
 * - 推送通知
 */

const CACHE_NAME = 'requirements-mgmt-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// 核心资源 (立即缓存)
const CORE_ASSETS = [
  '/',
  '/home.html',
  '/index.html',
  '/login.html',
  '/requirements.html',
  '/tasks.html',
  '/testcases.html',
  '/defects.html',
  '/templates.html',
  '/custom-fields.html',
  '/audit.html',
  '/navigation-tree.css',
  '/mobile.css',
  '/mobile.js',
  '/api-server.js',
  '/manifest.json'
];

// 安装事件 - 缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 安装中...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] 缓存核心资源');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] 核心资源缓存完成');
        return self.skipWaiting(); // 立即激活
      })
      .catch(error => {
        console.error('[SW] 缓存失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 激活中...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker 激活完成');
        return self.clients.claim(); // 立即接管所有页面
      })
  );
});

// 获取事件 - 网络优先，失败时回退到缓存
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // API 请求 - 网络优先
  if (request.url.includes('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源 - 缓存优先
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML 页面 - 网络优先，回退到缓存
  if (request.mode === 'navigate' || request.url.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 默认 - 网络优先
  event.respondWith(networkFirst(request));
});

/**
 * 网络优先策略
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // 成功的响应才缓存
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] 网络失败，使用缓存:', request.url);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // 如果是导航请求，返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('离线状态', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }

    return new Response('资源不可用', { status: 404 });
  }
}

/**
 * 缓存优先策略
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // 后台更新缓存
    fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(request, networkResponse);
        });
      }
    }).catch(() => {
      // 忽略网络错误
    });
    
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] 资源获取失败:', request.url);
    return new Response('资源不可用', { status: 404 });
  }
}

/**
 * 判断是否为静态资源
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  return pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i);
}

// 后台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] 后台同步:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // 获取待同步的数据
  const pendingSync = await clients.matchAll();
  
  for (const client of pendingSync) {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      status: 'success'
    });
  }
}

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] 收到推送:', event);
  
  const options = {
    body: event.data ? event.data.text() : '新消息通知',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: '查看'
      },
      {
        action: 'dismiss',
        title: '关闭'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('需求管理系统', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知点击:', event.action);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/home.html');
          }
        })
    );
  }
});

// 消息处理
self.addEventListener('message', (event) => {
  console.log('[SW] 收到消息:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => cache.addAll(event.data.urls))
    );
  }
});

console.log('[SW] Service Worker 已加载');
