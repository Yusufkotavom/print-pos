import Dexie, { type Table } from "dexie";

export type LocalProduct = {
	id: number;
	serverId: number;
	name: string;
	sku?: string | null;
	category?: string | null;
	updatedAt: string;
	payload: unknown;
};

export type LocalCustomer = {
	id: number;
	serverId: number;
	name: string;
	phone?: string | null;
	updatedAt: string;
	payload: unknown;
};

export type LocalPaymentMethod = {
	id: number;
	serverId: number;
	name: string;
	updatedAt: string;
	payload: unknown;
};

export type LocalProductCategory = {
	id: number;
	serverId: number;
	name: string;
	updatedAt: string;
	payload: unknown;
};

export type LocalServiceOrder = {
	id: number;
	serverId: number;
	serviceNumber?: string | null;
	customerName?: string | null;
	status: string;
	updatedAt: string;
	payload: unknown;
};

export type LocalOrder = {
	id: number;
	serverId: number;
	orderNumber?: string | null;
	customerName?: string | null;
	status?: string | null;
	paymentStatus?: string | null;
	updatedAt: string;
	payload: unknown;
};

export type LocalTransaction = {
	id: number;
	serverId: number;
	transactionNumber?: string | null;
	description?: string | null;
	type?: string | null;
	status?: string | null;
	updatedAt: string;
	payload: unknown;
};

export type LocalTransactionCategory = {
	id: number;
	serverId: number;
	name: string;
	type?: string | null;
	updatedAt: string;
	payload: unknown;
};

export type LocalDraft = {
	key: string;
	payload: unknown;
	updatedAt: string;
};

export type LocalProductImage = {
	key: string;
	productId: number;
	blob: Blob;
	url?: string;
	updatedAt: string;
};

export type LocalAppMeta = {
	key: string;
	value: unknown;
	updatedAt: string;
};

export type SyncQueueItem = {
	id: string;
	entity:
		| "order"
		| "serviceOrder"
		| "payment"
		| "paymentMethod"
		| "customer"
		| "product"
		| "productCategory"
		| "productImage"
		| "transaction"
		| "transactionCategory";
	operation:
		| "create"
		| "update"
		| "delete"
		| "updateStatus"
		| "receivePayment"
		| "updateWarranty";
	payload: unknown;
	status: "pending" | "syncing" | "success" | "failed" | "conflict";
	retryCount: number;
	errorMessage?: string;
	nextRetryAt?: string;
	createdAt: string;
	updatedAt: string;
};

class FinOpenPOSLocalDB extends Dexie {
	products!: Table<LocalProduct, number>;
	customers!: Table<LocalCustomer, number>;
	paymentMethods!: Table<LocalPaymentMethod, number>;
	productCategories!: Table<LocalProductCategory, number>;
	serviceOrders!: Table<LocalServiceOrder, number>;
	orders!: Table<LocalOrder, number>;
	transactions!: Table<LocalTransaction, number>;
	transactionCategories!: Table<LocalTransactionCategory, number>;
	productImages!: Table<LocalProductImage, string>;
	appMeta!: Table<LocalAppMeta, string>;
	drafts!: Table<LocalDraft, string>;
	syncQueue!: Table<SyncQueueItem, string>;

	constructor() {
		super("finopenpos-local");
		this.version(1).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			drafts: "key, updatedAt",
			syncQueue: "id, entity, operation, status, createdAt, updatedAt",
		});
		this.version(2).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			productImages: "key, productId, updatedAt",
			drafts: "key, updatedAt",
			syncQueue: "id, entity, operation, status, createdAt, updatedAt",
		});
		this.version(3).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			productImages: "key, productId, updatedAt",
			appMeta: "key, updatedAt",
			drafts: "key, updatedAt",
			syncQueue:
				"id, entity, operation, status, nextRetryAt, createdAt, updatedAt",
		});
		this.version(4).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			serviceOrders:
				"id, serverId, serviceNumber, customerName, status, updatedAt",
			productImages: "key, productId, updatedAt",
			appMeta: "key, updatedAt",
			drafts: "key, updatedAt",
			syncQueue:
				"id, entity, operation, status, nextRetryAt, createdAt, updatedAt",
		});
		this.version(5).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			productCategories: "id, serverId, name, updatedAt",
			serviceOrders:
				"id, serverId, serviceNumber, customerName, status, updatedAt",
			productImages: "key, productId, updatedAt",
			appMeta: "key, updatedAt",
			drafts: "key, updatedAt",
			syncQueue:
				"id, entity, operation, status, nextRetryAt, createdAt, updatedAt",
		});
		this.version(6).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			productCategories: "id, serverId, name, updatedAt",
			serviceOrders:
				"id, serverId, serviceNumber, customerName, status, updatedAt",
			orders:
				"id, serverId, orderNumber, customerName, status, paymentStatus, updatedAt",
			transactions:
				"id, serverId, transactionNumber, description, type, status, updatedAt",
			productImages: "key, productId, updatedAt",
			appMeta: "key, updatedAt",
			drafts: "key, updatedAt",
			syncQueue:
				"id, entity, operation, status, nextRetryAt, createdAt, updatedAt",
		});
		this.version(7).stores({
			products: "id, serverId, name, sku, category, updatedAt",
			customers: "id, serverId, name, phone, updatedAt",
			paymentMethods: "id, serverId, name, updatedAt",
			productCategories: "id, serverId, name, updatedAt",
			serviceOrders:
				"id, serverId, serviceNumber, customerName, status, updatedAt",
			orders:
				"id, serverId, orderNumber, customerName, status, paymentStatus, updatedAt",
			transactions:
				"id, serverId, transactionNumber, description, type, status, updatedAt",
			transactionCategories: "id, serverId, name, type, updatedAt",
			productImages: "key, productId, updatedAt",
			appMeta: "key, updatedAt",
			drafts: "key, updatedAt",
			syncQueue:
				"id, entity, operation, status, nextRetryAt, createdAt, updatedAt",
		});
	}
}

export const localDb = new FinOpenPOSLocalDB();
