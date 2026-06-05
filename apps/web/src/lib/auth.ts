import { createAuth } from "@finopenpos/auth";
import { serverUrls } from "@finopenpos/env/server";
import { db } from "./db";

export const auth = createAuth({
	db: db as never,
	baseURL: serverUrls.betterAuthUrl,
});
