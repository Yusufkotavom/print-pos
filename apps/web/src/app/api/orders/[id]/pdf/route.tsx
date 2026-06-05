import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { orders, companySettings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { renderToStream } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice-pdf";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const user = await getAuthUser();
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const { id } = await params;
	const orderId = Number.parseInt(id, 10);
	if (Number.isNaN(orderId)) {
		return new NextResponse("Invalid order ID", { status: 400 });
	}

	const order = await db.query.orders.findFirst({
		where: and(eq(orders.id, orderId), eq(orders.user_uid, user.id)),
		with: {
			customer: true,
			orderItems: {
				with: {
					product: {
						columns: { name: true, category: true, product_type: true },
					},
				},
			},
		},
	});

	if (!order) {
		return new NextResponse("Order not found", { status: 404 });
	}

	const settings = await db.query.companySettings.findFirst({
		where: eq(companySettings.user_uid, user.id),
	});

	const pdfLabels = {
		invoice: "Invoice",
		date: "Tanggal",
		status: "Status",
		customer: "Pelanggan",
		item: "Item",
		qty: "Jumlah",
		price: "Harga Satuan",
		subtotal: "Subtotal",
		total: "Total",
		paidAmount: "Dibayar",
		remainingAmount: "Sisa",
		paid: "Lunas",
		unpaid: "Belum Lunas",
		partial: "Sebagian",
		companyDetails: "Detail Perusahaan",
		thankYou: "Terima kasih atas kunjungan Anda!",
	};

	const stream = await renderToStream(
		<InvoicePDF
			order={order}
			companySettings={settings}
			labels={pdfLabels}
		/>
	);

	return new NextResponse(stream as any, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `inline; filename="invoice-${orderId}.pdf"`,
		},
	});
}
