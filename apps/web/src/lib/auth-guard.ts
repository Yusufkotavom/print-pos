import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { user } from "./db/schema";

export async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		return null;
	}

	if (session.user.role && session.user.status) {
		return session.user;
	}

	const authUser = await db.query.user.findFirst({
		where: eq(user.id, session.user.id),
		columns: {
			role: true,
			status: true,
		},
	});

	return {
		...session.user,
		role: authUser?.role ?? session.user.role ?? "user",
		status: authUser?.status ?? session.user.status ?? "active",
	};
}
