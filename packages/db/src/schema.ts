import { relations } from "drizzle-orm";
import {
	integer,
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
	in_stock: integer("in_stock").notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	category: varchar("category", { length: 50 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const productCategories = pgTable("product_categories", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	phone: varchar("phone", { length: 20 }),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	status: varchar("status", { length: 20 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
	id: serial("id").primaryKey(),
	customer_id: integer("customer_id").references(() => customers.id),
	total_amount: integer("total_amount").notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	status: varchar("status", { length: 20 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
	id: serial("id").primaryKey(),
	order_id: integer("order_id").references(() => orders.id),
	product_id: integer("product_id").references(() => products.id, {
		onDelete: "set null",
	}),
	quantity: integer("quantity").notNull(),
	price: integer("price").notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 50 }).notNull().unique(),
	created_at: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
	id: serial("id").primaryKey(),
	description: text("description"),
	order_id: integer("order_id").references(() => orders.id),
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
	tax_id: varchar("tax_id", { length: 20 }).notNull(),
	business_license: varchar("business_license", { length: 20 }).notNull(),
	business_type: integer("business_type").notNull(),
	currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
	timezone: varchar("timezone", { length: 64 })
		.notNull()
		.default("Asia/Jakarta"),
	province_code: varchar("province_code", { length: 2 }).notNull(),
	city_code: varchar("city_code", { length: 20 }).notNull(),
	city_name: varchar("city_name", { length: 100 }).notNull(),
	street: varchar("street", { length: 255 }).notNull(),
	street_number: varchar("street_number", { length: 10 }).notNull(),
	district: varchar("district", { length: 100 }).notNull(),
	postal_code: varchar("postal_code", { length: 10 }).notNull(),
	address_detail: varchar("address_detail", { length: 100 }),
	created_at: timestamp("created_at").defaultNow(),
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

export const transactionsRelations = relations(transactions, ({ one }) => ({
	order: one(orders, {
		fields: [transactions.order_id],
		references: [orders.id],
	}),
	paymentMethod: one(paymentMethods, {
		fields: [transactions.payment_method_id],
		references: [paymentMethods.id],
	}),
}));

export const customersRelations = relations(customers, ({ many }) => ({
	orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
	orderItems: many(orderItems),
}));

export const paymentMethodsRelations = relations(
	paymentMethods,
	({ many }) => ({
		transactions: many(transactions),
	}),
);
