"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { FormTextField } from "@finopenpos/ui/components/form-text-field";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@finopenpos/ui/components/tabs";
import { Textarea } from "@finopenpos/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const TIMEZONE_OPTIONS = [
	{ id: "Asia/Jakarta", name: "WIB (Asia/Jakarta)" },
	{ id: "Asia/Makassar", name: "WITA (Asia/Makassar)" },
	{ id: "Asia/Jayapura", name: "WIT (Asia/Jayapura)" },
];

export default function CompanySettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: settings, isLoading } = useQuery(
		trpc.companySettings.get.queryOptions(),
	);
	const t = useTranslations("companySettings");
	const tc = useTranslations("common");

	const upsertMutation = useMutation(
		trpc.companySettings.upsert.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.companySettings.get.queryOptions());
				toast.success(t("saved"));
			},
			onError: () => toast.error(t("saveError")),
		}),
	);

	const form = useForm({
		defaultValues: {
			company_name: settings?.company_name ?? "",
			trade_name: settings?.trade_name ?? "",
			email: settings?.email ?? "",
			phone: settings?.phone ?? "",
			whatsapp: settings?.whatsapp ?? "",
			website: settings?.website ?? "",
			address: settings?.address ?? "",
			currency: settings?.currency ?? "IDR",
			timezone: settings?.timezone ?? "Asia/Jakarta",
			receipt_header: settings?.receipt_header ?? "",
			receipt_footer: settings?.receipt_footer ?? "",
			invoice_terms: settings?.invoice_terms ?? "",
			service_terms: settings?.service_terms ?? "",
			invoice_template: settings?.invoice_template ?? "standard",
			whatsapp_template:
				settings?.whatsapp_template ??
				"Halo! Pesanan Anda {order_number} telah berhasil diproses. Anda bisa mengecek invoice melalui tautan berikut: {invoice_url} \nTerima kasih!",
			whatsapp_product_information_template:
				settings?.whatsapp_product_information_template ??
				"Produk/Item:\n{product_information}",
			whatsapp_service_in_progress_template:
				settings?.whatsapp_service_in_progress_template ?? "",
			whatsapp_service_waiting_template:
				settings?.whatsapp_service_waiting_template ?? "",
			whatsapp_service_ready_template:
				settings?.whatsapp_service_ready_template ?? "",
			whatsapp_service_done_template:
				settings?.whatsapp_service_done_template ?? "",
			whatsapp_service_warranty_template:
				settings?.whatsapp_service_warranty_template ?? "",
		},
		onSubmit: ({ value }) => {
			upsertMutation.mutate({
				company_name: value.company_name,
				trade_name: value.trade_name || undefined,
				email: value.email || undefined,
				phone: value.phone || undefined,
				whatsapp: value.whatsapp || undefined,
				website: value.website || undefined,
				address: value.address || undefined,
				currency: value.currency,
				timezone: value.timezone,
				receipt_header: value.receipt_header || undefined,
				receipt_footer: value.receipt_footer || undefined,
				invoice_terms: value.invoice_terms || undefined,
				service_terms: value.service_terms || undefined,
				invoice_template: value.invoice_template || undefined,
				whatsapp_template: value.whatsapp_template || undefined,
				whatsapp_product_information_template:
					value.whatsapp_product_information_template || undefined,
				whatsapp_service_in_progress_template:
					value.whatsapp_service_in_progress_template || undefined,
				whatsapp_service_waiting_template:
					value.whatsapp_service_waiting_template || undefined,
				whatsapp_service_ready_template:
					value.whatsapp_service_ready_template || undefined,
				whatsapp_service_done_template:
					value.whatsapp_service_done_template || undefined,
				whatsapp_service_warranty_template:
					value.whatsapp_service_warranty_template || undefined,
			});
		},
	});

	useEffect(() => {
		if (!settings) return;
		form.setFieldValue("company_name", settings.company_name ?? "");
		form.setFieldValue("trade_name", settings.trade_name ?? "");
		form.setFieldValue("email", settings.email ?? "");
		form.setFieldValue("phone", settings.phone ?? "");
		form.setFieldValue("whatsapp", settings.whatsapp ?? "");
		form.setFieldValue("website", settings.website ?? "");
		form.setFieldValue("address", settings.address ?? "");
		form.setFieldValue("currency", settings.currency ?? "IDR");
		form.setFieldValue("timezone", settings.timezone ?? "Asia/Jakarta");
		form.setFieldValue("receipt_header", settings.receipt_header ?? "");
		form.setFieldValue("receipt_footer", settings.receipt_footer ?? "");
		form.setFieldValue("invoice_terms", settings.invoice_terms ?? "");
		form.setFieldValue("service_terms", settings.service_terms ?? "");
		form.setFieldValue(
			"invoice_template",
			settings.invoice_template ?? "standard",
		);
		form.setFieldValue(
			"whatsapp_template",
			settings.whatsapp_template ??
				"Halo! Pesanan Anda {order_number} telah berhasil diproses. Anda bisa mengecek invoice melalui tautan berikut: {invoice_url} \nTerima kasih!",
		);
		form.setFieldValue(
			"whatsapp_product_information_template",
			settings.whatsapp_product_information_template ??
				"Produk/Item:\n{product_information}",
		);
		form.setFieldValue(
			"whatsapp_service_in_progress_template",
			settings.whatsapp_service_in_progress_template ?? "",
		);
		form.setFieldValue(
			"whatsapp_service_waiting_template",
			settings.whatsapp_service_waiting_template ?? "",
		);
		form.setFieldValue(
			"whatsapp_service_ready_template",
			settings.whatsapp_service_ready_template ?? "",
		);
		form.setFieldValue(
			"whatsapp_service_done_template",
			settings.whatsapp_service_done_template ?? "",
		);
		form.setFieldValue(
			"whatsapp_service_warranty_template",
			settings.whatsapp_service_warranty_template ?? "",
		);
	}, [form, settings]);

	if (isLoading) return null;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="max-w-3xl space-y-6"
		>
			<Tabs defaultValue="general" className="w-full">
				<TabsList className="mb-6 grid w-full grid-cols-2">
					<TabsTrigger value="general">{t("companyInfo")}</TabsTrigger>
					<TabsTrigger value="documents">{t("documentSettings")}</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("companyInfo")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<form.Field name="company_name">
									{(field) => (
										<FormTextField field={field} label={t("companyName")} />
									)}
								</form.Field>
								<form.Field name="trade_name">
									{(field) => (
										<FormTextField field={field} label={t("tradeName")} />
									)}
								</form.Field>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<form.Field name="email">
									{(field) => (
										<FormTextField field={field} label={tc("email")} />
									)}
								</form.Field>
								<form.Field name="website">
									{(field) => (
										<FormTextField field={field} label={t("website")} />
									)}
								</form.Field>
								<form.Field name="phone">
									{(field) => (
										<FormTextField field={field} label={tc("phone")} />
									)}
								</form.Field>
								<form.Field name="whatsapp">
									{(field) => (
										<FormTextField field={field} label={t("whatsappNumber")} />
									)}
								</form.Field>
							</div>
							<form.Field name="address">
								{(field) => (
									<div className="space-y-2">
										<Label>{t("address")}</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={4}
											placeholder={t("fullAddressPlaceholder")}
										/>
									</div>
								)}
							</form.Field>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("localization")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-2">
							<form.Field name="currency">
								{(field) => (
									<div className="space-y-2">
										<Label>{t("currency")}</Label>
										<Select
											value={field.state.value}
											onValueChange={field.handleChange}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="IDR">
													IDR - Rupiah Indonesia
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
							<form.Field name="timezone">
								{(field) => (
									<div className="space-y-2">
										<Label>{t("timezone")}</Label>
										<Select
											value={field.state.value}
											onValueChange={field.handleChange}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{TIMEZONE_OPTIONS.map((timezone) => (
													<SelectItem key={timezone.id} value={timezone.id}>
														{timezone.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="documents" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("documentSettings")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4">
							<form.Field name="receipt_header">
								{(field) => (
									<FormTextField
										field={field}
										label={t("receiptHeader")}
										placeholder="Contoh: Selamat Datang di Toko Kami!"
									/>
								)}
							</form.Field>
							<form.Field name="receipt_footer">
								{(field) => (
									<FormTextField
										field={field}
										label={t("receiptFooter")}
										placeholder="Contoh: Terima Kasih Atas Kunjungan Anda"
									/>
								)}
							</form.Field>
							<form.Field name="invoice_terms">
								{(field) => (
									<div className="space-y-2">
										<Label>{t("invoiceTerms")}</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={4}
											placeholder={t("invoiceTermsPlaceholder")}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="service_terms">
								{(field) => (
									<div className="space-y-2">
										<Label>{t("serviceTerms")}</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={4}
											placeholder={t("serviceTermsPlaceholder")}
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="invoice_template">
								{(field) => (
									<div className="space-y-2">
										<Label>Template Invoice PDF</Label>
										<div className="flex items-center gap-2">
											<Select
												value={field.state.value}
												onValueChange={field.handleChange}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="standard">
														Standard / Modern
													</SelectItem>
													<SelectItem value="elegant">
														Elegant / Bisnis
													</SelectItem>
													<SelectItem value="minimalist">Minimalist</SelectItem>
													<SelectItem value="receipt">
														Plain / POS Receipt
													</SelectItem>
												</SelectContent>
											</Select>
											<Button
												variant="outline"
												type="button"
												title="Lihat Contoh"
												asChild
											>
												<a
													href={`/api/settings/preview-pdf?template=${field.state.value || "standard"}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													<Eye className="mr-2 h-4 w-4" />
													Lihat
												</a>
											</Button>
										</div>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_template">
								{(field) => (
									<div className="space-y-2">
										<Label>Template WhatsApp Order</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Contoh: Halo! Pesanan Anda {order_number} telah berhasil diproses..."
											rows={4}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_product_information_template">
								{(field) => (
									<div className="space-y-2">
										<Label>Template Product Information</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={3}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_service_in_progress_template">
								{(field) => (
									<div className="space-y-2">
										<Label>WA Service In Progress</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={3}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_service_waiting_template">
								{(field) => (
									<div className="space-y-2">
										<Label>WA Service Waiting</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={3}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_service_ready_template">
								{(field) => (
									<div className="space-y-2">
										<Label>WA Service Ready</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={3}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_service_done_template">
								{(field) => (
									<div className="space-y-2">
										<Label>WA Service Done</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={3}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="whatsapp_service_warranty_template">
								{(field) => (
									<div className="space-y-2">
										<Label>WA Service Warranty</Label>
										<Textarea
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={3}
										/>
									</div>
								)}
							</form.Field>
							<p className="text-muted-foreground text-xs">
								Gunakan{" "}
								<code className="rounded bg-muted px-1">
									{"{order_number}"}
								</code>
								,{" "}
								<code className="rounded bg-muted px-1">{"{invoice_url}"}</code>
								,{" "}
								<code className="rounded bg-muted px-1">
									{"{service_number}"}
								</code>
								,{" "}
								<code className="rounded bg-muted px-1">
									{"{customer_name}"}
								</code>
								, <code className="rounded bg-muted px-1">{"{status}"}</code>,{" "}
								<code className="rounded bg-muted px-1">
									{"{product_information}"}
								</code>
								.
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<div className="flex justify-end">
				<Button type="submit" disabled={upsertMutation.isPending} size="lg">
					{tc("save")}
				</Button>
			</div>
		</form>
	);
}
