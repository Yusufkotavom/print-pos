"use client";

import { Button } from "@finopenpos/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CloudOffIcon,
	DownloadIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SYNC_MESSAGE } from "@/lib/local-db/background-sync";
import {
	markAutoOfflineWarmupStarted,
	shouldRunAutoOfflineWarmup,
	warmupOfflineCache,
} from "@/lib/local-db/offline-warmup";
import { createOfflineWarmupQueries } from "@/lib/local-db/offline-warmup-queries";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { createQueuedSyncHandlers } from "@/lib/local-db/sync-handlers";
import { useTRPC } from "@/lib/trpc/client";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type OfflineStatus = "unsupported" | "installing" | "ready";

const PWA_CACHE_NAME = "finopenpos-v5";

export function PWAProvider() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [isOnline, setIsOnline] = useState(true);
	const [offlineStatus, setOfflineStatus] =
		useState<OfflineStatus>("installing");
	const createOrderMutation = useMutation(trpc.orders.create.mutationOptions());
	const updateOrderMutation = useMutation(trpc.orders.update.mutationOptions());
	const receiveOrderPaymentMutation = useMutation(
		trpc.orders.receivePayment.mutationOptions(),
	);
	const deleteOrderMutation = useMutation(trpc.orders.delete.mutationOptions());
	const createServiceOrderMutation = useMutation(
		trpc.serviceOrders.create.mutationOptions(),
	);
	const updateServiceMutation = useMutation(
		trpc.serviceOrders.update.mutationOptions(),
	);
	const updateServiceStatusMutation = useMutation(
		trpc.serviceOrders.updateStatus.mutationOptions(),
	);
	const receiveServicePaymentMutation = useMutation(
		trpc.serviceOrders.receivePayment.mutationOptions(),
	);
	const updateServiceWarrantyMutation = useMutation(
		trpc.serviceOrders.updateWarranty.mutationOptions(),
	);
	const deleteServiceMutation = useMutation(
		trpc.serviceOrders.delete.mutationOptions(),
	);
	const createProductMutation = useMutation(
		trpc.products.create.mutationOptions(),
	);
	const updateProductMutation = useMutation(
		trpc.products.update.mutationOptions(),
	);
	const deleteProductMutation = useMutation(
		trpc.products.delete.mutationOptions(),
	);
	const createProductCategoryMutation = useMutation(
		trpc.productCategories.create.mutationOptions(),
	);
	const updateProductCategoryMutation = useMutation(
		trpc.productCategories.update.mutationOptions(),
	);
	const deleteProductCategoryMutation = useMutation(
		trpc.productCategories.delete.mutationOptions(),
	);
	const createPaymentMethodMutation = useMutation(
		trpc.paymentMethods.create.mutationOptions(),
	);
	const updatePaymentMethodMutation = useMutation(
		trpc.paymentMethods.update.mutationOptions(),
	);
	const deletePaymentMethodMutation = useMutation(
		trpc.paymentMethods.delete.mutationOptions(),
	);
	const createCustomerMutation = useMutation(
		trpc.customers.create.mutationOptions(),
	);
	const updateCustomerMutation = useMutation(
		trpc.customers.update.mutationOptions(),
	);
	const deleteCustomerMutation = useMutation(
		trpc.customers.delete.mutationOptions(),
	);
	const createTransactionMutation = useMutation(
		trpc.transactions.create.mutationOptions(),
	);
	const updateTransactionMutation = useMutation(
		trpc.transactions.update.mutationOptions(),
	);
	const deleteTransactionMutation = useMutation(
		trpc.transactions.delete.mutationOptions(),
	);
	const createTransactionCategoryMutation = useMutation(
		trpc.transactionCategories.create.mutationOptions(),
	);
	const updateTransactionCategoryMutation = useMutation(
		trpc.transactionCategories.update.mutationOptions(),
	);
	const deleteTransactionCategoryMutation = useMutation(
		trpc.transactionCategories.delete.mutationOptions(),
	);

	useEffect(() => {
		setIsMounted(true);
		setDismissed(
			localStorage.getItem("finopenpos:pwa-install-dismissed") === "1",
		);
	}, []);

	useEffect(() => {
		setIsOnline(navigator.onLine);
		if (!("serviceWorker" in navigator)) setOfflineStatus("unsupported");
		const updateOnline = () => setIsOnline(navigator.onLine);
		window.addEventListener("online", updateOnline);
		window.addEventListener("offline", updateOnline);
		return () => {
			window.removeEventListener("online", updateOnline);
			window.removeEventListener("offline", updateOnline);
		};
	}, []);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		const checkOfflineReady = async () => {
			try {
				await navigator.serviceWorker.ready;
				if (!("caches" in window)) {
					setOfflineStatus(
						navigator.serviceWorker.controller ? "ready" : "installing",
					);
					return;
				}
				const cache = await caches.open(PWA_CACHE_NAME);
				const [adminShell, posShell, offlinePage] = await Promise.all([
					cache.match("/admin"),
					cache.match("/admin/pos"),
					cache.match("/offline"),
				]);
				setOfflineStatus(
					adminShell && posShell && offlinePage ? "ready" : "installing",
				);
			} catch {
				setOfflineStatus("installing");
			}
		};
		void navigator.serviceWorker
			.register("/sw.js")
			.then(() => checkOfflineReady());
		const handleControllerChange = () => void checkOfflineReady();
		navigator.serviceWorker.addEventListener(
			"controllerchange",
			handleControllerChange,
		);
		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			if (!dismissed) setDeferredPrompt(event as BeforeInstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		return () => {
			navigator.serviceWorker.removeEventListener(
				"controllerchange",
				handleControllerChange,
			);
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, [dismissed]);

	const runSync = useCallback(() => {
		if (!navigator.onLine) return;
		void syncReadyQueue(
			createQueuedSyncHandlers({
				orders: {
					create: createOrderMutation,
					update: updateOrderMutation,
					receivePayment: receiveOrderPaymentMutation,
					delete: deleteOrderMutation,
				},
				serviceOrders: {
					create: createServiceOrderMutation,
					update: updateServiceMutation,
					updateStatus: updateServiceStatusMutation,
					receivePayment: receiveServicePaymentMutation,
					updateWarranty: updateServiceWarrantyMutation,
					delete: deleteServiceMutation,
				},
				products: {
					create: createProductMutation,
					update: updateProductMutation,
					delete: deleteProductMutation,
				},
				productCategories: {
					create: createProductCategoryMutation,
					update: updateProductCategoryMutation,
					delete: deleteProductCategoryMutation,
				},
				paymentMethods: {
					create: createPaymentMethodMutation,
					update: updatePaymentMethodMutation,
					delete: deletePaymentMethodMutation,
				},
				customers: {
					create: createCustomerMutation,
					update: updateCustomerMutation,
					delete: deleteCustomerMutation,
				},
				transactions: {
					create: createTransactionMutation,
					update: updateTransactionMutation,
					delete: deleteTransactionMutation,
				},
				transactionCategories: {
					create: createTransactionCategoryMutation,
					update: updateTransactionCategoryMutation,
					delete: deleteTransactionCategoryMutation,
				},
			}),
		);
	}, [
		createOrderMutation,
		updateOrderMutation,
		receiveOrderPaymentMutation,
		deleteOrderMutation,
		createServiceOrderMutation,
		updateServiceMutation,
		updateServiceStatusMutation,
		receiveServicePaymentMutation,
		updateServiceWarrantyMutation,
		deleteServiceMutation,
		createProductMutation,
		updateProductMutation,
		deleteProductMutation,
		createProductCategoryMutation,
		updateProductCategoryMutation,
		deleteProductCategoryMutation,
		createPaymentMethodMutation,
		updatePaymentMethodMutation,
		deletePaymentMethodMutation,
		createCustomerMutation,
		updateCustomerMutation,
		deleteCustomerMutation,
		createTransactionMutation,
		updateTransactionMutation,
		deleteTransactionMutation,
		createTransactionCategoryMutation,
		updateTransactionCategoryMutation,
		deleteTransactionCategoryMutation,
	]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data?.type === SYNC_MESSAGE) runSync();
		};
		const handleOnline = () => runSync();
		navigator.serviceWorker?.addEventListener("message", handleMessage);
		window.addEventListener("online", handleOnline);
		return () => {
			navigator.serviceWorker?.removeEventListener("message", handleMessage);
			window.removeEventListener("online", handleOnline);
		};
	}, [runSync]);

	useEffect(() => {
		if (!isOnline || offlineStatus !== "ready") return;
		let cancelled = false;
		void (async () => {
			const shouldRun = await shouldRunAutoOfflineWarmup();
			if (!shouldRun || cancelled) return;
			await markAutoOfflineWarmupStarted();
			await warmupOfflineCache({
				queryClient,
				queries: createOfflineWarmupQueries(trpc as never),
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [isOnline, offlineStatus, queryClient, trpc]);

	const statusText = useMemo(() => {
		if (offlineStatus === "unsupported") return "Offline app not supported";
		if (offlineStatus === "ready") return "Offline cache ready";
		return "Preparing offline cache";
	}, [offlineStatus]);
	const StatusIcon =
		offlineStatus === "ready" ? CheckCircle2Icon : CloudOffIcon;

	if (!isMounted) return null;

	return (
		<>
			<div className="fixed top-3.5 right-20 z-50 flex items-center gap-1.5 rounded-full border bg-background/50 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm sm:right-40">
				<StatusIcon className="h-3 w-3" />
				<span className="hidden sm:inline">{statusText}</span>
				<span
					className={`font-medium ${isOnline ? "text-green-600" : "text-amber-600"}`}
				>
					{isOnline ? "Online" : "Offline"}
				</span>
			</div>
			{deferredPrompt && !dismissed ? (
				<div className="fixed right-4 bottom-4 z-50 rounded-lg border bg-background p-3 shadow-lg">
					<div className="mb-2 flex items-center justify-between gap-3">
						<div className="text-sm">Install FinOpenPOS app</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={() => {
								localStorage.setItem("finopenpos:pwa-install-dismissed", "1");
								setDismissed(true);
								setDeferredPrompt(null);
							}}
						>
							<XIcon className="h-4 w-4" />
						</Button>
					</div>
					<Button
						type="button"
						size="sm"
						onClick={async () => {
							await deferredPrompt.prompt();
							await deferredPrompt.userChoice;
							setDeferredPrompt(null);
						}}
					>
						<DownloadIcon className="mr-2 h-4 w-4" />
						Install
					</Button>
				</div>
			) : null}
		</>
	);
}
