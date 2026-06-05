import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
	page: {
		padding: 50,
		fontSize: 9,
		fontFamily: "Helvetica",
		color: "#000000",
		lineHeight: 1.6,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		paddingBottom: 15,
		marginBottom: 20,
	},
	companyInfo: {
		flexDirection: "column",
		maxWidth: "60%",
	},
	companyName: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#111827",
		marginBottom: 4,
	},
	companySub: {
		color: "#4b5563",
		fontSize: 8,
		marginBottom: 2,
	},
	invoiceMeta: {
		alignItems: "flex-end",
	},
	invoiceTitle: {
		fontSize: 18,
		color: "#000000",
		marginBottom: 5,
		letterSpacing: 2,
		textTransform: "uppercase",
	},
	metaText: {
		fontSize: 8,
		color: "#4b5563",
		marginBottom: 2,
	},
	detailsContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 25,
	},
	billTo: {
		width: "48%",
	},
	billFrom: {
		width: "48%",
	},
	sectionTitle: {
		fontSize: 9,
		fontWeight: "bold",
		color: "#374151",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		paddingBottom: 3,
		marginBottom: 6,
		textTransform: "uppercase",
	},
	detailText: {
		fontSize: 8,
		color: "#4b5563",
		marginBottom: 2,
	},
	table: {
		marginTop: 10,
		marginBottom: 20,
	},
	tableHeader: {
		flexDirection: "row",
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: "#000000",
		paddingVertical: 8,
		paddingHorizontal: 4,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 6,
		paddingHorizontal: 4,
	},
	colItem: { width: "45%" },
	colQty: { width: "15%", textAlign: "center" },
	colPrice: { width: "20%", textAlign: "right" },
	colTotal: { width: "20%", textAlign: "right" },
	headerText: {
		fontWeight: "bold",
		color: "#374151",
	},
	totalsContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 10,
	},
	stampContainer: {
		width: "50%",
	},
	badgePaid: {
		borderWidth: 2,
		borderColor: "#16a34a",
		color: "#16a34a",
		paddingVertical: 6,
		paddingHorizontal: 12,
		fontSize: 14,
		fontWeight: "bold",
		textTransform: "uppercase",
		alignSelf: "flex-start",
		marginTop: 10,
		borderRadius: 4,
	},
	badgeUnpaid: {
		borderWidth: 2,
		borderColor: "#dc2626",
		color: "#dc2626",
		paddingVertical: 6,
		paddingHorizontal: 12,
		fontSize: 14,
		fontWeight: "bold",
		textTransform: "uppercase",
		alignSelf: "flex-start",
		marginTop: 10,
		borderRadius: 4,
	},
	badgePartial: {
		borderWidth: 2,
		borderColor: "#ca8a04",
		color: "#ca8a04",
		paddingVertical: 6,
		paddingHorizontal: 12,
		fontSize: 14,
		fontWeight: "bold",
		textTransform: "uppercase",
		alignSelf: "flex-start",
		marginTop: 10,
		borderRadius: 4,
	},
	totalsTable: {
		width: "40%",
	},
	totalsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 4,
	},
	totalsRowBold: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 6,
		borderTopWidth: 1,
		borderTopColor: "#d1d5db",
		fontWeight: "bold",
		fontSize: 10,
		color: "#111827",
	},
	footer: {
		position: "absolute",
		bottom: 30,
		left: 40,
		right: 40,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
		paddingTop: 10,
		textAlign: "center",
		color: "#9ca3af",
		fontSize: 8,
	},
	termsContainer: {
		marginTop: 30,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
		paddingTop: 10,
	},
	termsTitle: {
		fontSize: 8,
		fontWeight: "bold",
		color: "#4b5563",
		textTransform: "uppercase",
		marginBottom: 4,
	},
	termsText: {
		fontSize: 7,
		color: "#6b7280",
	},
});

import type { InvoicePDFProps } from "./types";

