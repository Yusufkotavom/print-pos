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
	TableActions,
} from "@finopenpos/ui/components/data-table";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@finopenpos/ui/components/dropdown-menu";
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
import { TableCell, TableRow } from "@finopenpos/ui/components/table";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { EllipsisVerticalIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
	enqueueSyncItem,
	readCachedTransactionCategories,
	readCachedTransactions,
	removeCachedTransaction,
	replaceCachedTransactionCategories,
	replaceCachedTransactions,
	upsertCachedTransaction,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency, formatDate } from "@/lib/utils";

type Transaction = RouterOutputs["transactions"]["list"][number];
type TransactionCategory =
	RouterOutputs["transactionCategories"]["list"][number];
type TransactionCreateInput = RouterInputs["transactions"]["create"];
type TransactionUpdateInput = RouterInputs["transactions"]["update"];
type TransactionType = "income" | "expense";
type TransactionStatus = "completed" | "pending";

export default function Cashier() {
	const trpc = useTRPC();
	const {
		data: remoteTransactions = [],
		isLoading,
		error,
	} = useQuery(trpc.transactions.list.queryOptions());
	const [cachedTransactions, setCachedTransactions] = useState<Transaction[]>(
		[],
	);
	const hasCachedTransactions = cachedTransactions.length > 0;
	const transactions =
		(isLoading || error) && hasCachedTransactions
			? cachedTransactions
			: remoteTransactions;
	const showSkeleton = isLoading && cachedTransactions.length === 0;
	const { data: remoteTransactionCategories = [], error: categoriesError } =
		useQuery(trpc.transactionCategories.list.queryOptions());
	const [cachedTransactionCategories, setCachedTransactionCategories] =
		useState<TransactionCategory[]>([]);
	const transactionCategories =
		categoriesError && cachedTransactionCategories.length
			? cachedTransactionCategories
			: remoteTransactionCategories;
	const t = useTranslations("cashier");
	const tc = useTranslations("common");
	const locale = useLocale();
	const isOnline = useOnlineStatus();
	const isOfflineMode = !isOnline || !!error;

	useEffect(() => {
		void readCachedTransactions<Transaction>().then(setCachedTransactions);
	}, []);

	useEffect(() => {
		void readCachedTransactionCategories<TransactionCategory>().then(
			setCachedTransactionCategories,
		);
	}, []);

	useEffect(() => {
		if (isLoading || error) return;
		setCachedTransactions(remoteTransactions);
		void replaceCachedTransactions(remoteTransactions);
	}, [remoteTransactions, error, isLoading]);

	useEffect(() => {
		if (categoriesError) return;
		setCachedTransactionCategories(remoteTransactionCategories);
		void replaceCachedTransactionCategories(remoteTransactionCategories);
	}, [remoteTransactionCategories, categoriesError]);

	const editTransactionSchema = z.object({
		description: z.string().min(1, t("descriptionRequired")),
		category: z.string(),
		type: z.enum(["income", "expense"]),
		amount: z.number().positive(t("amountPositive")),
		status: z.enum(["completed", "pending"]),
	});

	const tableColumns: Column<Transaction>[] = [
		{
			key: "transaction_number",
			header: "No.",
			sortable: true,
			accessorFn: (row) => row.transaction_number ?? `#${row.id}`,
			render: (row) => row.transaction_number ?? `#${row.id}`,
		},
		{ key: "description", header: tc("description"), sortable: true },
		{ key: "category", header: tc("category"), hideOnMobile: true },
		{
			key: "type",
			header: tc("type"),
			sortable: true,
			render: (row) => (
				<Badge variant={row.type as "income" | "expense" | undefined}>
					{row.type === "income" ? tc("income") : tc("expense")}
				</Badge>
			),
		},
		{
			key: "created_at",
			header: tc("date"),
			sortable: true,
			hideOnMobile: true,
			accessorFn: (row) =>
				row.created_at ? new Date(row.created_at).getTime() : 0,
			render: (row) =>
				row.created_at ? formatDate(row.created_at, locale) : "-",
		},
		{
			key: "amount",
			header: tc("amount"),
			sortable: true,
			accessorFn: (row) => row.amount,
			render: (row) => formatCurrency(row.amount, locale),
		},
		{
			key: "status",
			header: tc("status"),
			sortable: true,
			render: (row) => (
				<Badge variant={row.status === "completed" ? "default" : "secondary"}>
					{row.status === "completed" ? tc("completed") : tc("pending")}
				</Badge>
			),
		},
	];

	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);

	// Inline form state for the new row
	const [inlineForm, setInlineForm] = useState({
		description: "",
		category: "",
		type: "income" as TransactionType,
		amount: 0,
		status: "completed" as TransactionStatus,
	});

	const invalidateKeys = trpc.transactions.list.queryOptions().queryKey;

	const createMutation = useCrudMutation({
		mutationOptions: trpc.transactions.create.mutationOptions(),
		invalidateKeys,
		successMessage: t("created"),
		errorMessage: t("createError"),
		onSuccess: () => {
			setIsCreateOpen(false);
			setInlineForm({
				description: "",
				category: "",
				type: "income",
				amount: 0,
				status: "completed",
			});
		},
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.transactions.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => setIsEditOpen(false),
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.transactions.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	useEffect(() => {
		if (!isOnline) return;
		void syncReadyQueue({
			createTransaction: (payload) =>
				createMutation.mutateAsync(payload as TransactionCreateInput),
			updateTransaction: (payload) =>
				updateMutation.mutateAsync(payload as TransactionUpdateInput),
			deleteTransaction: (payload) =>
				deleteMutation.mutateAsync(payload as { id: number }),
		});
	}, [createMutation, deleteMutation, isOnline, updateMutation]);

	const buildOptimisticTransaction = (
		id: number,
		value: TransactionCreateInput,
	) =>
		({
			id,
			transaction_number:
				transactions.find((item) => item.id === id)?.transaction_number ?? null,
			description: value.description,
			amount: value.amount,
			type: value.type,
			category: value.category ?? null,
			status: value.status ?? "completed",
			order_id: null,
			payment_method_id: null,
			user_uid:
				transactions.find((item) => item.id === id)?.user_uid ?? "local",
			created_at:
				transactions.find((item) => item.id === id)?.created_at ?? new Date(),
		}) satisfies Transaction;

	const applyOfflineTransaction = async (
		operation: "create" | "update" | "delete",
		payload: TransactionCreateInput | TransactionUpdateInput | { id: number },
	) => {
		if (operation === "delete") {
			const id = (payload as { id: number }).id;
			await removeCachedTransaction(id);
			setCachedTransactions((current) =>
				current.filter((item) => item.id !== id),
			);
			await enqueueSyncItem({
				id: `transaction:delete:${id}`,
				entity: "transaction",
				operation: "delete",
				payload,
				status: "pending",
				retryCount: 0,
			});
			return;
		}
		if (operation === "create") {
			const localId = -Date.now();
			const nextTransaction = buildOptimisticTransaction(
				localId,
				payload as TransactionCreateInput,
			);
			await upsertCachedTransaction(nextTransaction);
			setCachedTransactions((current) => [nextTransaction, ...current]);
			await enqueueSyncItem({
				id: `transaction:create:${localId}`,
				entity: "transaction",
				operation: "create",
				payload: { localId, ...payload },
				status: "pending",
				retryCount: 0,
			});
			return;
		}
		const updatePayload = payload as TransactionUpdateInput;
		const current = transactions.find((item) => item.id === updatePayload.id);
		if (!current) return;
		const nextTransaction = {
			...current,
			...updatePayload,
			category: updatePayload.category ?? current.category,
		} satisfies Transaction;
		await upsertCachedTransaction(nextTransaction);
		setCachedTransactions((currentRows) =>
			currentRows.map((item) =>
				item.id === updatePayload.id ? nextTransaction : item,
			),
		);
		await enqueueSyncItem({
			id: `transaction:update:${updatePayload.id}`,
			entity: "transaction",
			operation: "update",
			payload,
			status: "pending",
			retryCount: 0,
		});
	};

	const editForm = useForm({
		defaultValues: {
			description: "",
			category: "",
			type: "income" as TransactionType,
			amount: 0,
			status: "completed" as TransactionStatus,
		},
		validators: {
			onSubmit: editTransactionSchema,
		},
		onSubmit: async ({ value }) => {
			if (editingId === null) return;
			const payload = {
				id: editingId,
				description: value.description,
				category: value.category || undefined,
				type: value.type,
				amount: Math.round(value.amount * 100),
				status: value.status,
			};
			if (isOfflineMode) {
				await applyOfflineTransaction("update", payload);
				setIsEditOpen(false);
				return;
			}
			updateMutation.mutate(payload);
		},
	});

	const inlineCategories = transactionCategories.filter(
		(category) => category.type === inlineForm.type,
	);

	const editCategories = transactionCategories.filter(
		(category) => category.type === editForm.state.values.type,
	);

	const openEdit = (t: Transaction) => {
		setEditingId(t.id);
		editForm.reset();
		editForm.setFieldValue("description", t.description ?? "");
		editForm.setFieldValue("category", t.category ?? "");
		editForm.setFieldValue("type", (t.type ?? "income") as TransactionType);
		editForm.setFieldValue("amount", t.amount / 100);
		editForm.setFieldValue(
			"status",
			(t.status ?? "completed") as TransactionStatus,
		);
		setIsEditOpen(true);
	};

	const handleAddTransaction = async () => {
		if (!inlineForm.description.trim()) return;
		if (inlineForm.amount <= 0) return;
		const payload = {
			description: inlineForm.description,
			category: inlineForm.category || undefined,
			type: inlineForm.type,
			amount: Math.round(inlineForm.amount * 100),
			status: inlineForm.status,
		};
		if (isOfflineMode) {
			await applyOfflineTransaction("create", payload);
			setInlineForm({
				description: "",
				category: "",
				type: "income",
				amount: 0,
				status: "completed",
			});
			setIsCreateOpen(false);
			return;
		}
		createMutation.mutate(payload);
	};

	const handleDelete = async () => {
		if (deleteId !== null) {
			if (isOfflineMode) {
				await applyOfflineTransaction("delete", { id: deleteId });
			} else {
				deleteMutation.mutate({ id: deleteId });
			}
			setIsDeleteOpen(false);
			setDeleteId(null);
		}
	};

	const actionsColumn: Column<Transaction> = {
		key: "actions",
		header: "",
		render: (row) => (
			<TableActions>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button aria-haspopup="true" size="icon" variant="ghost">
							<EllipsisVerticalIcon className="h-4 w-4" />
							<span className="sr-only">{t("toggleMenu")}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => openEdit(row)}>
							{tc("edit")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								setDeleteId(row.id);
								setIsDeleteOpen(true);
							}}
						>
							{tc("delete")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</TableActions>
		),
	};

	return (
		<>
			<Card className="w-full">
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div>
							<CardTitle>{t("title")}</CardTitle>
							<CardDescription>{t("subtitle")}</CardDescription>
						</div>
						<Button size="sm" onClick={() => setIsCreateOpen(true)}>
							<PlusIcon className="mr-2 h-4 w-4" />
							{t("addTransaction")}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{showSkeleton ? (
						<div className="space-y-3">
							{Array.from({ length: 5 }).map((_, i) => (
								<div key={i} className="flex items-center gap-4">
									<Skeleton className="h-4 w-12" />
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-6 w-16 rounded-full" />
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-6 w-16 rounded-full" />
								</div>
							))}
						</div>
					) : (
						<DataTable
							data={transactions}
							columns={[...tableColumns, actionsColumn]}
							mobileScroll
							defaultSort={[{ id: "created_at", desc: true }]}
							emptyMessage={t("noTransactions")}
							afterRows={
								<TableRow id="new-transaction-row" className="bg-muted/50">
									<TableCell className="font-medium text-muted-foreground">
										{tc("new")}
									</TableCell>
									<TableCell>
										<Input
											id="new-transaction-description"
											value={inlineForm.description}
											onChange={(e) =>
												setInlineForm({
													...inlineForm,
													description: e.target.value,
												})
											}
											placeholder={tc("description")}
											className="h-8"
										/>
									</TableCell>
									<TableCell>
										<Select
											value={inlineForm.category}
											onValueChange={(value) =>
												setInlineForm({ ...inlineForm, category: value })
											}
										>
											<SelectTrigger className="h-8">
												<SelectValue placeholder={tc("category")} />
											</SelectTrigger>
											<SelectContent>
												{inlineCategories.map((category) => (
													<SelectItem key={category.id} value={category.name}>
														{category.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell>
										<Select
											value={inlineForm.type}
											onValueChange={(value) =>
												setInlineForm({
													...inlineForm,
													category: "",
													type: value as TransactionType,
												})
											}
										>
											<SelectTrigger className="h-8">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="income">{tc("income")}</SelectItem>
												<SelectItem value="expense">{tc("expense")}</SelectItem>
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatDate(new Date().toISOString(), locale)}
									</TableCell>
									<TableCell>
										<div className="relative">
											<span className="absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground text-sm">
												{locale === "id" ? "Rp" : "$"}
											</span>
											<FormattedNumberInput
												value={inlineForm.amount || null}
												onValueChange={(value) =>
													setInlineForm({
														...inlineForm,
														amount: value ?? 0,
													})
												}
												placeholder="0"
												className="h-8 pl-5"
											/>
										</div>
									</TableCell>
									<TableCell>
										<Select
											value={inlineForm.status}
											onValueChange={(value) =>
												setInlineForm({
													...inlineForm,
													status: value as TransactionStatus,
												})
											}
										>
											<SelectTrigger className="h-8">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="completed">
													{tc("completed")}
												</SelectItem>
												<SelectItem value="pending">{tc("pending")}</SelectItem>
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell>
										<Button
											size="sm"
											onClick={() => void handleAddTransaction()}
											disabled={createMutation.isPending}
										>
											{createMutation.isPending ? (
												<Loader2Icon className="h-4 w-4 animate-spin" />
											) : (
												tc("add")
											)}
										</Button>
									</TableCell>
								</TableRow>
							}
						/>
					)}
				</CardContent>
			</Card>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("addTransaction")}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label htmlFor="create-desc">{tc("description")}</Label>
							<Input
								id="create-desc"
								value={inlineForm.description}
								onChange={(e) =>
									setInlineForm({ ...inlineForm, description: e.target.value })
								}
								className="col-span-3"
							/>
						</div>
						<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label htmlFor="create-type">{tc("type")}</Label>
							<Select
								value={inlineForm.type}
								onValueChange={(value) =>
									setInlineForm({
										...inlineForm,
										category: "",
										type: value as TransactionType,
									})
								}
							>
								<SelectTrigger id="create-type" className="col-span-3">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="income">{tc("income")}</SelectItem>
									<SelectItem value="expense">{tc("expense")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label htmlFor="create-category">{tc("category")}</Label>
							<Select
								value={inlineForm.category}
								onValueChange={(value) =>
									setInlineForm({ ...inlineForm, category: value })
								}
							>
								<SelectTrigger id="create-category" className="col-span-3">
									<SelectValue placeholder={tc("category")} />
								</SelectTrigger>
								<SelectContent>
									{inlineCategories.map((category) => (
										<SelectItem key={category.id} value={category.name}>
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label htmlFor="create-amount">{tc("amount")}</Label>
							<FormattedNumberInput
								id="create-amount"
								value={inlineForm.amount || null}
								onValueChange={(value) =>
									setInlineForm({
										...inlineForm,
										amount: value ?? 0,
									})
								}
								className="col-span-3"
							/>
						</div>
						<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label htmlFor="create-status">{tc("status")}</Label>
							<Select
								value={inlineForm.status}
								onValueChange={(value) =>
									setInlineForm({
										...inlineForm,
										status: value as TransactionStatus,
									})
								}
							>
								<SelectTrigger id="create-status" className="col-span-3">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="completed">{tc("completed")}</SelectItem>
									<SelectItem value="pending">{tc("pending")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="secondary"
							onClick={() => setIsCreateOpen(false)}
						>
							{tc("cancel")}
						</Button>
						<Button
							onClick={handleAddTransaction}
							disabled={createMutation.isPending}
						>
							{createMutation.isPending && (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							)}
							{tc("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isEditOpen}
				onOpenChange={(open) => {
					if (!open) setIsEditOpen(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("editTransaction")}</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							editForm.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<editForm.Field name="description">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="edit-desc">{tc("description")}</Label>
										<div className="col-span-3">
											<Input
												id="edit-desc"
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
							</editForm.Field>
							<editForm.Field name="category">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="edit-cat">{tc("category")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value)}
										>
											<SelectTrigger id="edit-cat" className="col-span-3">
												<SelectValue placeholder={tc("category")} />
											</SelectTrigger>
											<SelectContent>
												{editCategories.map((category) => (
													<SelectItem key={category.id} value={category.name}>
														{category.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</editForm.Field>
							<editForm.Field name="type">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="edit-type">{tc("type")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(v) => {
												field.handleChange(v as TransactionType);
												editForm.setFieldValue("category", "");
											}}
										>
											<SelectTrigger id="edit-type" className="col-span-3">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="income">{tc("income")}</SelectItem>
												<SelectItem value="expense">{tc("expense")}</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</editForm.Field>
							<editForm.Field name="amount">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="edit-amount">{tc("amount")}</Label>
										<div className="col-span-3">
											<FormattedNumberInput
												id="edit-amount"
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
							</editForm.Field>
							<editForm.Field name="status">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="edit-status">{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(v) =>
												field.handleChange(v as TransactionStatus)
											}
										>
											<SelectTrigger id="edit-status" className="col-span-3">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="completed">
													{tc("completed")}
												</SelectItem>
												<SelectItem value="pending">{tc("pending")}</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</editForm.Field>
						</div>
						<DialogFooter>
							<Button variant="secondary" onClick={() => setIsEditOpen(false)}>
								{tc("cancel")}
							</Button>
							<Button type="submit" disabled={updateMutation.isPending}>
								{updateMutation.isPending ? (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								) : null}
								{tc("update")}
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
		</>
	);
}
