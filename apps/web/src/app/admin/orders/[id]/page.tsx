"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
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
import { ArrowLeftIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { InvoicePDF } from "@/components/invoice-pdf";
import { PaymentDialog } from "@/components/payment-dialog";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

const PDFDownloadLink = dynamic(
	() => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
	{ ssr: false },
);

export default function OrderDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const orderId = Number.parseInt(id, 10);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: order, isLoading } = useQuery(
		trpc.orders.get.queryOptions({ id: orderId }),
	);
	const { data: paymentMethods = [] } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const t = useTranslations("orders");
	const tc = useTranslations("common");
	const locale = useLocale();
	const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

	const [isMounted, setIsMounted] = useState(false);
	useEffect(() => {
		setIsMounted(true);
	}, []);

	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);

	const pdfLabels = {
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
	};

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

	const handleReceivePayment = (data: {
		paymentMethodId: number;
		amount: number;
	}) => {
		receivePaymentMutation.mutate({
			id: order.id,
			paymentMethodId: data.paymentMethodId,
			amount: data.amount,
		});
	};

	const orderNumber = order.order_number ?? `#${order.id}`;

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
				<div className="flex flex-col gap-2 sm:flex-row">
					<Button
						className="w-full sm:w-auto"
						variant="outline"
						onClick={() => window.open(`/api/orders/${order.id}/pdf`, "_blank")}
					>
						<PrinterIcon className="mr-2 h-4 w-4" />
						{t("printInvoice")}
					</Button>
					{isMounted && order && (
						<PDFDownloadLink
							document={
								<InvoicePDF
									order={order}
									companySettings={companySettings}
									labels={pdfLabels}
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

			<div className="hidden print:block">
				<h1 className="font-bold text-3xl">
					{t("invoice")} {orderNumber}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{tc("date")}: {createdAtLabel}
				</p>
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

			{order.orderItems && order.orderItems.length > 0 && (
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
		</div>
	);
}
