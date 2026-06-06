"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Combobox } from "@finopenpos/ui/components/combobox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@finopenpos/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Textarea } from "@finopenpos/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { POSCartPanel } from "@/components/pos-cart-panel";
import { POSProductCatalog } from "@/components/pos-product-catalog";
import type { POSProductItem } from "@/components/pos-types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

export default function NewServicePage() {
	const trpc = useTRPC();
	const router = useRouter();
	const queryClient = useQueryClient();
	const t = useTranslations("services");
	const tPos = useTranslations("pos");
	const locale = useLocale();
	const { data: products = [] } = useQuery(trpc.products.list.queryOptions());
	const { data: customers = [] } = useQuery(trpc.customers.list.queryOptions());
	const [selectedProducts, setSelectedProducts] = useState<POSProductItem[]>(
		[],
	);
	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [serviceType, setServiceType] = useState<
		"phone" | "printing" | "other"
	>("other");
	const [customerNote, setCustomerNote] = useState("");
	const [internalNote, setInternalNote] = useState("");
	const [estimatedDoneAt, setEstimatedDoneAt] = useState<Date | undefined>();
	const [detailText, setDetailText] = useState("");
	const [productSearch, setProductSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [isCartOpen, setIsCartOpen] = useState(false);
	const search = useDebouncedValue(productSearch, 250);

	const productCategories = useMemo(() => {
		const names = products
			.map((product) => product.category)
			.filter((category): category is string => Boolean(category));
		return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
	}, [products]);

	const filteredProducts = useMemo(() => {
		const q = search.toLowerCase().trim();
		return products.filter((product) => {
			const matchesCategory =
				selectedCategory === "all" || product.category === selectedCategory;
			const matchesSearch =
				!q ||
				product.name.toLowerCase().includes(q) ||
				(product.category ?? "").toLowerCase().includes(q);
			return matchesCategory && matchesSearch;
		});
	}, [products, search, selectedCategory]);

	const total = selectedProducts.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);

	const createMutation = useMutation(
		trpc.serviceOrders.create.mutationOptions({
			onSuccess: (serviceOrder) => {
				queryClient.invalidateQueries(trpc.serviceOrders.list.queryOptions());
				toast.success(t("created"));
				router.push(`/admin/services/${serviceOrder.id}`);
			},
			onError: (error) => toast.error(error.message || t("createError")),
		}),
	);

	const handleSelectProduct = (productId: number | string) => {
		const product = products.find((item) => item.id === productId);
		if (!product) return;
		setSelectedProducts((prev) => {
			const existing = prev.find((item) => item.id === product.id);
			if (existing) {
				return prev.map((item) =>
					item.id === product.id
						? { ...item, quantity: item.quantity + 1 }
						: item,
				);
			}
			return [
				...prev,
				{
					id: product.id,
					name: product.name,
					price: product.price,
					in_stock: product.in_stock,
					track_stock: product.track_stock,
					product_type: product.product_type,
					wholesale_price: product.wholesale_price,
					wholesale_min_qty: product.wholesale_min_qty,
					category: product.category ?? "",
					quantity: 1,
				},
			];
		});
	};

	const canCreate = selectedCustomer && selectedProducts.length > 0;
	const handleCreateService = () => {
		if (!selectedCustomer) return;
		createMutation.mutate({
			customerId: selectedCustomer.id,
			serviceType,
			estimatedDoneAt,
			customerNote,
			internalNote,
			details: { text: detailText },
			items: selectedProducts.map((item) => ({
				id: item.id,
				quantity: item.quantity,
				price: item.price,
				lineType: item.product_type === "service" ? "service" : "product",
			})),
			total,
		});
	};
	const cartPanel = (
		<POSCartPanel
			items={selectedProducts}
			products={products}
			note={customerNote}
			total={total}
			locale={locale}
			isPending={createMutation.isPending}
			canCreate={Boolean(canCreate)}
			onNoteChange={setCustomerNote}
			onQuantityChange={(productId, delta) =>
				setSelectedProducts((prev) =>
					prev.map((item) =>
						item.id === productId
							? { ...item, quantity: Math.max(1, item.quantity + delta) }
							: item,
					),
				)
			}
			onPriceChange={(productId, price) =>
				setSelectedProducts((prev) =>
					prev.map((item) =>
						item.id === productId ? { ...item, price } : item,
					),
				)
			}
			onRemoveProduct={(productId) =>
				setSelectedProducts((prev) =>
					prev.filter((item) => item.id !== productId),
				)
			}
			onCreateOrder={handleCreateService}
		/>
	);

	return (
		<div className="mx-auto w-full max-w-7xl pb-24 lg:pb-0">
			<div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
				<div className="min-w-0 space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>{t("addService")}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex gap-2">
								<div className="min-w-0 flex-1">
									<Combobox
										items={customers.map((customer) => ({
											id: customer.id,
											name: customer.phone
												? `${customer.name} — ${customer.phone}`
												: customer.name,
										}))}
										placeholder={tPos("selectCustomer")}
										value={selectedCustomer?.name ?? ""}
										onSelect={(customerId) => {
											const customer = customers.find(
												(item) => item.id === customerId,
											);
											if (customer) setSelectedCustomer(customer);
										}}
									/>
								</div>
								<Button type="button" variant="outline" size="icon" disabled>
									<PlusCircle className="h-4 w-4" />
								</Button>
							</div>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>{t("serviceType")}</Label>
									<Select
										value={serviceType}
										onValueChange={(value) =>
											setServiceType(value as "phone" | "printing" | "other")
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="phone">
												{t("serviceTypePhone")}
											</SelectItem>
											<SelectItem value="printing">
												{t("serviceTypePrinting")}
											</SelectItem>
											<SelectItem value="other">
												{t("serviceTypeOther")}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>{t("estimatedDoneAt")}</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												className="w-full justify-start"
											>
												<CalendarIcon className="mr-2 h-4 w-4" />
												{estimatedDoneAt
													? estimatedDoneAt.toLocaleDateString(locale)
													: t("selectDate")}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto" align="start">
											<Input
												type="date"
												value={
													estimatedDoneAt
														? estimatedDoneAt.toISOString().slice(0, 10)
														: ""
												}
												onChange={(event) =>
													setEstimatedDoneAt(
														event.target.value
															? new Date(`${event.target.value}T00:00:00`)
															: undefined,
													)
												}
											/>
										</PopoverContent>
									</Popover>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="detail-text">{t("serviceDetails")}</Label>
								<Textarea
									id="detail-text"
									value={detailText}
									onChange={(event) => setDetailText(event.target.value)}
									placeholder={t("serviceDetailsPlaceholder")}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="customer-note">{t("customerNote")}</Label>
								<Textarea
									id="customer-note"
									value={customerNote}
									onChange={(event) => setCustomerNote(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="internal-note">{t("internalNote")}</Label>
								<Textarea
									id="internal-note"
									value={internalNote}
									onChange={(event) => setInternalNote(event.target.value)}
								/>
							</div>
						</CardContent>
					</Card>

					<POSProductCatalog
						products={filteredProducts}
						selectedProducts={selectedProducts}
						selectedCategory={selectedCategory}
						productCategories={productCategories}
						productSearch={productSearch}
						viewMode={viewMode}
						locale={locale}
						onSearchChange={setProductSearch}
						onCategoryChange={setSelectedCategory}
						onViewModeChange={setViewMode}
						onSelectProduct={handleSelectProduct}
					/>
				</div>
				<div className="hidden lg:block">{cartPanel}</div>
			</div>

			<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 lg:hidden">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
					<div>
						<div className="text-muted-foreground text-xs">
							{selectedProducts.length} {tPos("products")}
						</div>
						<div className="font-bold text-lg">
							{formatCurrency(total, locale)}
						</div>
					</div>
					<Button type="button" onClick={() => setIsCartOpen(true)}>
						{tPos("cartAndPay")}
					</Button>
				</div>
			</div>

			<Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("addService")}</DialogTitle>
					</DialogHeader>
					{cartPanel}
				</DialogContent>
			</Dialog>
		</div>
	);
}
