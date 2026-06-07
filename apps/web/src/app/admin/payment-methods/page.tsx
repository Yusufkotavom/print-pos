"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
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
import {
	CreditCardIcon,
	FilePenIcon,
	PlusCircle,
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
	readCachedPaymentMethods,
	removeCachedPaymentMethod,
	replaceCachedPaymentMethods,
	upsertCachedPaymentMethod,
} from "@/lib/local-db/repo";
import { syncReadyQueue } from "@/lib/local-db/sync-engine";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/router";

type PaymentMethod = RouterOutputs["paymentMethods"]["list"][number];
type PaymentMethodCreateInput = RouterInputs["paymentMethods"]["create"];
type PaymentMethodUpdateInput = RouterInputs["paymentMethods"]["update"];

export default function PaymentMethodsPage() {
	const trpc = useTRPC();
	const {
		data: remoteMethods = [],
		isLoading,
		error,
	} = useQuery(trpc.paymentMethods.list.queryOptions());
	const [cachedMethods, setCachedMethods] = useState<PaymentMethod[]>([]);
	const hasCachedMethods = cachedMethods.length > 0;
	const methods =
		(isLoading || error) && hasCachedMethods ? cachedMethods : remoteMethods;
	const t = useTranslations("paymentMethods");
	const tc = useTranslations("common");
	const isOnline = useOnlineStatus();
	const isOfflineMode = !isOnline || !!error;

	useEffect(() => {
		void readCachedPaymentMethods<PaymentMethod>().then(setCachedMethods);
	}, []);

	useEffect(() => {
		if (isLoading || error) return;
		setCachedMethods(remoteMethods);
		void replaceCachedPaymentMethods(remoteMethods);
	}, [remoteMethods, error, isLoading]);

	const paymentMethodSchema = z.object({
		name: z.string().min(1, t("nameRequired")),
	});

	const tableColumns: Column<PaymentMethod>[] = [
		{
			key: "name",
			header: tc("name"),
			sortable: true,
			className: "font-medium",
		},
	];

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);

	const isEditing = editingId !== null;
	const invalidateKeys = trpc.paymentMethods.list.queryOptions().queryKey;

	const createMutation = useCrudMutation({
		mutationOptions: trpc.paymentMethods.create.mutationOptions(),
		invalidateKeys,
		successMessage: t("created"),
		errorMessage: t("createError"),
		onSuccess: () => setIsDialogOpen(false),
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.paymentMethods.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => setIsDialogOpen(false),
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.paymentMethods.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	useEffect(() => {
		if (!isOnline) return;
		void syncReadyQueue({
			createPaymentMethod: (payload) =>
				createMutation.mutateAsync(payload as PaymentMethodCreateInput),
			updatePaymentMethod: (payload) =>
				updateMutation.mutateAsync(payload as PaymentMethodUpdateInput),
			deletePaymentMethod: (payload) =>
				deleteMutation.mutateAsync(payload as { id: number }),
		});
	}, [createMutation, deleteMutation, isOnline, updateMutation]);

	const buildOptimisticMethod = (id: number, name: string) =>
		({
			id,
			name,
			user_uid: methods.find((item) => item.id === id)?.user_uid ?? "local",
			created_at:
				methods.find((item) => item.id === id)?.created_at ?? new Date(),
		}) satisfies PaymentMethod;

	const form = useForm({
		defaultValues: { name: "" },
		validators: {
			onSubmit: paymentMethodSchema,
		},
		onSubmit: async ({ value }) => {
			if (isOfflineMode) {
				if (isEditing) {
					const nextMethod = buildOptimisticMethod(editingId, value.name);
					await upsertCachedPaymentMethod(nextMethod);
					setCachedMethods((current) =>
						current
							.map((item) => (item.id === editingId ? nextMethod : item))
							.sort((a, b) => a.name.localeCompare(b.name)),
					);
					await enqueueSyncItem({
						id: `paymentMethod:update:${editingId}`,
						entity: "paymentMethod",
						operation: "update",
						payload: { id: editingId, name: value.name },
						status: "pending",
						retryCount: 0,
					});
				} else {
					const localId = -Date.now();
					const nextMethod = buildOptimisticMethod(localId, value.name);
					await upsertCachedPaymentMethod(nextMethod);
					setCachedMethods((current) =>
						[...current, nextMethod].sort((a, b) =>
							a.name.localeCompare(b.name),
						),
					);
					await enqueueSyncItem({
						id: `paymentMethod:create:${localId}`,
						entity: "paymentMethod",
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
			if (isEditing) {
				updateMutation.mutate({ id: editingId, name: value.name });
			} else {
				createMutation.mutate({ name: value.name });
			}
		},
	});

	const openCreate = () => {
		setEditingId(null);
		form.reset();
		setIsDialogOpen(true);
	};

	const openEdit = (m: PaymentMethod) => {
		setEditingId(m.id);
		form.reset();
		form.setFieldValue("name", m.name);
		setIsDialogOpen(true);
	};

	const handleDelete = async () => {
		if (deleteId !== null) {
			if (isOfflineMode) {
				await removeCachedPaymentMethod(deleteId);
				setCachedMethods((current) =>
					current.filter((item) => item.id !== deleteId),
				);
				await enqueueSyncItem({
					id: `paymentMethod:delete:${deleteId}`,
					entity: "paymentMethod",
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

	const actionsColumn: Column<PaymentMethod> = {
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
	};

	if (isLoading && methods.length === 0) {
		return (
			<Card className="flex flex-col gap-6 p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-9 w-28" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-8 w-20" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-muted-foreground">
						<CreditCardIcon className="h-5 w-5" />
						<span className="text-sm">
							{t("methodCount", { count: methods.length })}
						</span>
						{isOfflineMode ? (
							<Badge variant="secondary">Offline cache</Badge>
						) : null}
					</div>
					<Button size="sm" onClick={openCreate}>
						<PlusCircle className="mr-2 h-4 w-4" />
						{t("addMethod")}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				{isOfflineMode ? (
					<div className="mb-3 text-muted-foreground text-sm">
						Offline changes queued for sync.
					</div>
				) : null}
				<DataTable
					data={methods}
					columns={[...tableColumns, actionsColumn]}
					emptyMessage={t("noMethods")}
					emptyIcon={<CreditCardIcon className="h-8 w-8" />}
					defaultSort={[{ id: "name", desc: false }]}
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
							{isEditing ? t("editMethod") : t("newMethod")}
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
										<Label htmlFor="method-name">{tc("name")}</Label>
										<div className="col-span-3">
											<Input
												id="method-name"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												placeholder={t("namePlaceholder")}
												error={
													field.state.meta.errors.length > 0
														? field.state.meta.errors
																.map((e) => e?.message ?? e)
																.join(", ")
														: undefined
												}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														form.handleSubmit();
													}
												}}
											/>
										</div>
									</div>
								)}
							</form.Field>
						</div>
						<DialogFooter>
							<Button
								variant="secondary"
								onClick={() => setIsDialogOpen(false)}
							>
								{tc("cancel")}
							</Button>
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
										{isEditing ? tc("update") : tc("create")}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<DeleteConfirmationDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={() => void handleDelete()}
				description={t("deleteMessage")}
			/>
		</Card>
	);
}
