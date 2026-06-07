import { requestBackgroundSync } from "./background-sync";
import {
	type LocalCustomer,
	type LocalDraft,
	type LocalOrder,
	type LocalPaymentMethod,
	type LocalProduct,
	type LocalProductCategory,
	type LocalServiceOrder,
	type LocalTransaction,
	localDb,
	type SyncQueueItem,
} from "./db";

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

function toLocalOrder(order: unknown): LocalOrder {
	const item = order as {
		id: number;
		order_number?: string | null;
		status?: string | null;
		payment_status?: string | null;
		customer?: { name?: string | null } | null;
	};
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		orderNumber: item.order_number,
		customerName: item.customer?.name ?? null,
		status: item.status,
		paymentStatus: item.payment_status,
		updatedAt: new Date().toISOString(),
		payload: order,
	};
}

export async function replaceCachedOrders(orders: unknown[]) {
	if (orders.length) {
		await localDb.orders.clear();
		await localDb.orders.bulkPut(orders.map(toLocalOrder));
	} else {
		const rows = await localDb.orders.where("serverId").above(0).toArray();
		const idsToDelete = rows.map((row) => row.id);
		if (idsToDelete.length) await localDb.orders.bulkDelete(idsToDelete);
	}
}

export async function readCachedOrders<T>() {
	const rows = await localDb.orders.toArray();
	return rows.map((row) => row.payload as T);
}

function toLocalTransaction(transaction: unknown): LocalTransaction {
	const item = transaction as {
		id: number;
		transaction_number?: string | null;
		description?: string | null;
		type?: string | null;
		status?: string | null;
	};
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		transactionNumber: item.transaction_number,
		description: item.description,
		type: item.type,
		status: item.status,
		updatedAt: new Date().toISOString(),
		payload: transaction,
	};
}

export async function replaceCachedTransactions(transactions: unknown[]) {
	if (transactions.length) {
		await localDb.transactions.clear();
		await localDb.transactions.bulkPut(transactions.map(toLocalTransaction));
	} else {
		const rows = await localDb.transactions
			.where("serverId")
			.above(0)
			.toArray();
		const idsToDelete = rows.map((row) => row.id);
		if (idsToDelete.length) await localDb.transactions.bulkDelete(idsToDelete);
	}
}

export async function readCachedTransactions<T>() {
	const rows = await localDb.transactions.toArray();
	return rows.map((row) => row.payload as T);
}

function toLocalProduct(product: unknown): LocalProduct {
	const item = product as {
		id: number;
		name: string;
		sku?: string | null;
		category?: string | null;
	};
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		name: item.name,
		sku: item.sku,
		category: item.category,
		updatedAt: new Date().toISOString(),
		payload: product,
	};
}

export async function replaceCachedProducts(products: unknown[]) {
	if (products.length) {
		// Replace all entries with the fresh server list
		await localDb.products.clear();
		await localDb.products.bulkPut(
			products.map((product) => toLocalProduct(product)),
		);
	} else {
		// Server returned empty — only remove synced (positive-id) entries,
		// keep pending local entries (negative id) so they aren't lost.
		const rows = await localDb.products.where("serverId").above(0).toArray();
		const idsToDelete = rows.map((r) => r.id);
		if (idsToDelete.length) await localDb.products.bulkDelete(idsToDelete);
	}
}

export async function upsertCachedProduct(product: unknown) {
	await localDb.products.put(toLocalProduct(product));
}

export async function replaceCachedProductId(
	localId: number,
	product: unknown,
) {
	if (localId !== (product as { id: number }).id) {
		await localDb.products.delete(localId);
	}
	await localDb.products.put(toLocalProduct(product));
}

export async function removeCachedProduct(id: number) {
	await localDb.products.delete(id);
}

export async function readCachedProducts<T>() {
	const rows = await localDb.products.toArray();
	return rows.map((row) => row.payload as T);
}

function toLocalCustomer(customer: unknown): LocalCustomer {
	const item = customer as {
		id: number;
		name: string;
		phone?: string | null;
	};
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		name: item.name,
		phone: item.phone,
		updatedAt: new Date().toISOString(),
		payload: customer,
	};
}

export async function replaceCachedCustomers(customers: unknown[]) {
	if (customers.length) {
		await localDb.customers.clear();
		await localDb.customers.bulkPut(
			customers.map((customer) => toLocalCustomer(customer)),
		);
	} else {
		const rows = await localDb.customers.where("serverId").above(0).toArray();
		const idsToDelete = rows.map((r) => r.id);
		if (idsToDelete.length) await localDb.customers.bulkDelete(idsToDelete);
	}
}

export async function upsertCachedCustomer(customer: unknown) {
	await localDb.customers.put(toLocalCustomer(customer));
}

export async function replaceCachedCustomerId(
	localId: number,
	customer: unknown,
) {
	if (localId !== (customer as { id: number }).id) {
		await localDb.customers.delete(localId);
	}
	await localDb.customers.put(toLocalCustomer(customer));
}

export async function removeCachedCustomer(id: number) {
	await localDb.customers.delete(id);
}

export async function readCachedCustomers<T>() {
	const rows = await localDb.customers.toArray();
	return rows.map((row) => row.payload as T);
}

function toLocalPaymentMethod(method: unknown): LocalPaymentMethod {
	const item = method as { id: number; name: string };
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		name: item.name,
		updatedAt: new Date().toISOString(),
		payload: method,
	};
}

