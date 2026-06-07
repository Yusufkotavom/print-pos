"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { createDefaultWorkspace } from "@/lib/onboarding/default-data";

export async function signup(formData: FormData) {
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	try {
		const result = await auth.api.signUpEmail({
			body: { email, password, name },
			headers: await headers(),
		});
		await createDefaultWorkspace(result.user.id, name, email);
		const now = new Date();
		const currentPeriodEnd = new Date(now);
		currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 14);
		await db.insert(subscriptions).values({
			userId: result.user.id,
			planId: null,
			status: "active",
			currentPeriodStart: now,
			currentPeriodEnd,
			cancelAtPeriodEnd: false,
			cancelledAt: null,
		});
	} catch (error) {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes("email") && message.includes("exists")) {
				return { error: "emailExists" };
			}
			if (message.includes("password")) {
				return { error: "invalidPassword" };
			}
		}
		return { error: "signupFailed" };
	}

	revalidatePath("/admin", "layout");
	redirect("/admin");
}
