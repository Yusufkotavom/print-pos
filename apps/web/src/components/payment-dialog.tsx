"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Label } from "@finopenpos/ui/components/label";
import { cn } from "@finopenpos/ui/lib/utils";
import { BanknoteIcon, CreditCardIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { formatCurrency } from "@/lib/utils";

type PaymentMethod = {
	id: number;
	name: string;
};

interface PaymentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	totalLabel: string;
	amountLabel: string;
	paymentMethodLabel: string;
	submitLabel: string;
	cancelLabel: string;
	totalAmount: number;
	maxAmount?: number;
	allowOverpayment?: boolean;
	locale: string;
	paymentMethods: PaymentMethod[];
	isPending?: boolean;
	extraContent?: ReactNode;
	onSubmit: (data: { paymentMethodId: number; amount: number }) => void;
}

export function PaymentDialog({
	open,
	onOpenChange,
	title,
	totalLabel,
	amountLabel,
	paymentMethodLabel,
	submitLabel,
	cancelLabel,
	totalAmount,
	maxAmount = totalAmount,
	allowOverpayment = false,
	locale,
	paymentMethods,
	isPending,
	extraContent,
	onSubmit,
}: PaymentDialogProps) {
	const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
	const [amount, setAmount] = useState(Math.round(maxAmount / 100));

	useEffect(() => {
		if (open) {
			setPaymentMethodId(paymentMethods[0]?.id ?? null);
			setAmount(Math.round(maxAmount / 100));
		}
	}, [open, maxAmount, paymentMethods]);

	const amountInCents = amount * 100;
	const changeAmount = Math.max(0, amountInCents - totalAmount);
	const canSubmit =
		paymentMethodId !== null &&
		amountInCents > 0 &&
		(allowOverpayment || amountInCents <= maxAmount);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-lg"
				onInteractOutside={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="space-y-5">
					<div className="rounded-lg border bg-muted/30 p-4 text-center">
						<div className="text-muted-foreground text-sm">{totalLabel}</div>
						<div className="font-bold text-3xl">
							{formatCurrency(totalAmount, locale)}
						</div>
					</div>

					<div className="space-y-2">
						<Label>{paymentMethodLabel}</Label>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{paymentMethods.map((method) => {
								const selected = method.id === paymentMethodId;
								const Icon = /cash|tunai|kas/i.test(method.name)
									? BanknoteIcon
									: CreditCardIcon;

								return (
									<button
										key={method.id}
										type="button"
										className={cn(
											"rounded-lg border bg-card text-left shadow-sm transition-colors",
											selected && "border-primary bg-primary/5",
										)}
										onClick={() => setPaymentMethodId(method.id)}
									>
										<div className="p-3 pb-1">
											<Icon className="h-4 w-4 text-muted-foreground" />
										</div>
										<div className="p-3 pt-0">
											<div className="font-semibold text-xs">{method.name}</div>
										</div>
									</button>
								);
							})}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="payment-amount">{amountLabel}</Label>
						<FormattedNumberInput
							id="payment-amount"
							value={amount}
							onValueChange={(value) => setAmount(value ?? 0)}
						/>
						{allowOverpayment && changeAmount > 0 && (
							<div className="rounded-lg border bg-emerald-50 px-3 py-2 text-emerald-700 text-sm">
								Kembalian: {formatCurrency(changeAmount, locale)}
							</div>
						)}
					</div>
					{extraContent}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="secondary"
						onClick={() => onOpenChange(false)}
					>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						disabled={!canSubmit || isPending}
						onClick={() => {
							if (!paymentMethodId) return;
							onSubmit({ paymentMethodId, amount: amountInCents });
						}}
					>
						{isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
