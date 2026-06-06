import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "./auth-schema";

export const products = pgTable("products", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	description: text("description"),
	price: integer("price").notNull(),
	cost: integer("cost").default(0).notNull(),
	in_stock: integer("in_stock").notNull(),
	track_stock: boolean("track_stock").default(true).notNull(),
	wholesale_price: integer("wholesale_price"),
	wholesale_min_qty: integer("wholesale_min_qty"),
	product_type: varchar("product_type", { length: 20 })
		.default("product")
		.notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	category: varchar("category", { length: 50 }),
	image_url: text("image_url"),
	image_key: varchar("image_key", { length: 255 }),
	image_width: integer("image_width"),
	image_height: integer("image_height"),
	image_blurhash: text("image_blurhash"),
	image_updated_at: timestamp("image_updated_at"),
	created_at: timestamp("created_at").defaultNow(),
});

export const productCategories = pgTable("product_categories", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const serviceTypes = pgTable("service_types", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	value: varchar("value", { length: 100 }).notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 20 }).notNull(),
	address: text("address"),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	status: varchar("status", { length: 20 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
	id: serial("id").primaryKey(),
	order_number: varchar("order_number", { length: 32 }),
	client_order_id: varchar("client_order_id", { length: 64 }).unique(),
	customer_id: integer("customer_id").references(() => customers.id),
	total_amount: integer("total_amount").notNull(),
	note: text("note"),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	status: varchar("status", { length: 20 }),
	paid_amount: integer("paid_amount").default(0).notNull(),
	payment_status: varchar("payment_status", { length: 20 })
		.default("unpaid")
		.notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
	id: serial("id").primaryKey(),
	order_id: integer("order_id").references(() => orders.id),
	product_id: integer("product_id").references(() => products.id, {
		onDelete: "set null",
	}),
	item_name: varchar("item_name", { length: 255 }).default("").notNull(),
	item_type: varchar("item_type", { length: 20 }).default("product").notNull(),
	quantity: integer("quantity").notNull(),
	price: integer("price").notNull(),
	cost: integer("cost").default(0).notNull(),
	note: text("note"),
	created_at: timestamp("created_at").defaultNow(),
});

export const serviceOrders = pgTable("service_orders", {
	id: serial("id").primaryKey(),
	client_service_order_id: varchar("client_service_order_id", {
		length: 64,
	}).unique(),
	service_number: varchar("service_number", { length: 32 }),
	customer_id: integer("customer_id").references(() => customers.id),
	service_type: varchar("service_type", { length: 32 })
		.notNull()
		.default("other"),
	status: varchar("status", { length: 32 }).notNull().default("new"),
	estimated_done_at: timestamp("estimated_done_at"),
	customer_note: text("customer_note"),
	internal_note: text("internal_note"),
	details_json: jsonb("details_json"),
	total_amount: integer("total_amount").notNull().default(0),
	paid_amount: integer("paid_amount").notNull().default(0),
	payment_status: varchar("payment_status", { length: 20 })
		.default("unpaid")
		.notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	created_at: timestamp("created_at").defaultNow(),
	warranty_unit: varchar("warranty_unit", { length: 20 })
		.default("none")
		.notNull(),
	warranty_value: integer("warranty_value"),
	completed_at: timestamp("completed_at"),
});

export const serviceOrderItems = pgTable("service_order_items", {
	id: serial("id").primaryKey(),
	service_order_id: integer("service_order_id").references(
		() => serviceOrders.id,
	),
	product_id: integer("product_id").references(() => products.id, {
		onDelete: "set null",
	}),
	line_type: varchar("line_type", { length: 20 }).notNull().default("service"),
	item_name: varchar("item_name", { length: 255 }).notNull(),
	item_type: varchar("item_type", { length: 20 }).default("product").notNull(),
	quantity: integer("quantity").notNull(),
	price: integer("price").notNull(),
	cost: integer("cost").default(0).notNull(),
	note: text("note"),
	created_at: timestamp("created_at").defaultNow(),
});

