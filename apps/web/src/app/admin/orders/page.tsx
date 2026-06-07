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
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
	EyeIcon,
	FilePenIcon,
	ShoppingCartIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { readCachedOrders, replaceCachedOrders } from "@/lib/local-db/repo";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Order = RouterOutputs["orders"]["list"][number];
type OrderStatus = "completed" | "pending" | "cancelled";

type PaymentStatus = "paid" | "partial" | "unpaid";

export default function OrdersPage() {
	const trpc = useTRPC();
	const {
		data: remoteOrders = [],
		isLoading,
		error,
	} = useQuery(trpc.orders.list.queryOptions());
	const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
	const orders = remoteOrders.length ? remoteOrders : cachedOrders;
	const showSkeleton = isLoading && cachedOrders.length === 0;
	const t = useTranslations("orders");
	const tc = useTranslations("common");
	const locale = useLocale();

	const orderEditSchema = z.object({
		total: z.string().min(1, t("totalRequired")),
		status: z.enum(["completed", "pending", "cancelled"]),
	});

	const statusFilterOptions: FilterOption[] = [
		{ label: tc("all"), value: "all" },
		{ label: tc("completed"), value: "completed", variant: "success" },
		{ label: tc("pending"), value: "pending", variant: "warning" },
		{ label: tc("cancelled"), value: "cancelled", variant: "danger" },
	];
	const paymentFilterOptions: FilterOption[] = [
		{ label: tc("all"), value: "all" },
		{ label: t("paid"), value: "paid", variant: "success" },
		{ label: t("partial"), value: "partial", variant: "warning" },
		{ label: t("unpaid"), value: "unpaid", variant: "danger" },
	];

	const tableColumns: Column<Order>[] = [
		{
			key: "order_number",
			header: t("orderId"),
			sortable: true,
			accessorFn: (row) => row.order_number ?? `#${row.id}`,
			render: (row) => row.order_number ?? `#${row.id}`,
		},
		{
			key: "customer",
			header: t("customer"),
			sortable: true,
			accessorFn: (row) => row.customer?.name ?? "",
			render: (row) => row.customer?.name ?? "",
		},
		{
			key: "total_amount",
			header: tc("total"),
			sortable: true,
			accessorFn: (row) => row.total_amount,
			render: (row) => formatCurrency(row.total_amount, locale),
		},
		{
			key: "payment_status",
			header: t("paymentStatus"),
			sortable: true,
			render: (row) => {
				const s = row.payment_status as PaymentStatus;
				const color =
					s === "paid"
						? "text-green-600"
						: s === "partial"
							? "text-yellow-600"
							: "text-red-600";
				const label =
					s === "paid"
						? t("paid")
						: s === "partial"
							? t("partial")
							: t("unpaid");
				return <span className={color}>{label}</span>;
			},
		},
		{
			key: "paid_amount",
			header: t("paidAmount"),
			sortable: true,
			hideOnMobile: true,
			accessorFn: (row) => row.paid_amount,
			render: (row) => formatCurrency(row.paid_amount, locale),
		},
		{
			key: "remaining_amount",
			header: t("remainingAmount"),
			sortable: true,
			hideOnMobile: true,
			accessorFn: (row) => row.total_amount - row.paid_amount,
			render: (row) =>
				formatCurrency(Math.max(0, row.total_amount - row.paid_amount), locale),
		},
		{
			key: "note",
			header: t("note") || "Note",
			sortable: true,
			hideOnMobile: true,
			accessorFn: (row) => row.note ?? "",
			render: (row) => (
				<span
					className="inline-block max-w-[150px] truncate"
					title={row.note ?? ""}
				>
					{row.note ?? "—"}
				</span>
			),
		},
		{
			key: "status",
			header: tc("status"),
			sortable: true,
			render: (row) => {
				const s = row.status ?? "pending";
				const color =
					s === "completed"
						? "text-green-600"
						: s === "cancelled"
							? "text-red-600"
							: "text-yellow-600";
				const label =
					s === "completed"
						? tc("completed")
						: s === "cancelled"
							? tc("cancelled")
							: tc("pending");
				return <span className={color}>{label}</span>;
			},
		},
		{
			key: "created_at",
			header: tc("date"),
			sortable: true,
			hideOnMobile: true,
			accessorFn: (row) =>
				row.created_at ? new Date(row.created_at).getTime() : 0,
			render: (row) =>
				row.created_at
					? new Date(row.created_at).toLocaleString(locale, {
							dateStyle: "medium",
							timeStyle: "short",
						})
					: "",
		},
	];

	const exportColumns: ExportColumn<Order>[] = [
		{
			key: "order_number",
			header: t("orderId"),
			getValue: (o) => o.order_number ?? `#${o.id}`,
		},
		{
			key: "customer",
			header: t("customer"),
			getValue: (o) => o.customer?.name ?? "",
		},
		{
			key: "total",
			header: tc("total"),
			getValue: (o) => (o.total_amount / 100).toFixed(2),
		},
		{
			key: "status",
			header: tc("status"),
			getValue: (o) => o.status ?? "pending",
		},
		{
			key: "payment_status",
			header: t("paymentStatus"),
			getValue: (o) => o.payment_status,
		},
		{
			key: "paid_amount",
			header: t("paidAmount"),
			getValue: (o) => (o.paid_amount / 100).toFixed(2),
		},
		{
			key: "remaining_amount",
			header: t("remainingAmount"),
			getValue: (o) =>
				(Math.max(0, o.total_amount - o.paid_amount) / 100).toFixed(2),
		},
		{
			key: "date",
			header: tc("date"),
			getValue: (o) =>
				o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
		},
	];

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [paymentFilter, setPaymentFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [editCustomerName, setEditCustomerName] = useState("");

	useEffect(() => {
		void readCachedOrders<Order>().then(setCachedOrders);
	}, []);

	useEffect(() => {
		void replaceCachedOrders(remoteOrders);
		if (remoteOrders.length || !isLoading) setCachedOrders(remoteOrders);
	}, [remoteOrders, isLoading]);

	const invalidateKeys = trpc.orders.list.queryOptions().queryKey;

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.orders.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => setIsDialogOpen(false),
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.orders.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	const form = useForm({
		defaultValues: { total: "", status: "pending" as OrderStatus },
		validators: {
			onSubmit: orderEditSchema,
		},
		onSubmit: ({ value }) => {
			if (editingId !== null) {
				updateMutation.mutate({
					id: editingId,
					total_amount: Math.round(Number.parseFloat(value.total) * 100),
					status: value.status,
				});
			}
		},
	});

	const filteredOrders = useMemo(() => {
		return orders.filter((o) => {
			if (statusFilter !== "all" && o.status !== statusFilter) return false;
			if (paymentFilter !== "all" && o.payment_status !== paymentFilter)
				return false;
			const q = searchTerm.toLowerCase();
			return (
				(o.customer?.name ?? "").toLowerCase().includes(q) ||
				o.id.toString().includes(searchTerm)
			);
		});
	}, [orders, statusFilter, paymentFilter, searchTerm]);

	const openEdit = (o: Order) => {
		setEditingId(o.id);
		setEditCustomerName(o.customer?.name ?? "");
		form.reset();
		form.setFieldValue("total", (o.total_amount / 100).toString());
		form.setFieldValue("status", (o.status ?? "pending") as OrderStatus);
		setIsDialogOpen(true);
	};

	const handleDelete = () => {
		if (deleteId !== null) {
			deleteMutation.mutate({ id: deleteId });
			setIsDeleteOpen(false);
			setDeleteId(null);
		}
	};

	const actionsColumn: Column<Order> = {
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
				<Link
					href={`/admin/orders/${row.id}`}
					prefetch={false}
					onClick={(e) => e.stopPropagation()}
				>
					<Button size="icon" variant="ghost">
						<EyeIcon className="h-4 w-4" />
						<span className="sr-only">{tc("view")}</span>
					</Button>
				</Link>
			</TableActions>
		),
	};

	if (showSkeleton) {
		return (
			<Card className="flex flex-col gap-6 p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-9 w-32" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	if (error && cachedOrders.length === 0) {
		return (
			<Card>
				<CardContent>
					<p className="text-red-500">{error.message}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<SearchFilter
					search={searchTerm}
					onSearchChange={setSearchTerm}
					searchPlaceholder={t("searchPlaceholder")}
					filters={[
						{
							options: statusFilterOptions,
							value: statusFilter,
							onChange: setStatusFilter,
						},
						{
							options: paymentFilterOptions,
							value: paymentFilter,
							onChange: setPaymentFilter,
						},
					]}
				/>
			</CardHeader>
			<CardContent className="p-0">
				<DataTable
					data={filteredOrders}
					columns={[...tableColumns, actionsColumn]}
					mobileScroll
					onRowClick={(row) => {
						window.location.href = `/admin/orders/${row.id}`;
					}}
					exportColumns={exportColumns}
					exportFilename="orders"
					emptyMessage={t("noOrders")}
					emptyIcon={<ShoppingCartIcon className="h-8 w-8" />}
					defaultSort={[{ id: "created_at", desc: true }]}
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
						<DialogTitle>{t("editOrder")}</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
								<Label htmlFor="customerName">{t("customer")}</Label>
								<Input
									id="customerName"
									value={editCustomerName}
									disabled
									className="col-span-3"
								/>
							</div>
							<form.Field name="total">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="total">{tc("total")}</Label>
										<div className="col-span-3">
											<FormattedNumberInput
												id="total"
												value={Number(field.state.value || 0)}
												onValueChange={(value) =>
													field.handleChange(String(value ?? 0))
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
							<form.Field name="status">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="status">{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as OrderStatus)
											}
										>
											<SelectTrigger id="status" className="col-span-3">
												<SelectValue placeholder={t("selectStatus")} />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="completed">
													{tc("completed")}
												</SelectItem>
												<SelectItem value="pending">{tc("pending")}</SelectItem>
												<SelectItem value="cancelled">
													{tc("cancelled")}
												</SelectItem>
											</SelectContent>
										</Select>
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
							<Button type="submit" disabled={updateMutation.isPending}>
								{t("updateOrder")}
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
