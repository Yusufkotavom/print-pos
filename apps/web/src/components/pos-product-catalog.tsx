"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import {
	LayoutGridIcon,
	ListIcon,
	PackageIcon,
	SearchIcon,
} from "lucide-react";
import * as Icons from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { formatCurrency } from "@/lib/utils";

type ProductItem = {
	id: number;
	name: string;
	price: number;
	category?: string | null;
	icon?: string | null;
	image_url?: string | null;
	in_stock: number;
	track_stock: boolean;
	product_type: string;
};

type SelectedProduct = {
	id: number;
	quantity: number;
};

interface POSProductCatalogProps {
	products: ProductItem[];
	selectedProducts: SelectedProduct[];
	selectedCategory: string;
	productCategories: string[];
	productSearch: string;
	viewMode: "grid" | "list";
	locale: string;
	onSearchChange: (value: string) => void;
	onCategoryChange: (value: string) => void;
	onViewModeChange: (value: "grid" | "list") => void;
	onSelectProduct: (productId: number) => void;
}

export function POSProductCatalog({
	products,
	selectedProducts,
	selectedCategory,
	productCategories,
	productSearch,
	viewMode,
	locale,
	onSearchChange,
	onCategoryChange,
	onViewModeChange,
	onSelectProduct,
}: POSProductCatalogProps) {
	const t = useTranslations("pos");
	const tc = useTranslations("common");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("products")}</CardTitle>
				<div className="!mt-4 space-y-3">
					<div className="flex min-w-0 gap-2">
						<div className="relative min-w-0 flex-1">
							<SearchIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								type="text"
								placeholder={t("searchPlaceholder")}
								value={productSearch}
								onChange={(e) => onSearchChange(e.target.value)}
								className="pl-8"
							/>
						</div>
						<div className="flex w-fit items-center gap-1 rounded-lg border p-1">
							<ModeButton
								active={viewMode === "grid"}
								onClick={() => onViewModeChange("grid")}
								icon={<LayoutGridIcon className="h-4 w-4" />}
							/>
							<ModeButton
								active={viewMode === "list"}
								onClick={() => onViewModeChange("list")}
								icon={<ListIcon className="h-4 w-4" />}
							/>
						</div>
					</div>
					<div className="max-w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						<div className="inline-flex min-w-max gap-2">
							<Button
								type="button"
								variant={selectedCategory === "all" ? "default" : "outline"}
								size="sm"
								onClick={() => onCategoryChange("all")}
								className="shrink-0"
							>
								{tc("all")}
							</Button>
							{productCategories.map((category) => (
								<Button
									key={category}
									type="button"
									variant={
										selectedCategory === category ? "default" : "outline"
									}
									size="sm"
									onClick={() => onCategoryChange(category)}
									className="shrink-0"
								>
									{category}
								</Button>
							))}
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{products.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
						{t("selectProducts")}
					</div>
				) : (
					<div
						className={`grid gap-3 ${viewMode === "grid" ? "grid-cols-2" : "grid-cols-1"}`}
					>
						{products.map((product) => {
							const FallbackIcon = product.icon ? (Icons as any)[product.icon] || PackageIcon : PackageIcon;
							const selectedProduct = selectedProducts.find(
								(p) => p.id === product.id,
							);
							return (
								<button
									key={product.id}
									type="button"
									onClick={() => onSelectProduct(product.id)}
									className={`rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 ${viewMode === "grid" ? "min-h-36" : ""}`}
								>
									<div
										className={`gap-3 ${viewMode === "grid" ? "flex flex-col" : "flex items-center"}`}
									>
										<div
											className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ${viewMode === "grid" ? "h-20 w-full" : "h-12 w-12"}`}
										>
											{product.image_url ? (
												<img
													src={product.image_url}
													alt={product.name}
													className="h-full w-full object-cover"
												/>
											) : (
												<FallbackIcon className="h-5 w-5 text-muted-foreground md:h-6 md:w-6" />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<div className="break-words font-semibold text-sm leading-tight md:text-base">
														{product.name}
													</div>
													<div className="text-muted-foreground text-xs">
														{product.category ?? "—"}
													</div>
												</div>
												{selectedProduct && (
													<Badge>{selectedProduct.quantity}</Badge>
												)}
											</div>
											<div className="mt-2 font-bold text-base md:text-lg">
												{formatCurrency(product.price, locale)}
											</div>
											<div className="mt-1 text-muted-foreground text-xs">
												{product.product_type === "service"
													? t("service")
													: product.track_stock
														? t("stockCount", { count: product.in_stock })
														: t("unlimitedStock")}
											</div>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ModeButton({
	active,
	onClick,
	icon,
}: {
	active: boolean;
	onClick: () => void;
	icon: ComponentProps<typeof Button>["children"];
}) {
	return (
		<Button
			type="button"
			variant={active ? "default" : "ghost"}
			size="icon"
			className="h-8 w-8"
			onClick={onClick}
		>
			{icon}
		</Button>
	);
}
