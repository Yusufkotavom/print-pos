import {
	adminProcedure,
	createCallerFactory,
	protectedProcedure,
	publicProcedure,
	router,
	type TRPCContext,
} from "@finopenpos/api";
import { getAuthUser } from "@/lib/auth-guard";

export {
	router,
	createCallerFactory,
	publicProcedure,
	protectedProcedure,
	adminProcedure,
};
export type { TRPCContext };

export const createTRPCContext = async (): Promise<TRPCContext> => {
	const user = await getAuthUser();
	return { user };
};
