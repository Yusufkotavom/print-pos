import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { paymentMethods, transactions } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const paymentMethodSchema = z.object({
	id: z.number(),
	name: z.string(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
});

export const paymentMethodsRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/payment-methods",
				tags: ["Payment Methods"],
				summary: "List all payment methods",
			},
		})
		.input(z.void())
		.output(z.array(paymentMethodSchema))
		.query(async ({ ctx }) => {
			return db
				.select()
				.from(paymentMethods)
				.where(eq(paymentMethods.user_uid, ctx.user.id));
		}),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/payment-methods",
				tags: ["Payment Methods"],
				summary: "Create a payment method",
			},
		})
		.input(z.object({ name: z.string().min(1) }))
		.output(paymentMethodSchema)
		.mutation(async ({ ctx, input }) => {
			const name = input.name.trim();
			const existing = await db
				.select({ id: paymentMethods.id })
				.from(paymentMethods)
				.where(
					and(
						eq(paymentMethods.user_uid, ctx.user.id),
						eq(paymentMethods.name, name),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				throw new Error("Payment method already exists");
			}

			const [data] = await db
				.insert(paymentMethods)
				.values({ name, user_uid: ctx.user.id })
				.returning();
			return data;
		}),

	update: protectedProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/payment-methods/{id}",
				tags: ["Payment Methods"],
				summary: "Update a payment method",
			},
		})
		.input(z.object({ id: z.number(), name: z.string().min(1) }))
		.output(paymentMethodSchema)
		.mutation(async ({ ctx, input }) => {
			const name = input.name.trim();
			const existing = await db
				.select({ id: paymentMethods.id })
				.from(paymentMethods)
				.where(
					and(
						eq(paymentMethods.user_uid, ctx.user.id),
						eq(paymentMethods.name, name),
					),
				)
				.limit(1);

			if (existing.some((row) => row.id !== input.id)) {
				throw new Error("Payment method already exists");
			}

			const [data] = await db
				.update(paymentMethods)
				.set({ name })
				.where(
					and(
						eq(paymentMethods.id, input.id),
						eq(paymentMethods.user_uid, ctx.user.id),
					),
				)
				.returning();
			return data;
		}),

	delete: protectedProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/payment-methods/{id}",
				tags: ["Payment Methods"],
				summary: "Delete a payment method",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const existingTransactions = await db
				.select({ id: transactions.id })
				.from(transactions)
				.where(eq(transactions.payment_method_id, input.id))
				.limit(1);

			if (existingTransactions.length > 0) {
				throw new Error("Payment method already used in transactions");
			}

			await db
				.delete(paymentMethods)
				.where(
					and(
						eq(paymentMethods.id, input.id),
						eq(paymentMethods.user_uid, ctx.user.id),
					),
				);
			return { success: true };
		}),
});
