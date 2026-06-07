import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	orders,
	paymentMethods,
	payments,
	serviceOrders,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

function formatSequenceNumber(prefix: string, id: number) {
	const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	return `${prefix}-${date}-${String(id).padStart(4, "0")}`;
}

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentDb = typeof db | PaymentTransaction;

export const paymentSchema = z.object({
	id: z.number(),
	payment_number: z.string().nullable(),
	order_id: z.number().nullable(),
	service_order_id: z.number().nullable(),
	payment_method_id: z.number().nullable(),
	amount: z.number(),
	type: z.string(),
	status: z.string(),
	notes: z.string().nullable(),
	paid_at: z.date().nullable(),
	created_at: z.date().nullable(),
	paymentMethod: z.object({ name: z.string() }).nullable().optional(),
});

async function recalculateOrderPayment(tx: PaymentDb, orderId: number) {
	const [summary] = await tx
		.select({
			paid: sql<number>`coalesce(sum(case when ${payments.type} = 'payment' and ${payments.status} = 'completed' then ${payments.amount} when ${payments.type} = 'refund' and ${payments.status} = 'completed' then -${payments.amount} else 0 end), 0)`,
		})
		.from(payments)
		.where(eq(payments.order_id, orderId));
	const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
	if (!order) throw new Error("Order not found");
	const paidAmount = Math.max(0, Number(summary?.paid ?? 0));
	const paymentStatus =
		paidAmount >= order.total_amount
			? "paid"
			: paidAmount > 0
				? "partial"
				: "unpaid";
	const [updated] = await tx
		.update(orders)
		.set({
			paid_amount: paidAmount,
			payment_status: paymentStatus,
			status: paymentStatus === "paid" ? "completed" : "pending",
		})
		.where(eq(orders.id, orderId))
		.returning();
	return updated;
}

async function recalculateServicePayment(
	tx: PaymentDb,
	serviceOrderId: number,
) {
	const [summary] = await tx
		.select({
			paid: sql<number>`coalesce(sum(case when ${payments.type} = 'payment' and ${payments.status} = 'completed' then ${payments.amount} when ${payments.type} = 'refund' and ${payments.status} = 'completed' then -${payments.amount} else 0 end), 0)`,
		})
		.from(payments)
		.where(eq(payments.service_order_id, serviceOrderId));
	const [serviceOrder] = await tx
		.select()
		.from(serviceOrders)
		.where(eq(serviceOrders.id, serviceOrderId));
	if (!serviceOrder) throw new Error("Service not found");
	const paidAmount = Math.max(0, Number(summary?.paid ?? 0));
	const paymentStatus =
		paidAmount >= serviceOrder.total_amount
			? "paid"
			: paidAmount > 0
				? "partial"
				: "unpaid";
	const [updated] = await tx
		.update(serviceOrders)
		.set({ paid_amount: paidAmount, payment_status: paymentStatus })
		.where(eq(serviceOrders.id, serviceOrderId))
		.returning();
	return updated;
}

export const paymentsRouter = router({
	listForOrder: protectedProcedure
		.input(z.object({ orderId: z.number() }))
		.output(z.array(paymentSchema))
		.query(async ({ ctx, input }) => {
			const order = await db.query.orders.findFirst({
				where: and(
					eq(orders.id, input.orderId),
					eq(orders.user_uid, ctx.user.id),
				),
			});
			if (!order) return [];
			return db.query.payments.findMany({
				where: eq(payments.order_id, input.orderId),
				with: { paymentMethod: { columns: { name: true } } },
			});
		}),

	listForService: protectedProcedure
		.input(z.object({ serviceOrderId: z.number() }))
		.output(z.array(paymentSchema))
		.query(async ({ ctx, input }) => {
			const serviceOrder = await db.query.serviceOrders.findFirst({
				where: and(
					eq(serviceOrders.id, input.serviceOrderId),
					eq(serviceOrders.user_uid, ctx.user.id),
				),
			});
			if (!serviceOrder) return [];
			return db.query.payments.findMany({
				where: eq(payments.service_order_id, input.serviceOrderId),
				with: { paymentMethod: { columns: { name: true } } },
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				orderId: z.number().optional(),
				serviceOrderId: z.number().optional(),
				paymentMethodId: z.number(),
				amount: z.number().int().positive(),
				type: z.enum(["payment", "refund"]).default("payment"),
				notes: z.string().optional(),
			}),
		)
		.output(paymentSchema)
		.mutation(async ({ ctx, input }) => {
			if (!input.orderId && !input.serviceOrderId) {
				throw new Error("Order or service is required");
			}
			return db.transaction(async (tx) => {
				const method = await tx.query.paymentMethods.findFirst({
					where: and(
						eq(paymentMethods.id, input.paymentMethodId),
						eq(paymentMethods.user_uid, ctx.user.id),
					),
				});
				if (!method) throw new Error("Payment method not found");
				if (input.orderId) {
					const order = await tx.query.orders.findFirst({
						where: and(
							eq(orders.id, input.orderId),
							eq(orders.user_uid, ctx.user.id),
						),
					});
					if (!order) throw new Error("Order not found");
				}
				if (input.serviceOrderId) {
					const serviceOrder = await tx.query.serviceOrders.findFirst({
						where: and(
							eq(serviceOrders.id, input.serviceOrderId),
							eq(serviceOrders.user_uid, ctx.user.id),
						),
					});
					if (!serviceOrder) throw new Error("Service not found");
				}
				const [created] = await tx
					.insert(payments)
					.values({
						order_id: input.orderId,
						service_order_id: input.serviceOrderId,
						payment_method_id: input.paymentMethodId,
						amount: input.amount,
						type: input.type,
						status: "completed",
						notes: input.notes?.trim() || null,
						user_uid: ctx.user.id,
					})
					.returning();
				const [payment] = await tx
					.update(payments)
					.set({ payment_number: formatSequenceNumber("PAY", created.id) })
					.where(eq(payments.id, created.id))
					.returning();
				if (input.orderId) await recalculateOrderPayment(tx, input.orderId);
				if (input.serviceOrderId) {
					await recalculateServicePayment(tx, input.serviceOrderId);
				}
				return { ...payment, paymentMethod: { name: method.name } };
			});
		}),
});

export { recalculateOrderPayment, recalculateServicePayment };
