"use client";

import { PaymentDialog } from "@/components/payment-dialog";
import type { PendingPOSOrder } from "@/components/pos-types";

interface POSPaymentFlowProps {
	pendingOrder: PendingPOSOrder | null;
	paymentMethods: { id: number; name: string }[];
	locale: string;
	isPending: boolean;
	title: string;
	totalLabel: string;
	amountLabel: string;
	paymentMethodLabel: string;
	submitLabel: string;
	cancelLabel: string;
	onOpenChange: (open: boolean) => void;
	onSubmitOrder: (payload: {
		clientOrderId: string;
		customerId: number;
		products: { id: number; quantity: number; price: number }[];
		note: string;
		paymentMethodId: number;
		paidAmount: number;
		total: number;
	}) => Promise<void>;
}

export function POSPaymentFlow({
	pendingOrder,
	paymentMethods,
	locale,
	isPending,
	title,
	totalLabel,
	amountLabel,
	paymentMethodLabel,
	submitLabel,
	cancelLabel,
	onOpenChange,
	onSubmitOrder,
}: POSPaymentFlowProps) {
	return (
		<PaymentDialog
			open={!!pendingOrder}
			onOpenChange={onOpenChange}
			title={title}
			totalLabel={totalLabel}
			amountLabel={amountLabel}
			paymentMethodLabel={paymentMethodLabel}
			submitLabel={submitLabel}
			cancelLabel={cancelLabel}
			totalAmount={pendingOrder?.total ?? 0}
			maxAmount={pendingOrder?.total ?? 0}
			allowOverpayment
			locale={locale}
			paymentMethods={paymentMethods}
			isPending={isPending}
			onSubmit={async ({ paymentMethodId, amount }) => {
				if (!pendingOrder) return;
				await onSubmitOrder({
					clientOrderId: pendingOrder.clientOrderId,
					customerId: pendingOrder.customer.id,
					products: pendingOrder.items.map((item) => ({
						id: item.id,
						quantity: item.quantity,
						price: item.price,
					})),
					note: pendingOrder.note,
					paymentMethodId,
					paidAmount: amount,
					total: pendingOrder.total,
				});
			}}
		/>
	);
}
