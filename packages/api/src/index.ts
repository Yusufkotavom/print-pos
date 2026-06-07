import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";

export interface BaseUser {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	status?: string | null;
}

export interface TRPCContext {
	user: BaseUser | null;
}

const t = initTRPC.context<TRPCContext>().meta<OpenApiMeta>().create({
	transformer: superjson,
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.user || ctx.user.status !== "active") {
		throw new TRPCError({ code: "FORBIDDEN" });
	}
	if (ctx.user.role !== "super_admin" && ctx.user.role !== "admin") {
		throw new TRPCError({ code: "FORBIDDEN" });
	}
	return next({ ctx: { ...ctx, user: ctx.user } });
});

export type { OpenApiMeta };
