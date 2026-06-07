import { useCallback, useEffect, useState } from "react";
import type { POSDraft, QueuedPOSOrder } from "@/components/pos-types";
import { POS_DRAFT_KEY } from "@/lib/local-db/keys";
import {
	clearDraft,
	countPendingSyncItems,
	enqueueSyncItem,
	getNextRetryAt,
	listSyncQueue,
	readCachedCustomers,
	readCachedPaymentMethods,
	readCachedProducts,
	readDraft,
	removeSyncQueueItem,
	replaceCachedCustomers,
	replaceCachedPaymentMethods,
	replaceCachedProducts,
	saveDraft,
	updateSyncQueueItem,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";

export function usePOSLocalFirst<
	TProduct,
	TCustomer,
	TPaymentMethod,
	TCreatePayload extends { clientOrderId?: string },
>({
	remoteProducts,
	remoteCustomers,
	remotePaymentMethods,
	createOrder,
	isRemoteLoading = false,
	isRemoteError = false,
}: {
	remoteProducts: TProduct[];
	remoteCustomers: TCustomer[];
	remotePaymentMethods: TPaymentMethod[];
	createOrder: (payload: TCreatePayload) => Promise<void>;
	isRemoteLoading?: boolean;
	isRemoteError?: boolean;
}) {
	const [cachedProducts, setCachedProducts] = useState<TProduct[]>([]);
	const [cachedCustomers, setCachedCustomers] = useState<TCustomer[]>([]);
	const [cachedPaymentMethods, setCachedPaymentMethods] = useState<
		TPaymentMethod[]
	>([]);
	const [queueCount, setQueueCount] = useState(0);

	const products = remoteProducts.length ? remoteProducts : cachedProducts;
	const customers = remoteCustomers.length ? remoteCustomers : cachedCustomers;
	const paymentMethods = remotePaymentMethods.length
		? remotePaymentMethods
		: cachedPaymentMethods;

	useEffect(() => {
		void (async () => {
			const [productCache, customerCache, paymentMethodCache, pending] =
				await Promise.all([
					readCachedProducts<TProduct>(),
					readCachedCustomers<TCustomer>(),
					readCachedPaymentMethods<TPaymentMethod>(),
					countPendingSyncItems(),
				]);
			setCachedProducts(productCache);
			setCachedCustomers(customerCache);
			setCachedPaymentMethods(paymentMethodCache);
			setQueueCount(pending);
		})();
	}, []);

	useEffect(() => {
		if (isRemoteLoading || isRemoteError) return;
		setCachedProducts(remoteProducts);
		void replaceCachedProducts(remoteProducts);
	}, [remoteProducts, isRemoteError, isRemoteLoading]);

	useEffect(() => {
		if (isRemoteLoading || isRemoteError) return;
		setCachedCustomers(remoteCustomers);
		void replaceCachedCustomers(remoteCustomers);
	}, [remoteCustomers, isRemoteError, isRemoteLoading]);

	useEffect(() => {
		if (isRemoteLoading || isRemoteError) return;
		setCachedPaymentMethods(remotePaymentMethods);
		void replaceCachedPaymentMethods(remotePaymentMethods);
	}, [remotePaymentMethods, isRemoteError, isRemoteLoading]);

	const loadDraft = useCallback(async () => {
		return readDraft<POSDraft>(POS_DRAFT_KEY);
	}, []);

	const savePOSDraft = useCallback(async (draft: POSDraft) => {
		await saveDraft(POS_DRAFT_KEY, draft);
	}, []);

	const clearPOSDraft = useCallback(async () => {
		await clearDraft(POS_DRAFT_KEY);
	}, []);

	const queueOrder = useCallback(async (queuedOrder: QueuedPOSOrder) => {
		await enqueueSyncItem({
			id: queuedOrder.clientOrderId,
			entity: "order",
			operation: "create",
			payload: queuedOrder,
			status: "pending",
			retryCount: 0,
		});
		setQueueCount(await countPendingSyncItems());
	}, []);

	const markOrderSynced = useCallback(async (clientOrderId: string) => {
		await removeSyncQueueItem(clientOrderId);
		setQueueCount(await countPendingSyncItems());
	}, []);

	const markOrderFailed = useCallback(
		async (clientOrderId: string, errorMessage: string) => {
			const queue = await listSyncQueue();
			const current = queue.find((item) => item.id === clientOrderId);
			const retryCount = (current?.retryCount ?? 0) + 1;
			await updateSyncQueueItem(clientOrderId, {
				status: "failed",
				retryCount,
				errorMessage,
				nextRetryAt: getNextRetryAt(retryCount),
			});
			setQueueCount(await countPendingSyncItems());
		},
		[],
	);

	const syncQueuedOrders = useCallback(async () => {
		await syncReadyQueue(
			{
				createOrder: async (payload) => {
					await createOrder(payload as TCreatePayload);
					return undefined;
				},
			},
			{ entities: ["order"] },
		);
		setQueueCount(await countPendingSyncItems());
	}, [createOrder]);

	return {
		products,
		customers,
		paymentMethods,
		queueCount,
		loadDraft,
		savePOSDraft,
		clearPOSDraft,
		queueOrder,
		markOrderSynced,
		markOrderFailed,
		syncQueuedOrders,
	};
}
