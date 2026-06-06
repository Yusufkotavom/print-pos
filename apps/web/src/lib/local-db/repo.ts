import { type LocalDraft, localDb, type SyncQueueItem } from "./db";

export async function saveDraft<T>(key: string, payload: T) {
	const draft: LocalDraft = {
		key,
		payload,
		updatedAt: new Date().toISOString(),
	};
	await localDb.drafts.put(draft);
}

export async function readDraft<T>(key: string) {
	const draft = await localDb.drafts.get(key);
	return (draft?.payload as T | undefined) ?? null;
}

export async function clearDraft(key: string) {
	await localDb.drafts.delete(key);
}

export async function replaceCachedProducts(products: unknown[]) {
	await localDb.products.bulkPut(
		products.map((product) => {
			const item = product as {
				id: number;
				name: string;
				sku?: string | null;
				category?: string | null;
			};
			return {
				id: item.id,
				serverId: item.id,
				name: item.name,
				sku: item.sku,
				category: item.category,
				updatedAt: new Date().toISOString(),
				payload: product,
			};
		}),
	);
}

export async function readCachedProducts<T>() {
	const rows = await localDb.products.toArray();
	return rows.map((row) => row.payload as T);
}

export async function replaceCachedCustomers(customers: unknown[]) {
	await localDb.customers.bulkPut(
		customers.map((customer) => {
			const item = customer as {
				id: number;
				name: string;
				phone?: string | null;
			};
			return {
				id: item.id,
				serverId: item.id,
				name: item.name,
				phone: item.phone,
				updatedAt: new Date().toISOString(),
				payload: customer,
			};
		}),
	);
}

export async function readCachedCustomers<T>() {
	const rows = await localDb.customers.toArray();
	return rows.map((row) => row.payload as T);
}

export async function replaceCachedPaymentMethods(methods: unknown[]) {
	await localDb.paymentMethods.bulkPut(
		methods.map((method) => {
			const item = method as { id: number; name: string };
			return {
				id: item.id,
				serverId: item.id,
				name: item.name,
				updatedAt: new Date().toISOString(),
				payload: method,
			};
		}),
	);
}

export async function readCachedPaymentMethods<T>() {
	const rows = await localDb.paymentMethods.toArray();
	return rows.map((row) => row.payload as T);
}

const MAX_PRODUCT_IMAGE_CACHE_ITEMS = 30;
const MAX_PRODUCT_IMAGE_CACHE_BYTES = 30 * 1024 * 1024;

export async function cleanupProductImageCache() {
	const rows = await localDb.productImages.orderBy("updatedAt").toArray();
	let totalBytes = rows.reduce((sum, row) => sum + row.blob.size, 0);
	const keysToDelete: string[] = [];
	while (
		rows.length - keysToDelete.length > MAX_PRODUCT_IMAGE_CACHE_ITEMS ||
		totalBytes > MAX_PRODUCT_IMAGE_CACHE_BYTES
	) {
		const next = rows.shift();
		if (!next) break;
		keysToDelete.push(next.key);
		totalBytes -= next.blob.size;
	}
	if (keysToDelete.length) await localDb.productImages.bulkDelete(keysToDelete);
}

export async function cacheProductImage(productId: number, blob: Blob) {
	const key = `product:${productId}`;
	await localDb.productImages.put({
		key,
		productId,
		blob,
		url: URL.createObjectURL(blob),
		updatedAt: new Date().toISOString(),
	});
	await cleanupProductImageCache();
	return key;
}

export async function readCachedProductImage(productId: number) {
	return localDb.productImages.get(`product:${productId}`);
}

export async function removeCachedProductImage(productId: number) {
	await localDb.productImages.delete(`product:${productId}`);
}

export function getNextRetryAt(retryCount: number) {
	const delayMs = Math.min(30_000, 2 ** Math.max(0, retryCount) * 1_000);
	return new Date(Date.now() + delayMs).toISOString();
}

export async function enqueueSyncItem(
	item: Omit<SyncQueueItem, "createdAt" | "updatedAt">,
) {
	const now = new Date().toISOString();
	await localDb.syncQueue.put({
		...item,
		createdAt: now,
		updatedAt: now,
	});
}

export async function listSyncQueue<T extends SyncQueueItem = SyncQueueItem>() {
	return (await localDb.syncQueue.orderBy("createdAt").toArray()) as T[];
}

export async function listReadySyncQueue() {
	const now = new Date().toISOString();
	const queue = await localDb.syncQueue.orderBy("createdAt").toArray();
	return queue.filter(
		(item) =>
			item.status !== "syncing" &&
			(item.status !== "failed" ||
				!item.nextRetryAt ||
				item.nextRetryAt <= now),
	);
}

export async function countPendingSyncItems() {
	return localDb.syncQueue
		.where("status")
		.anyOf("pending", "syncing", "failed")
		.count();
}

export async function updateSyncQueueItem(
	id: string,
	patch: Partial<
		Pick<
			SyncQueueItem,
			"status" | "retryCount" | "errorMessage" | "payload" | "nextRetryAt"
		>
	>,
) {
	await localDb.syncQueue.update(id, {
		...patch,
		updatedAt: new Date().toISOString(),
	});
}

export async function setAppMeta<T>(key: string, value: T) {
	await localDb.appMeta.put({
		key,
		value,
		updatedAt: new Date().toISOString(),
	});
}

export async function getAppMeta<T>(key: string) {
	const meta = await localDb.appMeta.get(key);
	return (meta?.value as T | undefined) ?? null;
}

export async function mapLocalToServerId(
	entity: "order" | "serviceOrder",
	localId: string,
	serverId: number,
) {
	await setAppMeta(`${entity}:${localId}:serverId`, serverId);
}

export async function removeSyncQueueItem(id: string) {
	await localDb.syncQueue.delete(id);
}
