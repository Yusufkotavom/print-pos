"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	TableActionButton,
	TableActions,
} from "@finopenpos/ui/components/data-table";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { FilePenIcon, FolderTreeIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
	enqueueSyncItem,
	readCachedProductCategories,
	removeCachedProductCategory,
	replaceCachedProductCategories,
	upsertCachedProductCategory,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/router";

type ProductCategory = RouterOutputs["productCategories"]["list"][number];
type ProductCategoryCreateInput = RouterInputs["productCategories"]["create"];
type ProductCategoryUpdateInput = RouterInputs["productCategories"]["update"];

export default function ProductCategoriesPage() {
	const trpc = useTRPC();
	const tc = useTranslations("common");
	const {
		data: remoteCategories = [],
		isLoading,
		error,
	} = useQuery(trpc.productCategories.list.queryOptions());
	const [cachedCategories, setCachedCategories] = useState<ProductCategory[]>(
		[],
	);
	const hasCachedCategories = cachedCategories.length > 0;
	const categories =
		(isLoading || error) && hasCachedCategories
			? cachedCategories
			: remoteCategories;
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const isEditing = editingId !== null;
	const isOnline = useOnlineStatus();
	const isOfflineMode = !isOnline || !!error;
	const invalidateKeys = trpc.productCategories.list.queryOptions().queryKey;
	const schema = z.object({ name: z.string().min(1).max(100) });

	useEffect(() => {
		void readCachedProductCategories<ProductCategory>().then(
			setCachedCategories,
		);
	}, []);

	useEffect(() => {
		if (isLoading || error) return;
		setCachedCategories(remoteCategories);
		void replaceCachedProductCategories(remoteCategories);
	}, [remoteCategories, error, isLoading]);

	const createMutation = useCrudMutation({
		mutationOptions: trpc.productCategories.create.mutationOptions(),
		invalidateKeys,
		successMessage: "Kategori produk dibuat",
		errorMessage: "Gagal membuat kategori produk",
		onSuccess: () => {
			setIsDialogOpen(false);
			form.reset();
		},
	});
	const updateMutation = useCrudMutation({
		mutationOptions: trpc.productCategories.update.mutationOptions(),
		invalidateKeys,
		successMessage: "Kategori produk diperbarui",
		errorMessage: "Gagal memperbarui kategori produk",
		onSuccess: () => {
			setIsDialogOpen(false);
			form.reset();
		},
	});
	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.productCategories.delete.mutationOptions(),
		invalidateKeys,
		successMessage: "Kategori produk dihapus",
		errorMessage: "Gagal menghapus kategori produk",
	});

	useEffect(() => {
		if (!isOnline) return;
		void syncReadyQueue({
			createProductCategory: (payload) =>
				createMutation.mutateAsync(payload as ProductCategoryCreateInput),
			updateProductCategory: (payload) =>
				updateMutation.mutateAsync(payload as ProductCategoryUpdateInput),
			deleteProductCategory: (payload) =>
				deleteMutation.mutateAsync(payload as { id: number }),
		});
	}, [createMutation, deleteMutation, isOnline, updateMutation]);

	const buildOptimisticCategory = (id: number, name: string) =>
		({
			id,
			name,
			user_uid: categories.find((item) => item.id === id)?.user_uid ?? "local",
			created_at:
				categories.find((item) => item.id === id)?.created_at ?? new Date(),
		}) satisfies ProductCategory;

	const form = useForm({
		defaultValues: { name: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			if (isOfflineMode) {
				if (isEditing) {
					const nextCategory = buildOptimisticCategory(editingId, value.name);
					await upsertCachedProductCategory(nextCategory);
					setCachedCategories((current) =>
						current
							.map((item) => (item.id === editingId ? nextCategory : item))
							.sort((a, b) => a.name.localeCompare(b.name)),
					);
					await enqueueSyncItem({
						id: `productCategory:update:${editingId}`,
						entity: "productCategory",
						operation: "update",
						payload: { id: editingId, name: value.name },
						status: "pending",
						retryCount: 0,
					});
				} else {
					const localId = -Date.now();
					const nextCategory = buildOptimisticCategory(localId, value.name);
					await upsertCachedProductCategory(nextCategory);
					setCachedCategories((current) =>
						[...current, nextCategory].sort((a, b) =>
							a.name.localeCompare(b.name),
						),
					);
					await enqueueSyncItem({
						id: `productCategory:create:${localId}`,
						entity: "productCategory",
						operation: "create",
						payload: { localId, name: value.name },
						status: "pending",
						retryCount: 0,
					});
				}
				setIsDialogOpen(false);
				form.reset();
				return;
			}
			if (isEditing) updateMutation.mutate({ id: editingId, ...value });
			else createMutation.mutate(value);
		},
	});

	const columns: Column<ProductCategory>[] = [
		{ key: "name", header: tc("name"), sortable: true },
		{
			key: "actions",
			header: tc("actions"),
			render: (row) => (
				<TableActions>
					<TableActionButton
						onClick={() => {
							setEditingId(row.id);
							form.setFieldValue("name", row.name);
							setIsDialogOpen(true);
						}}
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
		},
	];

	if (isLoading && !hasCachedCategories)
		return <Skeleton className="h-96 w-full" />;

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div className="flex items-center gap-2">
					<CardTitle>Kategori Produk</CardTitle>
					{isOfflineMode ? (
						<Badge variant="secondary">Offline cache</Badge>
					) : null}
				</div>
				<Button
					size="sm"
					onClick={() => {
						setEditingId(null);
						form.reset();
						setIsDialogOpen(true);
					}}
				>
					<PlusIcon className="mr-2 h-4 w-4" />
					Tambah
				</Button>
			</CardHeader>
			<CardContent>
				{isOfflineMode ? (
					<div className="mb-3 text-muted-foreground text-sm">
						Offline changes queued for sync.
					</div>
				) : null}
				<DataTable
					data={categories}
					columns={columns}
					emptyMessage="Kategori produk belum ada."
					emptyIcon={<FolderTreeIcon className="h-8 w-8" />}
				/>
			</CardContent>
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? "Edit" : "Tambah"} Kategori Produk
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
						<form.Field name="name">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor="name">{tc("name")}</Label>
									<Input
										id="name"
										value={field.state.value}
										onChange={(event) => field.handleChange(event.target.value)}
										onBlur={field.handleBlur}
									/>
								</div>
							)}
						</form.Field>
						<DialogFooter>
							<Button type="submit">
								{isEditing ? tc("update") : tc("create")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<DeleteConfirmationDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={() => {
					if (deleteId !== null) {
						if (isOfflineMode) {
							void removeCachedProductCategory(deleteId);
							setCachedCategories((current) =>
								current.filter((item) => item.id !== deleteId),
							);
							void enqueueSyncItem({
								id: `productCategory:delete:${deleteId}`,
								entity: "productCategory",
								operation: "delete",
								payload: { id: deleteId },
								status: "pending",
								retryCount: 0,
							});
						} else deleteMutation.mutate({ id: deleteId });
					}
					setDeleteId(null);
				}}
			/>
		</Card>
	);
}
