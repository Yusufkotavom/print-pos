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
import { useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type Category = RouterOutputs["transactionCategories"]["list"][number];
type CategoryType = "income" | "expense";

export default function CategoriesPage() {
	const trpc = useTRPC();
	const { data: categories = [], isLoading } = useQuery(
		trpc.transactionCategories.list.queryOptions(),
	);
	const t = useTranslations("categories");
	const tc = useTranslations("common");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);

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

	const form = useForm({
		defaultValues: {
			name: "",
			type: "income" as CategoryType,
		},
		validators: {
			onSubmit: categorySchema,
		},
		onSubmit: ({ value }) => {
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

	const handleDelete = () => {
		if (deleteId !== null) {
			deleteMutation.mutate({ id: deleteId });
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

	if (isLoading) {
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
