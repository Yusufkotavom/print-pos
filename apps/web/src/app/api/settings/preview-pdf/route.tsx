import { renderToStream } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { InvoicePDF } from "@/components/invoice-pdf";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const template = searchParams.get("template") || "standard";

	const mockOrder = {
		id: 9999,
		created_at: new Date().toISOString(),
		status: "completed",
		total_amount: 1500000,
		paid_amount: 1500000,
		payment_status: "paid",
		customer: {
			name: "Budi Santoso (Contoh)",
			phone: "081234567890",
			email: "budi@example.com",
			address: "Jl. Contoh No. 123, Jakarta Raya",
		},
		orderItems: [
			{
				id: 1,
				item_name: "Produk Contoh A",
				item_type: "product",
				quantity: 2,
				price: 500000,
			},
			{
				id: 2,
				item_name: "Produk Contoh B",
				item_type: "product",
				quantity: 1,
				price: 500000,
			},
		],
	};

	const mockCompanySettings = {
		company_name: "Toko Super Maju (Contoh)",
		trade_name: "Super Maju Group",
		email: "halo@supermaju.test",
		phone: "021-12345678",
		whatsapp: "081234567890",
		website: "https://supermaju.test",
		address:
			"Jl. Jendral Sudirman Kav 1, Kebayoran Baru, Jakarta Selatan 12190",
		invoice_terms:
			"Ini adalah contoh catatan atau syarat ketentuan yang akan muncul di faktur/invoice pelanggan Anda. Pembayaran harap dilakukan tepat waktu.",
		invoice_template: template,
	};

	const mockLabels = {
		invoice: "INVOICE",
		date: "Tanggal",
		status: "Status",
		customer: "Pelanggan",
		item: "Item",
		qty: "Qty",
		price: "Harga",
		subtotal: "Total",
		total: "Total Keseluruhan",
		paidAmount: "Jumlah Dibayar",
		remainingAmount: "Sisa Tagihan",
		paid: "LUNAS",
		unpaid: "BELUM BAYAR",
		partial: "DIBAYAR SEBAGIAN",
		companyDetails: "Detail Perusahaan",
		thankYou: "Terima Kasih Atas Pembelian Anda!",
	};

	try {
		const stream = await renderToStream(
			<InvoicePDF
				order={mockOrder}
				companySettings={mockCompanySettings}
				labels={mockLabels}
			/>,
		);

		return new NextResponse(stream as unknown as ReadableStream, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'inline; filename="preview-invoice.pdf"',
			},
		});
	} catch (error) {
		console.error("PDF Preview Error:", error);
		return new NextResponse("Error generating PDF preview", { status: 500 });
	}
}
