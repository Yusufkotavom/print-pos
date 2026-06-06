import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	customers,
	paymentMethods,
	products,
	serviceOrderItems,
	serviceOrders,
	transactions,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

function formatSequenceNumber(prefix: string, id: number) {
	const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	return `${prefix}-${date}-${String(id).padStart(4, "0")}`;
}

const serviceStatusSchema = z.enum([
	"in_progress",
	"waiting",
	"ready",
	"done",
	"warranty",
]);

const serviceTypeSchema = z.string().min(1).max(100);

const serviceOrderSummarySchema = z.object({
	id: z.number(),
	service_number: z.string().nullable(),
	customer_id: z.number().nullable(),
	service_type: z.string(),
	status: z.string(),
	estimated_done_at: z.date().nullable(),
	customer_note: z.string().nullable(),
	internal_note: z.string().nullable(),
	details_json: z.any().nullable(),
	total_amount: z.number(),
	paid_amount: z.number(),
	payment_status: z.string(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
	warranty_unit: z.string(),
	warranty_value: z.number().nullable(),
	completed_at: z.date().nullable(),
	client_service_order_id: z.string().nullable(),
	customer: z.object({ name: z.string(), phone: z.string() }).nullable(),
});

const serviceOrderDetailSchema = serviceOrderSummarySchema.extend({
	items: z.array(
		z.object({
			id: z.number(),
			product_id: z.number().nullable(),
			line_type: z.string(),
			item_name: z.string(),
			item_type: z.string(),
			quantity: z.number(),
			price: z.number(),
			cost: z.number(),
			note: z.string().nullable(),
		}),
	),
	transactions: z.array(
		z.object({
			id: z.number(),
			amount: z.number(),
			created_at: z.date().nullable(),
			paymentMethod: z.object({ name: z.string() }).nullable(),
		}),
	),
});

export const serviceOrdersRouter = router({
	list: protectedProcedure
		.output(z.array(serviceOrderSummarySchema))
		.query(async ({ ctx }) => {
			return db.query.serviceOrders.findMany({
				where: eq(serviceOrders.user_uid, ctx.user.id),
				with: { customer: { columns: { name: true, phone: true } } },
				orderBy: [desc(serviceOrders.created_at)],
			});
		}),

	get: protectedProcedure
		.input(z.object({ id: z.number() }))
		.output(serviceOrderDetailSchema.nullable())
		.query(async ({ ctx, input }) => {
			const serviceOrder = await db.query.serviceOrders.findFirst({
				where: and(
					eq(serviceOrders.id, input.id),
					eq(serviceOrders.user_uid, ctx.user.id),
				),
				with: {
					customer: { columns: { name: true, phone: true } },
					items: true,
					transactions: {
						columns: { id: true, amount: true, created_at: true },
						with: { paymentMethod: { columns: { name: true } } },
					},
				},
			});
			return serviceOrder ?? null;
		}),

	create: protectedProcedure
		.input(
			z.object({
				clientServiceOrderId: z.string().min(1).max(64).optional(),
				customerId: z.number(),
				serviceType: serviceTypeSchema.default("other"),
				estimatedDoneAt: z.date().optional(),
				customerNote: z.string().optional(),
				internalNote: z.string().optional(),
				details: z.record(z.string(), z.any()).optional(),
				items: z.array(
					z.object({
						id: z.number().optional(),
						quantity: z.number().int().positive(),
						price: z.number().int(),
						name: z.string().optional(),
						lineType: z.enum(["service", "product"]).default("product"),
						note: z.string().optional(),
					}),
				),
				total: z.number().int(),
			}),
		)
		.output(serviceOrderSummarySchema)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				if (input.clientServiceOrderId) {
					const existing = await tx.query.serviceOrders.findFirst({
						where: and(
							eq(
								serviceOrders.client_service_order_id,
								input.clientServiceOrderId,
							),
							eq(serviceOrders.user_uid, ctx.user.id),
						),
						with: { customer: { columns: { name: true, phone: true } } },
					});
					if (existing) return existing;
				}
				const [created] = await tx
					.insert(serviceOrders)
					.values({
						client_service_order_id: input.clientServiceOrderId,
						customer_id: input.customerId,
						service_type: input.serviceType,
						status: "in_progress",
						estimated_done_at: input.estimatedDoneAt,
						customer_note: input.customerNote?.trim() || null,
						internal_note: input.internalNote?.trim() || null,
						details_json: input.details ?? {},
						total_amount: input.total,
						user_uid: ctx.user.id,
					})
					.returning();
				const serviceNumber = formatSequenceNumber("SRV", created.id);
				const [serviceOrder] = await tx
					.update(serviceOrders)
					.set({ service_number: serviceNumber })
					.where(eq(serviceOrders.id, created.id))
					.returning();

				const values = [];
				for (const item of input.items) {
					const [product] = item.id
						? await tx
								.select({
									id: products.id,
									name: products.name,
									cost: products.cost,
									product_type: products.product_type,
									track_stock: products.track_stock,
									in_stock: products.in_stock,
								})
								.from(products)
								.where(
									and(
										eq(products.id, item.id),
										eq(products.user_uid, ctx.user.id),
									),
								)
								.limit(1)
						: [];
					if (item.id && !product) throw new Error("Product not found");
					if (
						product?.product_type === "product" &&
						product.track_stock &&
						product.in_stock < item.quantity
					) {
						throw new Error(`${product.name} has insufficient stock`);
					}
					values.push({
						service_order_id: serviceOrder.id,
						product_id: product?.id,
						line_type: item.lineType,
						item_name: product?.name ?? item.name ?? "Service",
						item_type: product?.product_type ?? item.lineType,
						quantity: item.quantity,
						price: item.price,
						cost: product?.cost ?? 0,
						note: item.note,
					});
				}
				if (values.length) await tx.insert(serviceOrderItems).values(values);

				const customer = await tx.query.customers.findFirst({
					where: eq(customers.id, input.customerId),
					columns: { name: true, phone: true },
				});
				return { ...serviceOrder, customer: customer ?? null };
			});
		}),

	updateStatus: protectedProcedure
		.input(z.object({ id: z.number(), status: serviceStatusSchema }))
		.output(serviceOrderSummarySchema)
		.mutation(async ({ ctx, input }) => {
			const [updated] = await db
				.update(serviceOrders)
				.set({
					status: input.status,
					completed_at: input.status === "done" ? new Date() : null,
				})
				.where(
					and(
						eq(serviceOrders.id, input.id),
						eq(serviceOrders.user_uid, ctx.user.id),
					),
				)
				.returning();
			if (!updated) throw new Error("Service not found");
			const customer = await db.query.customers.findFirst({
				where: eq(customers.id, updated.customer_id ?? 0),
				columns: { name: true, phone: true },
			});
			return { ...updated, customer: customer ?? null };
		}),

	receivePayment: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				paymentMethodId: z.number(),
				amount: z.number().int().positive(),
				warrantyUnit: z.enum(["none", "day", "month", "year"]).default("none"),
				warrantyValue: z.number().int().positive().optional(),
			}),
		)
		.output(serviceOrderSummarySchema)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const serviceOrder = await tx.query.serviceOrders.findFirst({
					where: and(
						eq(serviceOrders.id, input.id),
						eq(serviceOrders.user_uid, ctx.user.id),
					),
				});
				if (!serviceOrder) throw new Error("Service not found");
				const method = await tx.query.paymentMethods.findFirst({
					where: and(
						eq(paymentMethods.id, input.paymentMethodId),
						eq(paymentMethods.user_uid, ctx.user.id),
					),
				});
				if (!method) throw new Error("Payment method not found");

				const paidAmount = serviceOrder.paid_amount + input.amount;
				const paymentStatus =
					paidAmount >= serviceOrder.total_amount
						? "paid"
						: paidAmount > 0
							? "partial"
							: "unpaid";
				const [transaction] = await tx
					.insert(transactions)
					.values({
						service_order_id: serviceOrder.id,
						payment_method_id: input.paymentMethodId,
						amount: input.amount,
						user_uid: ctx.user.id,
						status: "completed",
						category: "selling",
						type: "income",
						description: `Payment for service ${serviceOrder.service_number ?? serviceOrder.id}`,
					})
					.returning();
				await tx
					.update(transactions)
					.set({
						transaction_number: formatSequenceNumber("TRX", transaction.id),
					})
					.where(eq(transactions.id, transaction.id));

				const [updated] = await tx
					.update(serviceOrders)
					.set({
						paid_amount: paidAmount,
						payment_status: paymentStatus,
						warranty_unit: input.warrantyUnit,
						warranty_value:
							input.warrantyUnit === "none"
								? null
								: (input.warrantyValue ?? null),
					})
					.where(eq(serviceOrders.id, serviceOrder.id))
					.returning();
				const customer = await tx.query.customers.findFirst({
					where: eq(customers.id, updated.customer_id ?? 0),
					columns: { name: true, phone: true },
				});
				return { ...updated, customer: customer ?? null };
			});
		}),
});
