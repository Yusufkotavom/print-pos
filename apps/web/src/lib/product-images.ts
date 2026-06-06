export type ProductImageUploadResult = {
	url: string;
	key: string;
	width?: number;
	height?: number;
};

export async function uploadProductImage(file: File) {
	const formData = new FormData();
	formData.append("file", file);
	const response = await fetch("/api/products/images", {
		method: "POST",
		body: formData,
	});
	if (!response.ok) {
		const error = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(error?.error ?? "Failed to upload image");
	}
	return (await response.json()) as ProductImageUploadResult;
}
