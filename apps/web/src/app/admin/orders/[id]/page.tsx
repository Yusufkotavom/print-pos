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
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	DownloadIcon,
	MessageCircleIcon,
	PencilIcon,
	PrinterIcon,
	Trash2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { InvoicePDF } from "@/components/invoice-pdf";
import { PaymentDialog } from "@/components/payment-dialog";
import { POSCartPanel } from "@/components/pos-cart-panel";
import { POSProductCatalog } from "@/components/pos-product-catalog";
import type { POSProductItem } from "@/components/pos-types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
	enqueueSyncItem,
	readCachedOrder,
	removeCachedOrder,
	upsertCachedOrder,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

const PDFDownloadLink = dynamic(
	() => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
	{ ssr: false },
);

type OrderDetail = NonNullable<RouterOutputs["orders"]["get"]>;
type OrderUpdateInput = RouterInputs["orders"]["update"];
type OrderPaymentInput = RouterInputs["orders"]["receivePayment"];

function toWhatsappUrl(phone: string | null | undefined, message: string) {
	if (!phone) return null;
	const cleanPhone = phone.replace(/[^0-9]/g, "");
	const waPhone = cleanPhone.startsWith("0")
		? `62${cleanPhone.slice(1)}`
		: cleanPhone;
	if (!waPhone) return null;
	return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}

