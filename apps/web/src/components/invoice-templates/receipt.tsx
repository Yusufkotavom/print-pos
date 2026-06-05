import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { InvoicePDFProps } from "./types";

const styles = StyleSheet.create({
	page: {
		padding: 10,
		fontSize: 8,
		fontFamily: "Helvetica",
		color: "#000000",
		lineHeight: 1.4,
	},
	header: {
		alignItems: "center",
		marginBottom: 10,
		borderBottomWidth: 1,
		borderBottomStyle: "dashed",
		borderBottomColor: "#000000",
		paddingBottom: 10,
	},
	companyName: {
		fontSize: 12,
		fontWeight: "bold",
		marginBottom: 4,
		textAlign: "center",
	},
	companySub: {
		fontSize: 7,
		marginBottom: 2,
		textAlign: "center",
	},
	metaText: {
		fontSize: 7,
		marginBottom: 2,
		textAlign: "center",
	},
	table: {
		marginTop: 5,
		marginBottom: 10,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 4,
	},
	colItem: { width: "40%" },
	colQty: { width: "15%", textAlign: "center" },
	colPrice: { width: "20%", textAlign: "right" },
	colTotal: { width: "25%", textAlign: "right" },
	itemTitle: {
		fontWeight: "bold",
		marginBottom: 2,
	},
	totalsContainer: {
		borderTopWidth: 1,
		borderTopStyle: "dashed",
		borderTopColor: "#000000",
		paddingTop: 5,
		marginBottom: 10,
	},
	totalsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 2,
	},
	totalsRowBold: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 2,
		fontWeight: "bold",
		fontSize: 9,
	},
	footer: {
		textAlign: "center",
		fontSize: 7,
		marginTop: 10,
	},
	termsText: {
		fontSize: 6,
		textAlign: "center",
		marginTop: 10,
		borderTopWidth: 1,
		borderTopStyle: "dashed",
		borderTopColor: "#000000",
		paddingTop: 10,
	},
});

export function TemplateReceipt({ order, companySettings, labels }: InvoicePDFProps) {
	const remainingAmount = Math.max(0, order.total_amount - order.paid_amount);

	const formattedDate = order.created_at
		? new Date(order.created_at).toLocaleDateString("id-ID", {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: "—";

	const formatPdfCurrency = (amount: number) => {
		return `Rp ${(amount / 100).toLocaleString("id-ID")}`;
	};

	return (
		<Document>
			<Page size={[226, 800]} style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.companyName}>
						{companySettings?.company_name || "FinOpenPOS"}
					</Text>
					{companySettings?.trade_name && (
						<Text style={styles.companySub}>{companySettings.trade_name}</Text>
					)}
					<Text style={styles.companySub}>
						{companySettings?.street} No. {companySettings?.street_number}
					</Text>
					<Text style={styles.companySub}>
						{companySettings?.district}, {companySettings?.city_name}
					</Text>
					<Text style={styles.metaText}>
						{labels.invoice}: #{order.id}
					</Text>
					<Text style={styles.metaText}>{formattedDate}</Text>
					{order.customer && (
						<Text style={styles.metaText}>Plg: {order.customer.name}</Text>
					)}
				</View>

				{/* Items Table */}
				<View style={styles.table}>
					{order.orderItems?.map((item) => (
						<View key={item.id} style={styles.tableRow}>
							<View style={styles.colItem}>
								<Text style={styles.itemTitle}>
									{item.item_name || item.product?.name || `#${item.id}`}
								</Text>
							</View>
							<View style={styles.colQty}>
								<Text>x{item.quantity}</Text>
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

				{/* Totals */}
				<View style={styles.totalsContainer}>
					<View style={styles.totalsRow}>
						<Text>{labels.subtotal}:</Text>
						<Text>{formatPdfCurrency(order.total_amount)}</Text>
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

				<View style={{ alignItems: "center", marginBottom: 10 }}>
					<Text style={{ fontWeight: "bold" }}>
						{order.payment_status === "paid"
							? labels.paid
							: order.payment_status === "partial"
								? labels.partial
								: labels.unpaid}
					</Text>
				</View>

				{/* Terms and Notes */}
				{companySettings?.invoice_terms && (
					<Text style={styles.termsText}>{companySettings.invoice_terms}</Text>
				)}

				{/* Footer */}
				<Text style={styles.footer}>{labels.thankYou}</Text>
			</Page>
		</Document>
	);
}
