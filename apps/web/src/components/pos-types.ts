export type POSProductItem = {
	id: number;
	name: string;
	price: number;
	in_stock: number;
	track_stock: boolean;
	product_type: string;
	wholesale_price: number | null;
	wholesale_min_qty: number | null;
	category: string;
	quantity: number;
};

export type POSCustomerRef = {
	id: number;
	name: string;
	phone?: string;
};

export type SuccessPOSOrder = {
	id: number;
	order_number: string | null;
	created_at: Date | null;
	total_amount: number;
	paid_amount: number;
	payment_status: string;
	customer: POSCustomerRef | null;
	items: POSProductItem[];
	note?: string | null;
	paymentMethodName?: string;
};

export type PendingPOSOrder = {
	clientOrderId: string;
	customer: POSCustomerRef;
	items: POSProductItem[];
	note: string;
	total: number;
};

export type QueuedPOSOrder = PendingPOSOrder & {
	paymentMethodId: number;
	paidAmount: number;
	createdAt: string;
	status: "pending" | "syncing" | "failed";
	error?: string;
};

export type POSDraft = {
	items: POSProductItem[];
	customer: Pick<POSCustomerRef, "id" | "name"> | null;
	note: string;
};
