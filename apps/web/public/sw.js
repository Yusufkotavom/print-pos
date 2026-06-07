const CACHE_NAME = "finopenpos-v5";
const APP_SHELL = [
	"/",
	"/admin",
	"/admin/pos",
	"/admin/products",
	"/admin/products/categories",
	"/admin/customers",
	"/admin/payment-methods",
	"/admin/services",
	"/admin/orders",
	"/offline",
	"/manifest.webmanifest",
	"/icons/icon.svg",
];
const ADMIN_SHELL = "/admin";
const OFFLINE_FALLBACK = "/offline";
const SYNC_TAG = "finopenpos-sync-queue";
const SYNC_MESSAGE = "FINOPENPOS_SYNC_QUEUE";
const DB_NAME = "finopenpos-local";
const DB_VERSION = 7;

self.addEventListener("install", (event) => {
	event.waitUntil(precacheAppShell());
	self.skipWaiting();
});

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

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.pathname.startsWith("/api/")) return;
	if (url.pathname.startsWith("/trpc/")) return;

	const isStaticAsset = shouldCacheAsset(url.pathname);
	const isRSC = url.searchParams.has("_rsc");
	const isAdminRoute = url.pathname.startsWith("/admin");

	if (isStaticAsset && !isRSC) {
		// Cache First, fallback to Network for static assets
		event.respondWith(
			caches.match(request).then((cached) => {
				if (cached) return cached;
				return fetch(request).then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					}
					return response;
				}).catch(() => Response.error());
			})
		);
		return;
	}

	// Network First, fallback to Cache for HTML navigations and Next.js RSC requests
	event.respondWith(
		fetch(request)
			.then((response) => {
				if (response.ok && (isAdminRoute || isRSC || url.pathname === "/")) {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
				}
				return response;
			})
			.catch(async () => {
				const cached = await caches.match(request);
				if (cached) return cached;

				if (request.mode === "navigate") {
					if (isAdminRoute) {
						const adminShell = await caches.match(ADMIN_SHELL);
						if (adminShell) return adminShell;
					}
					return (await caches.match(OFFLINE_FALLBACK)) ?? Response.error();
				}
				return Response.error();
			})
	);
});

self.addEventListener("sync", (event) => {
	if (event.tag !== SYNC_TAG) return;
	event.waitUntil(runBackgroundSync());
});

self.addEventListener("message", (event) => {
	if (event.data?.type !== SYNC_MESSAGE) return;
	event.waitUntil(broadcastSyncRequest());
});

async function precacheAppShell() {
	const cache = await caches.open(CACHE_NAME);
	await Promise.all(
		APP_SHELL.map(async (path) => {
			try {
				const response = await fetch(path, { cache: "reload" });
				if (response.ok) await cache.put(path, response);
			} catch {}
		}),
	);
}

function shouldCacheAsset(pathname) {
	return (
		pathname.startsWith("/_next/static/") ||
		pathname === "/favicon.ico" ||
		pathname === "/manifest.webmanifest" ||
		pathname === "/icons/icon.svg" ||
		/\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(pathname)
	);
}

// handleNavigation removed in favor of inline logic in fetch handler

async function broadcastSyncRequest() {
	const clientsList = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	for (const client of clientsList) {
		client.postMessage({ type: SYNC_MESSAGE });
	}
}

async function runBackgroundSync() {
	try {
		const pendingItems = await readPendingSyncQueue();
		if (!pendingItems.length) return;
		await broadcastSyncRequest();
	} catch {}
}

function openLocalDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
		request.onupgradeneeded = () => {
			request.transaction?.abort();
		};
	});
}

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
					if (item.status === "syncing" || item.status === "success")
						return false;
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
