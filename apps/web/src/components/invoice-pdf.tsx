import { InvoicePDFProps } from "./invoice-templates/types";
import { TemplateStandard } from "./invoice-templates/standard";
import { TemplateElegant } from "./invoice-templates/elegant";
import { TemplateMinimalist } from "./invoice-templates/minimalist";
import { TemplateReceipt } from "./invoice-templates/receipt";

export function InvoicePDF({ order, companySettings, labels }: InvoicePDFProps) {
	const template = companySettings?.invoice_template || "standard";

	switch (template) {
		case "elegant":
			return <TemplateElegant order={order} companySettings={companySettings} labels={labels} />;
		case "minimalist":
			return <TemplateMinimalist order={order} companySettings={companySettings} labels={labels} />;
		case "receipt":
			return <TemplateReceipt order={order} companySettings={companySettings} labels={labels} />;
		case "standard":
		default:
			return <TemplateStandard order={order} companySettings={companySettings} labels={labels} />;
	}
}
export type { InvoicePDFProps } from "./invoice-templates/types";
