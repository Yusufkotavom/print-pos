import { and, asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { serviceTypes } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const serviceTypeSchema = z.object({
	id: z.number(),
	name: z.string(),
	value: z.string(),
	user_uid: z.string(),
	created_at: z.date().nullable(),
});

export const serviceTypesRouter = router({
	list: protectedProcedure
		.input(z.void())
		.output(z.array(serviceTypeSchema))
		.query(async ({ ctx }) =>
			db
				.select()
				.from(serviceTypes)
				.where(eq(serviceTypes.user_uid, ctx.user.id))
				.orderBy(asc(serviceTypes.name)),
		),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				value: z.string().min(1).max(100),
			}),
		)
		.output(serviceTypeSchema)
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.insert(serviceTypes)
				.values({ ...input, user_uid: ctx.user.id })
				.returning();
			return row;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).max(100),
				value: z.string().min(1).max(100),
			}),
		)
		.output(serviceTypeSchema)
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.update(serviceTypes)
				.set({ name: input.name, value: input.value })
				.where(
					and(
						eq(serviceTypes.id, input.id),
						eq(serviceTypes.user_uid, ctx.user.id),
					),
				)
				.returning();
			if (!row) throw new Error("Service type not found");
			return row;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(serviceTypes)
				.where(
					and(
						eq(serviceTypes.id, input.id),
						eq(serviceTypes.user_uid, ctx.user.id),
					),
				);
			return { success: true };
		}),
});
