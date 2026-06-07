import { useCallback, useEffect, useState } from "react";
import {
	countPendingSyncItems,
	enqueueSyncItem,
	getNextRetryAt,
	listSyncQueue,
	removeSyncQueueItem,
	updateSyncQueueItem,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";

export type QueuedServiceOrder = {
	clientServiceOrderId: string;
	customerId: number;
	serviceType: string;
	estimatedDoneAt?: Date;
	customerNote?: string;
	internalNote?: string;
	details?: Record<string, unknown>;
	items: {
		id?: number;
		quantity: number;
		price: number;
		name?: string;
		lineType: "service" | "product";
		note?: string;
	}[];
	total: number;
};

export function createClientServiceOrderId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useServiceOrderSync({
	createServiceOrder,
}: {
	createServiceOrder: (payload: QueuedServiceOrder) => Promise<void>;
}) {
	const [queueCount, setQueueCount] = useState(0);

	const refreshQueueCount = useCallback(async () => {
		setQueueCount(await countPendingSyncItems());
	}, []);

	useEffect(() => {
		void refreshQueueCount();
	}, [refreshQueueCount]);

	const queueServiceOrder = useCallback(
		async (payload: QueuedServiceOrder) => {
			await enqueueSyncItem({
				id: payload.clientServiceOrderId,
				entity: "serviceOrder",
				operation: "create",
				payload,
				status: "pending",
				retryCount: 0,
			});
			await refreshQueueCount();
		},
		[refreshQueueCount],
	);

	const markServiceOrderSynced = useCallback(
		async (clientServiceOrderId: string) => {
			await removeSyncQueueItem(clientServiceOrderId);
			await refreshQueueCount();
		},
		[refreshQueueCount],
	);

	const markServiceOrderFailed = useCallback(
		async (clientServiceOrderId: string, errorMessage: string) => {
			const queue = await listSyncQueue();
			const current = queue.find((item) => item.id === clientServiceOrderId);
			const retryCount = (current?.retryCount ?? 0) + 1;
			await updateSyncQueueItem(clientServiceOrderId, {
				status: "failed",
				retryCount,
				errorMessage,
				nextRetryAt: getNextRetryAt(retryCount),
			});
			await refreshQueueCount();
		},
		[refreshQueueCount],
	);

	const syncQueuedServiceOrders = useCallback(async () => {
		await syncReadyQueue(
			{
				createServiceOrder: async (payload) => {
					await createServiceOrder(payload as QueuedServiceOrder);
					return undefined;
				},
			},
			{ entities: ["serviceOrder"] },
		);
		await refreshQueueCount();
	}, [createServiceOrder, refreshQueueCount]);

	return {
		queueCount,
		queueServiceOrder,
		markServiceOrderSynced,
		markServiceOrderFailed,
		syncQueuedServiceOrders,
		refreshQueueCount,
	};
}
