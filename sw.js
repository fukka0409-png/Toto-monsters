// ホーム画面に追加できるようにするための、なにもしないサービスワーカー（キャッシュはしない）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
