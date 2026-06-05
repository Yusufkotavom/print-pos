import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { productCategories } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const categorySchema = z.object({
	id: z.number(),
	name: z.string(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
});

export const productCategoriesRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/product-categories",
				tags: ["Products"],
				summary: "List product categories",
			},
		})
		.input(z.void())
		.output(z.array(categorySchema))
		.query(async ({ ctx }) =>
			db
				.select()
				.from(productCategories)
				.where(eq(productCategories.user_uid, ctx.user.id))
				.orderBy(asc(productCategories.name)),
		),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/product-categories",
				tags: ["Products"],
				summary: "Create product category",
			},
		})
		.input(z.object({ name: z.string().min(1).max(100) }))
		.output(categorySchema)
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.insert(productCategories)
				.values({ name: input.name, user_uid: ctx.user.id })
				.returning();
			return row;
		}),
});
