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
