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
	onQueueChange: (queue: QueuedPOSOrder[]) => void;
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
	readQueue: () => QueuedPOSOrder[];
	writeQueue: (queue: QueuedPOSOrder[]) => void;
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
	onQueueChange,
	onClearDraft,
	onSubmitOrder,
	readQueue,
	writeQueue,
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
			onSubmit={({ paymentMethodId, amount }) => {
				if (!pendingOrder) return;
				const queuedOrder: QueuedPOSOrder = {
					...pendingOrder,
					paymentMethodId,
					paidAmount: amount,
					createdAt: new Date().toISOString(),
					status: "pending",
				};
				const enqueueOrder = () => {
					const queue = [
						...readQueue().filter(
							(item) => item.clientOrderId !== queuedOrder.clientOrderId,
						),
						queuedOrder,
					];
					writeQueue(queue);
					onQueueChange(queue);
					onOpenChange(false);
					onClearDraft();
					toast.success(queuedMessage);
				};
				if (!navigator.onLine) {
					enqueueOrder();
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
