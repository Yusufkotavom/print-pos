"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { FormTextField } from "@finopenpos/ui/components/form-text-field";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useTRPC } from "@/lib/trpc/client";

const PROVINCE_OPTIONS = [
	{ id: "AC", name: "Aceh" },
	{ id: "SU", name: "Sumatera Utara" },
	{ id: "SB", name: "Sumatera Barat" },
	{ id: "RI", name: "Riau" },
	{ id: "JA", name: "Jambi" },
	{ id: "SS", name: "Sumatera Selatan" },
	{ id: "BE", name: "Bengkulu" },
	{ id: "LA", name: "Lampung" },
	{ id: "BB", name: "Kepulauan Bangka Belitung" },
	{ id: "KR", name: "Kepulauan Riau" },
	{ id: "JK", name: "DKI Jakarta" },
	{ id: "JB", name: "Jawa Barat" },
	{ id: "JT", name: "Jawa Tengah" },
	{ id: "YO", name: "DI Yogyakarta" },
	{ id: "JI", name: "Jawa Timur" },
	{ id: "BT", name: "Banten" },
	{ id: "BA", name: "Bali" },
	{ id: "NB", name: "Nusa Tenggara Barat" },
	{ id: "NT", name: "Nusa Tenggara Timur" },
	{ id: "KB", name: "Kalimantan Barat" },
	{ id: "KT", name: "Kalimantan Tengah" },
	{ id: "KS", name: "Kalimantan Selatan" },
	{ id: "KI", name: "Kalimantan Timur" },
	{ id: "KU", name: "Kalimantan Utara" },
	{ id: "SA", name: "Sulawesi Utara" },
	{ id: "ST", name: "Sulawesi Tengah" },
	{ id: "SN", name: "Sulawesi Selatan" },
	{ id: "SG", name: "Sulawesi Tenggara" },
	{ id: "GO", name: "Gorontalo" },
	{ id: "SR", name: "Sulawesi Barat" },
	{ id: "MA", name: "Maluku" },
	{ id: "MU", name: "Maluku Utara" },
	{ id: "PA", name: "Papua" },
	{ id: "PB", name: "Papua Barat" },
];

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
	) as { data: any; isLoading: boolean };
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
			tax_id: settings?.tax_id ?? "",
			business_license: settings?.business_license ?? "",
			business_type: String(settings?.business_type ?? 1),
			currency: settings?.currency ?? "IDR",
			timezone: settings?.timezone ?? "Asia/Jakarta",
			province_code: settings?.province_code ?? "JK",
			city_code: settings?.city_code ?? "",
			city_name: settings?.city_name ?? "",
			street: settings?.street ?? "",
			street_number: settings?.street_number ?? "",
			district: settings?.district ?? "",
			postal_code: settings?.postal_code ?? "",
			address_detail: settings?.address_detail ?? "",
		},
		onSubmit: ({ value }) => {
			upsertMutation.mutate({
				company_name: value.company_name,
				trade_name: value.trade_name || undefined,
				tax_id: value.tax_id,
				business_license: value.business_license,
				business_type: Number(value.business_type),
				currency: value.currency,
				timezone: value.timezone,
				province_code: value.province_code,
				city_code: value.city_code,
				city_name: value.city_name,
				street: value.street,
				street_number: value.street_number,
				district: value.district,
				postal_code: value.postal_code,
				address_detail: value.address_detail || undefined,
			});
		},
	});

	useEffect(() => {
		if (!settings) return;

		form.setFieldValue("company_name", settings.company_name ?? "");
		form.setFieldValue("trade_name", settings.trade_name ?? "");
		form.setFieldValue("tax_id", settings.tax_id ?? "");
		form.setFieldValue("business_license", settings.business_license ?? "");
		form.setFieldValue("business_type", String(settings.business_type ?? 1));
		form.setFieldValue("currency", settings.currency ?? "IDR");
		form.setFieldValue("timezone", settings.timezone ?? "Asia/Jakarta");
		form.setFieldValue("province_code", settings.province_code ?? "JK");
		form.setFieldValue("city_code", settings.city_code ?? "");
		form.setFieldValue("city_name", settings.city_name ?? "");
		form.setFieldValue("street", settings.street ?? "");
		form.setFieldValue("street_number", settings.street_number ?? "");
		form.setFieldValue("district", settings.district ?? "");
		form.setFieldValue("postal_code", settings.postal_code ?? "");
		form.setFieldValue("address_detail", settings.address_detail ?? "");
	}, [form, settings]);

	if (isLoading) return null;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-6 max-w-3xl"
		>
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
					<div className="grid gap-4 sm:grid-cols-3">
						<form.Field name="tax_id">
							{(field) => <FormTextField field={field} label={t("taxId")} />}
						</form.Field>
						<form.Field name="business_license">
							{(field) => (
								<FormTextField field={field} label={t("stateTaxId")} />
							)}
						</form.Field>
						<form.Field name="business_type">
							{(field) => (
								<div className="space-y-2">
									<Label>{t("taxRegime")}</Label>
									<Select
										value={field.state.value}
										onValueChange={field.handleChange}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="1">{t("taxRegimeUmkm")}</SelectItem>
											<SelectItem value="2">{t("taxRegimePkP")}</SelectItem>
											<SelectItem value="3">
												{t("taxRegimeEnterprise")}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>
					</div>
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
										<SelectItem value="IDR">IDR - Rupiah Indonesia</SelectItem>
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

			<Card>
				<CardHeader>
					<CardTitle>{t("address")}</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-3">
						<form.Field name="postal_code">
							{(field) => <FormTextField field={field} label={t("zipCode")} />}
						</form.Field>
						<form.Field name="province_code">
							{(field) => (
								<div className="space-y-2">
									<Label>{t("stateCode")}</Label>
									<Select
										value={field.state.value}
										onValueChange={field.handleChange}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PROVINCE_OPTIONS.map((province) => (
												<SelectItem key={province.id} value={province.id}>
													{province.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>
						<form.Field name="city_name">
							{(field) => <FormTextField field={field} label={t("cityName")} />}
						</form.Field>
					</div>
					<form.Field name="city_code">
						{(field) => <FormTextField field={field} label={t("cityCode")} />}
					</form.Field>
					<div className="grid gap-4 sm:grid-cols-4">
						<form.Field name="street">
							{(field) => (
								<div className="space-y-2 sm:col-span-2">
									<Label>{t("street")}</Label>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</div>
							)}
						</form.Field>
						<form.Field name="street_number">
							{(field) => (
								<FormTextField field={field} label={t("streetNumber")} />
							)}
						</form.Field>
						<form.Field name="district">
							{(field) => <FormTextField field={field} label={t("district")} />}
						</form.Field>
					</div>
					<form.Field name="address_detail">
						{(field) => (
							<FormTextField field={field} label={t("addressComplement")} />
						)}
					</form.Field>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button type="submit" disabled={upsertMutation.isPending} size="lg">
					{tc("save")}
				</Button>
			</div>
		</form>
	);
}
