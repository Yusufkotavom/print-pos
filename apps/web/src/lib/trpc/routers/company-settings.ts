import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { companySettings } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

export const companySettingsRouter = router({
	get: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/company-settings",
				tags: ["Company"],
				summary: "Get company settings",
			},
		})
		.input(z.void())
		.output(z.any())
		.query(async ({ ctx }) => {
			const result = await db
				.select()
				.from(companySettings)
				.where(eq(companySettings.user_uid, ctx.user.id))
				.limit(1);

			return result[0] ?? null;
		}),

	upsert: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/company-settings",
				tags: ["Company"],
				summary: "Create or update company settings",
			},
		})
		.input(
			z.object({
				company_name: z.string().min(1),
				trade_name: z.string().optional(),
				tax_id: z.string().min(8).max(20),
				business_license: z.string().min(1).max(20),
				business_type: z.number().int().min(1).max(3),
				currency: z.string().length(3),
				timezone: z.string().min(1),
				province_code: z.string().length(2),
				city_code: z.string().min(1).max(20),
				city_name: z.string().min(1),
				street: z.string().min(1),
				street_number: z.string().min(1),
				district: z.string().min(1),
				postal_code: z.string().min(4).max(10),
				address_detail: z.string().optional(),
				receipt_header: z.string().optional(),
				receipt_footer: z.string().optional(),
				invoice_terms: z.string().optional(),
				invoice_template: z.string().optional(),
			}),
		)
		.output(z.object({ success: z.boolean(), id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await db
				.select({ id: companySettings.id })
				.from(companySettings)
				.where(eq(companySettings.user_uid, ctx.user.id))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(companySettings)
					.set({ ...input, updated_at: new Date() })
					.where(eq(companySettings.user_uid, ctx.user.id));

				return { success: true, id: existing[0].id };
			}

			const [row] = await db
				.insert(companySettings)
				.values({ user_uid: ctx.user.id, ...input })
				.returning({ id: companySettings.id });

			return { success: true, id: row.id };
		}),
});
