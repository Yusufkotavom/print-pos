import { useCallback, useEffect, useState } from "react";
import {
	enqueueSyncItem,
	listReadySyncQueue,
	listSyncQueue,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";

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
		await syncReadyQueue(
			{ updateProductImage },
			{ entities: ["productImage"] },
		);
		await refreshQueueCount();
	}, [refreshQueueCount, updateProductImage]);

	return {
		queueCount,
		failedCount,
		queueProductImageUpload,
		syncQueuedProductImages,
	};
}
