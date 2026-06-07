import { count, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions, user } from "@/lib/db/schema";
import { createDefaultWorkspace } from "@/lib/onboarding/default-data";
import { adminProcedure, router } from "../init";

const requireSuperAdmin = (role?: string | null) => {
	if (role !== "super_admin") {
		throw new Error("Forbidden");
	}
};

const getSuperAdminCount = async () => {
	const [result] = await db
		.select({ value: count() })
		.from(user)
		.where(eq(user.role, "super_admin"));
	return result?.value ?? 0;
};

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
		.query(async ({ ctx }) => {
			requireSuperAdmin(ctx.user.role);
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
	create: adminProcedure
		.input(
			z.object({
				name: z.string().min(1),
				email: z.email(),
				password: z.string().min(8),
				role: z.enum(["user", "admin", "super_admin"]).default("user"),
				status: z.enum(["active", "inactive", "suspended"]).default("active"),
			}),
		)
		.output(userSchema.omit({ subscription: true }))
		.mutation(async ({ ctx, input }) => {
			requireSuperAdmin(ctx.user.role);
			const existing = await db.query.user.findFirst({
				where: eq(user.email, input.email),
				columns: { id: true },
			});
			if (existing) throw new Error("Email already registered");
			const result = await auth.api.signUpEmail({
				body: {
					name: input.name,
					email: input.email,
					password: input.password,
				},
			});
			await db
				.update(user)
				.set({ role: input.role, status: input.status })
				.where(eq(user.id, result.user.id));
			await createDefaultWorkspace(result.user.id, input.name, input.email);
			const created = await db.query.user.findFirst({
				where: eq(user.id, result.user.id),
				columns: {
					id: true,
					name: true,
					email: true,
					role: true,
					status: true,
					createdAt: true,
				},
			});
			if (!created) throw new Error("User not found");
			return created;
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
		.mutation(async ({ ctx, input }) => {
			requireSuperAdmin(ctx.user.role);
			const { id, ...data } = input;
			const targetUser = await db.query.user.findFirst({
				where: eq(user.id, id),
				columns: { id: true, role: true, status: true },
			});
			if (!targetUser) {
				throw new Error("User not found");
			}
			if (targetUser.id === ctx.user.id) {
				if (data.role && data.role !== "super_admin") {
					throw new Error("Cannot remove your own platform access");
				}
				if (data.status && data.status !== "active") {
					throw new Error("Cannot deactivate your own account");
				}
			}
			if (
				targetUser.role === "super_admin" &&
				((data.role && data.role !== "super_admin") ||
					(data.status && data.status !== "active"))
			) {
				const superAdminCount = await getSuperAdminCount();
				if (superAdminCount <= 1) {
					throw new Error("Cannot remove last super admin");
				}
			}
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
			requireSuperAdmin(ctx.user.role);
			if (input.id === ctx.user.id) {
				throw new Error("Cannot delete your own account");
			}
			const targetUser = await db.query.user.findFirst({
				where: eq(user.id, input.id),
				columns: { id: true, role: true },
			});
			if (!targetUser) {
				throw new Error("User not found");
			}
			if (targetUser.role === "super_admin") {
				const superAdminCount = await getSuperAdminCount();
				if (superAdminCount <= 1) {
					throw new Error("Cannot delete last super admin");
				}
			}
			await db.delete(user).where(eq(user.id, input.id));
			return { success: true };
		}),
});
