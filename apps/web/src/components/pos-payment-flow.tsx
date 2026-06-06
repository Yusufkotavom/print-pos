"use client";

import { toast } from "sonner";
import { PaymentDialog } from "@/components/payment-dialog";
import type { PendingPOSOrder, QueuedPOSOrder } from "@/components/pos-types";

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
	queuedMessage: string;
	onOpenChange: (open: boolean) => void;
	onQueueOrder: (queueItem: QueuedPOSOrder) => Promise<void>;
	onClearDraft: () => void;
	onSubmitOrder: (payload: {
		clientOrderId: string;
		customerId: number;
		products: { id: number; quantity: number; price: number }[];
		note: string;
		paymentMethodId: number;
		paidAmount: number;
		total: number;
	}) => void;
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
	queuedMessage,
	onOpenChange,
	onQueueOrder,
	onClearDraft,
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
				const queuedOrder: QueuedPOSOrder = {
					...pendingOrder,
					paymentMethodId,
					paidAmount: amount,
					createdAt: new Date().toISOString(),
					status: "pending",
				};
				if (!navigator.onLine) {
					await onQueueOrder(queuedOrder);
					onOpenChange(false);
					onClearDraft();
					toast.success(queuedMessage);
					return;
				}
				onSubmitOrder({
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
