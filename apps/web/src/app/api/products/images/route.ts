import { NextResponse } from "next/server";
import { storeProductImage } from "@/lib/server/product-image-storage";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get("file");
		if (!(file instanceof File)) {
			return NextResponse.json({ error: "File is required" }, { status: 400 });
		}
		if (!ALLOWED_TYPES.has(file.type)) {
			return NextResponse.json(
				{ error: "Unsupported image type" },
				{ status: 400 },
			);
		}
		if (file.size > MAX_IMAGE_SIZE) {
			return NextResponse.json({ error: "Image too large" }, { status: 400 });
		}
		const stored = await storeProductImage(file);
		return NextResponse.json(stored);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to upload image",
			},
			{ status: 500 },
		);
	}
}
