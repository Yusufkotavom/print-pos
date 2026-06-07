import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

const unlimitedFeatures = ["Unlimited access"];
const subscriptionStatusSchema = z.enum([
	"active",
	"paused",
	"expired",
	"cancelled",
]);
const addDays = (date: Date, days: number) => {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
};
const subscriptionWithRelations = {
	user: { columns: { id: true, name: true, email: true } },
	plan: {
		columns: { id: true, name: true, price: true, interval: true },
	},
} as const;

import { db } from "@/lib/db";
import { plans, subscriptions, user } from "@/lib/db/schema";
import { adminProcedure, router } from "../init";

const planSchema = z.object({
	id: z.number(),
	name: z.string(),
	price: z.number(),
	interval: z.string(),
	features: z.array(z.string()),
	status: z.string(),
	created_at: z.date(),
	updated_at: z.date(),
});

const subscriptionSchema = z.object({
	id: z.number(),
	userId: z.string(),
	planId: z.number().nullable(),
	status: z.string(),
	currentPeriodStart: z.date(),
	currentPeriodEnd: z.date(),
	cancelAtPeriodEnd: z.boolean(),
	cancelledAt: z.date().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
	user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
	plan: z
		.object({
			id: z.number(),
			name: z.string(),
			price: z.number(),
			interval: z.string(),
		})
		.nullable(),
});

export const platformSubscriptionsRouter = router({
	listPlans: adminProcedure
		.input(z.void())
		.query(async () =>
			db.query.plans.findMany({ orderBy: desc(plans.created_at) }),
		),
	createPlan: adminProcedure
		.input(
			z.object({
				name: z.string().min(1),
				price: z.number().int().min(0),
				interval: z.enum(["month", "year", "lifetime"]),
				features: z.array(z.string()).default([]),
				status: z.enum(["active", "inactive", "archived"]),
			}),
		)
		.mutation(async ({ input }) => {
			const [created] = await db
				.insert(plans)
				.values({ ...input, features: unlimitedFeatures })
				.returning();
			return created;
		}),
	updatePlan: adminProcedure
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1),
				price: z.number().int().min(0),
				interval: z.enum(["month", "year", "lifetime"]),
				features: z.array(z.string()),
				status: z.enum(["active", "inactive", "archived"]),
			}),
		)
		.mutation(async ({ input }) => {
			const { id, ...data } = input;
			const [updated] = await db
				.update(plans)
				.set({ ...data, features: unlimitedFeatures })
				.where(eq(plans.id, id))
				.returning();
			return updated;
		}),
	deletePlan: adminProcedure
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ input }) => {
			await db.delete(plans).where(eq(plans.id, input.id));
			return { success: true };
		}),
	listSubscriptions: adminProcedure
		.input(z.void())
		.query(async () =>
			db.query.subscriptions.findMany({
				with: {
					user: { columns: { id: true, name: true, email: true } },
					plan: {
						columns: { id: true, name: true, price: true, interval: true },
					},
				},
				orderBy: desc(subscriptions.created_at),
			}),
		),
	createSubscription: adminProcedure
		.input(
			z.object({
				userId: z.string().min(1),
				planId: z.number().nullable(),
				status: subscriptionStatusSchema.default("active"),
				currentPeriodStart: z.date(),
				currentPeriodEnd: z.date(),
				cancelAtPeriodEnd: z.boolean().default(false),
				cancelledAt: z.date().nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const existingActive = await db.query.subscriptions.findFirst({
				where: and(
					eq(subscriptions.userId, input.userId),
					eq(subscriptions.status, "active"),
				),
			});

			if (existingActive) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "UserAlreadyHasSubscription",
				});
			}

			const [created] = await db
				.insert(subscriptions)
				.values({
					...input,
					cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
					cancelledAt: input.cancelledAt ?? null,
				})
				.returning();
			const result = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.id, created.id),
				with: subscriptionWithRelations,
			});
			if (!result) throw new Error("Subscription not found");
			return result;
		}),
	updateSubscription: adminProcedure
		.input(
			z.object({
				id: z.number(),
				userId: z.string().min(1),
				planId: z.number().nullable(),
				status: subscriptionStatusSchema,
				currentPeriodStart: z.date(),
				currentPeriodEnd: z.date(),
				cancelAtPeriodEnd: z.boolean().default(false),
				cancelledAt: z.date().nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const { id, ...data } = input;
			await db
				.update(subscriptions)
				.set({
					...data,
					cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
					cancelledAt: data.cancelledAt ?? null,
				})
				.where(eq(subscriptions.id, id));
			const result = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.id, id),
				with: subscriptionWithRelations,
			});
			if (!result) throw new Error("Subscription not found");
			return result;
		}),
	pauseSubscription: adminProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ input }) => {
			await db
				.update(subscriptions)
				.set({ status: "paused", updated_at: new Date() })
				.where(eq(subscriptions.id, input.id));
			const result = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.id, input.id),
				with: subscriptionWithRelations,
			});
			if (!result) throw new Error("Subscription not found");
			return result;
		}),
	resumeSubscription: adminProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ input }) => {
			await db
				.update(subscriptions)
				.set({ status: "active", updated_at: new Date() })
				.where(eq(subscriptions.id, input.id));
			const result = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.id, input.id),
				with: subscriptionWithRelations,
			});
			if (!result) throw new Error("Subscription not found");
			return result;
		}),
	extendSubscription: adminProcedure
		.input(z.object({ id: z.number(), days: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			const existing = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.id, input.id),
			});
			if (!existing) throw new Error("Subscription not found");
			const now = new Date();
			const baseDate =
				existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
			await db
				.update(subscriptions)
				.set({
					currentPeriodEnd: addDays(baseDate, input.days),
					updated_at: new Date(),
				})
				.where(eq(subscriptions.id, input.id));
			const result = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.id, input.id),
				with: subscriptionWithRelations,
			});
			if (!result) throw new Error("Subscription not found");
			return result;
		}),
	deleteSubscription: adminProcedure
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ input }) => {
			await db.delete(subscriptions).where(eq(subscriptions.id, input.id));
			return { success: true };
		}),
	listUsers: adminProcedure
		.input(z.void())
		.query(async () =>
			db.query.user.findMany({
				columns: { id: true, name: true, email: true },
				orderBy: desc(user.createdAt),
			}),
		),
});
