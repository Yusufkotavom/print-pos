import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { orderItems, products } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const productTypeSchema = z.enum(["product", "service"]);

const productSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	price: z.number(),
	in_stock: z.number(),
	product_type: z.string(),
	category: z.string().nullable(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
});

export const productsRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/products",
				tags: ["Products"],
				summary: "List all products",
			},
		})
		.input(z.void())
		.output(z.array(productSchema))
		.query(async ({ ctx }) =>
			db.select().from(products).where(eq(products.user_uid, ctx.user.id)),
		),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/products",
				tags: ["Products"],
				summary: "Create a product",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				price: z.number().int(),
				in_stock: z.number().int().min(0),
				product_type: productTypeSchema.default("product"),
				category: z.string().optional(),
			}),
		)
		.output(productSchema)
		.mutation(async ({ ctx, input }) => {
			const [data] = await db
				.insert(products)
				.values({ ...input, user_uid: ctx.user.id })
				.returning();
			return data;
		}),

	update: protectedProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/products/{id}",
				tags: ["Products"],
				summary: "Update a product",
			},
		})
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).optional(),
				description: z.string().optional(),
				price: z.number().int().optional(),
				in_stock: z.number().int().min(0).optional(),
				product_type: productTypeSchema.optional(),
				category: z.string().optional(),
			}),
		)
		.output(productSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const [updated] = await db
				.update(products)
				.set({ ...data, user_uid: ctx.user.id })
				.where(and(eq(products.id, id), eq(products.user_uid, ctx.user.id)))
				.returning();
			return updated;
		}),

	delete: protectedProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/products/{id}",
				tags: ["Products"],
				summary: "Delete a product",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db.transaction(async (tx) => {
				const [ownedProduct] = await tx
					.select({ id: products.id })
					.from(products)
					.where(
						and(eq(products.id, input.id), eq(products.user_uid, ctx.user.id)),
					)
					.limit(1);

				if (!ownedProduct) return;

				await tx
					.update(orderItems)
					.set({ product_id: null })
					.where(eq(orderItems.product_id, input.id));

				await tx
					.delete(products)
					.where(
						and(eq(products.id, input.id), eq(products.user_uid, ctx.user.id)),
					);
			});

			return { success: true };
		}),
});
