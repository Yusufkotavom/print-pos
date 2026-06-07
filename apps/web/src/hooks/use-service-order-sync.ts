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
	localId: number;
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
	createServiceOrder: (
		payload: QueuedServiceOrder,
	) => Promise<{ id?: number } | undefined>;
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
				id: `serviceOrder:create:${payload.localId}`,
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
				createServiceOrder: async (payload) =>
					createServiceOrder(payload as QueuedServiceOrder),
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
