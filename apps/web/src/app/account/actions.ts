"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const updateProfileSchema = z.object({
	name: z.string().min(2).optional(),
});

export async function updateProfile(formData: FormData) {
	const name = formData.get("name") as string;
	
	try {
        const h = await headers();
		const session = await auth.api.getSession({
            headers: h,
        });

		if (!session) {
			return { error: "unauthorized" };
		}

		await auth.api.updateUser({
			headers: h,
			body: { name },
		});
		
		revalidatePath("/account");
		return { success: true };
	} catch (error) {
		return { error: "failedToUpdate" };
	}
}