export async function replaceCachedPaymentMethods(methods: unknown[]) {
	if (methods.length) {
		await localDb.paymentMethods.clear();
		await localDb.paymentMethods.bulkPut(methods.map(toLocalPaymentMethod));
	} else {
		const rows = await localDb.paymentMethods
			.where("serverId")
			.above(0)
			.toArray();
		const idsToDelete = rows.map((r) => r.id);
		if (idsToDelete.length)
			await localDb.paymentMethods.bulkDelete(idsToDelete);
	}
}

export async function upsertCachedPaymentMethod(method: unknown) {
	await localDb.paymentMethods.put(toLocalPaymentMethod(method));
}

export async function replaceCachedPaymentMethodId(
	localId: number,
	method: unknown,
) {
	if (localId !== (method as { id: number }).id) {
		await localDb.paymentMethods.delete(localId);
	}
	await localDb.paymentMethods.put(toLocalPaymentMethod(method));
}

export async function removeCachedPaymentMethod(id: number) {
	await localDb.paymentMethods.delete(id);
}

export async function readCachedPaymentMethods<T>() {
	const rows = await localDb.paymentMethods.toArray();
	return rows.map((row) => row.payload as T);
}

function toLocalProductCategory(category: unknown): LocalProductCategory {
	const item = category as { id: number; name: string };
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		name: item.name,
		updatedAt: new Date().toISOString(),
		payload: category,
	};
}

export async function replaceCachedProductCategories(categories: unknown[]) {
	if (categories.length) {
		await localDb.productCategories.clear();
		await localDb.productCategories.bulkPut(
			categories.map(toLocalProductCategory),
		);
	} else {
		const rows = await localDb.productCategories
			.where("serverId")
			.above(0)
			.toArray();
		const idsToDelete = rows.map((r) => r.id);
		if (idsToDelete.length)
			await localDb.productCategories.bulkDelete(idsToDelete);
	}
}

export async function upsertCachedProductCategory(category: unknown) {
	await localDb.productCategories.put(toLocalProductCategory(category));
}

export async function replaceCachedProductCategoryId(
	localId: number,
	category: unknown,
) {
	if (localId !== (category as { id: number }).id) {
		await localDb.productCategories.delete(localId);
	}
	await localDb.productCategories.put(toLocalProductCategory(category));
}

export async function removeCachedProductCategory(id: number) {
	await localDb.productCategories.delete(id);
}

export async function readCachedProductCategories<T>() {
	const rows = await localDb.productCategories.toArray();
	return rows.map((row) => row.payload as T);
}

function toLocalServiceOrder(serviceOrder: unknown): LocalServiceOrder {
	const item = serviceOrder as {
		id: number;
		service_number?: string | null;
		status: string;
		customer?: { name?: string | null } | null;
	};
	return {
		id: item.id,
		serverId: item.id > 0 ? item.id : 0,
		serviceNumber: item.service_number,
		customerName: item.customer?.name ?? null,
		status: item.status,
		updatedAt: new Date().toISOString(),
		payload: serviceOrder,
	};
}

export async function replaceCachedServiceOrders(serviceOrders: unknown[]) {
	if (serviceOrders.length) {
		await localDb.serviceOrders.clear();
		await localDb.serviceOrders.bulkPut(
			serviceOrders.map((serviceOrder) => toLocalServiceOrder(serviceOrder)),
		);
	} else {
		const rows = await localDb.serviceOrders
			.where("serverId")
			.above(0)
			.toArray();
		const idsToDelete = rows.map((r) => r.id);
		if (idsToDelete.length) await localDb.serviceOrders.bulkDelete(idsToDelete);
	}
}

export async function upsertCachedServiceOrder(serviceOrder: unknown) {
	await localDb.serviceOrders.put(toLocalServiceOrder(serviceOrder));
}

export async function replaceCachedServiceOrderId(
	localId: number,
	serviceOrder: unknown,
) {
	if (localId !== (serviceOrder as { id: number }).id) {
		await localDb.serviceOrders.delete(localId);
	}
	await localDb.serviceOrders.put(toLocalServiceOrder(serviceOrder));
}

export async function removeCachedServiceOrder(id: number) {
	await localDb.serviceOrders.delete(id);
}

export async function readCachedServiceOrders<T>() {
	const rows = await localDb.serviceOrders.toArray();
	return rows.map((row) => row.payload as T);
}

export async function readCachedServiceOrder<T>(id: number) {
	const row = await localDb.serviceOrders.get(id);
	return (row?.payload as T | undefined) ?? null;
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
	await requestBackgroundSync();
}

export async function listSyncQueue<T extends SyncQueueItem = SyncQueueItem>() {
	return (await localDb.syncQueue.orderBy("createdAt").toArray()) as T[];
}

export async function listReadySyncQueue() {
	const now = new Date().toISOString();
	const queue = await localDb.syncQueue.orderBy("createdAt").toArray();
	return queue.filter((item) => {
		if (item.status === "syncing" || item.status === "success") return false;
		if (item.status === "conflict") return false;
		if (item.status !== "failed") return true;
		return !item.nextRetryAt || item.nextRetryAt <= now;
	});
}

export async function countPendingSyncItems() {
	return localDb.syncQueue
		.where("status")
		.anyOf("pending", "syncing", "failed", "conflict")
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

export async function markSyncQueueConflict(id: string, errorMessage: string) {
	await updateSyncQueueItem(id, {
		status: "conflict",
		errorMessage,
		nextRetryAt: undefined,
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
	entity:
		| "order"
		| "serviceOrder"
		| "product"
		| "productCategory"
		| "paymentMethod"
		| "customer",
	localId: string,
	serverId: number,
) {
	await setAppMeta(`${entity}:${localId}:serverId`, serverId);
}

export async function removeSyncQueueItem(id: string) {
	await localDb.syncQueue.delete(id);
}
