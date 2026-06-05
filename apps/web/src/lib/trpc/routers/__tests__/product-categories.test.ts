import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db }));

// Bun's module mock must be registered before the router module is loaded.
const { productCategoriesRouter } = await import("../product-categories");
const { createCallerFactory } = await import("../../init");

const caller = createCallerFactory(productCategoriesRouter)({
	user: makeUser("user-1"),
});
const callerAs = (uid: string) =>
	createCallerFactory(productCategoriesRouter)({ user: makeUser(uid) });

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
});

afterAll(async () => {
	await pg.close();
});

describe("productCategories", () => {
	it("creates, persists, and lists categories for the current user", async () => {
		const before = await caller.list();
		const created = await caller.create({ name: "Beverages" });

		expect(created.id).toBeGreaterThan(0);
		expect(created.name).toBe("Beverages");
		expect(created.user_uid).toBe("user-1");
		expect(created.created_at).toBeInstanceOf(Date);

		const after = await caller.list();
		expect(after.length).toBe(before.length + 1);
		expect(after.some((category) => category.id === created.id)).toBe(true);
	});

	it("does not leak categories between users", async () => {
		await caller.create({ name: "Private" });
		const other = callerAs("other-user");
		await other.create({ name: "Other" });

		const ownList = await caller.list();
		const otherList = await other.list();

		expect(ownList.every((category) => category.user_uid === "user-1")).toBe(true);
		expect(ownList.some((category) => category.name === "Other")).toBe(false);
		expect(otherList.every((category) => category.user_uid === "other-user")).toBe(true);
	});
});
