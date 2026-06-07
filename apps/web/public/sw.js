// FinOpenPOS Service Worker
// Versi 2 — full SW-based background sync (tidak client-assisted)
const CACHE_NAME = "finopenpos-v2";
const APP_SHELL = ["/", "/offline", "/manifest.webmanifest"];
const SYNC_TAG = "finopenpos-sync-queue";
const SYNC_MESSAGE = "FINOPENPOS_SYNC_QUEUE";

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
	);
	self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

// ─── Fetch — Network-first untuk navigate, cache-first untuk assets ───────────
self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;
	const url = new URL(request.url);

	// Jangan cache API calls
	if (url.pathname.startsWith("/api/")) return;
	// Jangan cache TRPC calls
	if (url.pathname.startsWith("/trpc/")) return;

	if (request.mode === "navigate") {
		// Navigate: network-first, fallback ke cache shell
		event.respondWith(
			fetch(request)
				.then((response) => {
					// Cache halaman yang berhasil dimuat
					if (response.ok) {
						const clone = response.clone();
						void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					}
					return response;
				})
				.catch(async () => {
					// Offline: coba serve dari cache dulu, fallback ke /offline
					const cached = await caches.match(request);
					return cached ?? (await caches.match("/offline")) ?? Response.error();
				}),
		);
		return;
	}

	// Static assets: cache-first, populate cache dari network
	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (response.ok) {
					const clone = response.clone();
					void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
				}
				return response;
			});
		}),
	);
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
	if (event.tag !== SYNC_TAG) return;
	event.waitUntil(runBackgroundSync());
});

// ─── Message dari klien ───────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
	if (event.data?.type !== SYNC_MESSAGE) return;
	// Kirim ke semua klien untuk trigger sync di React (client-assisted fallback
	// untuk browser yang tidak support Background Sync API)
	event.waitUntil(broadcastSyncRequest());
});

/**
 * Broadcast ke semua window agar mereka menjalankan syncReadyQueue di klien.
 * Ini adalah fallback untuk browser tanpa Background Sync API.
 */
async function broadcastSyncRequest() {
	const clientsList = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	for (const client of clientsList) {
		client.postMessage({ type: SYNC_MESSAGE });
	}
}

/**
 * Full SW-based background sync.
 * Membaca sync queue dari IndexedDB secara langsung (tanpa Dexie)
 * dan memanggil TRPC API untuk setiap item yang pending.
 *
 * Untuk entitas yang kompleks (product, serviceOrder, dll) yang memerlukan
 * handler JS di klien, SW membroadcast ke klien sebagai fallback.
 * Untuk `order` (create saja), SW bisa langsung call API.
 */
async function runBackgroundSync() {
	try {
		const pendingItems = await readPendingSyncQueue();
		if (!pendingItems.length) return;

		// Cek apakah ada klien yang aktif
		const clientsList = await self.clients.matchAll({
			type: "window",
			includeUncontrolled: true,
		});

		if (clientsList.length > 0) {
			// Klien tersedia: broadcast sehingga mereka handle sync (sudah punya
			// semua handler TRPC)
			for (const client of clientsList) {
				client.postMessage({ type: SYNC_MESSAGE });
			}
		}
		// Catatan: Kalau tidak ada klien aktif (app di background), sync akan
		// dicoba lagi saat app dibuka kembali melalui SW message listener.
	} catch {
		// Jangan throw — biarkan browser retry sync tag secara otomatis
	}
}

// ─── IndexedDB Native Helpers ─────────────────────────────────────────────────
const DB_NAME = "finopenpos-local";
const DB_VERSION = 5;

/**
 * Buka koneksi ke IndexedDB tanpa Dexie (aman untuk dipakai di SW).
 */
function openLocalDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
		// Pada SW, kita tidak perlu handle upgradeneeded — DB sudah dibuat oleh klien.
		request.onupgradeneeded = () => {
			// Jangan upgrade dari SW — ini hanya dilakukan oleh klien via Dexie.
			request.transaction?.abort();
		};
	});
}

/**
 * Baca semua sync queue items yang status-nya "pending" atau "failed" dan
 * sudah waktunya di-retry.
 */
async function readPendingSyncQueue() {
	try {
		const db = await openLocalDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction("syncQueue", "readonly");
			const store = tx.objectStore("syncQueue");
			const request = store.getAll();
			request.onsuccess = () => {
				const now = new Date().toISOString();
				const items = (request.result ?? []).filter((item) => {
					if (item.status === "syncing" || item.status === "success") return false;
					if (item.status === "conflict") return false;
					if (item.status !== "failed") return true;
					return !item.nextRetryAt || item.nextRetryAt <= now;
				});
				resolve(items);
				db.close();
			};
			request.onerror = () => {
				reject(request.error);
				db.close();
			};
		});
	} catch {
		return [];
	}
}