export default function OrderDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const orderId = Number.parseInt(id, 10);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const {
		data: remoteOrder,
		isLoading,
		error,
	} = useQuery(trpc.orders.get.queryOptions({ id: orderId }));
	const [cachedOrder, setCachedOrder] = useState<OrderDetail | null>(null);
	const order =
		error && cachedOrder ? cachedOrder : (remoteOrder ?? cachedOrder);
	const { data: paymentMethods = [] } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const { data: products = [] } = useQuery(trpc.products.list.queryOptions());
	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);
	const t = useTranslations("orders");
	const tc = useTranslations("common");
	const locale = useLocale();
	const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [editItems, setEditItems] = useState<POSProductItem[]>([]);
	const [editNote, setEditNote] = useState("");
	const [productSearch, setProductSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const search = useDebouncedValue(productSearch, 250);
	const isOnline = useOnlineStatus();
	const isOfflineMode = !isOnline || !!error;

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		void readCachedOrder<OrderDetail>(orderId).then(setCachedOrder);
	}, [orderId]);

	useEffect(() => {
		if (!remoteOrder || error) return;
		setCachedOrder(remoteOrder);
		void upsertCachedOrder(remoteOrder);
	}, [remoteOrder, error]);

	const receivePaymentMutation = useMutation(
		trpc.orders.receivePayment.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.orders.get.queryOptions({ id: orderId }),
				);
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				setIsPaymentDialogOpen(false);
				toast.success(t("paymentReceived"));
			},
			onError: (err) => toast.error(err.message || t("paymentError")),
		}),
	);

	const updateOrderMutation = useMutation(
		trpc.orders.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.orders.get.queryOptions({ id: orderId }),
				);
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				setEditOpen(false);
				toast.success(t("updated"));
			},
			onError: (err) => toast.error(err.message || t("updateError")),
		}),
	);

	const deleteOrderMutation = useMutation(
		trpc.orders.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.orders.list.queryOptions());
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				router.push("/admin/orders");
			},
			onError: (err) => toast.error(err.message || tc("error")),
		}),
	);

	useEffect(() => {
		if (!isOnline) return;
		void syncReadyQueue({
			updateOrder: (payload) =>
				updateOrderMutation.mutateAsync(payload as OrderUpdateInput),
			deleteOrder: (payload) =>
				deleteOrderMutation.mutateAsync(payload as { id: number }),
			receiveOrderPayment: (payload) =>
				receivePaymentMutation.mutateAsync(payload as OrderPaymentInput),
		});
	}, [
		deleteOrderMutation,
		isOnline,
		receivePaymentMutation,
		updateOrderMutation,
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
	const editTotal = editItems.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);

	const updateCachedOrderState = async (nextOrder: OrderDetail) => {
		setCachedOrder(nextOrder);
		await upsertCachedOrder(nextOrder);
		queryClient.setQueryData(
			trpc.orders.get.queryKey({ id: orderId }),
			nextOrder,
		);
		queryClient.setQueryData(
			trpc.orders.list.queryKey(),
			(current: RouterOutputs["orders"]["list"] | undefined) =>
				current?.map((item) => {
					if (item.id !== nextOrder.id) return item;
					return {
						...item,
						total_amount: nextOrder.total_amount,
						paid_amount: nextOrder.paid_amount,
						payment_status: nextOrder.payment_status,
						status: nextOrder.status,
						note: nextOrder.note,
					};
				}),
		);
	};

	if (isLoading) {
		return (
			<div className="max-w-3xl space-y-6">
				<Skeleton className="h-8 w-48" />
				<Card>
					<CardContent className="space-y-4 p-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-6 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!order) {
		return <div className="text-muted-foreground">{t("orderNotFound")}</div>;
	}

	const createdAtLabel = order.created_at
		? new Date(order.created_at).toLocaleString(locale, {
				dateStyle: "full",
				timeStyle: "short",
			})
		: "—";
	const remainingAmount = Math.max(0, order.total_amount - order.paid_amount);
	const statusColor =
		order.payment_status === "paid"
			? "text-green-600"
			: order.payment_status === "partial"
				? "text-yellow-600"
				: "text-red-600";
	const statusLabel =
		order.payment_status === "paid"
			? t("paid")
			: order.payment_status === "partial"
				? t("partial")
				: t("unpaid");
	const orderNumber = order.order_number ?? `#${order.id}`;
	const whatsappMessage = [
		`${t("invoice")} ${orderNumber}`,
		order.customer?.name ? `${t("customer")}: ${order.customer.name}` : null,
		...order.orderItems.map(
			(item) =>
				`- ${item.item_name || item.product?.name || `#${item.product_id}`} x${item.quantity} (${formatCurrency(item.price * item.quantity, locale)})`,
		),
		`${tc("total")}: ${formatCurrency(order.total_amount, locale)}`,
	]
		.filter(Boolean)
		.join("\n");
	const whatsappUrl = toWhatsappUrl(order.customer?.phone, whatsappMessage);

	const handleReceivePayment = async (data: {
		paymentMethodId: number;
		amount: number;
	}) => {
		if (isOfflineMode) {
			const amount = Math.min(data.amount, remainingAmount);
			const nextPaidAmount = order.paid_amount + amount;
			const nextPaymentStatus =
				nextPaidAmount >= order.total_amount
					? "paid"
					: nextPaidAmount > 0
						? "partial"
						: "unpaid";
			const paymentMethodName = paymentMethods.find(
				(item) => item.id === data.paymentMethodId,
			)?.name;
			const nextOrder = {
				...order,
				paid_amount: nextPaidAmount,
				payment_status: nextPaymentStatus,
				status: nextPaymentStatus === "paid" ? "completed" : order.status,
				payments: [
					...order.payments,
					{
						id: -Date.now(),
						payment_number: null,
						amount,
						type: "payment",
						status: "completed",
						paid_at: new Date(),
						paymentMethod: paymentMethodName
							? { name: paymentMethodName }
							: null,
					},
				],
			} satisfies OrderDetail;
			await updateCachedOrderState(nextOrder);
			await enqueueSyncItem({
				id: `order:receivePayment:${order.id}:${Date.now()}`,
				entity: "order",
				operation: "receivePayment",
				payload: {
					id: order.id,
					paymentMethodId: data.paymentMethodId,
					amount,
				},
				status: "pending",
				retryCount: 0,
			});
			setIsPaymentDialogOpen(false);
			toast.success(t("paymentReceived"));
			return;
		}
		receivePaymentMutation.mutate({
			id: order.id,
			paymentMethodId: data.paymentMethodId,
			amount: data.amount,
		});
	};

	const handleOpenEdit = () => {
		setEditItems(
			order.orderItems.map((item) => {
				const product = item.product_id
					? products.find((entry) => entry.id === item.product_id)
					: undefined;
				return {
					id: item.product_id ?? item.id,
					product_id: item.product_id,
					name: item.item_name || item.product?.name || `#${item.product_id}`,
					price: item.price,
					in_stock: product?.in_stock ?? 0,
					track_stock: product?.track_stock ?? false,
					product_type: product?.product_type ?? item.item_type ?? "product",
					wholesale_price: product?.wholesale_price ?? null,
					wholesale_min_qty: product?.wholesale_min_qty ?? null,
					category: product?.category ?? "",
					image_url: product?.image_url ?? null,
					quantity: item.quantity,
				};
			}),
		);
		setEditNote(order.note ?? "");
		setEditOpen(true);
	};

	return (
		<div className="max-w-3xl space-y-6 print:max-w-none">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
				<div className="flex items-center gap-4">
					<Link href="/admin/orders">
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="h-4 w-4" />
						</Button>
					</Link>
					<h1 className="font-bold text-2xl">
						{t("orderDetails")} {orderNumber}
					</h1>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="icon" onClick={handleOpenEdit}>
						<PencilIcon className="h-4 w-4" />
					</Button>
					{whatsappUrl && (
						<Button variant="outline" size="icon" asChild>
							<a href={whatsappUrl} target="_blank" rel="noreferrer">
								<MessageCircleIcon className="h-4 w-4" />
							</a>
						</Button>
					)}
					<Button
						variant="outline"
						size="icon"
						onClick={() => window.open(`/api/orders/${order.id}/pdf`, "_blank")}
					>
						<PrinterIcon className="h-4 w-4" />
					</Button>
					<Button
						variant="destructive"
						size="icon"
						onClick={() => setDeleteOpen(true)}
					>
						<Trash2Icon className="h-4 w-4" />
					</Button>
					{isMounted && (
						<PDFDownloadLink
							document={
								<InvoicePDF
									order={order}
									companySettings={companySettings}
									labels={{
										invoice: t("invoice"),
										date: tc("date"),
										status: t("paymentStatus"),
										customer: t("customer"),
										item: t("item"),
										qty: t("quantity"),
										price: t("unitPrice"),
										subtotal: t("subtotal"),
										total: tc("total"),
										paidAmount: t("paidAmount"),
										remainingAmount: t("remainingAmount"),
										paid: t("paid"),
										unpaid: t("unpaid"),
										partial: t("partial"),
										companyDetails: "Detail Perusahaan",
										thankYou: "Terima kasih atas kunjungan Anda!",
									}}
								/>
							}
							fileName={`invoice-${order.id}.pdf`}
						>
							{({ loading }) => (
								<Button
									className="w-full sm:w-auto"
									variant="default"
									disabled={loading}
								>
									<DownloadIcon className="mr-2 h-4 w-4" />
									{loading ? tc("loading") : "Download PDF"}
								</Button>
							)}
						</PDFDownloadLink>
					)}
				</div>
			</div>

			<Card className="print:border-none print:shadow-none">
				<CardHeader className="print:px-0">
					<div className="flex items-center justify-between">
						<CardTitle>{t("invoiceSummary")}</CardTitle>
						<span className={`font-semibold ${statusColor}`}>
							{statusLabel}
						</span>
					</div>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div>
							<dt className="text-muted-foreground">{t("customer")}</dt>
							<dd className="font-medium">{order.customer?.name ?? "—"}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">{tc("total")}</dt>
							<dd className="font-bold text-lg">
								{formatCurrency(order.total_amount, locale)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">{t("paidAmount")}</dt>
							<dd className="font-medium">
								{formatCurrency(order.paid_amount, locale)}
							</dd>
						</div>
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 sm:col-span-2">
							<dt className="font-bold text-red-700 text-sm uppercase tracking-wide">
								{t("remainingAmount")}
							</dt>
							<dd className="mt-1 font-bold text-2xl text-red-700 sm:text-3xl">
								{formatCurrency(remainingAmount, locale)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">{t("createdAt")}</dt>
							<dd>{createdAtLabel}</dd>
						</div>
					</dl>
					{remainingAmount > 0 && (
						<div className="mt-4 border-t pt-4 print:hidden">
							<Button onClick={() => setIsPaymentDialogOpen(true)}>
								{t("receivePayment")}
							</Button>
							<PaymentDialog
								open={isPaymentDialogOpen}
								onOpenChange={setIsPaymentDialogOpen}
								title={t("receivePayment")}
								totalLabel={t("remainingAmount")}
								amountLabel={t("paymentAmount")}
								paymentMethodLabel={t("paymentMethod")}
								submitLabel={t("savePayment")}
								cancelLabel={tc("cancel")}
								totalAmount={remainingAmount}
								maxAmount={remainingAmount}
								locale={locale}
								paymentMethods={paymentMethods}
								isPending={receivePaymentMutation.isPending}
								onSubmit={handleReceivePayment}
							/>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Riwayat Pembayaran</CardTitle>
				</CardHeader>
				<CardContent>
					{order.payments.length === 0 ? (
						<div className="text-muted-foreground text-sm">
							Belum ada pembayaran.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>No</TableHead>
									<TableHead>Metode</TableHead>
									<TableHead>Tipe</TableHead>
									<TableHead>Jumlah</TableHead>
									<TableHead>Tanggal</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{order.payments.map((payment) => (
									<TableRow key={payment.id}>
										<TableCell>
											{payment.payment_number ?? `#${payment.id}`}
										</TableCell>
										<TableCell>{payment.paymentMethod?.name ?? "—"}</TableCell>
										<TableCell>{payment.type}</TableCell>
										<TableCell>
											{formatCurrency(payment.amount, locale)}
										</TableCell>
										<TableCell>
											{payment.paid_at
												? new Date(payment.paid_at).toLocaleString(locale)
												: "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{order.orderItems.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>{t("items")}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("item")}</TableHead>
										<TableHead className="hidden sm:table-cell">
											{t("type")}
										</TableHead>
										<TableHead>{t("quantity")}</TableHead>
										<TableHead>{t("unitPrice")}</TableHead>
										<TableHead>{t("subtotal")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{order.orderItems.map((item) => (
										<TableRow key={item.id}>
											<TableCell className="font-medium">
												<div>
													{item.item_name ||
														item.product?.name ||
														`#${item.product_id}`}
												</div>
												{item.note && (
													<div className="mt-0.5 text-muted-foreground text-xs">
														{item.note}
													</div>
												)}
											</TableCell>
											<TableCell className="hidden sm:table-cell">
												<Badge variant="outline">
													{item.item_type === "service"
														? t("service")
														: t("physicalProduct")}
												</Badge>
											</TableCell>
											<TableCell>{item.quantity}</TableCell>
											<TableCell>
												{formatCurrency(item.price, locale)}
											</TableCell>
											<TableCell className="font-medium">
												{formatCurrency(item.price * item.quantity, locale)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-6xl">
					<DialogHeader>
						<DialogTitle>{t("editOrder")}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
						<div className="space-y-4">
							<POSProductCatalog
								products={filteredProducts}
								selectedProducts={editItems}
								selectedCategory={selectedCategory}
								productCategories={productCategories}
								productSearch={productSearch}
								viewMode={viewMode}
								locale={locale}
								onSearchChange={setProductSearch}
								onCategoryChange={setSelectedCategory}
								onViewModeChange={setViewMode}
								onSelectProduct={(productId) => {
									const product = products.find(
										(item) => item.id === productId,
									);
									if (!product) return;
									setEditItems((prev) => {
										const existing = prev.find(
											(item) => item.id === product.id,
										);
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
								}}
							/>
						</div>
						<POSCartPanel
							items={editItems}
							products={products}
							note={editNote}
							total={editTotal}
							locale={locale}
							title={t("editOrder")}
							actionLabel={t("updateOrder")}
							isPending={updateOrderMutation.isPending}
							canCreate={editItems.length > 0}
							onNoteChange={setEditNote}
							onQuantityChange={(productId, delta) =>
								setEditItems((prev) =>
									prev.map((item) =>
										item.id === productId
											? {
													...item,
													quantity: Math.max(1, item.quantity + delta),
												}
											: item,
									),
								)
							}
							onPriceChange={(productId, price) =>
								setEditItems((prev) =>
									prev.map((item) =>
										item.id === productId ? { ...item, price } : item,
									),
								)
							}
							onRemoveProduct={(productId) =>
								setEditItems((prev) =>
									prev.filter((item) => item.id !== productId),
								)
							}
							onCreateOrder={() => {
								const payload = {
									id: order.id,
									note: editNote,
									products: editItems.map((item) => ({
										id: item.id,
										quantity: item.quantity,
										price: item.price,
									})),
									total: editTotal,
								};
								if (isOfflineMode) {
									const nextOrder = {
										...order,
										note: editNote,
										total_amount: editTotal,
										orderItems: editItems.map((item, index) => ({
											id: -(Date.now() + index),
											product_id: item.product_id ?? null,
											item_name: item.name,
											item_type: item.product_type,
											quantity: item.quantity,
											price: item.price,
											cost: 0,
											note: null,
											product: {
												name: item.name,
												category: item.category || null,
												product_type: item.product_type,
											},
										})),
									} satisfies OrderDetail;
									void updateCachedOrderState(nextOrder).then(() =>
										enqueueSyncItem({
											id: `order:update:${order.id}`,
											entity: "order",
											operation: "update",
											payload,
											status: "pending",
											retryCount: 0,
										}),
									);
									setEditOpen(false);
									toast.success(t("updated"));
									return;
								}
								updateOrderMutation.mutate(payload);
							}}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditOpen(false)}>
							{tc("cancel")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<DeleteConfirmationDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={() => {
					if (isOfflineMode) {
						void removeCachedOrder(order.id).then(() =>
							enqueueSyncItem({
								id: `order:delete:${order.id}`,
								entity: "order",
								operation: "delete",
								payload: { id: order.id },
								status: "pending",
								retryCount: 0,
							}),
						);
						queryClient.setQueryData(
							trpc.orders.list.queryOptions().queryKey,
							(current: RouterOutputs["orders"]["list"] | undefined) =>
								current?.filter((item) => item.id !== order.id),
						);
						router.push("/admin/orders");
						return;
					}
					deleteOrderMutation.mutate({ id: order.id });
				}}
			/>
		</div>
	);
}
