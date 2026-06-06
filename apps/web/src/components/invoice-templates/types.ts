export interface InvoicePDFProps {
	order: {
		id: number;
		created_at: Date | string | null;
		status: string | null;
		total_amount: number;
		paid_amount: number;
		payment_status: string;
		customer?: {
			name: string;
			email?: string | null;
			phone?: string;
			address?: string | null;
		} | null;
		orderItems?: Array<{
			id: number;
			item_name: string;
			item_type: string;
			quantity: number;
			price: number;
			note?: string | null;
			product?: { name: string } | null;
		}> | null;
	};
	companySettings?: {
		company_name: string;
		trade_name?: string | null;
		email?: string | null;
		phone?: string | null;
		whatsapp?: string | null;
		website?: string | null;
		address?: string | null;
		invoice_terms?: string | null;
		service_terms?: string | null;
		invoice_template?: string | null;
		whatsapp_template?: string | null;
		receipt_header?: string | null;
		receipt_footer?: string | null;
	} | null;
	labels: {
		invoice: string;
		date: string;
		status: string;
		customer: string;
		item: string;
		qty: string;
		price: string;
		subtotal: string;
		total: string;
		paidAmount: string;
		remainingAmount: string;
		paid: string;
		unpaid: string;
		partial: string;
		companyDetails: string;
		thankYou: string;
	};
}
