import type { QueuedSyncHandlers } from "./sync-engine";

type MutationLike = {
	mutateAsync: (payload: never) => Promise<unknown>;
};

export function createQueuedSyncHandlers(trpc: {
	orders: {
		create: MutationLike;
		update: MutationLike;
		receivePayment: MutationLike;
		delete: MutationLike;
	};
	serviceOrders: {
		create: MutationLike;
		update: MutationLike;
		updateStatus: MutationLike;
		receivePayment: MutationLike;
		updateWarranty: MutationLike;
		delete: MutationLike;
	};
	products: {
		create: MutationLike;
		update: MutationLike;
		delete: MutationLike;
	};
	productCategories: {
		create: MutationLike;
		update: MutationLike;
		delete: MutationLike;
	};
	paymentMethods: {
		create: MutationLike;
		update: MutationLike;
		delete: MutationLike;
	};
	customers: {
		create: MutationLike;
		update: MutationLike;
		delete: MutationLike;
	};
	transactions: {
		create: MutationLike;
		update: MutationLike;
		delete: MutationLike;
	};
	transactionCategories: {
		create: MutationLike;
		update: MutationLike;
		delete: MutationLike;
	};
}): QueuedSyncHandlers {
	return {
		createOrder: (payload) =>
			trpc.orders.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updateOrder: (payload) => trpc.orders.update.mutateAsync(payload as never),
		receiveOrderPayment: (payload) =>
			trpc.orders.receivePayment.mutateAsync(payload as never),
		deleteOrder: (payload) => trpc.orders.delete.mutateAsync(payload as never),
		createServiceOrder: (payload) =>
			trpc.serviceOrders.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updateServiceOrder: (payload) =>
			trpc.serviceOrders.update.mutateAsync(payload as never),
		updateServiceOrderStatus: (payload) =>
			trpc.serviceOrders.updateStatus.mutateAsync(payload as never),
		receiveServiceOrderPayment: (payload) =>
			trpc.serviceOrders.receivePayment.mutateAsync(payload as never),
		updateServiceOrderWarranty: (payload) =>
			trpc.serviceOrders.updateWarranty.mutateAsync(payload as never),
		deleteServiceOrder: (payload) =>
			trpc.serviceOrders.delete.mutateAsync(payload as never),
		createProduct: (payload) =>
			trpc.products.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updateProduct: (payload) =>
			trpc.products.update.mutateAsync(payload as never),
		deleteProduct: (payload) =>
			trpc.products.delete.mutateAsync(payload as never),
		updateProductImage: async (payload) => {
			await trpc.products.update.mutateAsync(payload as never);
		},
		createProductCategory: (payload) =>
			trpc.productCategories.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updateProductCategory: (payload) =>
			trpc.productCategories.update.mutateAsync(payload as never),
		deleteProductCategory: (payload) =>
			trpc.productCategories.delete.mutateAsync(payload as never),
		createPaymentMethod: (payload) =>
			trpc.paymentMethods.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updatePaymentMethod: (payload) =>
			trpc.paymentMethods.update.mutateAsync(payload as never),
		deletePaymentMethod: (payload) =>
			trpc.paymentMethods.delete.mutateAsync(payload as never),
		createCustomer: (payload) =>
			trpc.customers.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updateCustomer: (payload) =>
			trpc.customers.update.mutateAsync(payload as never),
		deleteCustomer: (payload) =>
			trpc.customers.delete.mutateAsync(payload as never),
		createTransaction: (payload) =>
			trpc.transactions.create.mutateAsync(payload as never) as Promise<{
				id?: number;
			}>,
		updateTransaction: (payload) =>
			trpc.transactions.update.mutateAsync(payload as never),
		deleteTransaction: (payload) =>
			trpc.transactions.delete.mutateAsync(payload as never),
		createTransactionCategory: (payload) =>
			trpc.transactionCategories.create.mutateAsync(
				payload as never,
			) as Promise<{ id?: number }>,
		updateTransactionCategory: (payload) =>
			trpc.transactionCategories.update.mutateAsync(payload as never),
		deleteTransactionCategory: (payload) =>
			trpc.transactionCategories.delete.mutateAsync(payload as never),
	};
}