export function TemplateMinimalist({
	order,
	companySettings,
	labels,
}: InvoicePDFProps) {
	const remainingAmount = Math.max(0, order.total_amount - order.paid_amount);

	const formattedDate = order.created_at
		? new Date(order.created_at).toLocaleString("id-ID", {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: "—";

	const formatPdfCurrency = (amount: number) => {
		return `Rp ${(amount / 100).toLocaleString("id-ID")}`;
	};

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.companyInfo}>
						<Text style={styles.companyName}>
							{companySettings?.company_name || "FinOpenPOS"}
						</Text>
						{companySettings?.trade_name && (
							<Text style={styles.companySub}>
								{companySettings.trade_name}
							</Text>
						)}
						{companySettings?.tax_id && (
							<Text style={styles.companySub}>
								NPWP: {companySettings.tax_id}
							</Text>
						)}
					</View>
					<View style={styles.invoiceMeta}>
						<Text style={styles.invoiceTitle}>{labels.invoice}</Text>
						<Text style={styles.metaText}>No: #{order.id}</Text>
						<Text style={styles.metaText}>
							{labels.date}: {formattedDate}
						</Text>
					</View>
				</View>

				{/* Billing Details */}
				<View style={styles.detailsContainer}>
					<View style={styles.billTo}>
						<Text style={styles.sectionTitle}>{labels.customer}</Text>
						{order.customer ? (
							<>
								<Text style={[styles.detailText, { fontWeight: "bold" }]}>
									{order.customer.name}
								</Text>
								{order.customer.phone && (
									<Text style={styles.detailText}>{order.customer.phone}</Text>
								)}
								{order.customer.email && (
									<Text style={styles.detailText}>{order.customer.email}</Text>
								)}
								{order.customer.address && (
									<Text style={styles.detailText}>
										{order.customer.address}
									</Text>
								)}
							</>
						) : (
							<Text style={styles.detailText}>General Customer</Text>
						)}
					</View>

					<View style={styles.billFrom}>
						<Text style={styles.sectionTitle}>{labels.companyDetails}</Text>
						{companySettings ? (
							<>
								<Text style={styles.detailText}>
									{companySettings.street} No. {companySettings.street_number}
								</Text>
								<Text style={styles.detailText}>
									{companySettings.district}, {companySettings.city_name}
								</Text>
								<Text style={styles.detailText}>
									Kode Pos: {companySettings.postal_code}
								</Text>
								{companySettings.business_license && (
									<Text style={styles.detailText}>
										Izin: {companySettings.business_license}
									</Text>
								)}
							</>
						) : (
							<Text style={styles.detailText}>—</Text>
						)}
					</View>
				</View>

				{/* Items Table */}
				<View style={styles.table}>
					<View style={styles.tableHeader}>
						<View style={styles.colItem}>
							<Text style={styles.headerText}>{labels.item}</Text>
						</View>
						<View style={styles.colQty}>
							<Text style={styles.headerText}>{labels.qty}</Text>
						</View>
						<View style={styles.colPrice}>
							<Text style={styles.headerText}>{labels.price}</Text>
						</View>
						<View style={styles.colTotal}>
							<Text style={styles.headerText}>{labels.subtotal}</Text>
						</View>
					</View>

					{order.orderItems?.map((item) => (
						<View key={item.id} style={styles.tableRow}>
							<View style={styles.colItem}>
								<Text>
									{item.item_name || item.product?.name || `#${item.id}`}
								</Text>
								{item.note ? (
									<Text style={{ fontSize: 7, color: "#888" }}>
										{item.note}
									</Text>
								) : null}
							</View>
							<View style={styles.colQty}>
								<Text>{item.quantity}</Text>
							</View>
							<View style={styles.colPrice}>
								<Text>{formatPdfCurrency(item.price)}</Text>
							</View>
							<View style={styles.colTotal}>
								<Text>{formatPdfCurrency(item.price * item.quantity)}</Text>
							</View>
						</View>
					))}
				</View>

				{/* Totals & Stamp */}
				<View style={styles.totalsContainer}>
					<View style={styles.stampContainer}>
						{order.payment_status === "paid" && (
							<Text style={styles.badgePaid}>{labels.paid}</Text>
						)}
						{order.payment_status === "partial" && (
							<Text style={styles.badgePartial}>{labels.partial}</Text>
						)}
						{order.payment_status === "unpaid" && (
							<Text style={styles.badgeUnpaid}>{labels.unpaid}</Text>
						)}
					</View>

					<View style={styles.totalsTable}>
						<View style={styles.totalsRow}>
							<Text>{labels.total}:</Text>
							<Text style={{ fontWeight: "bold" }}>
								{formatPdfCurrency(order.total_amount)}
							</Text>
						</View>
						<View style={styles.totalsRow}>
							<Text>{labels.paidAmount}:</Text>
							<Text>{formatPdfCurrency(order.paid_amount)}</Text>
						</View>
						<View style={styles.totalsRowBold}>
							<Text>{labels.remainingAmount}:</Text>
							<Text>{formatPdfCurrency(remainingAmount)}</Text>
						</View>
					</View>
				</View>

				{/* Terms and Notes */}
				{companySettings?.invoice_terms && (
					<View style={styles.termsContainer}>
						<Text style={styles.termsTitle}>Catatan / Syarat Ketentuan</Text>
						<Text style={styles.termsText}>
							{companySettings.invoice_terms}
						</Text>
					</View>
				)}

				{/* Footer */}
				<View style={styles.footer}>
					<Text>{labels.thankYou}</Text>
				</View>
			</Page>
		</Document>
	);
}
