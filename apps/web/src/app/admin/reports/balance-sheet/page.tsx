"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

export default function BalanceSheetPage() {
	const trpc = useTRPC();
	const t = useTranslations("financialReports");
	const locale = useLocale();
	const { data, isLoading } = useQuery(
		trpc.financialReports.balanceSheet.queryOptions(),
	);

	if (isLoading || !data) return <BalanceSheetSkeleton />;

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="font-bold text-2xl">{t("balanceSheet")}</h1>
				<p className="text-muted-foreground text-sm">
					{t("balanceSheetDescription")}
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>{t("assets")}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Line label={t("cash")} value={data.cash} locale={locale} />
						<Line
							label={t("receivables")}
							value={data.receivables}
							locale={locale}
						/>
						<Line
							label={t("inventory")}
							value={data.inventory}
							locale={locale}
						/>
						<Line
							label={t("totalAssets")}
							value={data.totalAssets}
							locale={locale}
							strong
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t("liabilitiesAndEquity")}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Line
							label={t("liabilities")}
							value={data.liabilities}
							locale={locale}
						/>
						<Line label={t("equity")} value={data.equity} locale={locale} />
						<Line
							label={t("totalLiabilitiesAndEquity")}
							value={data.liabilities + data.equity}
							locale={locale}
							strong
						/>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("balanceSheetNotes")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-muted-foreground text-sm">
					<p>{t("balanceSheetCashNote")}</p>
					<p>{t("balanceSheetInventoryNote")}</p>
					<p>{t("balanceSheetLiabilityNote")}</p>
				</CardContent>
			</Card>
		</div>
	);
}

function Line({
	label,
	value,
	locale,
	strong,
}: {
	label: string;
	value: number;
	locale: string;
	strong?: boolean;
}) {
	return (
		<div
			className={`flex items-center justify-between border-b pb-3 ${strong ? "font-bold text-lg" : ""}`}
		>
			<span>{label}</span>
			<span>{formatCurrency(value, locale)}</span>
		</div>
	);
}

function BalanceSheetSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-16 w-full" />
			<Skeleton className="h-72 w-full" />
		</div>
	);
}
