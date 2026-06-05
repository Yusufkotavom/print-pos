"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

function getMonthRange() {
	const now = new Date();
	const from = new Date(now.getFullYear(), now.getMonth(), 1);
	const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	return {
		from: from.toISOString().split("T")[0] ?? "",
		to: to.toISOString().split("T")[0] ?? "",
	};
}

export default function IncomeStatementPage() {
	const trpc = useTRPC();
	const t = useTranslations("financialReports");
	const locale = useLocale();
	const initialRange = useMemo(() => getMonthRange(), []);
	const [from, setFrom] = useState(initialRange.from);
	const [to, setTo] = useState(initialRange.to);
	const { data, isLoading } = useQuery(
		trpc.financialReports.incomeStatement.queryOptions({ from, to }),
	);

	if (isLoading || !data) return <IncomeStatementSkeleton />;

	return (
		<div className="grid gap-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl">{t("incomeStatement")}</h1>
					<p className="text-muted-foreground text-sm">
						{t("incomeStatementDescription")}
					</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
					<Input
						type="date"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
					/>
					<Input
						type="date"
						value={to}
						onChange={(e) => setTo(e.target.value)}
					/>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							setFrom("");
							setTo("");
						}}
					>
						{t("allTime")}
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("incomeStatement")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<ReportLine
						label={t("revenue")}
						value={data.revenue}
						locale={locale}
					/>
					<ReportLine
						label={t("costOfGoodsSold")}
						value={-data.costOfGoodsSold}
						locale={locale}
					/>
					<ReportLine
						label={t("grossProfit")}
						value={data.grossProfit}
						locale={locale}
						emphasized
					/>
					<ReportLine
						label={t("operatingExpenses")}
						value={-data.expenses}
						locale={locale}
					/>
					<ReportLine
						label={t("netProfit")}
						value={data.netProfit}
						locale={locale}
						strong
					/>
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<BreakdownCard
					title={t("salesByCategory")}
					data={data.salesByCategory}
					locale={locale}
				/>
				<BreakdownCard
					title={t("expensesByCategory")}
					data={data.expensesByCategory}
					locale={locale}
				/>
			</div>
		</div>
	);
}

function ReportLine({
	label,
	value,
	locale,
	emphasized,
	strong,
}: {
	label: string;
	value: number;
	locale: string;
	emphasized?: boolean;
	strong?: boolean;
}) {
	return (
		<div
			className={`flex items-center justify-between border-b pb-3 ${strong ? "font-bold text-lg" : emphasized ? "font-semibold" : ""}`}
		>
			<span>{label}</span>
			<span className={value < 0 ? "text-red-600" : ""}>
				{formatCurrency(value, locale)}
			</span>
		</div>
	);
}

function BreakdownCard({
	title,
	data,
	locale,
}: {
	title: string;
	data: { name: string; value: number }[];
	locale: string;
}) {
	const t = useTranslations("financialReports");
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{data.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("noData")}</p>
				) : (
					data.map((item) => (
						<div
							key={item.name}
							className="flex items-center justify-between gap-4 text-sm"
						>
							<span>{item.name}</span>
							<span className="font-medium">
								{formatCurrency(item.value, locale)}
							</span>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function IncomeStatementSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-16 w-full" />
			<Skeleton className="h-72 w-full" />
		</div>
	);
}
