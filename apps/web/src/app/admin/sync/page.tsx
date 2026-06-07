"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { useMutation } from "@tanstack/react-query";
import { RefreshCwIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { localDb, type SyncQueueItem } from "@/lib/local-db/db";
import {
	listSyncQueue,
	removeSyncQueueItem,
	updateSyncQueueItem,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";

type SyncSnapshot = {
	queue: SyncQueueItem[];
	products: number;
	customers: number;
	paymentMethods: number;
	productCategories: number;
	productImages: number;
	serviceOrders: number;
	drafts: number;
	meta: number;
};

const emptySnapshot: SyncSnapshot = {
	queue: [],
	products: 0,
	customers: 0,
	paymentMethods: 0,
	productCategories: 0,
	productImages: 0,
	serviceOrders: 0,
	drafts: 0,
	meta: 0,
};

export default function SyncPage() {
	const trpc = useTRPC();
	const [snapshot, setSnapshot] = useState<SyncSnapshot>(emptySnapshot);
	const [isOnline, setIsOnline] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const createOrderMutation = useMutation(trpc.orders.create.mutationOptions());
	const createServiceOrderMutation = useMutation(
		trpc.serviceOrders.create.mutationOptions(),
	);
	const updateServiceOrderMutation = useMutation(
		trpc.serviceOrders.update.mutationOptions(),
	);
	const updateServiceOrderStatusMutation = useMutation(
		trpc.serviceOrders.updateStatus.mutationOptions(),
	);
	const receiveServiceOrderPaymentMutation = useMutation(
		trpc.serviceOrders.receivePayment.mutationOptions(),
	);
	const updateServiceOrderWarrantyMutation = useMutation(
		trpc.serviceOrders.updateWarranty.mutationOptions(),
	);
	const deleteServiceOrderMutation = useMutation(
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

	const refresh = useCallback(async () => {
		setIsLoading(true);
		const [
			queue,
			products,
			customers,
			paymentMethods,
			productCategories,
			productImages,
			serviceOrders,
			drafts,
			meta,
		] = await Promise.all([
			listSyncQueue(),
			localDb.products.count(),
			localDb.customers.count(),
			localDb.paymentMethods.count(),
			localDb.productCategories.count(),
			localDb.productImages.count(),
			localDb.serviceOrders.count(),
			localDb.drafts.count(),
			localDb.appMeta.count(),
		]);
		setSnapshot({
			queue,
			products,
			customers,
			paymentMethods,
			productCategories,
			productImages,
			serviceOrders,
			drafts,
			meta,
		});
		setIsLoading(false);
	}, []);

	useEffect(() => {
		setIsOnline(navigator.onLine);
		void refresh();
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [refresh]);

	const totals = useMemo(
		() =>
			snapshot.queue.reduce(
				(acc, item) => {
					acc.total += 1;
					acc[item.status] += 1;
					return acc;
				},
				{
					total: 0,
					pending: 0,
					syncing: 0,
					success: 0,
					failed: 0,
					conflict: 0,
				},
			),
		[snapshot.queue],
	);

	const retryItems = async (status: SyncQueueItem["status"]) => {
		await Promise.all(
			snapshot.queue
				.filter((item) => item.status === status)
				.map((item) =>
					updateSyncQueueItem(item.id, {
						status: "pending",
						nextRetryAt: undefined,
						errorMessage: undefined,
					}),
				),
		);
		await refresh();
	};

	const discardItem = async (id: string) => {
		await removeSyncQueueItem(id);
		await refresh();
	};

	const clearSuccess = async () => {
		await Promise.all(
			snapshot.queue
				.filter((item) => item.status === "success")
				.map((item) => localDb.syncQueue.delete(item.id)),
		);
		await refresh();
	};

	const runSync = async () => {
		setIsSyncing(true);
		await syncReadyQueue({
			createOrder: (payload) =>
				createOrderMutation.mutateAsync(payload as never) as Promise<{
					id?: number;
				}>,
			createServiceOrder: (payload) =>
				createServiceOrderMutation.mutateAsync(payload as never) as Promise<{
					id?: number;
				}>,
			updateServiceOrder: (payload) =>
				updateServiceOrderMutation.mutateAsync(payload as never),
			updateServiceOrderStatus: (payload) =>
				updateServiceOrderStatusMutation.mutateAsync(payload as never),
			receiveServiceOrderPayment: (payload) =>
				receiveServiceOrderPaymentMutation.mutateAsync(payload as never),
			updateServiceOrderWarranty: (payload) =>
				updateServiceOrderWarrantyMutation.mutateAsync(payload as never),
			deleteServiceOrder: (payload) =>
				deleteServiceOrderMutation.mutateAsync(payload as never),
			createProduct: (payload) =>
				createProductMutation.mutateAsync(payload as never) as Promise<{
					id?: number;
				}>,
			updateProduct: (payload) =>
				updateProductMutation.mutateAsync(payload as never),
			deleteProduct: (payload) =>
				deleteProductMutation.mutateAsync(payload as never),
			createProductCategory: (payload) =>
				createProductCategoryMutation.mutateAsync(payload as never) as Promise<{
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
			updateProductImage: async (payload) => {
				await updateProductMutation.mutateAsync(payload);
			},
		});
		setIsSyncing(false);
		await refresh();
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl">Sync Status</h1>
					<p className="text-muted-foreground text-sm">
						Local-first queue, cached data, and pending uploads.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge variant={isOnline ? "default" : "destructive"}>
						{isOnline ? "Online" : "Offline"}
					</Badge>
					<Button
						type="button"
						variant="outline"
						onClick={() => void runSync()}
						disabled={!isOnline || isSyncing}
					>
						<RotateCcwIcon className="mr-2 h-4 w-4" />
						{isSyncing ? "Syncing..." : "Sync now"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => void refresh()}
					>
						<RefreshCwIcon className="mr-2 h-4 w-4" />
						Refresh
					</Button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					title="Queue"
					value={totals.total}
					detail="All sync items"
				/>
				<MetricCard
					title="Pending"
					value={totals.pending}
					detail="Waiting sync"
				/>
				<MetricCard title="Failed" value={totals.failed} detail="Needs retry" />
				<MetricCard
					title="Conflicts"
					value={totals.conflict}
					detail="Needs manual fix"
				/>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<MetricCard title="Cached products" value={snapshot.products} />
				<MetricCard title="Cached customers" value={snapshot.customers} />
				<MetricCard title="Payment methods" value={snapshot.paymentMethods} />
				<MetricCard
					title="Product categories"
					value={snapshot.productCategories}
				/>
				<MetricCard title="Pending images" value={snapshot.productImages} />
				<MetricCard title="Cached services" value={snapshot.serviceOrders} />
				<MetricCard title="Drafts" value={snapshot.drafts} />
				<MetricCard title="Local mappings" value={snapshot.meta} />
			</div>

			<Card>
				<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle>Sync Queue</CardTitle>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => void retryItems("failed")}
							disabled={totals.failed === 0}
						>
							<RotateCcwIcon className="mr-2 h-4 w-4" />
							Retry failed
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => void retryItems("conflict")}
							disabled={totals.conflict === 0}
						>
							<RotateCcwIcon className="mr-2 h-4 w-4" />
							Retry conflict
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => void clearSuccess()}
							disabled={totals.success === 0}
						>
							<Trash2Icon className="mr-2 h-4 w-4" />
							Clear success
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="text-muted-foreground text-sm">Loading...</div>
					) : snapshot.queue.length === 0 ? (
						<div className="text-muted-foreground text-sm">No sync items.</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Entity</TableHead>
										<TableHead>Operation</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Retry</TableHead>
										<TableHead>Next retry</TableHead>
										<TableHead>Error</TableHead>
										<TableHead>Payload</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{snapshot.queue.map((item) => (
										<TableRow key={item.id}>
											<TableCell className="max-w-48 truncate font-mono text-xs">
												{item.id}
											</TableCell>
											<TableCell>{item.entity}</TableCell>
											<TableCell>{item.operation}</TableCell>
											<TableCell>
												<Badge variant={statusVariant(item.status)}>
													{item.status}
												</Badge>
											</TableCell>
											<TableCell>{item.retryCount}</TableCell>
											<TableCell>
												{item.nextRetryAt
													? new Date(item.nextRetryAt).toLocaleString()
													: "—"}
											</TableCell>
											<TableCell className="max-w-72 truncate">
												{item.errorMessage ?? "—"}
											</TableCell>
											<TableCell className="max-w-80">
												<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
													{JSON.stringify(item.payload, null, 2)}
												</pre>
											</TableCell>
											<TableCell>
												<div className="flex flex-col gap-2">
													{item.status === "conflict" ? (
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => void retryItems("conflict")}
														>
															Retry
														</Button>
													) : null}
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() => void discardItem(item.id)}
													>
														Discard
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function MetricCard({
	title,
	value,
	detail,
}: {
	title: string;
	value: number;
	detail?: string;
}) {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="text-muted-foreground text-sm">{title}</div>
				<div className="mt-2 font-bold text-3xl">{value}</div>
				{detail && (
					<div className="mt-1 text-muted-foreground text-xs">{detail}</div>
				)}
			</CardContent>
		</Card>
	);
}

function statusVariant(status: SyncQueueItem["status"]) {
	if (status === "failed" || status === "conflict") return "destructive";
	if (status === "success") return "default";
	return "secondary";
}
