import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ path: string[] }> }
) {
	try {
		const { path } = await params;
		const filePath = join(process.cwd(), "public", "uploads", ...path);

		// Prevent directory traversal
		if (!filePath.startsWith(join(process.cwd(), "public", "uploads"))) {
			return new NextResponse("Forbidden", { status: 403 });
		}

		if (!existsSync(filePath)) {
			return new NextResponse("Not Found", { status: 404 });
		}

		const fileBuffer = await readFile(filePath);
		
		// Determine Content-Type based on extension
		const ext = filePath.split('.').pop()?.toLowerCase();
		let contentType = "application/octet-stream";
		if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
		else if (ext === "png") contentType = "image/png";
		else if (ext === "webp") contentType = "image/webp";
		else if (ext === "svg") contentType = "image/svg+xml";

		return new NextResponse(fileBuffer, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=86400",
			},
		});
	} catch (error) {
		console.error("Error serving uploaded file:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
