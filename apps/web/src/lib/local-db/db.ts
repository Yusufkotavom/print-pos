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
	entity: "order" | "serviceOrder" | "payment" | "customer" | "productImage";
	operation: "create" | "update" | "delete";
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
	}
}

export const localDb = new FinOpenPOSLocalDB();
