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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Loader2Icon,
	MinusIcon,
	PlusCircle,
	PlusIcon,
	SearchIcon,
	Trash2Icon,
	CheckCircle2Icon,
	PrinterIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

type Product = RouterOutputs["products"]["list"][number];
type POSProduct = Pick<
	Product,
	"id" | "name" | "price" | "in_stock" | "product_type"
> & {
	category: string;
	quantity: number;
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

	const [successOrder, setSuccessOrder] = useState<any | null>(null);

	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);

	const createOrderMutation = useMutation(
		trpc.orders.create.mutationOptions({
			onSuccess: (order) => {
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				toast.success(tOrders("createdSuccessfully"));
				setSuccessOrder({
					id: order.id,
					order_number: order.order_number,
					created_at: order.created_at,
					total_amount: order.total_amount,
					paid_amount: order.paid_amount,
					payment_status: order.payment_status,
					customer: selectedCustomer,
					items: [...selectedProducts],
					paymentMethodName: paymentMethod?.name,
				});
				setSelectedProducts([]);
				setSelectedCustomer(null);
				setPaymentMethod(null);
				setPaidAmount("");
			},
			onError: (err) => toast.error(err.message || tOrders("createError")),
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
	const [paymentMethod, setPaymentMethod] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [paidAmount, setPaidAmount] = useState("");
	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [productSearch, setProductSearch] = useState("");
	const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
	const selectedCustomerPhone = selectedCustomer
		? customers.find((customer) => customer.id === selectedCustomer.id)?.phone
		: undefined;
	const selectedCustomerLabel = selectedCustomer
		? selectedCustomerPhone
			? `${selectedCustomer.name} — ${selectedCustomerPhone}`
			: selectedCustomer.name
		: "";
	const selectedPaymentMethodLabel = paymentMethod?.name ?? "";

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

	const filteredProducts = useMemo(() => {
		if (!productSearch.trim()) return products;
		const q = productSearch.toLowerCase();
		return products.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.category ?? "").toLowerCase().includes(q),
		);
	}, [products, productSearch]);

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
					price: product.price,
					in_stock: product.in_stock,
					product_type: product.product_type,
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

	const handleSelectPaymentMethod = (paymentMethodId: number | string) => {
		const method = paymentMethods.find((pm) => pm.id === paymentMethodId);
		if (method) setPaymentMethod(method);
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
				return { ...p, quantity: newQty };
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
	const parsedPaidAmount = paidAmount.trim()
		? Math.round(Number.parseFloat(paidAmount) * 100)
		: total;
	const canCreate =
		selectedProducts.length > 0 &&
		selectedCustomer &&
		paymentMethod &&
		parsedPaidAmount >= 0 &&
		parsedPaidAmount <= total;

	const handleCreateOrder = () => {
		if (!selectedCustomer || !paymentMethod || !canCreate) return;
		createOrderMutation.mutate({
			customerId: selectedCustomer.id,
			paymentMethodId: paymentMethod.id,
			products: selectedProducts.map((p) => ({
				id: p.id,
				quantity: p.quantity,
				price: p.price,
			})),
			paidAmount: parsedPaidAmount,
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

	return (
		<div className="mx-auto w-full max-w-4xl">
			<Card className="mb-4">
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
					<div className="flex-1">
						<Combobox
							items={paymentMethods}
							placeholder={t("selectPaymentMethod")}
							value={selectedPaymentMethodLabel}
							onSelect={handleSelectPaymentMethod}
						/>
					</div>
					<div className="flex-1">
						<Input
							type="number"
							step="0.01"
							min="0"
							max={(total / 100).toString()}
							placeholder={t("paidAmount")}
							value={paidAmount}
							onChange={(e) => setPaidAmount(e.target.value)}
						/>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t("products")}</CardTitle>
					<div className="!mt-4 flex flex-col gap-3 sm:flex-row">
						<div className="relative flex-1">
							<SearchIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								type="text"
								placeholder={t("searchPlaceholder")}
								value={productSearch}
								onChange={(e) => setProductSearch(e.target.value)}
								className="pl-8"
							/>
						</div>
						<Combobox
							items={filteredProducts.map((p) => ({
								id: p.id,
								name: `${p.name} — ${formatCurrency(p.price, locale)} (${p.product_type === "service" ? t("service") : t("stockCount", { count: p.in_stock })})`,
							}))}
							placeholder={t("addProduct")}
							noSelect
							onSelect={handleSelectProduct}
						/>
					</div>
				</CardHeader>
				<CardContent>
					{selectedProducts.length === 0 ? (
						<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
							{t("selectProducts")}
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{tc("name")}</TableHead>
										<TableHead className="hidden sm:table-cell">
											{tc("price")}
										</TableHead>
										<TableHead className="hidden md:table-cell">
											{tc("status")}
										</TableHead>
										<TableHead>{t("qty")}</TableHead>
										<TableHead>{tc("total")}</TableHead>
										<TableHead className="w-10" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{selectedProducts.map((product) => {
										const source = products.find((p) => p.id === product.id);
										return (
											<TableRow key={product.id}>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell className="hidden sm:table-cell">
													{formatCurrency(product.price, locale)}
												</TableCell>
												<TableCell className="hidden md:table-cell">
													<Badge
														variant={
															source?.product_type === "service"
																? "secondary"
																: source && source.in_stock > 5
																	? "default"
																	: "destructive"
														}
													>
														{source?.product_type === "service"
															? t("service")
															: (source?.in_stock ?? 0)}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7"
															onClick={() =>
																handleQuantityChange(product.id, -1)
															}
															disabled={product.quantity <= 1}
														>
															<MinusIcon className="h-3 w-3" />
														</Button>
														<span className="w-8 text-center tabular-nums">
															{product.quantity}
														</span>
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7"
															onClick={() =>
																handleQuantityChange(product.id, 1)
															}
															disabled={
																source?.product_type === "product"
																	? product.quantity >= source.in_stock
																	: false
															}
														>
															<PlusIcon className="h-3 w-3" />
														</Button>
													</div>
												</TableCell>
												<TableCell className="font-medium">
													{formatCurrency(
														product.quantity * product.price,
														locale,
													)}
												</TableCell>
												<TableCell>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => handleRemoveProduct(product.id)}
													>
														<Trash2Icon className="h-4 w-4" />
														<span className="sr-only">{tc("remove")}</span>
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
					<div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
						<strong className="text-lg">
							{tc("total")}: {formatCurrency(total, locale)}
						</strong>
						<div className="flex w-full items-center gap-3 sm:w-auto">
							<Button
								onClick={handleCreateOrder}
								disabled={!canCreate || createOrderMutation.isPending}
								size="lg"
								className="flex-1 sm:flex-initial"
							>
								{createOrderMutation.isPending && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{t("createOrder")}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
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
							<p className="text-sm text-muted-foreground text-center">
								Transaksi{" "}
								<strong>
									{successOrder.order_number ?? `#${successOrder.id}`}
								</strong>{" "}
								berhasil disimpan.
							</p>

							{/* Preview struk di layar */}
							<div className="border p-4 rounded bg-muted/20 font-mono text-xs max-h-56 overflow-y-auto">
								<div className="text-center font-bold mb-2">
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
									{successOrder.items.map((item: any) => (
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
						<DialogFooter className="flex flex-col sm:flex-row gap-2">
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
					className="hidden print:block print:absolute print:top-0 print:left-0 print:w-[80mm] print:bg-white print:text-black print:p-4 font-mono text-[10px] leading-tight"
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
					<div className="text-center border-b pb-2 mb-2">
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
							<p className="text-[9px] italic mt-1 border-t border-dashed pt-1">
								{companySettings.receipt_header}
							</p>
						)}
					</div>
					<div className="space-y-1 mb-2">
						<p>No: {successOrder.order_number ?? `#${successOrder.id}`}</p>
						<p>
							Tgl:{" "}
							{successOrder.created_at
								? new Date(successOrder.created_at).toLocaleString("id-ID")
								: new Date().toLocaleString("id-ID")}
						</p>
						<p>Pelanggan: {successOrder.customer?.name || "Pelanggan Umum"}</p>
					</div>
					<div className="border-t border-b border-dashed py-2 my-2 space-y-1">
						{successOrder.items.map((item: any) => (
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
					<div className="text-center border-t border-dashed pt-2 mt-4">
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
