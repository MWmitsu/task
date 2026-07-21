/* やること Web版 — オフライン対応の最小サービスワーカー
   方針：アプリ本体（同一オリジン）だけをキャッシュ。
   Firebase / Firestore など別オリジンの通信は一切触らない（同期を壊さないため）。 */
// ★重要: index.html などアプリ本体を更新したら必ずこの版番号を上げること。
//   これを上げないと、PWA導入済み端末は install 時に焼いた古い index.html を掃除できず、
//   オフライン/フォールバック時に旧版を配信し続ける（例: 日跨ぎ休憩で出勤が消える旧バグの再燃）。
//   版を上げると activate で旧キャッシュを削除し、install で最新 SHELL を取り直す。
const CACHE = "taskweb-v1.4.2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  const req = e.request;
  if(req.method !== "GET") return;
  let url;
  try{ url = new URL(req.url); }catch(_){ return; }
  // 別オリジン（Firebase等）はそのままネットワークへ
  if(url.origin !== self.location.origin) return;

  // 画面遷移は network-first（更新を取りに行き、オフライン時はキャッシュのindexを返す）
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(r){
        const cp = r.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", cp); });
        return r;
      }).catch(function(){ return caches.match("./index.html"); })
    );
    return;
  }

  // その他の同一オリジン資源は cache-first
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(r){
        if(r && r.ok){ const cp = r.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }); }
        return r;
      });
    })
  );
});
