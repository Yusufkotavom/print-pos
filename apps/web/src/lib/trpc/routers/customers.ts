import { and, eq, ne } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const customerSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string().nullable(),
	phone: z.string(),
	address: z.string().nullable(),
	status: z.string().nullable(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
});

export const customersRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/customers",
				tags: ["Customers"],
				summary: "List all customers",
			},
		})
		.input(z.void())
		.output(z.array(customerSchema))
		.query(async ({ ctx }) => {
			return db
				.select()
				.from(customers)
				.where(eq(customers.user_uid, ctx.user.id));
		}),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/customers",
				tags: ["Customers"],
				summary: "Create a customer",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				email: z.string().email().optional(),
				phone: z.string().min(1),
				address: z.string().optional(),
				status: z.enum(["active", "inactive"]).optional(),
			}),
		)
		.output(customerSchema)
		.mutation(async ({ ctx, input }) => {
			const [existingCustomer] = await db
				.select({ id: customers.id })
				.from(customers)
				.where(
					and(
						eq(customers.user_uid, ctx.user.id),
						eq(customers.phone, input.phone),
					),
				)
				.limit(1);

			if (existingCustomer) {
				throw new Error("Nomor HP sudah ada");
			}

			const [data] = await db
				.insert(customers)
				.values({ ...input, user_uid: ctx.user.id })
				.returning();
			return data;
		}),

	update: protectedProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/customers/{id}",
				tags: ["Customers"],
				summary: "Update a customer",
			},
		})
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).optional(),
				email: z.string().email().optional(),
				phone: z.string().min(1).optional(),
				address: z.string().optional(),
				status: z.enum(["active", "inactive"]).optional(),
			}),
		)
		.output(customerSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			if (data.phone) {
				const [existingCustomer] = await db
					.select({ id: customers.id })
					.from(customers)
					.where(
						and(
							eq(customers.user_uid, ctx.user.id),
							eq(customers.phone, data.phone),
							ne(customers.id, id),
						),
					)
					.limit(1);

				if (existingCustomer) {
					throw new Error("Nomor HP sudah ada");
				}
			}

			const [updated] = await db
				.update(customers)
				.set({ ...data, user_uid: ctx.user.id })
				.where(and(eq(customers.id, id), eq(customers.user_uid, ctx.user.id)))
				.returning();
			return updated;
		}),

	delete: protectedProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/customers/{id}",
				tags: ["Customers"],
				summary: "Delete a customer",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(customers)
				.where(
					and(eq(customers.id, input.id), eq(customers.user_uid, ctx.user.id)),
				);
			return { success: true };
		}),
});
