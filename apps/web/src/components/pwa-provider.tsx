"use client";

import { Button } from "@finopenpos/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { SYNC_MESSAGE } from "@/lib/local-db/background-sync";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAProvider() {
	const trpc = useTRPC();
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const createOrderMutation = useMutation(trpc.orders.create.mutationOptions());
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

	useEffect(() => {
		setDismissed(
			localStorage.getItem("finopenpos:pwa-install-dismissed") === "1",
		);
	}, []);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		void navigator.serviceWorker.register("/sw.js");
		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			if (!dismissed) setDeferredPrompt(event as BeforeInstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		return () =>
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
	}, [dismissed]);

	useEffect(() => {
		const runSync = () => {
			if (!navigator.onLine) return;
			void syncReadyQueue({
				createOrder: (payload) =>
					createOrderMutation.mutateAsync(payload as never) as Promise<{
						id?: number;
					}>,
				createServiceOrder: (payload) =>
					createServiceOrderMutation.mutateAsync(payload as never) as Promise<{
						id?: number;
					}>,
				updateServiceOrder: (payload) =>
					updateServiceMutation.mutateAsync(payload as never),
				updateServiceOrderStatus: (payload) =>
					updateServiceStatusMutation.mutateAsync(payload as never),
				receiveServiceOrderPayment: (payload) =>
					receiveServicePaymentMutation.mutateAsync(payload as never),
				updateServiceOrderWarranty: (payload) =>
					updateServiceWarrantyMutation.mutateAsync(payload as never),
				deleteServiceOrder: (payload) =>
					deleteServiceMutation.mutateAsync(payload as never),
				createProduct: (payload) =>
					createProductMutation.mutateAsync(payload as never) as Promise<{
						id?: number;
					}>,
				updateProduct: (payload) =>
					updateProductMutation.mutateAsync(payload as never),
				deleteProduct: (payload) =>
					deleteProductMutation.mutateAsync(payload as never),
				updateProductImage: async (payload) => {
					await updateProductMutation.mutateAsync(payload);
				},
				createProductCategory: (payload) =>
					createProductCategoryMutation.mutateAsync(
						payload as never,
					) as Promise<{
						id?: number;
					}>,
				updateProductCategory: (payload) =>
					updateProductCategoryMutation.mutateAsync(payload as never),
				deleteProductCategory: (payload) =>
					deleteProductCategoryMutation.mutateAsync(payload as never),
				createPaymentMethod: (payload) =>
					createPaymentMethodMutation.mutateAsync(payload as never) as Promise<{
						id?: number;
					}>,
				updatePaymentMethod: (payload) =>
					updatePaymentMethodMutation.mutateAsync(payload as never),
				deletePaymentMethod: (payload) =>
					deletePaymentMethodMutation.mutateAsync(payload as never),
				createCustomer: (payload) =>
					createCustomerMutation.mutateAsync(payload as never) as Promise<{
						id?: number;
					}>,
				updateCustomer: (payload) =>
					updateCustomerMutation.mutateAsync(payload as never),
				deleteCustomer: (payload) =>
					deleteCustomerMutation.mutateAsync(payload as never),
			});
		};
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
	}, [
		createOrderMutation,
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
	]);

	if (!deferredPrompt || dismissed) return null;

	return (
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
				Install
			</Button>
		</div>
	);
}
