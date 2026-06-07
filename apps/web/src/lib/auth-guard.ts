import { and, desc, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { subscriptions, user } from "./db/schema";

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

	return {
		...session.user,
		role,
		status,
		isPlatformAdmin,
		hasActiveSubscription: Boolean(activeSubscription),
	};
}
