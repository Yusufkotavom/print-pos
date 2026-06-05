"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@finopenpos/ui/components/chart";
import { Input } from "@finopenpos/ui/components/input";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
	BanknoteIcon,
	CircleDollarSignIcon,
	ReceiptTextIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	WalletCardsIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency, formatShortDate } from "@/lib/utils";

const CHART_COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
];

const cashFlowConfig = {
	salesBooked: { label: "Sales", color: CHART_COLORS[0] },
	cashReceived: { label: "Cash", color: CHART_COLORS[1] },
	expenses: { label: "Expenses", color: CHART_COLORS[2] },
} satisfies ChartConfig;

const productConfig = {
	revenue: { label: "Revenue", color: CHART_COLORS[0] },
	grossProfit: { label: "Gross Profit", color: CHART_COLORS[1] },
} satisfies ChartConfig;

function getMonthRange() {
	const now = new Date();
	const from = new Date(now.getFullYear(), now.getMonth(), 1);
	const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	return {
		from: from.toISOString().split("T")[0] ?? "",
		to: to.toISOString().split("T")[0] ?? "",
	};
}

export default function FinancialReportsPage() {
	const trpc = useTRPC();
	const t = useTranslations("financialReports");
	const locale = useLocale();
	const initialRange = useMemo(() => getMonthRange(), []);
	const [from, setFrom] = useState(initialRange.from);
	const [to, setTo] = useState(initialRange.to);
	const { data, isLoading } = useQuery(
		trpc.financialReports.summary.queryOptions({ from, to }),
	);

	if (isLoading || !data) {
		return <ReportsSkeleton />;
	}

	const netProfitIsPositive = data.totals.netProfit >= 0;

	return (
		<div className="grid min-w-0 flex-1 items-start gap-6 overflow-hidden">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl">{t("title")}</h1>
					<p className="text-muted-foreground text-sm">{t("subtitle")}</p>
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

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<KpiCard
					title={t("salesBooked")}
					value={formatCurrency(data.totals.salesBooked, locale)}
					description={t("salesBookedDescription")}
					icon={<ReceiptTextIcon className="h-4 w-4 text-muted-foreground" />}
				/>
				<KpiCard
					title={t("cashReceived")}
					value={formatCurrency(data.totals.cashReceived, locale)}
					description={t("cashReceivedDescription")}
					icon={<BanknoteIcon className="h-4 w-4 text-muted-foreground" />}
				/>
				<KpiCard
					title={t("expenses")}
					value={formatCurrency(data.totals.expenses, locale)}
					description={t("expensesDescription")}
					icon={<WalletCardsIcon className="h-4 w-4 text-muted-foreground" />}
				/>
				<KpiCard
					title={t("receivables")}
					value={formatCurrency(data.totals.receivables, locale)}
					description={t("receivablesDescription")}
					icon={
						<CircleDollarSignIcon className="h-4 w-4 text-muted-foreground" />
					}
				/>
				<KpiCard
					title={t("estimatedGrossProfit")}
					value={formatCurrency(data.totals.estimatedGrossProfit, locale)}
					description={t("estimatedGrossProfitDescription")}
					icon={<TrendingUpIcon className="h-4 w-4 text-emerald-500" />}
				/>
				<KpiCard
					title={t("netProfit")}
					value={formatCurrency(data.totals.netProfit, locale)}
					description={t("netProfitDescription")}
					className={netProfitIsPositive ? "text-emerald-600" : "text-red-600"}
					icon={
						netProfitIsPositive ? (
							<TrendingUpIcon className="h-4 w-4 text-emerald-500" />
						) : (
							<TrendingDownIcon className="h-4 w-4 text-red-500" />
						)
					}
				/>
			</div>

			<div className="grid min-w-0 gap-6 lg:grid-cols-2">
				<CashFlowChart data={data.cashFlow} />
				<ProductProfitChart data={data.salesByProduct.slice(0, 8)} />
				<BreakdownPieChart
					title={t("salesByCategory")}
					description={t("salesByCategoryDescription")}
					data={data.salesByCategory}
				/>
				<BreakdownPieChart
					title={t("expensesByCategory")}
					description={t("expensesByCategoryDescription")}
					data={data.expensesByCategory}
				/>
				<BreakdownPieChart
					title={t("paymentsByMethod")}
					description={t("paymentsByMethodDescription")}
					data={data.paymentsByMethod}
				/>
			</div>
		</div>
	);
}

