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
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { Textarea } from "@finopenpos/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	FileTextIcon,
	MessageCircleIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { POSCartPanel } from "@/components/pos-cart-panel";
import { POSProductCatalog } from "@/components/pos-product-catalog";
import type { POSProductItem } from "@/components/pos-types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

const statuses = [
	"in_progress",
	"waiting",
	"ready",
	"done",
	"warranty",
] as const;

function toWhatsappUrl(phone: string | null | undefined, message: string) {
	if (!phone) return null;
	const cleanPhone = phone.replace(/[^0-9]/g, "");
	const waPhone = cleanPhone.startsWith("0")
		? `62${cleanPhone.slice(1)}`
		: cleanPhone;
	if (!waPhone) return null;
	return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}

export default function ServiceDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const serviceId = Number.parseInt(id, 10);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("services");
	const tc = useTranslations("common");
	const locale = useLocale();
	const [paymentOpen, setPaymentOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [warrantyDialogOpen, setWarrantyDialogOpen] = useState(false);
	const [statusDialogOpen, setStatusDialogOpen] = useState(false);
	const [nextStatus, setNextStatus] = useState<
		(typeof statuses)[number] | null
	>(null);
	const [statusWhatsappEnabled, setStatusWhatsappEnabled] = useState(true);
	const [editServiceType, setEditServiceType] = useState("");
	const [editEstimatedDoneAt, setEditEstimatedDoneAt] = useState("");
	const [editCustomerNote, setEditCustomerNote] = useState("");
	const [editInternalNote, setEditInternalNote] = useState("");
	const [editDetailText, setEditDetailText] = useState("");
	const [editItems, setEditItems] = useState<POSProductItem[]>([]);
	const [productSearch, setProductSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [warrantyUnit, setWarrantyUnit] = useState<
		"none" | "day" | "month" | "year"
	>("none");
	const [warrantyValue, setWarrantyValue] = useState("");
	const [warrantyNotes, setWarrantyNotes] = useState("");
	const search = useDebouncedValue(productSearch, 250);
	const { data: service, isLoading } = useQuery(
		trpc.serviceOrders.get.queryOptions({ id: serviceId }),
	);
	const { data: paymentMethods = [] } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const { data: serviceTypes = [] } = useQuery(
		trpc.serviceTypes.list.queryOptions(),
	);
	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);
	const { data: products = [] } = useQuery(trpc.products.list.queryOptions());

	const updateService = useMutation(
		trpc.serviceOrders.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.serviceOrders.get.queryOptions({ id: serviceId }),
				);
				queryClient.invalidateQueries(trpc.serviceOrders.list.queryOptions());
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				setEditOpen(false);
				toast.success("Service diperbarui");
			},
			onError: (error) => toast.error(error.message || t("updateError")),
		}),
	);
	const deleteService = useMutation(
		trpc.serviceOrders.delete.mutationOptions({
			onSuccess: () => {
				toast.success("Service dihapus");
				window.location.href = "/admin/services";
			},
			onError: (error) => toast.error(error.message || t("deleteError")),
		}),
	);
	const receivePayment = useMutation(
		trpc.serviceOrders.receivePayment.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.serviceOrders.get.queryOptions({ id: serviceId }),
				);
				queryClient.invalidateQueries(trpc.serviceOrders.list.queryOptions());
				setPaymentOpen(false);
				toast.success(t("paymentReceived"));
			},
			onError: (error) => toast.error(error.message || t("paymentError")),
		}),
	);
	const updateWarranty = useMutation(
		trpc.serviceOrders.updateWarranty.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.serviceOrders.get.queryOptions({ id: serviceId }),
				);
				queryClient.invalidateQueries(trpc.serviceOrders.list.queryOptions());
				setWarrantyDialogOpen(false);
				toast.success("Garansi diperbarui");
			},
			onError: (error) => toast.error(error.message || t("updateError")),
		}),
	);
	const updateStatus = useMutation(
		trpc.serviceOrders.updateStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.serviceOrders.get.queryOptions({ id: serviceId }),
				);
				queryClient.invalidateQueries(trpc.serviceOrders.list.queryOptions());
				toast.success(t("statusUpdated"));
			},
			onError: (error) => toast.error(error.message || t("updateError")),
		}),
	);

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

	if (isLoading) return <Skeleton className="h-96 w-full" />;
	if (!service)
		return <div className="text-muted-foreground">{t("serviceNotFound")}</div>;

	const productInformation = service.items
		.map((item) => `- ${item.item_name} x${item.quantity}`)
		.join("\n");
	const productTemplate =
		companySettings?.whatsapp_product_information_template ||
		"Produk/Item:\n{product_information}";
	const productInformationText = productTemplate.replace(
		/{product_information}/g,
		productInformation,
	);
	const getStatusTemplate = (status: (typeof statuses)[number]) => {
		const templates = {
			in_progress: companySettings?.whatsapp_service_in_progress_template,
			waiting: companySettings?.whatsapp_service_waiting_template,
			ready: companySettings?.whatsapp_service_ready_template,
			done: companySettings?.whatsapp_service_done_template,
			warranty: companySettings?.whatsapp_service_warranty_template,
		};
		return (
			templates[status] ||
			`${t("whatsappStatusPrefix")} {service_number} - {status}\n\n{product_information}`
		);
	};
	const buildWhatsappMessage = (status: (typeof statuses)[number]) =>
		getStatusTemplate(status)
			.replace(/{service_number}/g, service.service_number ?? `#${service.id}`)
			.replace(/{customer_name}/g, service.customer?.name ?? "")
			.replace(/{status}/g, t(`status_${status}` as never))
			.replace(/{product_information}/g, productInformationText);
	const openWhatsappForStatus = (status: (typeof statuses)[number]) => {
		const url = toWhatsappUrl(
			service.customer?.phone || companySettings?.whatsapp,
			buildWhatsappMessage(status),
		);
		if (url) window.open(url, "_blank");
	};
	const serviceSummaryMessage = [
		`${service.service_number ?? `#${service.id}`}`,
		service.customer?.name
			? `${t("customer")}: ${service.customer.name}`
			: null,
		...service.items.map(
			(item) =>
				`- ${item.item_name} x${item.quantity} (${formatCurrency(item.price * item.quantity, locale)})`,
		),
		`${tc("total")}: ${formatCurrency(service.total_amount, locale)}`,
	]
		.filter(Boolean)
		.join("\n");
	const serviceWhatsappUrl = toWhatsappUrl(
		service.customer?.phone,
		serviceSummaryMessage,
	);
	const warrantyUntil = service.warranty_until
		? new Date(service.warranty_until)
		: null;
	const warrantyStartedAt = service.warranty_started_at
		? new Date(service.warranty_started_at)
		: null;
	const warrantyActive = warrantyUntil ? warrantyUntil >= new Date() : false;
	const warrantyPendingActivation =
		service.warranty_unit !== "none" &&
		!warrantyStartedAt &&
		service.payment_status !== "paid";
	const warrantyWaitingCompletion =
		service.warranty_unit !== "none" &&
		!warrantyStartedAt &&
		service.payment_status === "paid";
	const warrantyLabel =
		service.warranty_unit === "none"
			? t("warrantyNone")
			: warrantyPendingActivation
				? "Menunggu service lunas"
				: warrantyWaitingCompletion
					? "Menunggu service selesai"
					: warrantyUntil
						? warrantyActive
							? `Aktif sampai ${warrantyUntil.toLocaleDateString(locale)}`
							: `Expired ${warrantyUntil.toLocaleDateString(locale)}`
						: `${service.warranty_value ?? 0} ${t(`warranty_${service.warranty_unit}` as never)}`;

	const openEditDialog = () => {
		setEditServiceType(service.service_type);
		setEditEstimatedDoneAt(
			service.estimated_done_at
				? new Date(service.estimated_done_at).toISOString().slice(0, 16)
				: "",
		);
		setEditCustomerNote(service.customer_note ?? "");
		setEditInternalNote(service.internal_note ?? "");
		setEditDetailText(String(service.details_json?.text ?? ""));
		setEditItems(
			service.items.map((item) => {
				const product = item.product_id
					? products.find((entry) => entry.id === item.product_id)
					: undefined;
				return {
					id: item.product_id ?? item.id,
					name: item.item_name,
					price: item.price,
					in_stock: product?.in_stock ?? 0,
					track_stock: product?.track_stock ?? false,
					product_type: product?.product_type ?? item.item_type,
					wholesale_price: product?.wholesale_price ?? null,
					wholesale_min_qty: product?.wholesale_min_qty ?? null,
					category: product?.category ?? "",
					quantity: item.quantity,
				};
			}),
		);
		setEditOpen(true);
	};

	return (
		<div className="max-w-4xl space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-4">
					<Link href="/admin/services">
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="h-4 w-4" />
						</Button>
					</Link>
					<h1 className="font-bold text-2xl">
						{service.service_number ?? `#${service.id}`}
					</h1>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="icon" onClick={openEditDialog}>
						<PencilIcon className="h-4 w-4" />
					</Button>
					{serviceWhatsappUrl && (
						<Button variant="outline" size="icon" asChild>
							<a href={serviceWhatsappUrl} target="_blank" rel="noreferrer">
								<MessageCircleIcon className="h-4 w-4" />
							</a>
						</Button>
					)}
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							window.open(`/api/services/${service.id}/pdf`, "_blank")
						}
					>
						<FileTextIcon className="h-4 w-4" />
					</Button>
					<Button variant="outline" onClick={() => setWarrantyDialogOpen(true)}>
						Atur Garansi
					</Button>
					<Button variant="outline" onClick={() => setPaymentOpen(true)}>
						{t("receivePayment")}
					</Button>
					<Button
						variant="destructive"
						size="icon"
						onClick={() => setDeleteOpen(true)}
					>
						<Trash2Icon className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("serviceSummary")}</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div>
						<div className="text-muted-foreground text-sm">{t("customer")}</div>
						<div>{service.customer?.name ?? "—"}</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">
							{t("serviceType")}
						</div>
						<div>
							{serviceTypes.find((item) => item.value === service.service_type)
								?.name ?? service.service_type}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">{tc("status")}</div>
						<Badge>{t(`status_${service.status}` as never)}</Badge>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">
							{t("estimatedDoneAt")}
						</div>
						<div>
							{service.estimated_done_at
								? new Date(service.estimated_done_at).toLocaleString(locale)
								: "—"}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">{tc("total")}</div>
						<div>{formatCurrency(service.total_amount, locale)}</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">
							{t("paidAmount")}
						</div>
						<div>{formatCurrency(service.paid_amount, locale)}</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">{t("warranty")}</div>
						<div>{warrantyLabel}</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">Mulai Garansi</div>
						<div>
							{warrantyStartedAt
								? warrantyStartedAt.toLocaleDateString(locale)
								: "—"}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground text-sm">
							Berakhir Garansi
						</div>
						<div>
							{warrantyUntil ? warrantyUntil.toLocaleDateString(locale) : "—"}
						</div>
					</div>
					<div className="sm:col-span-2">
						<div className="text-muted-foreground text-sm">Catatan Garansi</div>
						<div>{service.warranty_notes || "—"}</div>
					</div>
					<div className="sm:col-span-2">
						<div className="text-muted-foreground text-sm">
							{t("customerNote")}
						</div>
						<div>{service.customer_note || "—"}</div>
					</div>
					<div className="sm:col-span-2">
						<div className="text-muted-foreground text-sm">
							{t("internalNote")}
						</div>
						<div>{service.internal_note || "—"}</div>
					</div>
					<div className="sm:col-span-2">
						<div className="text-muted-foreground text-sm">{t("terms")}</div>
						<div>
							{companySettings?.service_terms ||
								companySettings?.invoice_terms ||
								"—"}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Riwayat Pembayaran</CardTitle>
				</CardHeader>
				<CardContent>
					{service.payments.length === 0 ? (
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
								{service.payments.map((payment) => (
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

			<Card>
				<CardHeader>
					<CardTitle>{t("updateStatus")}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{statuses.map((status) => (
						<Button
							key={status}
							type="button"
							variant={service.status === status ? "default" : "outline"}
							onClick={() => {
								setNextStatus(status);
								setStatusWhatsappEnabled(true);
								setStatusDialogOpen(true);
							}}
						>
							{t(`status_${status}` as never)}
						</Button>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t("serviceItems")}</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("item")}</TableHead>
								<TableHead>{t("lineType")}</TableHead>
								<TableHead>{t("qty")}</TableHead>
								<TableHead>{tc("price")}</TableHead>
								<TableHead>{t("subtotal")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{service.items.map((item) => (
								<TableRow key={item.id}>
									<TableCell>{item.item_name}</TableCell>
									<TableCell>
										{t(`lineType_${item.line_type}` as never)}
									</TableCell>
									<TableCell>{item.quantity}</TableCell>
									<TableCell>{formatCurrency(item.price, locale)}</TableCell>
									<TableCell>
										{formatCurrency(item.price * item.quantity, locale)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("updateStatus")}</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div>{nextStatus ? t(`status_${nextStatus}` as never) : ""}</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={statusWhatsappEnabled}
								onChange={(event) =>
									setStatusWhatsappEnabled(event.target.checked)
								}
							/>
							{t("sendWhatsappStatus")}
						</label>
						{nextStatus && statusWhatsappEnabled && (
							<Textarea
								readOnly
								value={buildWhatsappMessage(nextStatus)}
								rows={6}
							/>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setStatusDialogOpen(false)}
						>
							{tc("cancel")}
						</Button>
						<Button
							type="button"
							disabled={!nextStatus || updateStatus.isPending}
							onClick={() => {
								if (!nextStatus) return;
								const status = nextStatus;
								updateStatus.mutate(
									{ id: service.id, status },
									{
										onSuccess: () => {
											setStatusDialogOpen(false);
											if (statusWhatsappEnabled) openWhatsappForStatus(status);
										},
									},
								);
							}}
						>
							{tc("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-6xl">
					<DialogHeader>
						<DialogTitle>Edit Service</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
						<div className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>{t("serviceType")}</Label>
									<Select
										value={editServiceType}
										onValueChange={setEditServiceType}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{serviceTypes.map((item) => (
												<SelectItem key={item.id} value={item.value}>
													{item.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>{t("estimatedDoneAt")}</Label>
									<Input
										type="datetime-local"
										value={editEstimatedDoneAt}
										onChange={(event) =>
											setEditEstimatedDoneAt(event.target.value)
										}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label>{t("serviceDetails")}</Label>
								<Textarea
									value={editDetailText}
									onChange={(event) => setEditDetailText(event.target.value)}
									rows={3}
								/>
							</div>
							<div className="space-y-2">
								<Label>{t("customerNote")}</Label>
								<Textarea
									value={editCustomerNote}
									onChange={(event) => setEditCustomerNote(event.target.value)}
									rows={3}
								/>
							</div>
							<div className="space-y-2">
								<Label>{t("internalNote")}</Label>
								<Textarea
									value={editInternalNote}
									onChange={(event) => setEditInternalNote(event.target.value)}
									rows={3}
								/>
							</div>
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
							note={editCustomerNote}
							total={editTotal}
							locale={locale}
							title={t("serviceSummary")}
							actionLabel={tc("update")}
							isPending={updateService.isPending}
							canCreate={editItems.length > 0}
							onNoteChange={setEditCustomerNote}
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
							onCreateOrder={() =>
								updateService.mutate({
									id: service.id,
									serviceType: editServiceType,
									estimatedDoneAt: editEstimatedDoneAt
										? new Date(editEstimatedDoneAt)
										: null,
									customerNote: editCustomerNote,
									internalNote: editInternalNote,
									details: { text: editDetailText },
									items: editItems.map((item) => ({
										id: item.id,
										quantity: item.quantity,
										price: item.price,
										name: item.name,
										lineType:
											item.product_type === "service" ? "service" : "product",
									})),
									total: editTotal,
								})
							}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setEditOpen(false)}
						>
							{tc("cancel")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={warrantyDialogOpen} onOpenChange={setWarrantyDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Atur Garansi</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="space-y-2">
							<Label>{t("warranty")}</Label>
							<Select
								value={warrantyUnit}
								onValueChange={(value) =>
									setWarrantyUnit(value as "none" | "day" | "month" | "year")
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">{t("warrantyNone")}</SelectItem>
									<SelectItem value="day">{t("warranty_day")}</SelectItem>
									<SelectItem value="month">{t("warranty_month")}</SelectItem>
									<SelectItem value="year">{t("warranty_year")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>{t("warrantyValue")}</Label>
							<Input
								type="number"
								min={1}
								disabled={warrantyUnit === "none"}
								value={warrantyValue}
								onChange={(event) => setWarrantyValue(event.target.value)}
								placeholder={t("warrantyValue")}
							/>
						</div>
						<div className="space-y-2">
							<Label>Catatan Garansi</Label>
							<Textarea
								value={warrantyNotes}
								onChange={(event) => setWarrantyNotes(event.target.value)}
								rows={3}
							/>
						</div>
						<div className="rounded-lg border bg-muted/40 p-3 text-sm">
							{warrantyUnit === "none"
								? "Garansi dimatikan."
								: service.payment_status !== "paid"
									? "Garansi akan aktif otomatis setelah service lunas."
									: service.status !== "done"
										? "Garansi akan aktif otomatis setelah service selesai."
										: "Garansi aktif segera setelah disimpan."}
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setWarrantyDialogOpen(false)}
						>
							{tc("cancel")}
						</Button>
						<Button
							type="button"
							disabled={updateWarranty.isPending}
							onClick={() =>
								updateWarranty.mutate({
									id: service.id,
									warrantyUnit,
									warrantyValue:
										warrantyUnit === "none"
											? undefined
											: Number.parseInt(warrantyValue || "0", 10) || undefined,
									warrantyNotes,
								})
							}
						>
							{tc("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<PaymentDialog
				open={paymentOpen}
				onOpenChange={setPaymentOpen}
				title={t("receivePayment")}
				totalLabel={tc("total")}
				amountLabel={t("paymentAmount")}
				paymentMethodLabel={t("paymentMethod")}
				submitLabel={tc("save")}
				cancelLabel={tc("cancel")}
				totalAmount={service.total_amount}
				maxAmount={Math.max(0, service.total_amount - service.paid_amount)}
				allowOverpayment
				locale={locale}
				paymentMethods={paymentMethods}
				isPending={receivePayment.isPending}
				onSubmit={({ paymentMethodId, amount }) =>
					receivePayment.mutate({
						id: service.id,
						paymentMethodId,
						amount,
					})
				}
			/>
			<DeleteConfirmationDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={() => deleteService.mutate({ id: service.id })}
				description="Service dengan pembayaran tidak bisa dihapus."
			/>
		</div>
	);
}
