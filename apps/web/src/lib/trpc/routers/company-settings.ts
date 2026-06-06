import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { companySettings } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const companySettingsSchema = z.object({
	id: z.number(),
	user_uid: z.string(),
	company_name: z.string(),
	trade_name: z.string().nullable(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	whatsapp: z.string().nullable(),
	website: z.string().nullable(),
	address: z.string().nullable(),
	currency: z.string(),
	timezone: z.string(),
	receipt_header: z.string().nullable(),
	receipt_footer: z.string().nullable(),
	invoice_terms: z.string().nullable(),
	service_terms: z.string().nullable(),
	invoice_template: z.string().nullable(),
	whatsapp_template: z.string().nullable(),
	whatsapp_product_information_template: z.string().nullable(),
	whatsapp_service_in_progress_template: z.string().nullable(),
	whatsapp_service_waiting_template: z.string().nullable(),
	whatsapp_service_ready_template: z.string().nullable(),
	whatsapp_service_done_template: z.string().nullable(),
	whatsapp_service_warranty_template: z.string().nullable(),
	created_at: z.date(),
	updated_at: z.date().nullable(),
});

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
		.output(companySettingsSchema.nullable())
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
				email: z.string().optional(),
				phone: z.string().optional(),
				whatsapp: z.string().optional(),
				website: z.string().optional(),
				address: z.string().optional(),
				currency: z.string().length(3),
				timezone: z.string().min(1),
				receipt_header: z.string().optional(),
				receipt_footer: z.string().optional(),
				invoice_terms: z.string().optional(),
				service_terms: z.string().optional(),
				invoice_template: z.string().optional(),
				whatsapp_template: z.string().optional(),
				whatsapp_product_information_template: z.string().optional(),
				whatsapp_service_in_progress_template: z.string().optional(),
				whatsapp_service_waiting_template: z.string().optional(),
				whatsapp_service_ready_template: z.string().optional(),
				whatsapp_service_done_template: z.string().optional(),
				whatsapp_service_warranty_template: z.string().optional(),
			}),
		)
		.output(z.object({ success: z.boolean(), id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const values = {
				...input,
				currency: input.currency ?? "IDR",
				timezone: input.timezone ?? "Asia/Jakarta",
			};

			const existing = await db
				.select({ id: companySettings.id })
				.from(companySettings)
				.where(eq(companySettings.user_uid, ctx.user.id))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(companySettings)
					.set({ ...values, updated_at: new Date() })
					.where(eq(companySettings.user_uid, ctx.user.id));

				return { success: true, id: existing[0].id };
			}

			const [row] = await db
				.insert(companySettings)
				.values({ user_uid: ctx.user.id, ...values })
				.returning({ id: companySettings.id });

			return { success: true, id: row.id };
		}),
});
