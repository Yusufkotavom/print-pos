import type { SyncQueueItem } from "@/lib/local-db/db";
import {
	getAppMeta,
	getNextRetryAt,
	listReadySyncQueue,
	mapLocalToServerId,
	markSyncQueueConflict,
	readCachedProductImage,
	removeCachedProductImage,
	removeSyncQueueItem,
	replaceCachedCustomerId,
	replaceCachedPaymentMethodId,
	replaceCachedProductCategoryId,
	replaceCachedProductId,
	replaceCachedServiceOrderId,
	updateSyncQueueItem,
} from "@/lib/local-db/repo";
import { uploadProductImage } from "@/lib/product-images";

export type QueuedSyncHandlers = {
	createOrder?: (payload: unknown) => Promise<{ id?: number } | undefined>;
	createServiceOrder?: (
		payload: unknown,
	) => Promise<{ id?: number } | undefined>;
	readServiceOrder?: (id: number) => Promise<unknown>;
	updateServiceOrder?: (payload: unknown) => Promise<unknown>;
	updateServiceOrderStatus?: (payload: unknown) => Promise<unknown>;
	receiveServiceOrderPayment?: (payload: unknown) => Promise<unknown>;
	updateServiceOrderWarranty?: (payload: unknown) => Promise<unknown>;
	deleteServiceOrder?: (payload: unknown) => Promise<unknown>;
	createProduct?: (payload: unknown) => Promise<{ id?: number } | undefined>;
	updateProduct?: (payload: unknown) => Promise<unknown>;
	deleteProduct?: (payload: unknown) => Promise<unknown>;
	createProductCategory?: (
		payload: unknown,
	) => Promise<{ id?: number } | undefined>;
	updateProductCategory?: (payload: unknown) => Promise<unknown>;
	deleteProductCategory?: (payload: unknown) => Promise<unknown>;
	createPaymentMethod?: (
		payload: unknown,
	) => Promise<{ id?: number } | undefined>;
	updatePaymentMethod?: (payload: unknown) => Promise<unknown>;
	deletePaymentMethod?: (payload: unknown) => Promise<unknown>;
	createCustomer?: (payload: unknown) => Promise<{ id?: number } | undefined>;
	updateCustomer?: (payload: unknown) => Promise<unknown>;
	deleteCustomer?: (payload: unknown) => Promise<unknown>;
	updateProductImage?: (payload: {
		id: number;
		image_url: string;
		image_key: string;
		image_width?: number;
		image_height?: number;
	}) => Promise<void>;
};

export type SyncQueueResult = {
	processed: number;
	succeeded: number;
	failed: number;
	skipped: number;
};

let syncInFlight = false;

