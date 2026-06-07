"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Combobox } from "@finopenpos/ui/components/combobox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { POSCartPanel } from "@/components/pos-cart-panel";
import { POSProductCatalog } from "@/components/pos-product-catalog";
import type { POSProductItem } from "@/components/pos-types";
import { ServiceOrderFields } from "@/components/service-order-fields";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
	createClientServiceOrderId,
	type QueuedServiceOrder,
	useServiceOrderSync,
} from "@/hooks/use-service-order-sync";
import { SERVICE_DRAFT_KEY } from "@/lib/local-db/keys";
import {
	clearDraft,
	readCachedCustomers,
	readCachedProducts,
	readDraft,
	replaceCachedCustomers,
	replaceCachedProducts,
	saveDraft,
	upsertCachedServiceOrder,
} from "@/lib/local-db/repo";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

function toDateOnly(value: Date | undefined) {
	return value
		? new Date(value.getFullYear(), value.getMonth(), value.getDate())
		: undefined;
}

export default function NewServicePage() {
	const trpc = useTRPC();
	const router = useRouter();
	const t = useTranslations("services");
	const tPos = useTranslations("pos");
	const locale = useLocale();
	const isOnline = useOnlineStatus();
	const {
		data: remoteProducts = [],
		isLoading: productsLoading,
		error: productsError,
	} = useQuery(trpc.products.list.queryOptions());
	const {
		data: remoteCustomers = [],
		isLoading: customersLoading,
		error: customersError,
	} = useQuery(trpc.customers.list.queryOptions());
	const [cachedProducts, setCachedProducts] = useState<typeof remoteProducts>(
		[],
	);
	const [cachedCustomers, setCachedCustomers] = useState<
		typeof remoteCustomers
	>([]);
	const products =
		(productsLoading || productsError) && cachedProducts.length
			? cachedProducts
			: remoteProducts;
	const customers =
		(customersLoading || customersError) && cachedCustomers.length
			? cachedCustomers
			: remoteCustomers;
	const [selectedProducts, setSelectedProducts] = useState<POSProductItem[]>(
		[],
	);
	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const { data: serviceTypes = [] } = useQuery(
		trpc.serviceTypes.list.queryOptions(),
	);
	const [serviceType, setServiceType] = useState("other");
	const serviceTypeOptions = useMemo(
		() =>
			serviceTypes.length
				? serviceTypes
				: [{ id: 0, name: t("serviceTypeOther"), value: "other" }],
		[serviceTypes, t],
	);
	const selectedServiceType = serviceTypeOptions.some(
		(item) => item.value === serviceType,
	)
		? serviceType
		: (serviceTypeOptions[0]?.value ?? "other");
	const [customerNote, setCustomerNote] = useState("");
	const [internalNote, setInternalNote] = useState("");
	const [estimatedDoneAt, setEstimatedDoneAt] = useState<Date | undefined>();
	const [detailText, setDetailText] = useState("");
	const [productSearch, setProductSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [isCartOpen, setIsCartOpen] = useState(false);
	const search = useDebouncedValue(productSearch, 250);

	useEffect(() => {
		void (async () => {
			const [productCache, customerCache, draft] = await Promise.all([
				readCachedProducts<(typeof remoteProducts)[number]>(),
				readCachedCustomers<(typeof remoteCustomers)[number]>(),
				readDraft<{
					items: POSProductItem[];
					customer: { id: number; name: string } | null;
					serviceType: string;
					customerNote: string;
					internalNote: string;
					detailText: string;
					estimatedDoneAt?: string;
				}>(SERVICE_DRAFT_KEY),
			]);
			setCachedProducts(productCache);
			setCachedCustomers(customerCache);
			if (draft) {
				setSelectedProducts(draft.items ?? []);
				setSelectedCustomer(draft.customer ?? null);
				setServiceType(draft.serviceType ?? "other");
				setCustomerNote(draft.customerNote ?? "");
				setInternalNote(draft.internalNote ?? "");
				setDetailText(draft.detailText ?? "");
				setEstimatedDoneAt(
					draft.estimatedDoneAt
						? toDateOnly(new Date(draft.estimatedDoneAt))
						: undefined,
				);
			}
		})();
	}, []);

	useEffect(() => {
		if (productsLoading || productsError) return;
		setCachedProducts(remoteProducts);
		void replaceCachedProducts(remoteProducts);
	}, [remoteProducts, productsLoading, productsError]);

	useEffect(() => {
		if (customersLoading || customersError) return;
		setCachedCustomers(remoteCustomers);
		void replaceCachedCustomers(remoteCustomers);
	}, [remoteCustomers, customersLoading, customersError]);

	useEffect(() => {
		void saveDraft(SERVICE_DRAFT_KEY, {
			items: selectedProducts,
			customer: selectedCustomer,
			serviceType: selectedServiceType,
			customerNote,
			internalNote,
			detailText,
			estimatedDoneAt: toDateOnly(estimatedDoneAt)?.toISOString(),
		});
	}, [
		selectedProducts,
		selectedCustomer,
		selectedServiceType,
		customerNote,
		internalNote,
		detailText,
		estimatedDoneAt,
	]);

	const productCategories = useMemo(() => {
		const names = products
			.map((product) => product.category)
			.filter((category): category is string => Boolean(category));
		return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
	}, [products]);

	const filteredProducts = useMemo(() => {
		const q = search.toLowerCase().trim();
		return products.filter((product) => {
			const matchesCategory =
				selectedCategory === "all" || product.category === selectedCategory;
			const matchesSearch =
				!q ||
				product.name.toLowerCase().includes(q) ||
				(product.category ?? "").toLowerCase().includes(q);
			return matchesCategory && matchesSearch;
		});
	}, [products, search, selectedCategory]);

	const total = selectedProducts.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);

	const createMutation = useMutation(
		trpc.serviceOrders.create.mutationOptions(),
	);

	const { queueCount, queueServiceOrder, syncQueuedServiceOrders } =
		useServiceOrderSync({
			createServiceOrder: async ({ localId: _localId, ...payload }) =>
				createMutation.mutateAsync(payload),
		});

	useEffect(() => {
		void syncQueuedServiceOrders();
		const handleOnline = () => void syncQueuedServiceOrders();
		window.addEventListener("online", handleOnline);
		return () => window.removeEventListener("online", handleOnline);
	}, [syncQueuedServiceOrders]);

	const handleSelectProduct = (productId: number | string) => {
		const product = products.find((item) => item.id === productId);
		if (!product) return;
		setSelectedProducts((prev) => {
			const existing = prev.find((item) => item.id === product.id);
			if (existing) {
				return prev.map((item) =>
					item.id === product.id
						? { ...item, quantity: item.quantity + 1 }
						: item,
				);
			}
			return [
				...prev,
				{
					id: product.id,
					name: product.name,
					price: product.price,
					in_stock: product.in_stock,
					track_stock: product.track_stock,
					product_type: product.product_type,
					wholesale_price: product.wholesale_price,
					wholesale_min_qty: product.wholesale_min_qty,
					category: product.category ?? "",
					image_url: product.image_url,
					product_id: product.id,
					quantity: 1,
				},
			];
		});
	};

	const canCreate = selectedCustomer && selectedProducts.length > 0;
	const handleCreateService = () => {
		if (!selectedCustomer) return;
		const localId = -Date.now();
		const payload: QueuedServiceOrder = {
			clientServiceOrderId: createClientServiceOrderId(),
			localId,
			customerId: selectedCustomer.id,
			serviceType: selectedServiceType,
			estimatedDoneAt: toDateOnly(estimatedDoneAt),
			customerNote,
			internalNote,
			details: { text: detailText },
			items: selectedProducts.map((item) => ({
				id: item.id,
				quantity: item.quantity,
				price: item.price,
				name: item.name,
				lineType: item.product_type === "service" ? "service" : "product",
			})),
			total,
		};
		const optimisticService = {
			id: localId,
			service_number: payload.clientServiceOrderId,
			customer_id: selectedCustomer.id,
			service_type: selectedServiceType,
			status: "in_progress",
			estimated_done_at: payload.estimatedDoneAt ?? null,
			customer_note: customerNote || null,
			internal_note: internalNote || null,
			details_json: { text: detailText },
			total_amount: total,
			paid_amount: 0,
			payment_status: "unpaid",
			user_uid: "local",
			created_at: new Date(),
			warranty_unit: "none",
			warranty_value: null,
			warranty_started_at: null,
			warranty_until: null,
			warranty_notes: null,
			completed_at: null,
			client_service_order_id: payload.clientServiceOrderId,
			customer: { name: selectedCustomer.name, phone: "" },
			items: payload.items.map((item, index) => ({
				id: index + 1,
				product_id: item.id,
				line_type: item.lineType,
				item_name: item.name ?? "",
				item_type: item.lineType,
				quantity: item.quantity,
				price: item.price,
				cost: 0,
				note: item.note ?? null,
			})),
		};
		void queueServiceOrder(payload).then(async () => {
			await upsertCachedServiceOrder(optimisticService);
			await clearDraft(SERVICE_DRAFT_KEY);
			setSelectedProducts([]);
			setSelectedCustomer(null);
			setCustomerNote("");
			setInternalNote("");
			setDetailText("");
			setEstimatedDoneAt(undefined);
			toast.success(t("serviceQueued"));
			router.push(`/admin/services/${localId}`);
			if (navigator.onLine) void syncQueuedServiceOrders();
		});
	};
	const cartPanel = (
		<POSCartPanel
			items={selectedProducts}
			products={products}
			note={customerNote}
			total={total}
			locale={locale}
			isPending={createMutation.isPending}
			canCreate={Boolean(canCreate)}
			onNoteChange={setCustomerNote}
			onQuantityChange={(productId, delta) =>
				setSelectedProducts((prev) =>
					prev.map((item) =>
						item.id === productId
							? { ...item, quantity: Math.max(1, item.quantity + delta) }
							: item,
					),
				)
			}
			onPriceChange={(productId, price) =>
				setSelectedProducts((prev) =>
					prev.map((item) =>
						item.id === productId ? { ...item, price } : item,
					),
				)
			}
			onRemoveProduct={(productId) =>
				setSelectedProducts((prev) =>
					prev.filter((item) => item.id !== productId),
				)
			}
			onCreateOrder={handleCreateService}
		/>
	);

	return (
		<div className="mx-auto w-full max-w-7xl pb-24 lg:pb-0">
			{!isOnline && (
				<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 text-sm">
					Offline mode. Service baru disimpan lokal dulu.
				</div>
			)}
			{queueCount > 0 && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
					<span>{queueCount} service menunggu sinkronisasi.</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void syncQueuedServiceOrders()}
					>
						{t("syncNow")}
					</Button>
				</div>
			)}
			<div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
				<div className="min-w-0 space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>{t("addService")}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex gap-2">
								<div className="min-w-0 flex-1">
									<Combobox
										items={customers.map((customer) => ({
											id: customer.id,
											name: customer.phone
												? `${customer.name} — ${customer.phone}`
												: customer.name,
										}))}
										placeholder={tPos("selectCustomer")}
										value={selectedCustomer?.name ?? ""}
										onSelect={(customerId) => {
											const customer = customers.find(
												(item) => item.id === customerId,
											);
											if (customer) setSelectedCustomer(customer);
										}}
									/>
								</div>
								<Button type="button" variant="outline" size="icon" disabled>
									<PlusCircle className="h-4 w-4" />
								</Button>
							</div>
							<ServiceOrderFields
								serviceTypes={serviceTypeOptions}
								serviceType={selectedServiceType}
								estimatedDoneAt={estimatedDoneAt}
								detailText={detailText}
								customerNote={customerNote}
								internalNote={internalNote}
								locale={locale}
								labels={{
									serviceType: t("serviceType"),
									estimatedDoneAt: t("estimatedDoneAt"),
									selectDate: t("selectDate"),
									serviceTypeOther: t("serviceTypeOther"),
									serviceDetails: t("serviceDetails"),
									serviceDetailsPlaceholder: t("serviceDetailsPlaceholder"),
									customerNote: t("customerNote"),
									internalNote: t("internalNote"),
								}}
								onServiceTypeChange={setServiceType}
								onEstimatedDoneAtChange={setEstimatedDoneAt}
								onDetailTextChange={setDetailText}
								onCustomerNoteChange={setCustomerNote}
								onInternalNoteChange={setInternalNote}
							/>
						</CardContent>
					</Card>

					<POSProductCatalog
						products={filteredProducts}
						selectedProducts={selectedProducts}
						selectedCategory={selectedCategory}
						productCategories={productCategories}
						productSearch={productSearch}
						viewMode={viewMode}
						locale={locale}
						onSearchChange={setProductSearch}
						onCategoryChange={setSelectedCategory}
						onViewModeChange={setViewMode}
						onSelectProduct={handleSelectProduct}
					/>
				</div>
				<div className="hidden lg:block">{cartPanel}</div>
			</div>

			<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 lg:hidden">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
					<div>
						<div className="text-muted-foreground text-xs">
							{selectedProducts.length} {tPos("products")}
						</div>
						<div className="font-bold text-lg">
							{formatCurrency(total, locale)}
						</div>
					</div>
					<Button type="button" onClick={() => setIsCartOpen(true)}>
						{tPos("cartAndPay")}
					</Button>
				</div>
			</div>

			<Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("addService")}</DialogTitle>
					</DialogHeader>
					{cartPanel}
				</DialogContent>
			</Dialog>
		</div>
	);
}