export const transactionCategories = pgTable("transaction_categories", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 50 }).notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull().default(""),
	created_at: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
	id: serial("id").primaryKey(),
	transaction_number: varchar("transaction_number", { length: 32 }),
	description: text("description"),
	order_id: integer("order_id").references(() => orders.id),
	service_order_id: integer("service_order_id").references(
		() => serviceOrders.id,
	),
	payment_method_id: integer("payment_method_id").references(
		() => paymentMethods.id,
	),
	amount: integer("amount").notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	type: varchar("type", { length: 20 }),
	category: varchar("category", { length: 100 }),
	status: varchar("status", { length: 20 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const cities = pgTable("cities", {
	id: integer("id").primaryKey(),
	name: varchar("name", { length: 120 }).notNull(),
	state_code: varchar("state_code", { length: 2 }).notNull(),
});

export const companySettings = pgTable("company_settings", {
	id: serial("id").primaryKey(),
	user_uid: varchar("user_uid", { length: 255 }).notNull().unique(),
	company_name: varchar("company_name", { length: 255 }).notNull(),
	trade_name: varchar("trade_name", { length: 255 }),
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 50 }),
	whatsapp: varchar("whatsapp", { length: 50 }),
	website: varchar("website", { length: 255 }),
	address: text("address"),
	currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
	timezone: varchar("timezone", { length: 64 })
		.notNull()
		.default("Asia/Jakarta"),
	receipt_header: text("receipt_header"),
	receipt_footer: text("receipt_footer"),
	invoice_terms: text("invoice_terms"),
	service_terms: text("service_terms"),
	invoice_template: varchar("invoice_template", { length: 20 }).default(
		"standard",
	),
	whatsapp_template: text("whatsapp_template").default(
		"Halo! Pesanan Anda {order_number} telah berhasil diproses. Anda bisa mengecek invoice melalui tautan berikut: {invoice_url} \nTerima kasih!",
	),
	whatsapp_product_information_template: text(
		"whatsapp_product_information_template",
	).default("Produk/Item:\n{product_information}"),
	whatsapp_service_in_progress_template: text(
		"whatsapp_service_in_progress_template",
	).default(
		"Halo {customer_name}, service {service_number} sedang dikerjakan.\n\n{product_information}",
	),
	whatsapp_service_waiting_template: text(
		"whatsapp_service_waiting_template",
	).default(
		"Halo {customer_name}, service {service_number} sedang menunggu proses lanjutan.\n\n{product_information}",
	),
	whatsapp_service_ready_template: text(
		"whatsapp_service_ready_template",
	).default(
		"Halo {customer_name}, service {service_number} sudah siap diambil.\n\n{product_information}",
	),
	whatsapp_service_done_template: text(
		"whatsapp_service_done_template",
	).default(
		"Halo {customer_name}, service {service_number} telah selesai.\n\n{product_information}",
	),
	whatsapp_service_warranty_template: text(
		"whatsapp_service_warranty_template",
	).default(
		"Halo {customer_name}, service {service_number} masuk status garansi.\n\n{product_information}",
	),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
	customer: one(customers, {
		fields: [orders.customer_id],
		references: [customers.id],
	}),
	orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, {
		fields: [orderItems.order_id],
		references: [orders.id],
	}),
	product: one(products, {
		fields: [orderItems.product_id],
		references: [products.id],
	}),
}));

export const serviceOrdersRelations = relations(
	serviceOrders,
	({ one, many }) => ({
		customer: one(customers, {
			fields: [serviceOrders.customer_id],
			references: [customers.id],
		}),
		items: many(serviceOrderItems),
		transactions: many(transactions),
	}),
);

export const serviceOrderItemsRelations = relations(
	serviceOrderItems,
	({ one }) => ({
		serviceOrder: one(serviceOrders, {
			fields: [serviceOrderItems.service_order_id],
			references: [serviceOrders.id],
		}),
		product: one(products, {
			fields: [serviceOrderItems.product_id],
			references: [products.id],
		}),
	}),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
	order: one(orders, {
		fields: [transactions.order_id],
		references: [orders.id],
	}),
	serviceOrder: one(serviceOrders, {
		fields: [transactions.service_order_id],
		references: [serviceOrders.id],
	}),
	paymentMethod: one(paymentMethods, {
		fields: [transactions.payment_method_id],
		references: [paymentMethods.id],
	}),
}));

export const customersRelations = relations(customers, ({ many }) => ({
	orders: many(orders),
	serviceOrders: many(serviceOrders),
}));

export const productsRelations = relations(products, ({ many }) => ({
	orderItems: many(orderItems),
	serviceOrderItems: many(serviceOrderItems),
}));

export const paymentMethodsRelations = relations(
	paymentMethods,
	({ many }) => ({
		transactions: many(transactions),
	}),
);