export async function syncReadyQueue(
	handlers: QueuedSyncHandlers,
	options?: { entities?: SyncQueueItem["entity"][] },
): Promise<SyncQueueResult> {
	if (typeof window !== "undefined" && !navigator.onLine) {
		return { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
	}
	if (syncInFlight) {
		return { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
	}
	syncInFlight = true;
	const result: SyncQueueResult = {
		processed: 0,
		succeeded: 0,
		failed: 0,
		skipped: 0,
	};
	try {
		const readyQueue = await listReadySyncQueue();
		const queue = options?.entities?.length
			? readyQueue.filter((item) => options.entities?.includes(item.entity))
			: readyQueue;
		for (const item of queue) {
			result.processed += 1;
			const handler = getHandler(item, handlers);
			if (!handler) {
				result.skipped += 1;
				continue;
			}
			await updateSyncQueueItem(item.id, {
				status: "syncing",
				errorMessage: undefined,
				nextRetryAt: undefined,
			});
			try {
				await handler();
				result.succeeded += 1;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Failed to sync item";
				if (isConflictError(errorMessage)) {
					await markSyncQueueConflict(item.id, errorMessage);
					result.failed += 1;
					continue;
				}
				const retryCount = item.retryCount + 1;
				await updateSyncQueueItem(item.id, {
					status: "failed",
					retryCount,
					errorMessage,
					nextRetryAt: getNextRetryAt(retryCount),
				});
				result.failed += 1;
			}
		}
		return result;
	} finally {
		syncInFlight = false;
	}
}

async function resolveServerId(
	entity:
		| "product"
		| "customer"
		| "serviceOrder"
		| "productCategory"
		| "paymentMethod",
	id: number,
) {
	if (id > 0) return id;
	return getAppMeta<number>(`${entity}:${id}:serverId`);
}

function stripLocalId(payload: unknown) {
	const { localId, ...serverPayload } = payload as { localId?: number };
	return serverPayload;
}

function isConflictError(message: string) {
	const value = message.toLowerCase();
	return value.includes("already exists") || value.includes("duplicate");
}

function getHandler(item: SyncQueueItem, handlers: QueuedSyncHandlers) {
	if (item.entity === "order" && item.operation === "create") {
		if (!handlers.createOrder) return null;
		return async () => {
			const response = await handlers.createOrder?.(item.payload);
			const serverId = response && "id" in response ? response.id : undefined;
			if (serverId) await mapLocalToServerId("order", item.id, serverId);
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "serviceOrder" && item.operation === "create") {
		if (!handlers.createServiceOrder) return null;
		return async () => {
			const response = await handlers.createServiceOrder?.(item.payload);
			const serverId = response && "id" in response ? response.id : undefined;
			if (serverId) {
				await mapLocalToServerId("serviceOrder", item.id, serverId);
				if (handlers.readServiceOrder) {
					const serviceOrder = await handlers.readServiceOrder(serverId);
					if (serviceOrder) {
						await replaceCachedServiceOrderId(
							Number.parseInt(item.id, 10),
							serviceOrder,
						);
					}
				}
			}
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "serviceOrder" && item.operation === "update") {
		if (!handlers.updateServiceOrder) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("serviceOrder", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for service order ${payload.id}`);
			await handlers.updateServiceOrder?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "serviceOrder" && item.operation === "updateStatus") {
		if (!handlers.updateServiceOrderStatus) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("serviceOrder", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for service order ${payload.id}`);
			await handlers.updateServiceOrderStatus?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "serviceOrder" && item.operation === "receivePayment") {
		if (!handlers.receiveServiceOrderPayment) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("serviceOrder", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for service order ${payload.id}`);
			await handlers.receiveServiceOrderPayment?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "serviceOrder" && item.operation === "updateWarranty") {
		if (!handlers.updateServiceOrderWarranty) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("serviceOrder", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for service order ${payload.id}`);
			await handlers.updateServiceOrderWarranty?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "serviceOrder" && item.operation === "delete") {
		if (!handlers.deleteServiceOrder) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("serviceOrder", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for service order ${payload.id}`);
			await handlers.deleteServiceOrder?.({ id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "product" && item.operation === "create") {
		if (!handlers.createProduct) return null;
		return async () => {
			const payload = item.payload as { localId?: number };
			const response = await handlers.createProduct?.(stripLocalId(payload));
			const serverId = response && "id" in response ? response.id : undefined;
			if (serverId && payload.localId != null) {
				await mapLocalToServerId("product", String(payload.localId), serverId);
				await replaceCachedProductId(payload.localId, {
					...stripLocalId(payload),
					...response,
					id: serverId,
				});
			}
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "product" && item.operation === "update") {
		if (!handlers.updateProduct) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("product", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for product ${payload.id}`);
			await handlers.updateProduct?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "product" && item.operation === "delete") {
		if (!handlers.deleteProduct) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("product", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for product ${payload.id}`);
			await handlers.deleteProduct?.({ id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "productCategory" && item.operation === "create") {
		if (!handlers.createProductCategory) return null;
		return async () => {
			const payload = item.payload as { localId?: number };
			const response = await handlers.createProductCategory?.(
				stripLocalId(payload),
			);
			const serverId = response && "id" in response ? response.id : undefined;
			if (serverId && payload.localId != null) {
				await mapLocalToServerId(
					"productCategory",
					String(payload.localId),
					serverId,
				);
				await replaceCachedProductCategoryId(payload.localId, {
					...stripLocalId(payload),
					...response,
					id: serverId,
				});
			}
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "productCategory" && item.operation === "update") {
		if (!handlers.updateProductCategory) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("productCategory", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for product category ${payload.id}`);
			await handlers.updateProductCategory?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "productCategory" && item.operation === "delete") {
		if (!handlers.deleteProductCategory) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("productCategory", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for product category ${payload.id}`);
			await handlers.deleteProductCategory?.({ id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "paymentMethod" && item.operation === "create") {
		if (!handlers.createPaymentMethod) return null;
		return async () => {
			const payload = item.payload as { localId?: number };
			const response = await handlers.createPaymentMethod?.(
				stripLocalId(payload),
			);
			const serverId = response && "id" in response ? response.id : undefined;
			if (serverId && payload.localId != null) {
				await mapLocalToServerId(
					"paymentMethod",
					String(payload.localId),
					serverId,
				);
				await replaceCachedPaymentMethodId(payload.localId, {
					...stripLocalId(payload),
					...response,
					id: serverId,
				});
			}
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "paymentMethod" && item.operation === "update") {
		if (!handlers.updatePaymentMethod) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("paymentMethod", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for payment method ${payload.id}`);
			await handlers.updatePaymentMethod?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "paymentMethod" && item.operation === "delete") {
		if (!handlers.deletePaymentMethod) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("paymentMethod", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for payment method ${payload.id}`);
			await handlers.deletePaymentMethod?.({ id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "customer" && item.operation === "create") {
		if (!handlers.createCustomer) return null;
		return async () => {
			const payload = item.payload as { localId?: number };
			const response = await handlers.createCustomer?.(stripLocalId(payload));
			const serverId = response && "id" in response ? response.id : undefined;
			if (serverId && payload.localId != null) {
				await mapLocalToServerId("customer", String(payload.localId), serverId);
				await replaceCachedCustomerId(payload.localId, {
					...stripLocalId(payload),
					...response,
					id: serverId,
				});
			}
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "customer" && item.operation === "update") {
		if (!handlers.updateCustomer) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("customer", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for customer ${payload.id}`);
			await handlers.updateCustomer?.({ ...payload, id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "customer" && item.operation === "delete") {
		if (!handlers.deleteCustomer) return null;
		return async () => {
			const payload = item.payload as { id: number };
			const serverId = await resolveServerId("customer", payload.id);
			if (!serverId)
				throw new Error(`Missing server id for customer ${payload.id}`);
			await handlers.deleteCustomer?.({ id: serverId });
			await removeSyncQueueItem(item.id);
		};
	}
	if (item.entity === "productImage" && item.operation === "update") {
		if (!handlers.updateProductImage) return null;
		return async () => {
			const payload = item.payload as { productId: number };
			const serverId = await resolveServerId("product", payload.productId);
			if (!serverId) {
				throw new Error(`Missing server id for product ${payload.productId}`);
			}
			const cached = await readCachedProductImage(payload.productId);
			if (!cached?.blob) {
				await removeSyncQueueItem(item.id);
				return;
			}
			const uploaded = await uploadProductImage(cached.blob);
			await handlers.updateProductImage?.({
				id: serverId,
				image_url: uploaded.url,
				image_key: uploaded.key,
				image_width: uploaded.width,
				image_height: uploaded.height,
			});
			await removeCachedProductImage(payload.productId);
			await removeSyncQueueItem(item.id);
		};
	}
	return null;
}
