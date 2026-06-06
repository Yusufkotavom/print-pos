import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	customers,
	orderItems,
	orders,
	products,
	transactions,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

function formatSequenceNumber(prefix: string, id: number) {
	const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	return `${prefix}-${date}-${String(id).padStart(4, "0")}`;
}

const orderWithCustomerSchema = z.object({
	id: z.number(),
	order_number: z.string().nullable(),
	customer_id: z.number().nullable(),
	total_amount: z.number(),
	note: z.string().nullable(),
	status: z.string().nullable(),
	paid_amount: z.number(),
	payment_status: z.string(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
	customer: z.object({ name: z.string() }).nullable(),
});

const orderDetailSchema = z.object({
	id: z.number(),
	order_number: z.string().nullable(),
	customer_id: z.number().nullable(),
	total_amount: z.number(),
	note: z.string().nullable(),
	status: z.string().nullable(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
	paid_amount: z.number(),
	payment_status: z.string(),
	customer: z.object({ name: z.string() }).nullable(),
	orderItems: z.array(
		z.object({
			id: z.number(),
			product_id: z.number().nullable(),
			item_name: z.string(),
			item_type: z.string(),
			quantity: z.number(),
			price: z.number(),
			cost: z.number(),
			note: z.string().nullable(),
			product: z
				.object({
					name: z.string(),
					category: z.string().nullable(),
					product_type: z.string(),
				})
				.nullable(),
		}),
	),
});

export const ordersRouter = router({
	get: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/orders/{id}",
				tags: ["Orders"],
				summary: "Get order details",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(orderDetailSchema.nullable())
		.query(async ({ ctx, input }) => {
			const result = await db.query.orders.findFirst({
				where: and(eq(orders.id, input.id), eq(orders.user_uid, ctx.user.id)),
				with: {
					customer: { columns: { name: true } },
					orderItems: {
						with: {
							product: {
								columns: { name: true, category: true, product_type: true },
							},
						},
					},
				},
			});
			return result ?? null;
		}),

	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/orders",
				tags: ["Orders"],
				summary: "List all orders",
			},
		})
		.input(z.void())
		.output(z.array(orderWithCustomerSchema))
		.query(async ({ ctx }) => {
			return db.query.orders.findMany({
				where: eq(orders.user_uid, ctx.user.id),
				with: {
					customer: {
						columns: { name: true },
					},
				},
			});
		}),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/orders",
				tags: ["Orders"],
				summary: "Create an order with items",
			},
		})
		.input(
			z.object({
				customerId: z.number(),
				paymentMethodId: z.number().optional(),
				note: z.string().optional(),
				products: z.array(
					z.object({
						id: z.number(),
						quantity: z.number().int().positive(),
						price: z.number().int(),
						note: z.string().optional(),
					}),
				),
				total: z.number().int(),
				paidAmount: z.number().int().min(0).optional(),
			}),
		)
		.output(orderWithCustomerSchema)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const paidAmount = input.paidAmount ?? 0;
				const paymentMethodId = input.paymentMethodId;
				if (paidAmount > 0 && !paymentMethodId) {
					throw new Error("Payment method is required");
				}
				const paymentStatus =
					paidAmount >= input.total
						? "paid"
						: paidAmount > 0
							? "partial"
							: "unpaid";

				const [createdOrder] = await tx
					.insert(orders)
					.values({
						customer_id: input.customerId,
						total_amount: input.total,
						note: input.note?.trim() || null,
						paid_amount: paidAmount,
						payment_status: paymentStatus,
						user_uid: ctx.user.id,
						status: paymentStatus === "paid" ? "completed" : "pending",
					})
					.returning();
				const orderNumber = formatSequenceNumber("INV", createdOrder.id);
				const [orderData] = await tx
					.update(orders)
					.set({ order_number: orderNumber })
					.where(eq(orders.id, createdOrder.id))
					.returning();

				const itemValues = [];
				for (const item of input.products) {
					const [product] = await tx
						.select({
							id: products.id,
							name: products.name,
							cost: products.cost,
							product_type: products.product_type,
							track_stock: products.track_stock,
							user_uid: products.user_uid,
							in_stock: products.in_stock,
						})
						.from(products)
						.where(
							and(eq(products.id, item.id), eq(products.user_uid, ctx.user.id)),
						)
						.limit(1);

					if (!product) throw new Error("Product not found");
					if (
						product.product_type === "product" &&
						product.track_stock &&
						product.in_stock < item.quantity
					) {
						throw new Error(`${product.name} has insufficient stock`);
					}

					if (product.product_type === "product" && product.track_stock) {
						await tx
							.update(products)
							.set({ in_stock: sql`${products.in_stock} - ${item.quantity}` })
							.where(eq(products.id, item.id));
					}

					itemValues.push({
						order_id: orderData.id,
						product_id: item.id,
						item_name: product.name,
						item_type: product.product_type,
						quantity: item.quantity,
						price: item.price,
						cost: product.cost,
						note: item.note,
					});
				}

				await tx.insert(orderItems).values(itemValues);

				if (paidAmount > 0) {
					const [createdTransaction] = await tx
						.insert(transactions)
						.values({
							order_id: orderData.id,
							payment_method_id: paymentMethodId,
							amount: paidAmount,
							user_uid: ctx.user.id,
							status: "completed",
							category: "selling",
							type: "income",
							description: `Payment for order ${orderNumber}`,
						})
						.returning();
					await tx
						.update(transactions)
						.set({
							transaction_number: formatSequenceNumber(
								"TRX",
								createdTransaction.id,
							),
						})
						.where(eq(transactions.id, createdTransaction.id));
				}

				const customer = input.customerId
					? await tx.query.customers.findFirst({
							where: eq(customers.id, input.customerId),
							columns: { name: true },
						})
					: null;

				return { ...orderData, customer: customer ?? null };
			});
		}),

	update: protectedProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/orders/{id}",
				tags: ["Orders"],
				summary: "Update an order",
			},
		})
		.input(
			z.object({
				id: z.number(),
				total_amount: z.number().int().optional(),
				status: z.enum(["completed", "pending", "cancelled"]).optional(),
			}),
		)
		.output(orderWithCustomerSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const [updated] = await db
				.update(orders)
				.set({ ...data, user_uid: ctx.user.id })
				.where(and(eq(orders.id, id), eq(orders.user_uid, ctx.user.id)))
				.returning();

			const customer = updated?.customer_id
				? await db.query.customers.findFirst({
						where: eq(customers.id, updated.customer_id),
						columns: { name: true },
					})
				: null;

			return { ...updated, customer: customer ?? null };
		}),

	receivePayment: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/orders/{id}/payments",
				tags: ["Orders"],
				summary: "Add a simple payment to an order",
			},
		})
		.input(
			z.object({
				id: z.number(),
				paymentMethodId: z.number(),
				amount: z.number().int().positive(),
			}),
		)
		.output(orderWithCustomerSchema)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [order] = await tx
					.select()
					.from(orders)
					.where(and(eq(orders.id, input.id), eq(orders.user_uid, ctx.user.id)))
					.limit(1);

				if (!order) throw new Error("Order not found");
				const remainingAmount = order.total_amount - order.paid_amount;
				if (remainingAmount <= 0) throw new Error("Order is already paid");

				const nextPaidAmount =
					order.paid_amount + Math.min(input.amount, remainingAmount);
				const paymentStatus =
					nextPaidAmount >= order.total_amount
						? "paid"
						: nextPaidAmount > 0
							? "partial"
							: "unpaid";
				const status = paymentStatus === "paid" ? "completed" : "pending";

				const [updated] = await tx
					.update(orders)
					.set({
						paid_amount: nextPaidAmount,
						payment_status: paymentStatus,
						status,
					})
					.where(and(eq(orders.id, input.id), eq(orders.user_uid, ctx.user.id)))
					.returning();

				const [createdTransaction] = await tx
					.insert(transactions)
					.values({
						order_id: input.id,
						payment_method_id: input.paymentMethodId,
						amount: nextPaidAmount - order.paid_amount,
						user_uid: ctx.user.id,
						status: "completed",
						category: "selling",
						type: "income",
						description: `Payment for order ${order.order_number ?? `#${input.id}`}`,
					})
					.returning();
				await tx
					.update(transactions)
					.set({
						transaction_number: formatSequenceNumber(
							"TRX",
							createdTransaction.id,
						),
					})
					.where(eq(transactions.id, createdTransaction.id));

				const customer = updated.customer_id
					? await tx.query.customers.findFirst({
							where: eq(customers.id, updated.customer_id),
							columns: { name: true },
						})
					: null;

				return { ...updated, customer: customer ?? null };
			});
		}),
	delete: protectedProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/orders/{id}",
				tags: ["Orders"],
				summary: "Delete an order and its items",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db.transaction(async (tx) => {
				const [order] = await tx
					.select({ id: orders.id })
					.from(orders)
					.where(and(eq(orders.id, input.id), eq(orders.user_uid, ctx.user.id)))
					.limit(1);

				if (!order) return;

				await tx
					.delete(transactions)
					.where(eq(transactions.order_id, input.id));
				await tx.delete(orderItems).where(eq(orderItems.order_id, input.id));
				await tx.delete(orders).where(eq(orders.id, input.id));
			});
			return { success: true };
		}),
});
