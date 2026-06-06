"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	type ExportColumn,
	TableActionButton,
	TableActions,
} from "@finopenpos/ui/components/data-table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	type FilterOption,
	SearchFilter,
} from "@finopenpos/ui/components/search-filter";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@finopenpos/ui/components/tabs";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	FilePenIcon,
	FileUpIcon,
	ImageIcon,
	PackageIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useProductImageSync } from "@/hooks/use-product-image-sync";
import {
	cacheProductImage,
	readCachedProductImage,
	removeCachedProductImage,
} from "@/lib/local-db/repo";
import { uploadProductImage } from "@/lib/product-images";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];
type ProductType = "product" | "service";

export default function Products() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: products = [], isLoading } = useQuery(
		trpc.products.list.queryOptions(),
	);
	const { data: categories = [] } = useQuery(
		trpc.productCategories.list.queryOptions(),
	);
	const t = useTranslations("products");
	const tc = useTranslations("common");
	const locale = useLocale();
	const isOnline = useOnlineStatus();

	const productFormSchema = z.object({
		name: z.string().min(1, t("nameRequired")),
		description: z.string(),
		product_type: z.enum(["product", "service"]),
		price: z.number().min(0, t("priceMustBePositive")),
		cost: z.number().min(0, t("priceMustBePositive")),
		track_stock: z.boolean(),
		in_stock: z.number().int().min(0, t("stockMustBeNonNegative")),
		category: z.string(),
		wholesale_price: z.number().min(0).nullable(),
		wholesale_min_qty: z.number().int().min(1).nullable(),
	});

	const categoryFilterOptions: FilterOption[] = [
		{ label: tc("all"), value: "all" },
		...categories.map((category) => ({
			label: category.name,
			value: category.name,
		})),
	];

	const stockFilterOptions: FilterOption[] = [
		{ label: t("allStock"), value: "all" },
		{ label: t("inStock"), value: "in-stock", variant: "success" },
		{ label: t("outOfStock"), value: "out-of-stock", variant: "danger" },
	];

	const columns: Column<Product>[] = [
		{
			key: "image_url",
			header: "Gambar",
			hideOnMobile: true,
			render: (row) =>
				row.image_url ? (
					<Image
						src={row.image_url}
						alt={row.name}
						width={40}
						height={40}
						className="h-10 w-10 rounded-md object-cover"
						unoptimized
					/>
				) : (
					<div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
						<ImageIcon className="h-4 w-4 text-muted-foreground" />
					</div>
				),
		},
		{
			key: "name",
			header: t("product"),
			sortable: true,
			className: "font-medium",
		},
		{ key: "description", header: tc("description"), hideOnMobile: true },
		{
			key: "product_type",
			header: t("type"),
			sortable: true,
			render: (row) =>
				row.product_type === "service" ? t("service") : t("physicalProduct"),
		},
		{
			key: "price",
			header: tc("price"),
			sortable: true,
			accessorFn: (row) => row.price,
			render: (row) => formatCurrency(row.price, locale),
		},
		{
			key: "cost",
			header: "HPP",
			sortable: true,
			accessorFn: (row) => row.cost,
			render: (row) => formatCurrency(row.cost, locale),
		},
		{
			key: "in_stock",
			header: t("stock"),
			sortable: true,
			render: (row) => (row.track_stock ? row.in_stock : t("unlimited")),
		},
	];

	const exportColumns: ExportColumn<Product>[] = [
		{ key: "id", header: "id", getValue: (p) => p.id },
		{ key: "name", header: t("product"), getValue: (p) => p.name },
		{
			key: "description",
			header: tc("description"),
			getValue: (p) => p.description ?? "",
		},
		{
			key: "price",
			header: tc("price"),
			getValue: (p) => (p.price / 100).toFixed(2),
		},
		{
			key: "cost",
			header: "HPP",
			getValue: (p) => (p.cost / 100).toFixed(2),
		},
		{
			key: "product_type",
			header: t("type"),
			getValue: (p) => p.product_type,
		},
		{ key: "in_stock", header: t("stock"), getValue: (p) => p.in_stock },
		{
			key: "track_stock",
			header: t("manageStock"),
			getValue: (p) => (p.track_stock ? "true" : "false"),
		},
		{
			key: "category",
			header: tc("category"),
			getValue: (p) => p.category ?? "",
		},
	];

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [stockFilter, setStockFilter] = useState("all");
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
	const [imageMeta, setImageMeta] = useState<{
		url?: string;
		key?: string;
		width?: number;
		height?: number;
	} | null>(null);

	const isEditing = editingId !== null;
	const invalidateKeys = trpc.products.list.queryOptions().queryKey;
	const resetImageState = () => {
		setImageFile(null);
		setImagePreviewUrl(null);
		setImageMeta(null);
	};

	useEffect(() => {
		return () => {
			if (imagePreviewUrl?.startsWith("blob:"))
				URL.revokeObjectURL(imagePreviewUrl);
		};
	}, [imagePreviewUrl]);

	const createMutation = useCrudMutation({
		mutationOptions: trpc.products.create.mutationOptions(),
		invalidateKeys,
		successMessage: t("created"),
		errorMessage: t("createError"),
		onSuccess: () => {
			resetImageState();
			setIsDialogOpen(false);
		},
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.products.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => {
			resetImageState();
			setIsDialogOpen(false);
		},
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.products.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	const {
		queueCount: imageQueueCount,
		queueProductImageUpload,
		syncQueuedProductImages,
	} = useProductImageSync({
		updateProductImage: async (payload) => {
			await updateMutation.mutateAsync(payload);
		},
	});

	useEffect(() => {
		void syncQueuedProductImages();
		const handleOnline = () => void syncQueuedProductImages();
		window.addEventListener("online", handleOnline);
		return () => window.removeEventListener("online", handleOnline);
	}, [syncQueuedProductImages]);

	const createCategoryMutation = useMutation(
		trpc.productCategories.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.productCategories.list.queryOptions(),
				);
				setNewCategoryName("");
				setIsCategoryDialogOpen(false);
				toast.success(t("categoryCreated"));
			},
			onError: () => toast.error(t("categoryCreateError")),
		}),
	);

	const form = useForm({
		defaultValues: {
			name: "",
			description: "",
			price: 0,
			cost: 0,
			product_type: "product" as ProductType,
			track_stock: true,
			in_stock: 0,
			category: "",
			wholesale_price: null as number | null,
			wholesale_min_qty: null as number | null,
		},
		validators: {
			onSubmit: productFormSchema,
		},
		onSubmit: async ({ value }) => {
			const trackStock = value.product_type === "product" && value.track_stock;
			const inStock = trackStock ? value.in_stock : 0;
			if (imageFile && editingId !== null && !isOnline) {
				await cacheProductImage(editingId, imageFile);
				await queueProductImageUpload(editingId);
				toast.success("Gambar disimpan lokal dan masuk antrean sinkronisasi.");
				resetImageState();
				setIsDialogOpen(false);
				return;
			}
			const uploadedImage = imageFile
				? await uploadProductImage(imageFile)
				: imageMeta;
			const payload = {
				name: value.name,
				description: value.description || undefined,
				price: Math.round(value.price * 100),
				cost: Math.round(value.cost * 100),
				in_stock: inStock,
				track_stock: trackStock,
				product_type: value.product_type,
				category: value.category || undefined,
				wholesale_price:
					value.wholesale_price != null
						? Math.round(value.wholesale_price * 100)
						: undefined,
				wholesale_min_qty: value.wholesale_min_qty ?? undefined,
				image_url: uploadedImage?.url,
				image_key: uploadedImage?.key,
				image_width: uploadedImage?.width,
				image_height: uploadedImage?.height,
			};

			if (isEditing) {
				updateMutation.mutate({ id: editingId, ...payload });
			} else {
				createMutation.mutate(payload);
			}
		},
	});

	const filteredProducts = useMemo(() => {
		return products.filter((p) => {
			if (categoryFilter !== "all" && p.category !== categoryFilter)
				return false;
			if (
				stockFilter === "in-stock" &&
				p.product_type === "product" &&
				p.track_stock &&
				p.in_stock === 0
			)
				return false;
			if (
				stockFilter === "out-of-stock" &&
				(p.product_type !== "product" || !p.track_stock || p.in_stock > 0)
			)
				return false;
			return p.name.toLowerCase().includes(searchTerm.toLowerCase());
		});
	}, [products, categoryFilter, stockFilter, searchTerm]);

	const openEdit = (p: Product) => {
		setEditingId(p.id);
		form.reset();
		setImageFile(null);
		setImageMeta({
			url: p.image_url ?? undefined,
			key: p.image_key ?? undefined,
			width: p.image_width ?? undefined,
			height: p.image_height ?? undefined,
		});
		setImagePreviewUrl(p.image_url ?? null);
		void readCachedProductImage(p.id).then((cached) => {
			if (cached?.blob) setImagePreviewUrl(URL.createObjectURL(cached.blob));
		});
		form.setFieldValue("name", p.name);
		form.setFieldValue("description", p.description ?? "");
		form.setFieldValue("price", p.price / 100);
		form.setFieldValue("cost", p.cost / 100);
		form.setFieldValue("product_type", p.product_type as ProductType);
		form.setFieldValue("track_stock", p.track_stock);
		form.setFieldValue("in_stock", p.in_stock);
		form.setFieldValue("category", p.category ?? "");
		form.setFieldValue(
			"wholesale_price",
			p.wholesale_price != null ? p.wholesale_price / 100 : null,
		);
		form.setFieldValue("wholesale_min_qty", p.wholesale_min_qty ?? null);
		setIsDialogOpen(true);
	};

	const handleDelete = () => {
		if (deleteId !== null) {
			void removeCachedProductImage(deleteId);
			deleteMutation.mutate({ id: deleteId });
			setIsDeleteOpen(false);
			setDeleteId(null);
		}
	};

	const handleImageChange = async (file: File | null) => {
		setImageFile(file);
		if (!file) {
			setImagePreviewUrl(imageMeta?.url ?? null);
			return;
		}
		const objectUrl = URL.createObjectURL(file);
		setImagePreviewUrl(objectUrl);
		if (editingId !== null) await cacheProductImage(editingId, file);
	};

	const actionsColumn: Column<Product> = {
		key: "actions",
		header: tc("actions"),
		render: (row) => (
			<TableActions>
				<TableActionButton
					onClick={() => openEdit(row)}
					icon={<FilePenIcon className="h-4 w-4" />}
					label={tc("edit")}
				/>
				<TableActionButton
					variant="danger"
					onClick={() => {
						setDeleteId(row.id);
						setIsDeleteOpen(true);
					}}
					icon={<TrashIcon className="h-4 w-4" />}
					label={tc("delete")}
				/>
			</TableActions>
		),
	};

	if (isLoading) {
		return (
			<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-9 w-32" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-8 w-20" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			{!isOnline && (
				<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 text-sm">
					Offline mode. Update gambar produk akan disinkronkan nanti.
				</div>
			)}
			{imageQueueCount > 0 && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
					<span>{imageQueueCount} gambar produk menunggu sinkronisasi.</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void syncQueuedProductImages()}
					>
						Sync now
					</Button>
				</div>
			)}
			<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
				<CardHeader className="p-0">
					<SearchFilter
						search={searchTerm}
						onSearchChange={setSearchTerm}
						searchPlaceholder={t("searchPlaceholder")}
						filters={[
							{
								options: categoryFilterOptions,
								value: categoryFilter,
								onChange: setCategoryFilter,
							},
							{
								options: stockFilterOptions,
								value: stockFilter,
								onChange: setStockFilter,
							},
						]}
					>
						<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setIsCategoryDialogOpen(true)}
								className="w-full whitespace-nowrap sm:w-auto"
							>
								<PackageIcon className="mr-2 h-4 w-4" />
								{t("addCategory")}
							</Button>

							<Button
								variant="outline"
								size="sm"
								asChild
								className="w-full whitespace-nowrap sm:w-auto"
							>
								<Link href="/admin/products/import">
									<FileUpIcon className="mr-2 h-4 w-4" />
									Import CSV
								</Link>
							</Button>

							<Button
								size="sm"
								variant="outline"
								onClick={() => {
									const BOM = "\uFEFF";
									const header = exportColumns
										.map((c) => `"${c.header}"`)
										.join(",");
									const rows = filteredProducts.map((item) =>
										exportColumns
											.map((c) => {
												const val = c.getValue(item);
												return typeof val === "string"
													? `"${val.replace(/"/g, '""')}"`
													: val;
											})
											.join(","),
									);
									const csv = BOM + [header, ...rows].join("\n");
									const blob = new Blob([csv], {
										type: "text/csv;charset=utf-8",
									});
									const url = URL.createObjectURL(blob);
									const a = document.createElement("a");
									a.href = url;
									a.download = `products-export-${Date.now()}.csv`;
									document.body.appendChild(a);
									a.click();
									setTimeout(() => {
										document.body.removeChild(a);
										URL.revokeObjectURL(url);
									}, 150);
								}}
								className="w-full whitespace-nowrap sm:w-auto"
							>
								<FileUpIcon className="mr-2 h-4 w-4 rotate-180" />
								Export CSV
							</Button>

							<Button
								size="sm"
								onClick={() => {
									setEditingId(null);
									form.reset();
									resetImageState();
									setIsDialogOpen(true);
								}}
								className="w-full whitespace-nowrap sm:w-auto"
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								{t("addProduct")}
							</Button>
						</div>
					</SearchFilter>
				</CardHeader>
				<CardContent className="p-0">
					<DataTable
						data={filteredProducts}
						columns={[...columns, actionsColumn]}
						emptyMessage={t("noProducts")}
						emptyIcon={<PackageIcon className="h-8 w-8" />}
						defaultSort={[{ id: "name", desc: false }]}
					/>
				</CardContent>
			</Card>

			<Dialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						resetImageState();
						setIsDialogOpen(false);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? t("editProduct") : t("addNewProduct")}
						</DialogTitle>
						<DialogDescription>
							{isEditing ? t("editDescription") : t("addDescription")}
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<Tabs defaultValue="info">
							<TabsList className="mb-4 w-full">
								<TabsTrigger value="info">Info Dasar</TabsTrigger>
								<TabsTrigger value="image">Gambar</TabsTrigger>
								<TabsTrigger value="wholesale">Harga Grosir</TabsTrigger>
							</TabsList>

							<TabsContent value="info">
								<div className="grid gap-4 py-2">
									<form.Field name="name">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label htmlFor="name" className="sm:text-right">
													{tc("name")}
												</Label>
												<div className="col-span-3">
													<Input
														id="name"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														error={
															field.state.meta.errors.length > 0
																? field.state.meta.errors
																		.map((e) => e?.message ?? e)
																		.join(", ")
																: undefined
														}
													/>
												</div>
											</div>
										)}
									</form.Field>
									<form.Field name="description">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label htmlFor="description" className="sm:text-right">
													{tc("description")}
												</Label>
												<Input
													id="description"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													className="col-span-3"
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="price">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label htmlFor="price" className="sm:text-right">
													{tc("price")}
												</Label>
												<div className="col-span-3">
													<FormattedNumberInput
														id="price"
														value={field.state.value}
														onValueChange={(value) =>
															field.handleChange(value ?? 0)
														}
														onBlur={field.handleBlur}
														error={
															field.state.meta.errors.length > 0
																? field.state.meta.errors
																		.map((e) => e?.message ?? e)
																		.join(", ")
																: undefined
														}
													/>
												</div>
											</div>
										)}
									</form.Field>
									<form.Field name="cost">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label htmlFor="cost" className="sm:text-right">
													HPP
												</Label>
												<div className="col-span-3">
													<FormattedNumberInput
														id="cost"
														value={field.state.value}
														onValueChange={(value) =>
															field.handleChange(value ?? 0)
														}
														onBlur={field.handleBlur}
														error={
															field.state.meta.errors.length > 0
																? field.state.meta.errors
																		.map((e) => e?.message ?? e)
																		.join(", ")
																: undefined
														}
													/>
												</div>
											</div>
										)}
									</form.Field>
									<form.Field name="product_type">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label htmlFor="product_type" className="sm:text-right">
													{t("type")}
												</Label>
												<Select
													value={field.state.value}
													onValueChange={(value) =>
														field.handleChange(value as ProductType)
													}
												>
													<SelectTrigger className="col-span-3">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="product">
															{t("physicalProduct")}
														</SelectItem>
														<SelectItem value="service">
															{t("service")}
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										)}
									</form.Field>
									<form.Field name="track_stock">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<div className="sm:text-right">
													<Label htmlFor="track_stock">
														{t("manageStock")}
													</Label>
												</div>
												<div className="col-span-3 flex items-center gap-2 text-sm">
													<Input
														id="track_stock"
														type="checkbox"
														checked={field.state.value}
														onChange={(event) =>
															field.handleChange(event.target.checked)
														}
														className="h-4 w-4"
													/>
													<span>{t("manageStockDescription")}</span>
												</div>
											</div>
										)}
									</form.Field>
									<form.Subscribe
										selector={(state) => ({
											productType: state.values.product_type,
											trackStock: state.values.track_stock,
										})}
									>
										{({ productType, trackStock }) =>
											productType === "product" && trackStock ? (
												<form.Field name="in_stock">
													{(field) => (
														<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
															<Label
																htmlFor="in_stock"
																className="sm:text-right"
															>
																{t("inStock")}
															</Label>
															<div className="col-span-3">
																<FormattedNumberInput
																	id="in_stock"
																	value={field.state.value}
																	onValueChange={(value) =>
																		field.handleChange(value ?? 0)
																	}
																	onBlur={field.handleBlur}
																	error={
																		field.state.meta.errors.length > 0
																			? field.state.meta.errors
																					.map((e) => e?.message ?? e)
																					.join(", ")
																			: undefined
																	}
																/>
															</div>
														</div>
													)}
												</form.Field>
											) : null
										}
									</form.Subscribe>

									<form.Field name="category">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label htmlFor="category" className="sm:text-right">
													{tc("category")}
												</Label>
												<Select
													value={field.state.value}
													onValueChange={(value) => field.handleChange(value)}
												>
													<SelectTrigger className="col-span-3">
														<SelectValue placeholder={t("selectCategory")} />
													</SelectTrigger>
													<SelectContent>
														{categories.map((category) => (
															<SelectItem
																key={category.id}
																value={category.name}
															>
																{category.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										)}
									</form.Field>
								</div>
							</TabsContent>

							<TabsContent value="image">
								<div className="grid gap-4 py-2">
									<div className="flex flex-col gap-3">
										<Label htmlFor="product-image">Gambar Produk</Label>
										<div className="flex items-center gap-4">
											<div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">
												{imagePreviewUrl ? (
													<Image
														src={imagePreviewUrl}
														alt="Product image preview"
														width={96}
														height={96}
														className="h-24 w-24 object-cover"
														unoptimized
													/>
												) : (
													<ImageIcon className="h-6 w-6 text-muted-foreground" />
												)}
											</div>
											<Input
												id="product-image"
												type="file"
												accept="image/png,image/jpeg,image/webp"
												onChange={(e) =>
													void handleImageChange(e.target.files?.[0] ?? null)
												}
											/>
										</div>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="wholesale">
								<div className="grid gap-5 py-4">
									<p className="text-muted-foreground text-sm">
										Atur harga khusus ketika pelanggan membeli dalam jumlah
										banyak. Harga grosir akan otomatis diterapkan di POS saat
										qty mencapai minimum.
									</p>
									<form.Field name="wholesale_price">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label
													htmlFor="wholesale_price"
													className="sm:text-right"
												>
													Harga Grosir (Rp)
												</Label>
												<div className="col-span-3">
													<FormattedNumberInput
														id="wholesale_price"
														placeholder="Contoh: 9.500"
														value={field.state.value}
														allowEmpty
														onValueChange={field.handleChange}
													/>
												</div>
											</div>
										)}
									</form.Field>
									<form.Field name="wholesale_min_qty">
										{(field) => (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label
													htmlFor="wholesale_min_qty"
													className="sm:text-right"
												>
													Min. Qty Grosir
												</Label>
												<div className="col-span-3">
													<FormattedNumberInput
														id="wholesale_min_qty"
														placeholder="Contoh: 12"
														value={field.state.value}
														allowEmpty
														onValueChange={field.handleChange}
													/>
													<p className="mt-1 text-muted-foreground text-xs">
														Harga grosir aktif saat qty ≥ angka ini
													</p>
												</div>
											</div>
										)}
									</form.Field>
								</div>
							</TabsContent>
						</Tabs>

						<DialogFooter className="mt-4">
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button
										type="submit"
										disabled={
											isSubmitting ||
											createMutation.isPending ||
											updateMutation.isPending
										}
									>
										{isEditing ? t("updateProduct") : t("addProduct")}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isCategoryDialogOpen}
				onOpenChange={setIsCategoryDialogOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("addCategory")}</DialogTitle>
						<DialogDescription>{t("addCategoryDescription")}</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="category-name">{tc("name")}</Label>
						<Input
							id="category-name"
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							placeholder={t("categoryNamePlaceholder")}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							disabled={
								!newCategoryName.trim() || createCategoryMutation.isPending
							}
							onClick={() =>
								createCategoryMutation.mutate({ name: newCategoryName.trim() })
							}
						>
							{t("addCategory")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<DeleteConfirmationDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={handleDelete}
				description={t("deleteMessage")}
			/>
		</>
	);
}
