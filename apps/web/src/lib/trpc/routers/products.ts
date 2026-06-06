import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { orderItems, productCategories, products } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const productTypeSchema = z.enum(["product", "service"]);

const productSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	price: z.number(),
	cost: z.number().default(0),
	in_stock: z.number(),
	track_stock: z.boolean(),
	wholesale_price: z.number().nullable(),
	wholesale_min_qty: z.number().nullable(),
	product_type: z.string(),
	category: z.string().nullable(),
	image_url: z.string().nullable(),
	image_key: z.string().nullable(),
	image_width: z.number().nullable(),
	image_height: z.number().nullable(),
	image_blurhash: z.string().nullable(),
	image_updated_at: z.date().nullable(),
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
		.query(async ({ ctx }) => {
			return await db
				.select()
				.from(products)
				.where(eq(products.user_uid, ctx.user.id))
				.orderBy(products.name);
		}),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/products",
				tags: ["Products"],
				summary: "Create a new product",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				price: z.number().int(),
				cost: z.number().int().min(0).default(0),
				in_stock: z.number().int().min(0),
				track_stock: z.boolean().default(true),
				product_type: productTypeSchema.default("product"),
				category: z.string().optional(),
				wholesale_price: z.number().int().optional(),
				wholesale_min_qty: z.number().int().optional(),
				image_url: z.string().optional(),
				image_key: z.string().optional(),
				image_width: z.number().int().optional(),
				image_height: z.number().int().optional(),
				image_blurhash: z.string().optional(),
			}),
		)
		.output(productSchema)
		.mutation(async ({ ctx, input }) => {
			const [newProduct] = await db
				.insert(products)
				.values({
					...input,
					image_updated_at: input.image_url ? new Date() : undefined,
					user_uid: ctx.user.id,
				})
				.returning();
			return newProduct;
		}),

	bulkCreate: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/products/bulk",
				tags: ["Products"],
				summary: "Bulk create or update products",
			},
		})
		.input(
			z.array(
				z.object({
					id: z.number().optional(),
					name: z.string().min(1),
					description: z.string().optional(),
					price: z.number().int(),
					cost: z.number().int().min(0).default(0),
					in_stock: z.number().int().min(0),
					track_stock: z.boolean().default(true),
					product_type: productTypeSchema.default("product"),
					category: z.string().optional(),
				}),
			),
		)
		.output(z.object({ count: z.number() }))
		.mutation(async ({ ctx, input }) => {
			if (input.length === 0) return { count: 0 };

			await db.transaction(async (tx) => {
				const uniqueCategories = [
					...new Set(
						input
							.map((i) => i.category)
							.filter((c): c is string => !!c && c.trim() !== ""),
					),
				];

				if (uniqueCategories.length > 0) {
					const existingCategories = await tx
						.select({ name: productCategories.name })
						.from(productCategories)
						.where(
							and(
								eq(productCategories.user_uid, ctx.user.id),
								inArray(productCategories.name, uniqueCategories),
							),
						);

					const existingCategoryNames = existingCategories.map((c) => c.name);
					const missingCategories = uniqueCategories.filter(
						(c) => !existingCategoryNames.includes(c),
					);

					if (missingCategories.length > 0) {
						await tx.insert(productCategories).values(
							missingCategories.map((name) => ({
								name,
								user_uid: ctx.user.id,
							})),
						);
					}
				}

				for (const item of input) {
					if (item.id) {
						await tx
							.update(products)
							.set({
								name: item.name,
								description: item.description,
								price: item.price,
								cost: item.cost,
								in_stock: item.in_stock,
								track_stock: item.track_stock,
								product_type: item.product_type,
								category: item.category,
							})
							.where(
								and(
									eq(products.id, item.id),
									eq(products.user_uid, ctx.user.id),
								),
							);
					} else {
						await tx.insert(products).values({
							name: item.name,
							description: item.description,
							price: item.price,
							cost: item.cost,
							in_stock: item.in_stock,
							track_stock: item.track_stock,
							product_type: item.product_type,
							category: item.category,
							user_uid: ctx.user.id,
						});
					}
				}
			});

			return { count: input.length };
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
				cost: z.number().int().min(0).optional(),
				in_stock: z.number().int().min(0).optional(),
				track_stock: z.boolean().optional(),
				product_type: productTypeSchema.optional(),
				category: z.string().optional(),
				wholesale_price: z.number().int().optional(),
				wholesale_min_qty: z.number().int().optional(),
				image_url: z.string().optional(),
				image_key: z.string().optional(),
				image_width: z.number().int().optional(),
				image_height: z.number().int().optional(),
				image_blurhash: z.string().optional(),
			}),
		)
		.output(productSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const [updated] = await db
				.update(products)
				.set({
					...data,
					image_updated_at:
						data.image_url !== undefined || data.image_key !== undefined
							? new Date()
							: undefined,
					user_uid: ctx.user.id,
				})
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
