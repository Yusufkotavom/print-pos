import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { put } from "@vercel/blob";

export type StoredProductImage = {
	url: string;
	key: string;
	width?: number;
	height?: number;
};

function getExtension(file: File) {
	return file.name.split(".").pop()?.toLowerCase() || "bin";
}

export async function storeProductImage(
	file: File,
): Promise<StoredProductImage> {
	const key = `products/${crypto.randomUUID()}.${getExtension(file)}`;
	if (!process.env.BLOB_READ_WRITE_TOKEN) {
		const uploadDir = join(process.cwd(), "public", "uploads", "products");
		await mkdir(uploadDir, { recursive: true });
		const fileName = key.replace("products/", "");
		await writeFile(
			join(uploadDir, fileName),
			Buffer.from(await file.arrayBuffer()),
		);
		return {
			key,
			url: `/uploads/products/${fileName}`,
		};
	}
	const blob = await put(key, file, {
		access: "public",
		contentType: file.type,
		addRandomSuffix: false,
		cacheControlMaxAge: 60 * 60 * 24 * 30,
	});
	return {
		key: blob.pathname,
		url: blob.url,
	};
}
