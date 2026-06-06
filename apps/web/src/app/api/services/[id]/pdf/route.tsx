import { renderToStream } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { InvoicePDF } from "@/components/invoice-pdf";
import { getAuthUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companySettings, serviceOrders } from "@/lib/db/schema";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getAuthUser();
	if (!user) return new NextResponse("Unauthorized", { status: 401 });

	const { id } = await params;
	const serviceId = Number.parseInt(id, 10);
	if (Number.isNaN(serviceId)) {
		return new NextResponse("Invalid service ID", { status: 400 });
	}

	const service = await db.query.serviceOrders.findFirst({
		where: and(
			eq(serviceOrders.id, serviceId),
			eq(serviceOrders.user_uid, user.id),
		),
		with: { customer: true, items: true },
	});
	if (!service) return new NextResponse("Service not found", { status: 404 });

	const settings = await db.query.companySettings.findFirst({
		where: eq(companySettings.user_uid, user.id),
	});
	const order = {
		id: service.id,
		created_at: service.created_at,
		status: service.status,
		total_amount: service.total_amount,
		paid_amount: service.paid_amount,
		payment_status: service.payment_status,
		customer: service.customer,
		orderItems: service.items.map((item) => ({
			id: item.id,
			item_name: item.item_name,
			item_type: item.line_type,
			quantity: item.quantity,
			price: item.price,
			note: item.note,
			product: null,
		})),
	};
	const serviceSettings = settings
		? {
				...settings,
				invoice_terms: settings.service_terms ?? settings.invoice_terms,
			}
		: null;
	const labels = {
		invoice: "Service Order",
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
		thankYou: "Terima kasih!",
	};

	const stream = await renderToStream(
		<InvoicePDF
			order={order}
			companySettings={serviceSettings}
			labels={labels}
		/>,
	);
	return new NextResponse(stream as unknown as ReadableStream, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `inline; filename="service-${serviceId}.pdf"`,
		},
	});
}
