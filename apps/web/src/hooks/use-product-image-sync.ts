import { useCallback, useEffect, useState } from "react";
import {
	enqueueSyncItem,
	getNextRetryAt,
	listReadySyncQueue,
	listSyncQueue,
	readCachedProductImage,
	removeCachedProductImage,
	removeSyncQueueItem,
	updateSyncQueueItem,
} from "@/lib/local-db/repo";
import { uploadProductImage } from "@/lib/product-images";

export type QueuedProductImageUpload = {
	productId: number;
};

export function useProductImageSync({
	updateProductImage,
}: {
	updateProductImage: (payload: {
		id: number;
		image_url: string;
		image_key: string;
		image_width?: number;
		image_height?: number;
	}) => Promise<void>;
}) {
	const [queueCount, setQueueCount] = useState(0);
	const [failedCount, setFailedCount] = useState(0);

	const refreshQueueCount = useCallback(async () => {
		const [readyQueue, fullQueue] = await Promise.all([
			listReadySyncQueue(),
			listSyncQueue(),
		]);
		setQueueCount(
			readyQueue.filter((item) => item.entity === "productImage").length,
		);
		setFailedCount(
			fullQueue.filter(
				(item) => item.entity === "productImage" && item.status === "failed",
			).length,
		);
	}, []);

	useEffect(() => {
		void refreshQueueCount();
	}, [refreshQueueCount]);

	const queueProductImageUpload = useCallback(
		async (productId: number) => {
			await enqueueSyncItem({
				id: `productImage:${productId}`,
				entity: "productImage",
				operation: "update",
				payload: { productId } satisfies QueuedProductImageUpload,
				status: "pending",
				retryCount: 0,
			});
			await refreshQueueCount();
		},
		[refreshQueueCount],
	);

	const syncQueuedProductImages = useCallback(async () => {
		if (typeof window === "undefined") return;
		if (!navigator.onLine) return;
		const queue = await listReadySyncQueue();
		const imageQueue = queue.filter((item) => item.entity === "productImage");
		for (const queued of imageQueue) {
			const payload = queued.payload as QueuedProductImageUpload;
			const cached = await readCachedProductImage(payload.productId);
			if (!cached?.blob) {
				await removeSyncQueueItem(queued.id);
				continue;
			}
			await updateSyncQueueItem(queued.id, {
				status: "syncing",
				errorMessage: undefined,
				nextRetryAt: undefined,
			});
			try {
				const uploaded = await uploadProductImage(cached.blob);
				await updateProductImage({
					id: payload.productId,
					image_url: uploaded.url,
					image_key: uploaded.key,
					image_width: uploaded.width,
					image_height: uploaded.height,
				});
				await removeCachedProductImage(payload.productId);
				await removeSyncQueueItem(queued.id);
			} catch (error) {
				const retryCount = queued.retryCount + 1;
				await updateSyncQueueItem(queued.id, {
					status: "failed",
					retryCount,
					errorMessage:
						error instanceof Error ? error.message : "Failed to sync image",
					nextRetryAt: getNextRetryAt(retryCount),
				});
			}
		}
		await refreshQueueCount();
	}, [refreshQueueCount, updateProductImage]);

	return {
		queueCount,
		failedCount,
		queueProductImageUpload,
		syncQueuedProductImages,
	};
}
