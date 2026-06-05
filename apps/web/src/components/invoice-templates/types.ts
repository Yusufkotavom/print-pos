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
			phone: string;
			address?: string | null;
		} | null;
		orderItems?: Array<{
			id: number;
			item_name: string;
			item_type: string;
			quantity: number;
			price: number;
			product?: { name: string } | null;
		}> | null;
	};
	companySettings?: {
		company_name: string;
		trade_name?: string | null;
		tax_id: string;
		business_license: string;
		city_name: string;
		street: string;
		street_number: string;
		district: string;
		postal_code: string;
		invoice_terms?: string | null;
		invoice_template?: string | null;
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
