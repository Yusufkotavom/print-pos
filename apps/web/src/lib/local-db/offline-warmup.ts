import type { QueryClient } from "@tanstack/react-query";
import {
	getAppMeta,
	replaceCachedCustomers,
	replaceCachedOrders,
	replaceCachedPaymentMethods,
	replaceCachedProductCategories,
	replaceCachedProducts,
	replaceCachedServiceOrders,
	replaceCachedTransactionCategories,
	replaceCachedTransactions,
	setAppMeta,
} from "./repo";

export const OFFLINE_WARMUP_LAST_AT_KEY = "offlineWarmup:lastWarmupAt";
export const OFFLINE_WARMUP_SUMMARY_KEY = "offlineWarmup:lastWarmupSummary";
export const OFFLINE_WARMUP_SESSION_KEY = "finopenpos:offline-warmup-session";
export const OFFLINE_WARMUP_INTERVAL_MS = 30 * 60 * 1000;

export const routeShellWarmupTargets = [
	"/admin",
	"/admin/pos",
	"/admin/products",
	"/admin/customers",
	"/admin/payment-methods",
	"/admin/products/categories",
	"/admin/services",
	"/admin/orders",
	"/admin/cashier",
	"/admin/cashier/categories",
	"/admin/company/settings",
	"/admin/sync",
	"/offline",
] as const;

export type OfflineWarmupFailure = {
	target: string;
	message: string;
};

export type OfflineWarmupSummary = {
	startedAt: string;
	finishedAt: string;
	routesWarmed: string[];
	datasetsWarmed: Record<string, number>;
	detailRoutesWarmed: string[];
	failures: OfflineWarmupFailure[];
};

type WarmupQueryOptions = Parameters<QueryClient["fetchQuery"]>[0] & {
	queryKey: readonly unknown[];
};

export type OfflineWarmupQueries = {
	products: WarmupQueryOptions;
	customers: WarmupQueryOptions;
	paymentMethods: WarmupQueryOptions;
	productCategories: WarmupQueryOptions;
	serviceOrders: WarmupQueryOptions;
	orders: WarmupQueryOptions;
	transactions: WarmupQueryOptions;
	transactionCategories: WarmupQueryOptions;
	companySettings?: WarmupQueryOptions;
};

export async function readLastOfflineWarmupSummary() {
	return getAppMeta<OfflineWarmupSummary>(OFFLINE_WARMUP_SUMMARY_KEY);
}

export async function shouldRunAutoOfflineWarmup() {
	if (typeof window === "undefined") return false;
	if (sessionStorage.getItem(OFFLINE_WARMUP_SESSION_KEY) === "1") return false;
	const lastWarmupAt = await getAppMeta<string>(OFFLINE_WARMUP_LAST_AT_KEY);
	if (!lastWarmupAt) return true;
	return (
		Date.now() - new Date(lastWarmupAt).getTime() > OFFLINE_WARMUP_INTERVAL_MS
	);
}

export async function markAutoOfflineWarmupStarted() {
	if (typeof window === "undefined") return;
	sessionStorage.setItem(OFFLINE_WARMUP_SESSION_KEY, "1");
}

export async function warmupOfflineCache({
	queryClient,
	queries,
	detailLimit = 15,
}: {
	queryClient: QueryClient;
	queries: OfflineWarmupQueries;
	detailLimit?: number;
}): Promise<OfflineWarmupSummary> {
	const summary: OfflineWarmupSummary = {
		startedAt: new Date().toISOString(),
		finishedAt: "",
		routesWarmed: [],
		datasetsWarmed: {},
		detailRoutesWarmed: [],
		failures: [],
	};

	await warmupRoutes(
		routeShellWarmupTargets,
		summary.routesWarmed,
		summary.failures,
	);
	const lists = await warmupDataSets(queryClient, queries, summary);
	await warmupRecentDetailRoutes(
		lists.orders,
		lists.serviceOrders,
		detailLimit,
		summary,
	);

	summary.finishedAt = new Date().toISOString();
	await setAppMeta(OFFLINE_WARMUP_LAST_AT_KEY, summary.finishedAt);
	await setAppMeta(OFFLINE_WARMUP_SUMMARY_KEY, summary);
	return summary;
}

async function warmupRoutes(
	routes: readonly string[],
	routesWarmed: string[],
	failures: OfflineWarmupFailure[],
) {
	await Promise.all(
		routes.map(async (route) => {
			try {
				const response = await fetch(route, {
					method: "GET",
					credentials: "same-origin",
					cache: "reload",
				});
				if (!response.ok)
					throw new Error(`${response.status} ${response.statusText}`);
				routesWarmed.push(route);
			} catch (error) {
				failures.push({ target: route, message: errorMessage(error) });
			}
		}),
	);
}

async function warmupDataSets(
	queryClient: QueryClient,
	queries: OfflineWarmupQueries,
	summary: OfflineWarmupSummary,
) {
	const lists: { orders: unknown[]; serviceOrders: unknown[] } = {
		orders: [],
		serviceOrders: [],
	};
	const steps = [
		["products", queries.products, replaceCachedProducts],
		["customers", queries.customers, replaceCachedCustomers],
		["paymentMethods", queries.paymentMethods, replaceCachedPaymentMethods],
		[
			"productCategories",
			queries.productCategories,
			replaceCachedProductCategories,
		],
		["serviceOrders", queries.serviceOrders, replaceCachedServiceOrders],
		["orders", queries.orders, replaceCachedOrders],
		["transactions", queries.transactions, replaceCachedTransactions],
		[
			"transactionCategories",
			queries.transactionCategories,
			replaceCachedTransactionCategories,
		],
	] as const;

	for (const [name, options, save] of steps) {
		try {
			const data = await queryClient.fetchQuery(options);
			const rows = Array.isArray(data) ? data : [];
			await save(rows);
			summary.datasetsWarmed[name] = rows.length;
			if (name === "orders") lists.orders = rows;
			if (name === "serviceOrders") lists.serviceOrders = rows;
		} catch (error) {
			summary.failures.push({ target: name, message: errorMessage(error) });
		}
	}

	if (queries.companySettings) {
		try {
			const settings = await queryClient.fetchQuery(queries.companySettings);
			await setAppMeta("companySettings", settings);
			summary.datasetsWarmed.companySettings = settings ? 1 : 0;
		} catch (error) {
			summary.failures.push({
				target: "companySettings",
				message: errorMessage(error),
			});
		}
	}

	return lists;
}

async function warmupRecentDetailRoutes(
	orders: unknown[],
	serviceOrders: unknown[],
	detailLimit: number,
	summary: OfflineWarmupSummary,
) {
	const routes = [
		...newestIds(orders, detailLimit).map((id) => `/admin/orders/${id}`),
		...newestIds(serviceOrders, detailLimit).map(
			(id) => `/admin/services/${id}`,
		),
	];
	await warmupRoutes(routes, summary.detailRoutesWarmed, summary.failures);
}

function newestIds(rows: unknown[], limit: number) {
	return [...rows]
		.sort((a, b) => timestamp(b) - timestamp(a))
		.map((row) => (row as { id?: number }).id)
		.filter((id): id is number => typeof id === "number" && id > 0)
		.slice(0, limit);
}

function timestamp(row: unknown) {
	const value = row as { updated_at?: string; created_at?: string };
	return new Date(value.updated_at ?? value.created_at ?? 0).getTime();
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Warmup failed";
}
