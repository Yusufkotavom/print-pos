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
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/payment-dialog";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

const statuses = [
	"in_progress",
	"waiting",
	"ready",
	"done",
	"warranty",
] as const;

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
	const [statusDialogOpen, setStatusDialogOpen] = useState(false);
	const [nextStatus, setNextStatus] = useState<
		(typeof statuses)[number] | null
	>(null);
	const [statusWhatsappEnabled, setStatusWhatsappEnabled] = useState(true);
	const [warrantyUnit, setWarrantyUnit] = useState<
		"none" | "day" | "month" | "year"
	>("none");
	const [warrantyValue, setWarrantyValue] = useState("");
	const { data: service, isLoading } = useQuery(
		trpc.serviceOrders.get.queryOptions({ id: serviceId }),
	);
	const { data: paymentMethods = [] } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const { data: companySettings } = useQuery(
		trpc.companySettings.get.queryOptions(),
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
		const customerPhone =
			service.customer?.phone || companySettings?.whatsapp || "";
		if (!customerPhone) return;
		const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
		const waPhone = cleanPhone.startsWith("0")
			? `62${cleanPhone.substring(1)}`
			: cleanPhone;
		window.open(
			`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsappMessage(status))}`,
			"_blank",
		);
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
					<Button
						variant="outline"
						onClick={() =>
							window.open(`/api/services/${service.id}/pdf`, "_blank")
						}
					>
						<FileTextIcon className="mr-2 h-4 w-4" />
						{t("printDocument")}
					</Button>
					<Button variant="outline" onClick={() => setPaymentOpen(true)}>
						{t("receivePayment")}
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
						<div>{t(`type_${service.service_type}` as never)}</div>
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
						<div>
							{service.warranty_unit === "none"
								? t("warrantyNone")
								: `${service.warranty_value ?? 0} ${t(`warranty_${service.warranty_unit}` as never)}`}
						</div>
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
				extraContent={
					<div className="grid gap-3 sm:grid-cols-[180px_1fr]">
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
					</div>
				}
				locale={locale}
				paymentMethods={paymentMethods}
				isPending={receivePayment.isPending}
				onSubmit={({ paymentMethodId, amount }) =>
					receivePayment.mutate({
						id: service.id,
						paymentMethodId,
						amount,
						warrantyUnit,
						warrantyValue:
							warrantyUnit === "none"
								? undefined
								: Number.parseInt(warrantyValue || "0", 10) || undefined,
					})
				}
			/>
		</div>
	);
}
