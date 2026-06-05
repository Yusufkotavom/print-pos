import { and, asc, between, eq, gte, lte, ne } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	orderItems,
	orders,
	paymentMethods,
	products,
	transactions,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const dateRangeSchema = z.object({
	from: z.string().optional(),
	to: z.string().optional(),
});

const reportPointSchema = z.object({
	date: z.string(),
	salesBooked: z.number(),
	cashReceived: z.number(),
	expenses: z.number(),
	netProfit: z.number(),
});

type ReportPoint = z.infer<typeof reportPointSchema>;

const breakdownSchema = z.object({
	name: z.string(),
	value: z.number(),
});

const productBreakdownSchema = z.object({
	name: z.string(),
	quantity: z.number(),
	revenue: z.number(),
	estimatedCost: z.number(),
	grossProfit: z.number(),
});

function toDateOnly(value: Date | null) {
	if (!value) return "unknown";
	return value.toISOString().split("T")[0] ?? "unknown";
}

function buildDateFilter(
	column: typeof orders.created_at | typeof transactions.created_at,
	from?: string,
	to?: string,
) {
	if (from && to) {
		return between(
			column,
			new Date(`${from}T00:00:00`),
			new Date(`${to}T23:59:59.999`),
		);
	}

	if (from) {
		return gte(column, new Date(`${from}T00:00:00`));
	}

	if (to) {
		return lte(column, new Date(`${to}T23:59:59.999`));
	}

	return undefined;
}

function toBreakdownEntries(data: Record<string, number>) {
	return Object.entries(data)
		.map(([name, value]) => ({ name, value }))
		.sort((a, b) => b.value - a.value);
}

