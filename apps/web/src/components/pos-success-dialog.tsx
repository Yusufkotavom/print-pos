"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { CheckCircle2Icon, FileTextIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { SuccessPOSOrder } from "@/components/pos-types";

interface POSSuccessDialogProps {
	order: SuccessPOSOrder | null;
	companySettings:
		| {
				company_name?: string | null;
				trade_name?: string | null;
				address?: string | null;
				phone?: string | null;
				receipt_header?: string | null;
				receipt_footer?: string | null;
				whatsapp_template?: string | null;
		  }
		| null
		| undefined;
	onOpenChange: (open: boolean) => void;
	title: string;
}

export function POSSuccessDialog({
	order,
	companySettings,
	onOpenChange,
	title,
}: POSSuccessDialogProps) {
	if (!order) return null;

	const changeAmount = Math.max(0, order.paid_amount - order.total_amount);

	return (
		<>
			<Dialog open={!!order} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-md print:hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-green-600">
							<CheckCircle2Icon className="h-5 w-5" />
							{title}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="rounded-lg border bg-muted/20 p-4 text-sm">
							<div className="flex justify-between gap-4">
								<span className="text-muted-foreground">No. Transaksi</span>
								<span className="font-medium">
									{order.order_number ?? `#${order.id}`}
								</span>
							</div>
							<div className="mt-2 flex justify-between gap-4">
								<span className="text-muted-foreground">Tanggal</span>
								<span className="text-right">
									{order.created_at
										? new Date(order.created_at).toLocaleString("id-ID")
										: new Date().toLocaleString("id-ID")}
								</span>
							</div>
							<div className="mt-2 flex justify-between gap-4">
								<span className="text-muted-foreground">Pelanggan</span>
								<span className="text-right">
									{order.customer?.name ?? "Pelanggan Umum"}
								</span>
							</div>
							<div className="mt-2 flex justify-between gap-4">
								<span className="text-muted-foreground">Metode</span>
								<span>{order.paymentMethodName}</span>
							</div>
						</div>

						<div className="rounded-lg border p-4 text-sm">
							<div className="mb-2 font-semibold">Detail Item</div>
							<div className="space-y-2">
								{order.items.map((item) => (
									<div key={item.id} className="flex justify-between gap-3">
										<span className="min-w-0 truncate">
											{item.name} x{item.quantity}
										</span>
										<span className="shrink-0">
											Rp{" "}
											{((item.price * item.quantity) / 100).toLocaleString(
												"id-ID",
											)}
										</span>
									</div>
								))}
							</div>
							{order.note && (
								<div className="mt-3 rounded bg-muted/50 p-2 text-muted-foreground text-xs">
									<span className="font-medium text-foreground">Catatan: </span>
									{order.note}
								</div>
							)}
						</div>

						<div className="rounded-lg border bg-muted/20 p-4 text-sm">
							<div className="flex justify-between">
								<span>Total</span>
								<span className="font-semibold">
									Rp {(order.total_amount / 100).toLocaleString("id-ID")}
								</span>
							</div>
							<div className="mt-2 flex justify-between">
								<span>Dibayar</span>
								<span>
									Rp {(order.paid_amount / 100).toLocaleString("id-ID")}
								</span>
							</div>
							<div className="mt-2 flex justify-between border-t pt-2 font-bold text-emerald-700">
								<span>Kembalian</span>
								<span>Rp {(changeAmount / 100).toLocaleString("id-ID")}</span>
							</div>
						</div>
					</div>
					<DialogFooter className="mt-4 flex flex-col flex-wrap gap-2 sm:flex-row sm:justify-center">
						<Button
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => window.print()}
						>
							<PrinterIcon className="mr-2 h-4 w-4" />
							Cetak Struk
						</Button>
						<Button
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() =>
								window.open(`/api/orders/${order.id}/pdf`, "_blank")
							}
						>
							<FileTextIcon className="mr-2 h-4 w-4" />
							Print Invoice
						</Button>
						<Button
							variant="outline"
							className="w-full border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 sm:w-auto"
							onClick={() => {
								const customerPhone = order.customer?.phone;
								if (!customerPhone) {
									toast.error(
										"Nomor WhatsApp pelanggan tidak tersedia untuk transaksi ini.",
									);
									return;
								}
								const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
								const waPhone = cleanPhone.startsWith("0")
									? `62${cleanPhone.substring(1)}`
									: cleanPhone;
								const template =
									companySettings?.whatsapp_template ||
									"Halo! Pesanan Anda {order_number} telah berhasil diproses. Anda bisa mengecek invoice melalui tautan berikut: {invoice_url} \nTerima kasih!";
								const orderNum = order.order_number ?? `#${order.id}`;
								const invoiceUrl = `${window.location.origin}/api/orders/${order.id}/pdf`;
								const whatsappText = template
									.replace(/{order_number}/g, orderNum)
									.replace(/{invoice_url}/g, invoiceUrl);
								window.open(
									`https://wa.me/${waPhone}?text=${encodeURIComponent(whatsappText)}`,
									"_blank",
								);
							}}
						>
							WhatsApp
						</Button>
						<Link
							href={`/admin/orders/${order.id}`}
							className="w-full sm:w-auto"
						>
							<Button variant="secondary" className="w-full">
								Detail Invoice
							</Button>
						</Link>
						<Button
							className="w-full sm:w-auto"
							onClick={() => onOpenChange(false)}
						>
							Transaksi Baru
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div
				id="thermal-receipt"
				className="hidden font-mono text-[10px] leading-tight print:absolute print:top-0 print:left-0 print:block print:w-[80mm] print:bg-white print:p-4 print:text-black"
			>
				<style
					dangerouslySetInnerHTML={{
						__html: `
						@media print {
							body * { visibility: hidden; }
							#thermal-receipt, #thermal-receipt * { visibility: visible; }
							#thermal-receipt { position: absolute; left: 0; top: 0; width: 80mm; background: white; color: black; padding: 10px; }
							@page { margin: 0; }
						}
					`,
					}}
				/>
				<div className="mb-2 border-b pb-2 text-center">
					<h2 className="font-bold text-sm uppercase">
						{companySettings?.company_name || "FinOpenPOS"}
					</h2>
					{companySettings?.trade_name && (
						<p className="text-[9px]">{companySettings.trade_name}</p>
					)}
					{companySettings?.address && <p>{companySettings.address}</p>}
					{companySettings?.phone && <p>{companySettings.phone}</p>}
					{companySettings?.receipt_header && (
						<p className="mt-1 border-t border-dashed pt-1 text-[9px] italic">
							{companySettings.receipt_header}
						</p>
					)}
				</div>
				<div className="mb-2 space-y-1">
					<p>No: {order.order_number ?? `#${order.id}`}</p>
					<p>
						Tgl:{" "}
						{order.created_at
							? new Date(order.created_at).toLocaleString("id-ID")
							: new Date().toLocaleString("id-ID")}
					</p>
					<p>Pelanggan: {order.customer?.name || "Pelanggan Umum"}</p>
				</div>
				<div className="my-2 space-y-1 border-t border-b border-dashed py-2">
					{order.items.map((item) => (
						<div key={item.id} className="flex justify-between">
							<div className="max-w-[70%]">
								<p>{item.name}</p>
								<p className="text-gray-500">
									{item.quantity} x Rp{" "}
									{(item.price / 100).toLocaleString("id-ID")}
								</p>
							</div>
							<p>
								Rp{" "}
								{((item.price * item.quantity) / 100).toLocaleString("id-ID")}
							</p>
						</div>
					))}
				</div>
				{order.note && (
					<div className="mb-2 border-b border-dashed pb-2 text-[9px]">
						<p className="font-bold">Catatan:</p>
						<p>{order.note}</p>
					</div>
				)}
				<div className="space-y-1 text-right">
					<div className="flex justify-between font-bold">
						<p>TOTAL:</p>
						<p>Rp {(order.total_amount / 100).toLocaleString("id-ID")}</p>
					</div>
					<div className="flex justify-between">
						<p>Bayar ({order.paymentMethodName || "Tunai"}):</p>
						<p>Rp {(order.paid_amount / 100).toLocaleString("id-ID")}</p>
					</div>
					<div className="flex justify-between border-t border-dashed pt-1">
						<p>Kembalian:</p>
						<p>Rp {(changeAmount / 100).toLocaleString("id-ID")}</p>
					</div>
				</div>
				<div className="mt-4 border-t border-dashed pt-2 text-center">
					{companySettings?.receipt_footer ? (
						<p>{companySettings.receipt_footer}</p>
					) : (
						<>
							<p>Terima Kasih</p>
							<p>Atas Kunjungan Anda</p>
						</>
					)}
				</div>
			</div>
		</>
	);
}
