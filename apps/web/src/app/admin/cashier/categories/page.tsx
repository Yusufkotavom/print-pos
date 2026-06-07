"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
	FilePenIcon,
	FolderTreeIcon,
	Loader2Icon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
	enqueueSyncItem,
	readCachedTransactionCategories,
	removeCachedTransactionCategory,
	replaceCachedTransactionCategories,
	upsertCachedTransactionCategory,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/router";

type Category = RouterOutputs["transactionCategories"]["list"][number];
type CategoryCreateInput = RouterInputs["transactionCategories"]["create"];
type CategoryUpdateInput = RouterInputs["transactionCategories"]["update"];
type CategoryType = "income" | "expense";

export default function CategoriesPage() {
	const trpc = useTRPC();
	const {
		data: remoteCategories = [],
		isLoading,
		error,
	} = useQuery(trpc.transactionCategories.list.queryOptions());
	const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
	const hasCachedCategories = cachedCategories.length > 0;
	const categories =
		(isLoading || error) && hasCachedCategories
			? cachedCategories
			: remoteCategories;
	const t = useTranslations("categories");
	const tc = useTranslations("common");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const isOnline = useOnlineStatus();
	const isOfflineMode = !isOnline || !!error;

	useEffect(() => {
		void readCachedTransactionCategories<Category>().then(setCachedCategories);
	}, []);

	useEffect(() => {
		if (isLoading || error) return;
		setCachedCategories(remoteCategories);
		void replaceCachedTransactionCategories(remoteCategories);
	}, [remoteCategories, error, isLoading]);

	const categorySchema = z.object({
		name: z.string().min(1, t("nameRequired")),
		type: z.enum(["income", "expense"]),
	});

	const isEditing = editingId !== null;
	const invalidateKeys =
		trpc.transactionCategories.list.queryOptions().queryKey;

	const createMutation = useCrudMutation({
		mutationOptions: trpc.transactionCategories.create.mutationOptions(),
		invalidateKeys,
		successMessage: t("created"),
		errorMessage: t("createError"),
		onSuccess: () => {
			setIsDialogOpen(false);
			form.reset();
		},
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.transactionCategories.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => {
			setIsDialogOpen(false);
			form.reset();
		},
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.transactionCategories.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	useEffect(() => {
		if (!isOnline) return;
		void syncReadyQueue({
			createTransactionCategory: (payload) =>
				createMutation.mutateAsync(payload as CategoryCreateInput),
			updateTransactionCategory: (payload) =>
				updateMutation.mutateAsync(payload as CategoryUpdateInput),
			deleteTransactionCategory: (payload) =>
				deleteMutation.mutateAsync(payload as { id: number }),
		});
	}, [createMutation, deleteMutation, isOnline, updateMutation]);

	const buildOptimisticCategory = (id: number, value: CategoryCreateInput) =>
		({
			id,
			name: value.name,
			type: value.type,
			user_uid: categories.find((item) => item.id === id)?.user_uid ?? "local",
			created_at:
				categories.find((item) => item.id === id)?.created_at ?? new Date(),
		}) satisfies Category;

	const form = useForm({
		defaultValues: {
			name: "",
			type: "income" as CategoryType,
		},
		validators: {
			onSubmit: categorySchema,
		},
		onSubmit: async ({ value }) => {
			if (isOfflineMode) {
				if (isEditing) {
					const nextCategory = buildOptimisticCategory(editingId, value);
					await upsertCachedTransactionCategory(nextCategory);
					setCachedCategories((current) =>
						current
							.map((item) => (item.id === editingId ? nextCategory : item))
							.sort(
								(a, b) =>
									a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
							),
					);
					await enqueueSyncItem({
						id: `transactionCategory:update:${editingId}`,
						entity: "transactionCategory",
						operation: "update",
						payload: { id: editingId, ...value },
						status: "pending",
						retryCount: 0,
					});
				} else {
					const localId = -Date.now();
					const nextCategory = buildOptimisticCategory(localId, value);
					await upsertCachedTransactionCategory(nextCategory);
					setCachedCategories((current) =>
						[...current, nextCategory].sort(
							(a, b) =>
								a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
						),
					);
					await enqueueSyncItem({
						id: `transactionCategory:create:${localId}`,
						entity: "transactionCategory",
						operation: "create",
						payload: { localId, ...value },
						status: "pending",
						retryCount: 0,
					});
				}
				setIsDialogOpen(false);
				form.reset();
				return;
			}
			if (isEditing) {
				updateMutation.mutate({ id: editingId, ...value });
			} else {
				createMutation.mutate(value);
			}
		},
	});

	const openCreate = () => {
		setEditingId(null);
		form.reset();
		setIsDialogOpen(true);
	};

	const openEdit = (category: Category) => {
		setEditingId(category.id);
		form.setFieldValue("name", category.name);
		form.setFieldValue("type", category.type as CategoryType);
		setIsDialogOpen(true);
	};

	const handleDelete = async () => {
		if (deleteId !== null) {
			if (isOfflineMode) {
				await removeCachedTransactionCategory(deleteId);
				setCachedCategories((current) =>
					current.filter((item) => item.id !== deleteId),
				);
				await enqueueSyncItem({
					id: `transactionCategory:delete:${deleteId}`,
					entity: "transactionCategory",
					operation: "delete",
					payload: { id: deleteId },
					status: "pending",
					retryCount: 0,
				});
			} else {
				deleteMutation.mutate({ id: deleteId });
			}
			setIsDeleteOpen(false);
			setDeleteId(null);
		}
	};

	const columns: Column<Category>[] = [
		{ key: "name", header: tc("name"), sortable: true },
		{
			key: "type",
			header: tc("type"),
			sortable: true,
			render: (row) => (
				<Badge variant={row.type as CategoryType}>
					{row.type === "income" ? tc("income") : tc("expense")}
				</Badge>
			),
		},
		{
			key: "actions",
			header: tc("actions"),
			headerClassName: "w-[100px]",
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
		},
	];

	if (isLoading && !hasCachedCategories) {
		return (
			<Card className="flex flex-col gap-6 p-6">
				<CardHeader className="p-0">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<div className="flex items-center justify-between gap-3">
					<div>
						<CardTitle>{t("title")}</CardTitle>
						<CardDescription>{t("subtitle")}</CardDescription>
					</div>
					<Button size="sm" onClick={openCreate}>
						<PlusIcon className="mr-2 h-4 w-4" />
						{t("addNew")}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<DataTable
					data={categories}
					columns={columns}
					emptyMessage={t("noCategories")}
					emptyIcon={<FolderTreeIcon className="h-8 w-8" />}
					defaultSort={[{ id: "type", desc: false }]}
				/>
			</CardContent>

			<Dialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!open) setIsDialogOpen(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? t("editCategory") : t("addNew")}
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<form.Field name="name">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="category-name">{tc("name")}</Label>
										<div className="col-span-3">
											<Input
												id="category-name"
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
							<form.Field name="type">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="category-type">{tc("type")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as CategoryType)
											}
										>
											<SelectTrigger id="category-type" className="col-span-3">
												<SelectValue placeholder={t("selectType")} />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="income">{tc("income")}</SelectItem>
												<SelectItem value="expense">{tc("expense")}</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="secondary"
								onClick={() => setIsDialogOpen(false)}
							>
								{tc("cancel")}
							</Button>
							<Button
								type="submit"
								disabled={createMutation.isPending || updateMutation.isPending}
							>
								{(createMutation.isPending || updateMutation.isPending) && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{tc("save")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<DeleteConfirmationDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={handleDelete}
				description={t("deleteMessage")}
			/>
		</Card>
	);
}
