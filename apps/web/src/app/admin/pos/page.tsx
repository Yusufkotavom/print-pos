"use client";

import { Badge } from "@finopenpos/ui/components/badge";
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { Textarea } from "@finopenpos/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	FileTextIcon,
	LayoutGridIcon,
	ListIcon,
	Loader2Icon,
	MinusIcon,
	PackageIcon,
	PlusCircle,
	PlusIcon,
	PrinterIcon,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { PaymentDialog } from "@/components/payment-dialog";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];
type POSProduct = Pick<
	Product,
	| "id"
	| "name"
	| "price"
	| "in_stock"
	| "product_type"
	| "wholesale_price"
	| "wholesale_min_qty"
> & {
	category: string;
	quantity: number;
};

type SuccessOrder = {
	id: number;
	order_number: string | null;
	created_at: Date | null;
	total_amount: number;
	paid_amount: number;
	payment_status: string;
	customer: { id: number; name: string; phone?: string } | null;
	items: POSProduct[];
	note?: string | null;
	paymentMethodName?: string;
};

export default function POSPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: products = [], isLoading: loadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);
	const { data: customers = [], isLoading: loadingCustomers } = useQuery(
		trpc.customers.list.queryOptions(),
	);
	const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const t = useTranslations("pos");
	const tc = useTranslations("common");
	const tOrders = useTranslations("orders");
	const tCustomers = useTranslations("customers");
	const locale = useLocale();

	const customerFormSchema = z.object({
		name: z.string().min(1, tCustomers("nameRequired")),
		email: z.union([
			z.string().email(tCustomers("invalidEmail")),
			z.literal(""),
		]),
		phone: z.string().min(1, tCustomers("phoneRequired")),
		address: z.string(),
	});

	const loading = loadingProducts || loadingCustomers || loadingMethods;

	const [successOrder, setSuccessOrder] = useState<SuccessOrder | null>(null);
	const [paymentOrder, setPaymentOrder] = useState<SuccessOrder | null>(null);

	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);

	const createOrderMutation = useMutation(
		trpc.orders.create.mutationOptions({
			onSuccess: (order) => {
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				const createdOrder = {
					id: order.id,
					order_number: order.order_number,
					created_at: order.created_at,
					total_amount: order.total_amount,
					paid_amount: order.paid_amount,
					payment_status: order.payment_status,
					customer: selectedCustomer
						? { ...selectedCustomer, phone: selectedCustomerPhone }
						: null,
					items: [...selectedProducts],
					note: orderNote,
				};
				toast.success(tOrders("createdSuccessfully"));
				setPaymentOrder(createdOrder);
				setIsCartOpen(false);
				setSelectedProducts([]);
				setSelectedCustomer(null);
				setOrderNote("");
			},
			onError: (err) => toast.error(err.message || tOrders("createError")),
		}),
	);

	const receivePaymentMutation = useMutation(
		trpc.orders.receivePayment.mutationOptions({
			onSuccess: (order, variables) => {
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				const selectedMethod = paymentMethods.find(
					(method) => method.id === variables.paymentMethodId,
				);
				setSuccessOrder(
					paymentOrder
						? {
								...paymentOrder,
								paid_amount: order.paid_amount,
								payment_status: order.payment_status,
								paymentMethodName: selectedMethod?.name,
							}
						: null,
				);
				setPaymentOrder(null);
			},
			onError: (err) => toast.error(err.message || tOrders("paymentError")),
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
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [orderNote, setOrderNote] = useState("");
	const [isCartOpen, setIsCartOpen] = useState(false);
	const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
	const selectedCustomerPhone = selectedCustomer
		? customers.find((customer) => customer.id === selectedCustomer.id)?.phone
		: undefined;
	const selectedCustomerLabel = selectedCustomer
		? selectedCustomerPhone
			? `${selectedCustomer.name} — ${selectedCustomerPhone}`
			: selectedCustomer.name
		: "";

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
		const q = productSearch.toLowerCase().trim();
		return products.filter((product) => {
			const matchesCategory =
				selectedCategory === "all" || product.category === selectedCategory;
			const matchesSearch =
				!q ||
				product.name.toLowerCase().includes(q) ||
				(product.category ?? "").toLowerCase().includes(q);
			return matchesCategory && matchesSearch;
		});
	}, [products, productSearch, selectedCategory]);

	const handleSelectProduct = (productId: number | string) => {
		const product = products.find((p) => p.id === productId);
		if (!product) return;
		if (product.product_type === "product" && product.in_stock <= 0) {
			toast.error(t("outOfStock", { name: product.name }));
			return;
		}
		const existing = selectedProducts.find((p) => p.id === productId);
		if (
			product.product_type === "product" &&
			existing &&
			existing.quantity >= product.in_stock
		) {
			toast.error(
				t("limitedStock", { count: product.in_stock, name: product.name }),
			);
			return;
		}
		if (existing) {
			setSelectedProducts(
				selectedProducts.map((p) =>
					p.id === productId ? { ...p, quantity: p.quantity + 1 } : p,
				),
			);
		} else {
			setSelectedProducts([
				...selectedProducts,
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
					product_type: product.product_type,
					wholesale_price: product.wholesale_price,
					wholesale_min_qty: product.wholesale_min_qty,
					category: product.category ?? "",
					quantity: 1,
				},
			]);
		}
	};

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
					newQty > product.in_stock
				) {
					toast.error(t("limitedUnits", { count: product.in_stock }));
					return p;
				}
				// Auto-apply wholesale price based on qty
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
		createOrderMutation.mutate({
			customerId: selectedCustomer.id,
			products: selectedProducts.map((p) => ({
				id: p.id,
				quantity: p.quantity,
				price: p.price,
			})),
			note: orderNote,
			paidAmount: 0,
			total,
		});
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
		<Card className="h-fit lg:sticky lg:top-4">
			<CardHeader>
				<CardTitle>{t("createOrder")}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{selectedProducts.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
						{t("selectProducts")}
					</div>
				) : (
					<div className="space-y-3">
						{selectedProducts.map((product) => {
							const source = products.find((p) => p.id === product.id);
							return (
								<div key={product.id} className="rounded-lg border p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="truncate font-medium text-sm">
												{product.name}
											</div>
											<div className="text-muted-foreground text-xs">
												{formatCurrency(product.price, locale)}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
											onClick={() => handleRemoveProduct(product.id)}
										>
											<Trash2Icon className="h-4 w-4" />
											<span className="sr-only">{tc("remove")}</span>
										</Button>
									</div>
									<div className="mt-3 flex items-center justify-between gap-3">
										<div className="flex items-center gap-1">
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8"
												onClick={() => handleQuantityChange(product.id, -1)}
												disabled={product.quantity <= 1}
											>
												<MinusIcon className="h-3 w-3" />
											</Button>
											<span className="w-8 text-center font-medium tabular-nums">
												{product.quantity}
											</span>
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8"
												onClick={() => handleQuantityChange(product.id, 1)}
												disabled={
													source?.product_type === "product"
														? product.quantity >= source.in_stock
														: false
												}
											>
												<PlusIcon className="h-3 w-3" />
											</Button>
										</div>
										<div className="font-semibold text-sm">
											{formatCurrency(product.quantity * product.price, locale)}
										</div>
									</div>
									<div className="mt-3 flex items-center gap-2">
										<span className="text-muted-foreground text-xs">Rp</span>
										<FormattedNumberInput
											className="h-8"
											value={product.price / 100}
											onValueChange={(value) =>
												handlePriceChange(product.id, (value ?? 0) * 100)
											}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
				{selectedProducts.length > 0 && (
					<div className="space-y-2">
						<Label htmlFor="order-note">{tc("description")}</Label>
						<Textarea
							id="order-note"
							value={orderNote}
							onChange={(event) => setOrderNote(event.target.value)}
							rows={4}
						/>
					</div>
				)}
				<div className="border-t pt-4">
					<div className="mb-3 flex items-center justify-between">
						<span className="font-medium">{tc("total")}</span>
						<strong className="text-xl">{formatCurrency(total, locale)}</strong>
					</div>
					<Button
						onClick={handleCreateOrder}
						disabled={!canCreate || createOrderMutation.isPending}
						size="lg"
						className="w-full"
					>
						{createOrderMutation.isPending && (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						)}
						{t("createOrder")}
					</Button>
				</div>
			</CardContent>
		</Card>
	);

	return (
		<div className="mx-auto w-full max-w-7xl pb-24 lg:pb-0">
			<div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
				<div className="min-w-0 space-y-4">
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

					<Card>
						<CardHeader>
							<CardTitle>{t("products")}</CardTitle>
							<div className="!mt-4 space-y-3">
								<div className="flex min-w-0 gap-2">
									<div className="relative min-w-0 flex-1">
										<SearchIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
										<Input
											type="text"
											placeholder={t("searchPlaceholder")}
											value={productSearch}
											onChange={(e) => setProductSearch(e.target.value)}
											className="pl-8"
										/>
									</div>
									<div className="flex w-fit items-center gap-1 rounded-lg border p-1">
										<Button
											type="button"
											variant={viewMode === "grid" ? "default" : "ghost"}
											size="icon"
											className="h-8 w-8"
											onClick={() => setViewMode("grid")}
										>
											<LayoutGridIcon className="h-4 w-4" />
										</Button>
										<Button
											type="button"
											variant={viewMode === "list" ? "default" : "ghost"}
											size="icon"
											className="h-8 w-8"
											onClick={() => setViewMode("list")}
										>
											<ListIcon className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div className="max-w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
									<div className="inline-flex min-w-max gap-2">
										<Button
											type="button"
											variant={
												selectedCategory === "all" ? "default" : "outline"
											}
											size="sm"
											onClick={() => setSelectedCategory("all")}
											className="shrink-0"
										>
											{tc("all")}
										</Button>
										{productCategories.map((category) => (
											<Button
												key={category}
												type="button"
												variant={
													selectedCategory === category ? "default" : "outline"
												}
												size="sm"
												onClick={() => setSelectedCategory(category)}
												className="shrink-0"
											>
												{category}
											</Button>
										))}
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{filteredProducts.length === 0 ? (
								<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
									{t("selectProducts")}
								</div>
							) : (
								<div
									className={`grid gap-3 ${viewMode === "grid" ? "grid-cols-2" : "grid-cols-1"}`}
								>
									{filteredProducts.map((product) => {
										const selectedProduct = selectedProducts.find(
											(p) => p.id === product.id,
										);
										return (
											<button
												key={product.id}
												type="button"
												onClick={() => handleSelectProduct(product.id)}
												className={`rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 ${viewMode === "grid" ? "min-h-36" : ""}`}
											>
												<div
													className={`gap-3 ${viewMode === "grid" ? "flex flex-col" : "flex items-center"}`}
												>
													<div
														className={`flex shrink-0 items-center justify-center rounded-lg bg-muted ${viewMode === "grid" ? "h-20 w-full" : "h-12 w-12"}`}
													>
														<PackageIcon className="h-5 w-5 text-muted-foreground md:h-6 md:w-6" />
													</div>
													<div className="min-w-0 flex-1">
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<div className="break-words font-semibold text-sm leading-tight md:text-base">
																	{product.name}
																</div>
																<div className="text-muted-foreground text-xs">
																	{product.category ?? "—"}
																</div>
															</div>
															{selectedProduct && (
																<Badge>{selectedProduct.quantity}</Badge>
															)}
														</div>
														<div className="mt-2 font-bold text-base md:text-lg">
															{formatCurrency(product.price, locale)}
														</div>
														<div className="mt-1 text-muted-foreground text-xs">
															{product.product_type === "service"
																? t("service")
																: t("stockCount", { count: product.in_stock })}
														</div>
													</div>
												</div>
											</button>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>
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
					<Button type="button" onClick={() => setIsCartOpen(true)}>
						Keranjang / Bayar
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
			<Dialog
				open={isCustomerDialogOpen}
				onOpenChange={setIsCustomerDialogOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{tCustomers("addCustomer")}</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							customerForm.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<customerForm.Field name="name">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="customer-name">{tc("name")}</Label>
										<div className="col-span-3">
											<Input
												id="customer-name"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												error={
													field.state.meta.errors.length > 0
														? field.state.meta.errors
																.map((e) => e?.message ?? e)
																.join(", ")
														: undefined
												}
											/>
										</div>
									</div>
								)}
							</customerForm.Field>
							<customerForm.Field name="email">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="customer-email">{tc("email")}</Label>
										<div className="col-span-3">
											<Input
												id="customer-email"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												error={
													field.state.meta.errors.length > 0
														? field.state.meta.errors
																.map((e) => e?.message ?? e)
																.join(", ")
														: undefined
												}
											/>
										</div>
									</div>
								)}
							</customerForm.Field>
							<customerForm.Field name="phone">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="customer-phone">{tc("phone")}</Label>
										<div className="col-span-3">
											<Input
												id="customer-phone"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												error={
													field.state.meta.errors.length > 0
														? field.state.meta.errors
																.map((e) => e?.message ?? e)
																.join(", ")
														: undefined
												}
											/>
										</div>
									</div>
								)}
							</customerForm.Field>
							<customerForm.Field name="address">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="customer-address">{tc("address")}</Label>
										<Input
											id="customer-address"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											className="col-span-3"
										/>
									</div>
								)}
							</customerForm.Field>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="secondary"
								onClick={() => setIsCustomerDialogOpen(false)}
							>
								{tc("cancel")}
							</Button>
							<Button type="submit" disabled={createCustomerMutation.isPending}>
								{createCustomerMutation.isPending && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{tc("save")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<PaymentDialog
				open={!!paymentOrder}
				onOpenChange={(open) => {
					if (!open) setPaymentOrder(null);
				}}
				title={tOrders("receivePayment")}
				totalLabel={tc("total")}
				amountLabel={tOrders("paymentAmount")}
				paymentMethodLabel={tOrders("paymentMethod")}
				submitLabel={tOrders("savePayment")}
				cancelLabel={tc("cancel")}
				totalAmount={paymentOrder?.total_amount ?? 0}
				maxAmount={
					paymentOrder
						? paymentOrder.total_amount - paymentOrder.paid_amount
						: 0
				}
				locale={locale}
				paymentMethods={paymentMethods}
				isPending={receivePaymentMutation.isPending}
				onSubmit={({ paymentMethodId, amount }) => {
					if (!paymentOrder) return;
					receivePaymentMutation.mutate({
						id: paymentOrder.id,
						paymentMethodId,
						amount,
					});
				}}
			/>

			{/* Dialog Sukses Transaksi / Cetak Struk */}
			{successOrder && (
				<Dialog
					open={!!successOrder}
					onOpenChange={(open) => {
						if (!open) setSuccessOrder(null);
					}}
				>
					<DialogContent className="max-w-md print:hidden">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-green-600">
								<CheckCircle2Icon className="h-5 w-5" />
								{tOrders("createdSuccessfully")}
							</DialogTitle>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<p className="text-center text-muted-foreground text-sm">
								Transaksi{" "}
								<strong>
									{successOrder.order_number ?? `#${successOrder.id}`}
								</strong>{" "}
								berhasil disimpan.
							</p>

							{/* Preview struk di layar */}
							<div className="max-h-56 overflow-y-auto rounded border bg-muted/20 p-4 font-mono text-xs">
								<div className="mb-2 text-center font-bold">
									PRATINJAU STRUK
								</div>
								<div className="flex justify-between">
									<span>No. Transaksi:</span>
									<span>
										{successOrder.order_number ?? `#${successOrder.id}`}
									</span>
								</div>
								<div className="flex justify-between">
									<span>Tanggal:</span>
									<span>
										{successOrder.created_at
											? new Date(successOrder.created_at).toLocaleString(
													"id-ID",
												)
											: new Date().toLocaleString("id-ID")}
									</span>
								</div>
								<div className="flex justify-between">
									<span>Metode:</span>
									<span>{successOrder.paymentMethodName}</span>
								</div>
								<hr className="my-2 border-dashed" />
								<div className="space-y-1">
									{successOrder.items.map((item) => (
										<div key={item.id} className="flex justify-between">
											<span>
												{item.name} x{item.quantity}
											</span>
											<span>
												Rp{" "}
												{((item.price * item.quantity) / 100).toLocaleString(
													"id-ID",
												)}
											</span>
										</div>
									))}
								</div>
								{successOrder.note && (
									<>
										<hr className="my-2 border-dashed" />
										<div className="space-y-1 text-[10px] text-muted-foreground">
											<div className="font-semibold text-foreground">
												Catatan
											</div>
											<div>{successOrder.note}</div>
										</div>
									</>
								)}
								<hr className="my-2 border-dashed" />
								<div className="flex justify-between font-bold">
									<span>Total:</span>
									<span>
										Rp{" "}
										{(successOrder.total_amount / 100).toLocaleString("id-ID")}
									</span>
								</div>
								<div className="flex justify-between text-muted-foreground">
									<span>Dibayar:</span>
									<span>
										Rp{" "}
										{(successOrder.paid_amount / 100).toLocaleString("id-ID")}
									</span>
								</div>
							</div>
						</div>
						<DialogFooter className="mt-4 flex flex-col flex-wrap gap-2 sm:flex-row sm:justify-center">
							<Button
								variant="outline"
								className="w-full sm:w-auto"
								onClick={() => {
									window.print();
								}}
							>
								<PrinterIcon className="mr-2 h-4 w-4" />
								Cetak Struk
							</Button>

							<Button
								variant="outline"
								className="w-full sm:w-auto"
								onClick={() => {
									window.open(`/api/orders/${successOrder.id}/pdf`, "_blank");
								}}
							>
								<FileTextIcon className="mr-2 h-4 w-4" />
								Print Invoice
							</Button>

							<Button
								variant="outline"
								className="w-full border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 sm:w-auto"
								onClick={() => {
									const customerPhone = successOrder.customer?.phone;
									if (customerPhone) {
										const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
										const waPhone = cleanPhone.startsWith("0")
											? `62${cleanPhone.substring(1)}`
											: cleanPhone;

										const template =
											companySettings?.whatsapp_template ||
											"Halo! Pesanan Anda {order_number} telah berhasil diproses. Anda bisa mengecek invoice melalui tautan berikut: {invoice_url} \nTerima kasih!";
										const orderNum =
											successOrder.order_number ?? `#${successOrder.id}`;
										const invoiceUrl = `${window.location.origin}/api/orders/${successOrder.id}/pdf`;

										const whatsappText = template
											.replace(/{order_number}/g, orderNum)
											.replace(/{invoice_url}/g, invoiceUrl);

										window.open(
											`https://wa.me/${waPhone}?text=${encodeURIComponent(whatsappText)}`,
											"_blank",
										);
									} else {
										toast.error(
											"Nomor WhatsApp pelanggan tidak tersedia untuk transaksi ini.",
										);
									}
								}}
							>
								<svg
									className="mr-2 h-4 w-4"
									fill="currentColor"
									viewBox="0 0 24 24"
									aria-label="WhatsApp"
								>
									<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
								</svg>
								WhatsApp
							</Button>

							<Link
								href={`/admin/orders/${successOrder.id}`}
								className="w-full sm:w-auto"
							>
								<Button variant="secondary" className="w-full">
									Detail Invoice
								</Button>
							</Link>
							<Button
								className="w-full sm:w-auto"
								onClick={() => setSuccessOrder(null)}
							>
								Transaksi Baru
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}

			{/* Thermal Receipt Section for printing */}
			{successOrder && (
				<div
					id="thermal-receipt"
					className="hidden font-mono text-[10px] leading-tight print:absolute print:top-0 print:left-0 print:block print:w-[80mm] print:bg-white print:p-4 print:text-black"
				>
					<style
						dangerouslySetInnerHTML={{
							__html: `
						@media print {
							body * {
								visibility: hidden;
							}
							#thermal-receipt, #thermal-receipt * {
								visibility: visible;
							}
							#thermal-receipt {
								position: absolute;
								left: 0;
								top: 0;
								width: 80mm;
								background: white;
								color: black;
								padding: 10px;
							}
							@page {
								margin: 0;
							}
						}
					`,
						}}
					/>
					<div className="mb-2 border-b pb-2 text-center">
						<h2 className="font-bold text-sm uppercase">
							{companySettings?.company_name || "FinOpenPOS"}
						</h2>
						{companySettings?.trade_name && (
							<p className="text-[9px]">{companySettings.trade_name}</p>
						)}
						<p>
							{companySettings?.street} No. {companySettings?.street_number}
						</p>
						<p>
							{companySettings?.district}, {companySettings?.city_name}
						</p>
						{companySettings?.tax_id && <p>NPWP: {companySettings.tax_id}</p>}
						{companySettings?.receipt_header && (
							<p className="mt-1 border-t border-dashed pt-1 text-[9px] italic">
								{companySettings.receipt_header}
							</p>
						)}
					</div>
					<div className="mb-2 space-y-1">
						<p>No: {successOrder.order_number ?? `#${successOrder.id}`}</p>
						<p>
							Tgl:{" "}
							{successOrder.created_at
								? new Date(successOrder.created_at).toLocaleString("id-ID")
								: new Date().toLocaleString("id-ID")}
						</p>
						<p>Pelanggan: {successOrder.customer?.name || "Pelanggan Umum"}</p>
					</div>
					<div className="my-2 space-y-1 border-t border-b border-dashed py-2">
						{successOrder.items.map((item) => (
							<div key={item.id} className="flex justify-between">
								<div className="max-w-[70%]">
									<p>{item.name}</p>
									<p className="text-gray-500">
										{item.quantity} x Rp{" "}
										{(item.price / 100).toLocaleString("id-ID")}
									</p>
								</div>
								<p>
									Rp{" "}
									{((item.price * item.quantity) / 100).toLocaleString("id-ID")}
								</p>
							</div>
						))}
					</div>
					{successOrder.note && (
						<div className="mb-2 border-b border-dashed pb-2 text-[9px]">
							<p className="font-bold">Catatan:</p>
							<p>{successOrder.note}</p>
						</div>
					)}
					<div className="space-y-1 text-right">
						<div className="flex justify-between font-bold">
							<p>TOTAL:</p>
							<p>
								Rp {(successOrder.total_amount / 100).toLocaleString("id-ID")}
							</p>
						</div>
						<div className="flex justify-between">
							<p>Bayar ({successOrder.paymentMethodName || "Tunai"}):</p>
							<p>
								Rp {(successOrder.paid_amount / 100).toLocaleString("id-ID")}
							</p>
						</div>
						<div className="flex justify-between border-t border-dashed pt-1">
							<p>Sisa Tagihan:</p>
							<p>
								Rp{" "}
								{Math.max(
									0,
									(successOrder.total_amount - successOrder.paid_amount) / 100,
								).toLocaleString("id-ID")}
							</p>
						</div>
					</div>
					<div className="mt-4 border-t border-dashed pt-2 text-center">
						{companySettings?.receipt_footer ? (
							<p>{companySettings.receipt_footer}</p>
						) : (
							<>
								<p>Terima Kasih</p>
								<p>Atas Kunjungan Anda</p>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