export const financialReportsRouter = router({
	summary: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/reports/financial",
				tags: ["Reports"],
				summary: "Get financial report summary",
			},
		})
		.input(dateRangeSchema.optional())
		.output(
			z.object({
				dateRange: dateRangeSchema,
				totals: z.object({
					salesBooked: z.number(),
					cashReceived: z.number(),
					expenses: z.number(),
					receivables: z.number(),
					estimatedGrossProfit: z.number(),
					netProfit: z.number(),
				}),
				cashFlow: z.array(reportPointSchema),
				expensesByCategory: z.array(breakdownSchema),
				paymentsByMethod: z.array(breakdownSchema),
				salesByCategory: z.array(breakdownSchema),
				salesByProduct: z.array(productBreakdownSchema),
			}),
		)
		.query(async ({ ctx, input }) => {
			const from = input?.from;
			const to = input?.to;
			const uid = ctx.user.id;

			const orderDateFilter = buildDateFilter(orders.created_at, from, to);
			const transactionDateFilter = buildDateFilter(
				transactions.created_at,
				from,
				to,
			);

			const orderConditions = [eq(orders.user_uid, uid)];
			if (orderDateFilter) orderConditions.push(orderDateFilter);

			const transactionConditions = [
				eq(transactions.user_uid, uid),
				eq(transactions.status, "completed"),
			];
			if (transactionDateFilter)
				transactionConditions.push(transactionDateFilter);

			const [orderRows, transactionRows, productRows] = await Promise.all([
				db
					.select({
						id: orders.id,
						status: orders.status,
						total_amount: orders.total_amount,
						paid_amount: orders.paid_amount,
						created_at: orders.created_at,
					})
					.from(orders)
					.where(and(...orderConditions))
					.orderBy(asc(orders.created_at)),
				db
					.select({
						amount: transactions.amount,
						type: transactions.type,
						category: transactions.category,
						created_at: transactions.created_at,
						paymentMethodName: paymentMethods.name,
					})
					.from(transactions)
					.leftJoin(
						paymentMethods,
						eq(transactions.payment_method_id, paymentMethods.id),
					)
					.where(and(...transactionConditions))
					.orderBy(asc(transactions.created_at)),
				db
					.select({
						item_name: orderItems.item_name,
						quantity: orderItems.quantity,
						price: orderItems.price,
						cost: orderItems.cost,
						productCategory: products.category,
					})
					.from(orderItems)
					.innerJoin(orders, eq(orderItems.order_id, orders.id))
					.leftJoin(products, eq(orderItems.product_id, products.id))
					.where(and(...orderConditions, ne(orders.status, "cancelled"))),
			]);

			const validOrders = orderRows.filter(
				(order) => order.status !== "cancelled",
			);
			const incomeTransactions = transactionRows.filter(
				(row) => row.type === "income",
			);
			const expenseTransactions = transactionRows.filter(
				(row) => row.type === "expense",
			);

			const totals = {
				salesBooked: validOrders.reduce(
					(sum, order) => sum + order.total_amount,
					0,
				),
				cashReceived: incomeTransactions.reduce(
					(sum, row) => sum + row.amount,
					0,
				),
				expenses: expenseTransactions.reduce((sum, row) => sum + row.amount, 0),
				receivables: validOrders.reduce(
					(sum, order) =>
						sum + Math.max(order.total_amount - order.paid_amount, 0),
					0,
				),
				estimatedGrossProfit: 0,
				netProfit: 0,
			};

			const cashFlowMap: Record<string, ReportPoint> = {};
			const salesByCategoryMap: Record<string, number> = {};
			const expensesByCategoryMap: Record<string, number> = {};
			const paymentsByMethodMap: Record<string, number> = {};
			const salesByProductMap: Record<
				string,
				z.infer<typeof productBreakdownSchema>
			> = {};

			for (const order of validOrders) {
				const date = toDateOnly(order.created_at);
				cashFlowMap[date] ??= {
					date,
					salesBooked: 0,
					cashReceived: 0,
					expenses: 0,
					netProfit: 0,
				};
				cashFlowMap[date].salesBooked += order.total_amount;
			}

			for (const row of incomeTransactions) {
				const date = toDateOnly(row.created_at);
				cashFlowMap[date] ??= {
					date,
					salesBooked: 0,
					cashReceived: 0,
					expenses: 0,
					netProfit: 0,
				};
				cashFlowMap[date].cashReceived += row.amount;
				paymentsByMethodMap[row.paymentMethodName ?? "Unknown"] =
					(paymentsByMethodMap[row.paymentMethodName ?? "Unknown"] || 0) +
					row.amount;
			}

			for (const row of expenseTransactions) {
				const date = toDateOnly(row.created_at);
				cashFlowMap[date] ??= {
					date,
					salesBooked: 0,
					cashReceived: 0,
					expenses: 0,
					netProfit: 0,
				};
				cashFlowMap[date].expenses += row.amount;
				expensesByCategoryMap[row.category ?? "Uncategorized"] =
					(expensesByCategoryMap[row.category ?? "Uncategorized"] || 0) +
					row.amount;
			}

			for (const row of productRows) {
				const revenue = row.price * row.quantity;
				const estimatedCost = row.cost * row.quantity;
				const grossProfit = revenue - estimatedCost;
				const categoryName = row.productCategory ?? "Uncategorized";
				const productName = row.item_name || "Unknown";

				salesByCategoryMap[categoryName] =
					(salesByCategoryMap[categoryName] || 0) + revenue;

				salesByProductMap[productName] ??= {
					name: productName,
					quantity: 0,
					revenue: 0,
					estimatedCost: 0,
					grossProfit: 0,
				};
				salesByProductMap[productName].quantity += row.quantity;
				salesByProductMap[productName].revenue += revenue;
				salesByProductMap[productName].estimatedCost += estimatedCost;
				salesByProductMap[productName].grossProfit += grossProfit;
				totals.estimatedGrossProfit += grossProfit;
			}

			const cashFlow = Object.values(cashFlowMap)
				.sort((a, b) => a.date.localeCompare(b.date))
				.map((row) => ({
					...row,
					netProfit: row.cashReceived - row.expenses,
				}));

			totals.netProfit = totals.cashReceived - totals.expenses;

			return {
				dateRange: { from, to },
				totals,
				cashFlow,
				expensesByCategory: toBreakdownEntries(expensesByCategoryMap),
				paymentsByMethod: toBreakdownEntries(paymentsByMethodMap),
				salesByCategory: toBreakdownEntries(salesByCategoryMap),
				salesByProduct: Object.values(salesByProductMap).sort(
					(a, b) => b.revenue - a.revenue,
				),
			};
		}),
	incomeStatement: protectedProcedure
		.input(dateRangeSchema.optional())
		.output(
			z.object({
				dateRange: dateRangeSchema,
				revenue: z.number(),
				costOfGoodsSold: z.number(),
				grossProfit: z.number(),
				expenses: z.number(),
				netProfit: z.number(),
				expensesByCategory: z.array(breakdownSchema),
				salesByCategory: z.array(breakdownSchema),
			}),
		)
		.query(async ({ ctx, input }) => {
			const from = input?.from;
			const to = input?.to;
			const orderDateFilter = buildDateFilter(orders.created_at, from, to);
			const transactionDateFilter = buildDateFilter(
				transactions.created_at,
				from,
				to,
			);
			const orderConditions = [
				eq(orders.user_uid, ctx.user.id),
				ne(orders.status, "cancelled"),
			];
			const transactionConditions = [
				eq(transactions.user_uid, ctx.user.id),
				eq(transactions.status, "completed"),
				eq(transactions.type, "expense"),
			];
			if (orderDateFilter) orderConditions.push(orderDateFilter);
			if (transactionDateFilter)
				transactionConditions.push(transactionDateFilter);

			const [itemRows, expenseRows] = await Promise.all([
				db
					.select({
						quantity: orderItems.quantity,
						price: orderItems.price,
						cost: orderItems.cost,
						productCategory: products.category,
					})
					.from(orderItems)
					.innerJoin(orders, eq(orderItems.order_id, orders.id))
					.leftJoin(products, eq(orderItems.product_id, products.id))
					.where(and(...orderConditions)),
				db
					.select({
						amount: transactions.amount,
						category: transactions.category,
					})
					.from(transactions)
					.where(and(...transactionConditions)),
			]);

			const salesByCategoryMap: Record<string, number> = {};
			const expensesByCategoryMap: Record<string, number> = {};
			let revenue = 0;
			let costOfGoodsSold = 0;

			for (const row of itemRows) {
				const itemRevenue = row.price * row.quantity;
				revenue += itemRevenue;
				costOfGoodsSold += row.cost * row.quantity;
				const category = row.productCategory ?? "Uncategorized";
				salesByCategoryMap[category] =
					(salesByCategoryMap[category] || 0) + itemRevenue;
			}

			const expenses = expenseRows.reduce((sum, row) => {
				const category = row.category ?? "Uncategorized";
				expensesByCategoryMap[category] =
					(expensesByCategoryMap[category] || 0) + row.amount;
				return sum + row.amount;
			}, 0);
			const grossProfit = revenue - costOfGoodsSold;

			return {
				dateRange: { from, to },
				revenue,
				costOfGoodsSold,
				grossProfit,
				expenses,
				netProfit: grossProfit - expenses,
				expensesByCategory: toBreakdownEntries(expensesByCategoryMap),
				salesByCategory: toBreakdownEntries(salesByCategoryMap),
			};
		}),
	balanceSheet: protectedProcedure
		.input(z.void())
		.output(
			z.object({
				cash: z.number(),
				receivables: z.number(),
				inventory: z.number(),
				totalAssets: z.number(),
				liabilities: z.number(),
				equity: z.number(),
			}),
		)
		.query(async ({ ctx }) => {
			const [orderRows, transactionRows, productRows] = await Promise.all([
				db
					.select({
						total_amount: orders.total_amount,
						paid_amount: orders.paid_amount,
						status: orders.status,
					})
					.from(orders)
					.where(eq(orders.user_uid, ctx.user.id)),
				db
					.select({ amount: transactions.amount, type: transactions.type })
					.from(transactions)
					.where(
						and(
							eq(transactions.user_uid, ctx.user.id),
							eq(transactions.status, "completed"),
						),
					),
				db
					.select({ cost: products.cost, in_stock: products.in_stock })
					.from(products)
					.where(eq(products.user_uid, ctx.user.id)),
			]);

			const cash = transactionRows.reduce(
				(sum, row) => sum + (row.type === "expense" ? -row.amount : row.amount),
				0,
			);
			const receivables = orderRows
				.filter((order) => order.status !== "cancelled")
				.reduce(
					(sum, order) =>
						sum + Math.max(order.total_amount - order.paid_amount, 0),
					0,
				);
			const inventory = productRows.reduce(
				(sum, row) => sum + row.cost * row.in_stock,
				0,
			);
			const totalAssets = cash + receivables + inventory;
			const liabilities = 0;

			return {
				cash,
				receivables,
				inventory,
				totalAssets,
				liabilities,
				equity: totalAssets - liabilities,
			};
		}),
});
