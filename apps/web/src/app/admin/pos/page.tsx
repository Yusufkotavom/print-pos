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
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { POSCartPanel } from "@/components/pos-cart-panel";
import { POSCustomerDialog } from "@/components/pos-customer-dialog";
import { POSPaymentFlow } from "@/components/pos-payment-flow";
import { POSProductCatalog } from "@/components/pos-product-catalog";
import { POSSuccessDialog } from "@/components/pos-success-dialog";
import { POSSyncBanner } from "@/components/pos-sync-banner";
import type {
	PendingPOSOrder,
	POSDraft,
	POSProductItem,
	QueuedPOSOrder,
	SuccessPOSOrder,
} from "@/components/pos-types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { usePOSLocalFirst } from "@/hooks/use-pos-local-first";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

type POSProduct = POSProductItem;
type SuccessOrder = SuccessPOSOrder;

function createClientOrderId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export default function POSPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: remoteProducts = [], isLoading: loadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);
	const { data: remoteCustomers = [], isLoading: loadingCustomers } = useQuery(
		trpc.customers.list.queryOptions(),
	);
	const { data: remotePaymentMethods = [], isLoading: loadingMethods } =
		useQuery(trpc.paymentMethods.list.queryOptions());
	const t = useTranslations("pos");
	const tc = useTranslations("common");
	const tOrders = useTranslations("orders");
	const tCustomers = useTranslations("customers");
	const locale = useLocale();
	const isOnline = useOnlineStatus();

	const customerFormSchema = z.object({
		name: z.string().min(1, tCustomers("nameRequired")),
		email: z.union([
			z.string().email(tCustomers("invalidEmail")),
			z.literal(""),
		]),
		phone: z.string().min(1, tCustomers("phoneRequired")),
		address: z.string(),
	});

	const [successOrder, setSuccessOrder] = useState<SuccessOrder | null>(null);
	const [pendingPaymentOrder, setPendingPaymentOrder] =
		useState<PendingPOSOrder | null>(null);
	const saleDetailsRef = useRef<HTMLDivElement | null>(null);

	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);

	const createOrderMutation = useMutation(
		trpc.orders.create.mutationOptions({
			onSuccess: async (order, variables) => {
				if (variables.clientOrderId) {
					await markOrderSynced(variables.clientOrderId, order.id);
				}
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				const selectedMethod = paymentMethods.find(
					(method) => method.id === variables.paymentMethodId,
				);
				const draft =
					pendingPaymentOrder?.clientOrderId === variables.clientOrderId
						? pendingPaymentOrder
						: null;
				if (draft) {
					setSuccessOrder({
						id: order.id,
						order_number: order.order_number,
						created_at: order.created_at,
						total_amount: order.total_amount,
						paid_amount: order.paid_amount,
						payment_status: order.payment_status,
						customer: draft.customer,
						items: draft.items,
						note: draft.note,
						paymentMethodName: selectedMethod?.name,
					});
					toast.success(tOrders("createdSuccessfully"));
					setPendingPaymentOrder(null);
					setIsCartOpen(false);
					setSelectedProducts([]);
					setSelectedCustomer(null);
					setOrderNote("");
					await clearPOSDraft();
				}
			},
			onError: async (err, variables) => {
				if (variables.clientOrderId) {
					await markOrderFailed(variables.clientOrderId, err.message);
				}
				toast.error(err.message || tOrders("createError"));
			},
		}),
	);

	const createCustomerMutation = useMutation(
		trpc.customers.create.mutationOptions({
			onSuccess: (customer) => {
				queryClient.invalidateQueries(trpc.customers.list.queryOptions());
				setSelectedCustomer(customer);
				setIsCustomerDialogOpen(false);
				customerForm.reset();
				toast.success(tCustomers("created"));
			},
			onError: (err) => toast.error(err.message || tCustomers("createError")),
		}),
	);

	const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);

	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [productSearch, setProductSearch] = useState("");
	const debouncedProductSearch = useDebouncedValue(productSearch, 250);
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [orderNote, setOrderNote] = useState("");
	const [isCartOpen, setIsCartOpen] = useState(false);
	const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
	const {
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
	} = usePOSLocalFirst({
		remoteProducts,
		remoteCustomers,
		remotePaymentMethods,
		createOrder: async (payload: {
			clientOrderId?: string;
			customerId: number;
			products: { id: number; quantity: number; price: number }[];
			note: string;
			paymentMethodId: number;
			paidAmount: number;
			total: number;
		}) => {
			await createOrderMutation.mutateAsync(payload);
		},
	});
	const loading =
		(loadingProducts && products.length === 0) ||
		(loadingCustomers && customers.length === 0) ||
		(loadingMethods && paymentMethods.length === 0);
	const selectedCustomerPhone = selectedCustomer
		? customers.find((customer) => customer.id === selectedCustomer.id)?.phone
		: undefined;
	const selectedCustomerLabel = selectedCustomer
		? selectedCustomerPhone
			? `${selectedCustomer.name} — ${selectedCustomerPhone}`
			: selectedCustomer.name
		: "";

	useEffect(() => {
		void (async () => {
			const saved = await loadDraft();
			if (saved) {
				setSelectedProducts(saved.items ?? []);
				setSelectedCustomer(saved.customer ?? null);
				setOrderNote(saved.note ?? "");
			}
		})();
	}, [loadDraft]);

	useEffect(() => {
		const draft: POSDraft = {
			items: selectedProducts,
			customer: selectedCustomer,
			note: orderNote,
		};
		void savePOSDraft(draft);
	}, [selectedProducts, selectedCustomer, orderNote, savePOSDraft]);

	useEffect(() => {
		void syncQueuedOrders();
		const handleOnline = () => void syncQueuedOrders();
		window.addEventListener("online", handleOnline);
		return () => window.removeEventListener("online", handleOnline);
	}, [syncQueuedOrders]);

	const customerForm = useForm({
		defaultValues: {
			name: "",
			email: "",
			phone: "",
			address: "",
		},
		validators: {
			onSubmit: customerFormSchema,
		},
		onSubmit: ({ value }) => {
			createCustomerMutation.mutate({
				name: value.name,
				email: value.email || undefined,
				phone: value.phone,
				address: value.address || undefined,
				status: "active",
			});
		},
	});

	const productCategories = useMemo(() => {
		const names = products
			.map((product) => product.category)
			.filter((category): category is string => Boolean(category));
		return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
	}, [products]);

	const filteredProducts = useMemo(() => {
		const q = debouncedProductSearch.toLowerCase().trim();
		return products.filter((product) => {
			const matchesCategory =
				selectedCategory === "all" || product.category === selectedCategory;
			const matchesSearch =
				!q ||
				product.name.toLowerCase().includes(q) ||
				(product.category ?? "").toLowerCase().includes(q);
			return matchesCategory && matchesSearch;
		});
	}, [products, debouncedProductSearch, selectedCategory]);

	const handleSelectProduct = useCallback(
		(productId: number | string) => {
			const product = products.find((p) => p.id === productId);
			if (!product) return;
			if (
				product.product_type === "product" &&
				product.track_stock &&
				product.in_stock <= 0
			) {
				toast.error(t("outOfStock", { name: product.name }));
				return;
			}

			setSelectedProducts((prev) => {
				const existing = prev.find((p) => p.id === productId);
				if (
					product.product_type === "product" &&
					product.track_stock &&
					existing &&
					existing.quantity >= product.in_stock
				) {
					toast.error(
						t("limitedStock", { count: product.in_stock, name: product.name }),
					);
					return prev;
				}
				if (existing) {
					return prev.map((p) =>
						p.id === productId ? { ...p, quantity: p.quantity + 1 } : p,
					);
				}
				return [
					...prev,
					{
						id: product.id,
						name: product.name,
						price:
							product.wholesale_price != null &&
							product.wholesale_min_qty != null &&
							1 >= product.wholesale_min_qty
								? product.wholesale_price
								: product.price,
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
		},
		[products, t],
	);

	const handleSelectCustomer = (customerId: number | string) => {
		const customer = customers.find((c) => c.id === customerId);
		if (customer) setSelectedCustomer(customer);
	};

	const handleQuantityChange = (productId: number, delta: number) => {
		const product = products.find((p) => p.id === productId);
		setSelectedProducts((prev) =>
			prev.map((p) => {
				if (p.id !== productId) return p;
				const newQty = p.quantity + delta;
				if (newQty <= 0) return p;
				if (
					product &&
					product.product_type === "product" &&
					product.track_stock &&
					newQty > product.in_stock
				) {
					toast.error(t("limitedUnits", { count: product.in_stock }));
					return p;
				}
				let newPrice = p.price;
				const source = products.find((pr) => pr.id === p.id);
				if (
					source?.wholesale_price != null &&
					source.wholesale_min_qty != null
				) {
					newPrice =
						newQty >= source.wholesale_min_qty
							? source.wholesale_price
							: source.price;
				}
				return { ...p, quantity: newQty, price: newPrice };
			}),
		);
	};

	const handlePriceChange = (productId: number, newPrice: number) => {
		setSelectedProducts((prev) =>
			prev.map((p) => {
				if (p.id !== productId) return p;
				return { ...p, price: newPrice };
			}),
		);
	};

	const handleRemoveProduct = (productId: number) => {
		setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
	};

	const total = selectedProducts.reduce(
		(sum, product) => sum + product.price * product.quantity,
		0,
	);
	const canCreate = selectedProducts.length > 0 && selectedCustomer;

	const handleCreateOrder = () => {
		if (!selectedCustomer || !canCreate) return;
		setPendingPaymentOrder({
			clientOrderId: createClientOrderId(),
			customer: { ...selectedCustomer, phone: selectedCustomerPhone },
			items: [...selectedProducts],
			note: orderNote,
			total,
		});
		setIsCartOpen(false);
	};

	const handleOpenCart = () => {
		if (!selectedCustomer) {
			saleDetailsRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
			toast.error(t("selectCustomerFirst"));
			return;
		}
		setIsCartOpen(true);
	};

	if (loading) {
		return (
			<div className="container mx-auto space-y-4 p-4">
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32" />
					</CardHeader>
					<CardContent className="flex gap-4">
						<Skeleton className="h-10 flex-1" />
						<Skeleton className="h-10 flex-1" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-24" />
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-10 w-full" />
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="flex items-center gap-4">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-8 w-24" />
								<Skeleton className="h-4 w-20" />
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	const cartPanel = (
		<POSCartPanel
			items={selectedProducts}
			products={products}
			note={orderNote}
			total={total}
			locale={locale}
			isPending={createOrderMutation.isPending}
			canCreate={Boolean(canCreate)}
			onNoteChange={setOrderNote}
			onQuantityChange={handleQuantityChange}
			onPriceChange={handlePriceChange}
			onRemoveProduct={handleRemoveProduct}
			onCreateOrder={handleCreateOrder}
		/>
	);

	return (
		<div className="mx-auto w-full max-w-7xl pb-24 lg:pb-0">
			<POSSyncBanner
				isOnline={isOnline}
				queueCount={queueCount}
				onSync={() => void syncQueuedOrders()}
				queuedLabel={t("queuedOrdersNotice", { count: queueCount })}
			/>
			<div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
				<div className="min-w-0 space-y-4">
					<div ref={saleDetailsRef}>
						<Card>
							<CardHeader>
								<CardTitle>{t("saleDetails")}</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-3 sm:flex-row sm:gap-4">
								<div className="flex flex-1 gap-2">
									<div className="min-w-0 flex-1">
										<Combobox
											items={customers.map((customer) => ({
												id: customer.id,
												name: customer.phone
													? `${customer.name} — ${customer.phone}`
													: customer.name,
											}))}
											placeholder={t("selectCustomer")}
											value={selectedCustomerLabel}
											onSelect={handleSelectCustomer}
										/>
									</div>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => setIsCustomerDialogOpen(true)}
									>
										<PlusCircle className="h-4 w-4" />
										<span className="sr-only">{tCustomers("addCustomer")}</span>
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>

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
							{selectedProducts.length} {t("products")}
						</div>
						<div className="font-bold text-lg">
							{formatCurrency(total, locale)}
						</div>
					</div>
					<Button type="button" onClick={handleOpenCart}>
						{t("cartAndPay")}
					</Button>
				</div>
			</div>

			<Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("createOrder")}</DialogTitle>
					</DialogHeader>
					{cartPanel}
				</DialogContent>
			</Dialog>
			<POSCustomerDialog
				open={isCustomerDialogOpen}
				onOpenChange={setIsCustomerDialogOpen}
				form={customerForm}
				isPending={createCustomerMutation.isPending}
				labels={{
					title: tCustomers("addCustomer"),
					name: tc("name"),
					email: tc("email"),
					phone: tc("phone"),
					address: tc("address"),
					cancel: tc("cancel"),
					save: tc("save"),
				}}
			/>

			<POSPaymentFlow
				pendingOrder={pendingPaymentOrder}
				paymentMethods={paymentMethods}
				locale={locale}
				isPending={createOrderMutation.isPending}
				title={tOrders("receivePayment")}
				totalLabel={tc("total")}
				amountLabel={tOrders("paymentAmount")}
				paymentMethodLabel={tOrders("paymentMethod")}
				submitLabel={tOrders("savePayment")}
				cancelLabel={tc("cancel")}
				queuedMessage={t("orderQueued")}
				onOpenChange={(open) => {
					if (!open) setPendingPaymentOrder(null);
				}}
				onQueueOrder={queueOrder}
				onClearDraft={() => {
					setSelectedProducts([]);
					setSelectedCustomer(null);
					setOrderNote("");
					void clearPOSDraft();
				}}
				onSubmitOrder={(payload) => {
					const draft = pendingPaymentOrder;
					createOrderMutation.mutate(payload, {
						onError: async () => {
							if (!draft) return;
							const queuedOrder: QueuedPOSOrder = {
								...draft,
								paymentMethodId: payload.paymentMethodId,
								paidAmount: payload.paidAmount,
								createdAt: new Date().toISOString(),
								status: "pending",
							};
							await queueOrder(queuedOrder);
							setPendingPaymentOrder(null);
							setSelectedProducts([]);
							setSelectedCustomer(null);
							setOrderNote("");
							await clearPOSDraft();
							toast.success(t("orderQueued"));
						},
					});
				}}
			/>

			<POSSuccessDialog
				order={successOrder}
				companySettings={companySettings}
				onOpenChange={(open) => {
					if (!open) setSuccessOrder(null);
				}}
				title={tOrders("createdSuccessfully")}
			/>
		</div>
	);
}
