"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
	} catch {
		redirect("/signup?error=signup-failed");
	}

	revalidatePath("/admin", "layout");
	redirect("/admin");
}
