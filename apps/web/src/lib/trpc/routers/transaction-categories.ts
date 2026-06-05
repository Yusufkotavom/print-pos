import { and, asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { transactionCategories } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const transactionCategorySchema = z.object({
	id: z.number(),
	name: z.string(),
	type: z.string(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
});

export const transactionCategoriesRouter = router({
	list: protectedProcedure
		.input(
			z.object({ type: z.enum(["income", "expense"]).optional() }).optional(),
		)
		.output(z.array(transactionCategorySchema))
		.query(async ({ ctx, input }) => {
			const conditions = [eq(transactionCategories.user_uid, ctx.user.id)];

			if (input?.type) {
				conditions.push(eq(transactionCategories.type, input.type));
			}

			return db
				.select()
				.from(transactionCategories)
				.where(and(...conditions))
				.orderBy(
					asc(transactionCategories.type),
					asc(transactionCategories.name),
				);
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				type: z.enum(["income", "expense"]),
			}),
		)
		.output(transactionCategorySchema)
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.insert(transactionCategories)
				.values({ name: input.name, type: input.type, user_uid: ctx.user.id })
				.returning();
			return row;
		}),
	update: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).max(100),
				type: z.enum(["income", "expense"]),
			}),
		)
		.output(transactionCategorySchema)
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.update(transactionCategories)
				.set({ name: input.name, type: input.type })
				.where(
					and(
						eq(transactionCategories.id, input.id),
						eq(transactionCategories.user_uid, ctx.user.id),
					),
				)
				.returning();
			return row;
		}),
	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(transactionCategories)
				.where(
					and(
						eq(transactionCategories.id, input.id),
						eq(transactionCategories.user_uid, ctx.user.id),
					),
				);
			return { success: true };
		}),
});
