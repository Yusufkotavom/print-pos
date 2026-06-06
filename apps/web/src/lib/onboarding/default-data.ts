import { db } from "@/lib/db";
import {
	companySettings,
	customers,
	paymentMethods,
	productCategories,
	products,
	transactionCategories,
} from "@/lib/db/schema";

const defaultPaymentMethods = ["Tunai", "Transfer Bank", "QRIS"];
const defaultProductCategories = ["Produk", "Layanan"];
const defaultTransactionCategories = [
	{ name: "selling", type: "income" },
	{ name: "other_income", type: "income" },
	{ name: "rent", type: "expense" },
	{ name: "utilities", type: "expense" },
	{ name: "supplies", type: "expense" },
] as const;
const defaultProducts = [
	{
		name: "Produk Contoh",
		description: "Produk siap jual untuk mulai transaksi pertama.",
		price: 2500000,
		cost: 1500000,
		in_stock: 20,
		category: "Produk",
		product_type: "product",
		track_stock: true,
	},
	{
		name: "Jasa Contoh",
		description: "Layanan siap pakai untuk invoice atau POS.",
		price: 5000000,
		cost: 0,
		in_stock: 0,
		category: "Layanan",
		product_type: "service",
		track_stock: false,
	},
];

export async function createDefaultWorkspace(
	userId: string,
	name: string,
	email: string,
) {
	await db.transaction(async (tx) => {
		await tx.insert(companySettings).values({
			user_uid: userId,
			company_name: name ? `${name} Store` : "Toko Saya",
			email,
			currency: "IDR",
			timezone: "Asia/Jakarta",
			receipt_header: "Terima kasih sudah berbelanja",
			receipt_footer: "Barang yang sudah dibeli tidak dapat dikembalikan",
			invoice_terms: "Pembayaran jatuh tempo sesuai kesepakatan.",
			invoice_template: "standard",
		});

		await tx.insert(paymentMethods).values(
			defaultPaymentMethods.map((method) => ({
				name: method,
				user_uid: userId,
			})),
		);

		await tx.insert(productCategories).values(
			defaultProductCategories.map((category) => ({
				name: category,
				user_uid: userId,
			})),
		);

		await tx.insert(transactionCategories).values(
			defaultTransactionCategories.map((category) => ({
				name: category.name,
				type: category.type,
				user_uid: userId,
			})),
		);

		await tx.insert(customers).values({
			name: "Pelanggan Umum",
			phone: "-",
			address: "",
			status: "active",
			user_uid: userId,
		});

		await tx.insert(products).values(
			defaultProducts.map((product) => ({
				...product,
				user_uid: userId,
			})),
		);
	});
}
