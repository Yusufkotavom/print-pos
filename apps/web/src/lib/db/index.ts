import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://finopenpos:finopenpos@localhost:15432/finopenpos";

export const db = drizzle(databaseUrl, { schema });
