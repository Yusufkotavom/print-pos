"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Label } from "@finopenpos/ui/components/label";
import { Textarea } from "@finopenpos/ui/components/textarea";
import { Loader2Icon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { formatCurrency } from "@/lib/utils";

type POSCartItem = {
	id: number;
	name: string;
	price: number;
	in_stock: number;
	track_stock: boolean;
	product_type: string;
	quantity: number;
};

type ProductSource = {
	id: number;
	in_stock: number;
	track_stock: boolean;
	product_type: string;
};

interface POSCartPanelProps {
	items: POSCartItem[];
	products: ProductSource[];
	note: string;
	total: number;
	locale: string;
	isPending?: boolean;
	canCreate: boolean;
	onNoteChange: (value: string) => void;
	onQuantityChange: (productId: number, delta: number) => void;
	onPriceChange: (productId: number, price: number) => void;
	onRemoveProduct: (productId: number) => void;
	onCreateOrder: () => void;
}

export function POSCartPanel({
	items,
	products,
	note,
	total,
	locale,
	isPending,
	canCreate,
	onNoteChange,
	onQuantityChange,
	onPriceChange,
	onRemoveProduct,
	onCreateOrder,
}: POSCartPanelProps) {
	const t = useTranslations("pos");
	const tc = useTranslations("common");

	return (
		<Card className="h-fit lg:sticky lg:top-4">
			<CardHeader>
				<CardTitle>{t("createOrder")}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{items.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
						{t("selectProducts")}
					</div>
				) : (
					<div className="space-y-3">
						{items.map((product) => {
							const source = products.find((p) => p.id === product.id);
							return (
								<div key={product.id} className="rounded-lg border p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="truncate font-medium text-sm">
												{product.name}
											</div>
											<div className="text-muted-foreground text-xs">
												{formatCurrency(product.price, locale)}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
											onClick={() => onRemoveProduct(product.id)}
										>
											<Trash2Icon className="h-4 w-4" />
											<span className="sr-only">{tc("remove")}</span>
										</Button>
									</div>
									<div className="mt-3 flex items-center justify-between gap-3">
										<div className="flex items-center gap-1">
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8"
												onClick={() => onQuantityChange(product.id, -1)}
												disabled={product.quantity <= 1}
											>
												<MinusIcon className="h-3 w-3" />
											</Button>
											<span className="w-8 text-center font-medium tabular-nums">
												{product.quantity}
											</span>
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8"
												onClick={() => onQuantityChange(product.id, 1)}
												disabled={
													source?.product_type === "product" &&
													source.track_stock
														? product.quantity >= source.in_stock
														: false
												}
											>
												<PlusIcon className="h-3 w-3" />
											</Button>
										</div>
										<div className="font-semibold text-sm">
											{formatCurrency(product.quantity * product.price, locale)}
										</div>
									</div>
									<div className="mt-3 flex items-center gap-2">
										<span className="text-muted-foreground text-xs">Rp</span>
										<FormattedNumberInput
											className="h-8"
											value={product.price / 100}
											onValueChange={(value) =>
												onPriceChange(product.id, (value ?? 0) * 100)
											}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
				{items.length > 0 && (
					<div className="space-y-2">
						<Label htmlFor="order-note">{tc("description")}</Label>
						<Textarea
							id="order-note"
							value={note}
							onChange={(event) => onNoteChange(event.target.value)}
							rows={4}
						/>
					</div>
				)}
				<div className="border-t pt-4">
					<div className="mb-3 flex items-center justify-between">
						<span className="font-medium">{tc("total")}</span>
						<strong className="text-xl">{formatCurrency(total, locale)}</strong>
					</div>
					<Button
						onClick={onCreateOrder}
						disabled={!canCreate || isPending}
						size="lg"
						className="w-full"
					>
						{isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
						{t("createOrder")}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
