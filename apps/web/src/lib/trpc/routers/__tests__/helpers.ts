import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const TABLES: PgTable[] = [
	schema.products,
	schema.productCategories,
	schema.customers,
	schema.transactionCategories,
	schema.paymentMethods,
	schema.orders,
	schema.orderItems,
	schema.transactions,
	schema.cities,
	schema.companySettings,
];

function tableToDDL(table: PgTable): string {
	const { name, columns, foreignKeys } = getTableConfig(table);

	const colDefs = columns.map((col) => {
		const sqlType = col.getSQLType();
		const isSerial = sqlType === "serial";
		const parts: string[] = [col.name, sqlType];

		if (col.primary) parts.push("PRIMARY KEY");
		if (col.notNull && !isSerial) parts.push("NOT NULL");
		if (col.isUnique) parts.push("UNIQUE");
		if (col.name === "product_type" || col.name === "item_type")
			parts.push("DEFAULT 'product'");
		if (col.name === "item_name") parts.push("DEFAULT ''");
		if (col.name === "paid_amount") parts.push("DEFAULT 0");
		if (col.name === "payment_status") parts.push("DEFAULT 'unpaid'");
		if (col.name === "track_stock") parts.push("DEFAULT true");
		if (col.hasDefault && !isSerial && sqlType.startsWith("timestamp"))
			parts.push("DEFAULT NOW()");

		return parts.join(" ");
	});

	const fkDefs = foreignKeys.map((fk) => {
		const ref = fk.reference();
		const col = ref.columns[0].name;
		const refTable = getTableName(ref.foreignColumns[0].table);
		const refCol = ref.foreignColumns[0].name;
		return `FOREIGN KEY (${col}) REFERENCES ${refTable}(${refCol})`;
	});

	return `CREATE TABLE IF NOT EXISTS ${name} (\n  ${[...colDefs, ...fkDefs].join(",\n  ")}\n);`;
}

export const SCHEMA_DDL = TABLES.map(tableToDDL).join("\n\n");

let testSchemaId = 0;

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export function createTestDb() {
	const schemaName = `test_${process.pid}_${testSchemaId++}`;
	const quotedSchemaName = quoteIdentifier(schemaName);
	const pool = new Pool({
		connectionString:
			process.env.TEST_DATABASE_URL ??
			process.env.DATABASE_URL ??
			"postgresql://finopenpos:finopenpos@localhost:15432/finopenpos",
		options: `-c search_path=${schemaName}`,
	});
	const db = drizzle(pool, { schema });
	const pg = {
		async exec(sql: string) {
			await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchemaName}`);
			await pool.query(sql);
		},
		async close() {
			try {
				await pool.query(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`);
			} finally {
				await pool.end();
			}
		},
	};
	return { pg, db };
}

export function makeUser(id: string) {
	return {
		id,
		name: "Test",
		email: `${id}@test.com`,
		emailVerified: false,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}
