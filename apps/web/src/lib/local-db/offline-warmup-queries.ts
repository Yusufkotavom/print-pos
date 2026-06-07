import type { OfflineWarmupQueries } from "./offline-warmup";

type QueryFactory<T> = {
	queryOptions: (...args: unknown[]) => T;
};

type WarmupTrpcLike = {
	products: { list: QueryFactory<OfflineWarmupQueries["products"]> };
	customers: { list: QueryFactory<OfflineWarmupQueries["customers"]> };
	paymentMethods: {
		list: QueryFactory<OfflineWarmupQueries["paymentMethods"]>;
	};
	productCategories: {
		list: QueryFactory<OfflineWarmupQueries["productCategories"]>;
	};
	serviceOrders: { list: QueryFactory<OfflineWarmupQueries["serviceOrders"]> };
	orders: { list: QueryFactory<OfflineWarmupQueries["orders"]> };
	transactions: { list: QueryFactory<OfflineWarmupQueries["transactions"]> };
	transactionCategories: {
		list: QueryFactory<OfflineWarmupQueries["transactionCategories"]>;
	};
	companySettings: {
		get: QueryFactory<NonNullable<OfflineWarmupQueries["companySettings"]>>;
	};
};

export function createOfflineWarmupQueries(
	trpc: WarmupTrpcLike,
): OfflineWarmupQueries {
	return {
		products: trpc.products.list.queryOptions(),
		customers: trpc.customers.list.queryOptions(),
		paymentMethods: trpc.paymentMethods.list.queryOptions(),
		productCategories: trpc.productCategories.list.queryOptions(),
		serviceOrders: trpc.serviceOrders.list.queryOptions(),
		orders: trpc.orders.list.queryOptions(),
		transactions: trpc.transactions.list.queryOptions(),
		transactionCategories: trpc.transactionCategories.list.queryOptions(),
		companySettings: trpc.companySettings.get.queryOptions(),
	};
}