function KpiCard({
	title,
	value,
	description,
	icon,
	className,
}: {
	title: string;
	value: string;
	description: string;
	icon: ReactNode;
	className?: string;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className={`font-bold text-2xl ${className ?? ""}`}>{value}</div>
				<p className="text-muted-foreground text-xs">{description}</p>
			</CardContent>
		</Card>
	);
}

function CashFlowChart({
	data,
}: {
	data: {
		date: string;
		salesBooked: number;
		cashReceived: number;
		expenses: number;
	}[];
}) {
	const t = useTranslations("financialReports");
	const locale = useLocale();

	return (
		<Card className="min-w-0 overflow-hidden lg:col-span-2">
			<CardHeader>
				<CardTitle>{t("cashFlow")}</CardTitle>
				<CardDescription>{t("cashFlowDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<EmptyState message={t("noData")} />
				) : (
					<ChartContainer config={cashFlowConfig} className="h-[320px] w-full">
						<AreaChart data={data}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) =>
									formatShortDate(String(value), locale)
								}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatCurrency(Number(value), locale)}
								width={90}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										formatter={(value) => formatCurrency(Number(value), locale)}
									/>
								}
							/>
							<Area
								dataKey="salesBooked"
								type="monotone"
								stroke="var(--color-salesBooked)"
								fill="var(--color-salesBooked)"
								fillOpacity={0.18}
							/>
							<Area
								dataKey="cashReceived"
								type="monotone"
								stroke="var(--color-cashReceived)"
								fill="var(--color-cashReceived)"
								fillOpacity={0.18}
							/>
							<Area
								dataKey="expenses"
								type="monotone"
								stroke="var(--color-expenses)"
								fill="var(--color-expenses)"
								fillOpacity={0.18}
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

function ProductProfitChart({
	data,
}: {
	data: { name: string; revenue: number; grossProfit: number }[];
}) {
	const t = useTranslations("financialReports");
	const locale = useLocale();

	return (
		<Card className="min-w-0 overflow-hidden lg:col-span-2">
			<CardHeader>
				<CardTitle>{t("salesByProduct")}</CardTitle>
				<CardDescription>{t("salesByProductDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<EmptyState message={t("noData")} />
				) : (
					<ChartContainer config={productConfig} className="h-[320px] w-full">
						<BarChart data={data}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="name"
								tickLine={false}
								axisLine={false}
								interval={0}
								angle={-15}
								textAnchor="end"
								height={70}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatCurrency(Number(value), locale)}
								width={90}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										formatter={(value) => formatCurrency(Number(value), locale)}
									/>
								}
							/>
							<Bar
								dataKey="revenue"
								fill="var(--color-revenue)"
								radius={[4, 4, 0, 0]}
							/>
							<Bar
								dataKey="grossProfit"
								fill="var(--color-grossProfit)"
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

function BreakdownPieChart({
	title,
	description,
	data,
}: {
	title: string;
	description: string;
	data: { name: string; value: number }[];
}) {
	const locale = useLocale();
	const t = useTranslations("financialReports");
	const chartConfig: ChartConfig = Object.fromEntries(
		data.map((item, index) => [
			item.name,
			{ label: item.name, color: CHART_COLORS[index % CHART_COLORS.length] },
		]),
	);
	const chartData = data.map((item, index) => ({
		...item,
		fill: CHART_COLORS[index % CHART_COLORS.length],
	}));

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<EmptyState message={t("noData")} />
				) : (
					<ChartContainer
						config={chartConfig}
						className="mx-auto aspect-square max-h-[280px]"
					>
						<PieChart>
							<ChartTooltip
								content={
									<ChartTooltipContent
										nameKey="name"
										formatter={(value) => formatCurrency(Number(value), locale)}
									/>
								}
							/>
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="name"
								innerRadius={60}
								strokeWidth={2}
							>
								{chartData.map((entry) => (
									<Cell key={entry.name} fill={entry.fill} />
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
			{message}
		</div>
	);
}

function ReportsSkeleton() {
	return (
		<div className="grid flex-1 items-start gap-6">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<Card key={index}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-4 w-4" />
						</CardHeader>
						<CardContent>
							<Skeleton className="mb-2 h-8 w-32" />
							<Skeleton className="h-3 w-40" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				{Array.from({ length: 4 }).map((_, index) => (
					<Card key={index}>
						<CardHeader>
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-3 w-48" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-[280px] w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
