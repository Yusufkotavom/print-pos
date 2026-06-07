import { and, desc, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { plans, subscriptions, user } from "./db/schema";

export async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		return null;
	}

	const authUser = await db.query.user.findFirst({
		where: eq(user.id, session.user.id),
		columns: {
			role: true,
			status: true,
		},
	});
	const activeSubscription = await db.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.userId, session.user.id),
			eq(subscriptions.status, "active"),
			gt(subscriptions.currentPeriodEnd, new Date()),
		),
		orderBy: desc(subscriptions.currentPeriodEnd),
		columns: { id: true },
	});
	const sessionUser = session.user as typeof session.user & {
		role?: string;
		status?: string;
	};
	const role = authUser?.role ?? sessionUser.role ?? "user";
	const status = authUser?.status ?? sessionUser.status ?? "active";
	const isPlatformAdmin = role === "super_admin";
	let hasActiveSubscription = Boolean(activeSubscription);
	if (!isPlatformAdmin && status === "active" && !hasActiveSubscription) {
		const now = new Date();
		const currentPeriodEnd = new Date(now);
		currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
		const [existingPlan] = await db
			.select({ id: plans.id })
			.from(plans)
			.where(eq(plans.name, "Trial"))
			.limit(1);
		let planId = existingPlan?.id;
		if (!planId) {
			const [trialPlan] = await db
				.insert(plans)
				.values({
					name: "Trial",
					price: 0,
					interval: "month",
					features: ["Unlimited access"],
					status: "active",
				})
				.returning({ id: plans.id });
			planId = trialPlan?.id;
		}
		await db.insert(subscriptions).values({
			userId: session.user.id,
			planId,
			status: "active",
			currentPeriodStart: now,
			currentPeriodEnd,
		});
		hasActiveSubscription = true;
	}

	return {
		...session.user,
		role,
		status,
		isPlatformAdmin,
		hasActiveSubscription,
	};
}
