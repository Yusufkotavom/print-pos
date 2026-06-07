import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { subscriptions, user } from "@/lib/db/schema";
import { adminProcedure, router } from "../init";

const userSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	role: z.string(),
	status: z.string(),
	createdAt: z.date(),
	subscription: z
		.object({
			id: z.number(),
			status: z.string(),
			currentPeriodEnd: z.date(),
			plan: z
				.object({
					id: z.number(),
					name: z.string(),
					price: z.number(),
					interval: z.string(),
				})
				.nullable(),
		})
		.nullable(),
});

export const platformAdminUsersRouter = router({
	list: adminProcedure
		.input(z.void())
		.output(z.array(userSchema))
		.query(async () => {
			const users = await db.query.user.findMany({
				orderBy: desc(user.createdAt),
			});
			const allSubscriptions = await db.query.subscriptions.findMany({
				with: { plan: true },
				orderBy: desc(subscriptions.created_at),
			});
			const latestByUser = new Map<string, (typeof allSubscriptions)[number]>();
			for (const subscription of allSubscriptions) {
				if (!latestByUser.has(subscription.userId)) {
					latestByUser.set(subscription.userId, subscription);
				}
			}
			return users.map((item) => {
				const subscription = latestByUser.get(item.id) ?? null;
				return {
					id: item.id,
					name: item.name,
					email: item.email,
					role: item.role,
					status: item.status,
					createdAt: item.createdAt,
					subscription: subscription
						? {
								id: subscription.id,
								status: subscription.status,
								currentPeriodEnd: subscription.currentPeriodEnd,
								plan: subscription.plan
									? {
											id: subscription.plan.id,
											name: subscription.plan.name,
											price: subscription.plan.price,
											interval: subscription.plan.interval,
										}
									: null,
							}
						: null,
				};
			});
		}),
	update: adminProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				role: z.enum(["user", "admin", "super_admin"]).optional(),
				status: z.enum(["active", "inactive", "suspended"]).optional(),
			}),
		)
		.output(userSchema.omit({ subscription: true }))
		.mutation(async ({ input }) => {
			const { id, ...data } = input;
			const [updated] = await db
				.update(user)
				.set(data)
				.where(eq(user.id, id))
				.returning({
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
					status: user.status,
					createdAt: user.createdAt,
				});
			return updated;
		}),
	delete: adminProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (input.id === ctx.user.id) {
				throw new Error("Cannot delete your own account");
			}
			await db.delete(user).where(eq(user.id, input.id));
			return { success: true };
		}),
});
