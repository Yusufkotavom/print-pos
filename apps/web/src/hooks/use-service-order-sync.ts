import { useCallback, useEffect, useRef, useState } from "react";
import {
	countPendingSyncItems,
	enqueueSyncItem,
	getNextRetryAt,
	listReadySyncQueue,
	listSyncQueue,
	mapLocalToServerId,
	removeSyncQueueItem,
	updateSyncQueueItem,
} from "@/lib/local-db/repo";

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
	const syncInFlightRef = useRef(false);
	const syncedIdsRef = useRef<Set<string>>(new Set());

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
		async (clientServiceOrderId: string, serverId?: number) => {
			syncedIdsRef.current.add(clientServiceOrderId);
			if (serverId) {
				await mapLocalToServerId(
					"serviceOrder",
					clientServiceOrderId,
					serverId,
				);
			}
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
		if (typeof window === "undefined") return;
		if (syncInFlightRef.current || !navigator.onLine) return;
		const queue = await listReadySyncQueue();
		const serviceQueue = queue.filter((item) => item.entity === "serviceOrder");
		if (serviceQueue.length === 0) {
			await refreshQueueCount();
			return;
		}
		syncInFlightRef.current = true;
		try {
			for (const queued of serviceQueue) {
				const payload = queued.payload as QueuedServiceOrder;
				if (syncedIdsRef.current.has(payload.clientServiceOrderId)) continue;
				await updateSyncQueueItem(queued.id, {
					status: "syncing",
					errorMessage: undefined,
					nextRetryAt: undefined,
				});
				await refreshQueueCount();
				await createServiceOrder(payload);
			}
		} finally {
			syncInFlightRef.current = false;
			await refreshQueueCount();
		}
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
