"use client";

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
import { FilePenIcon, TrashIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type PlatformUser = RouterOutputs["platformAdminUsers"]["list"][number];

export default function AdminUsersPage() {
	const trpc = useTRPC();
	const {
		data: users = [],
		isLoading,
		error,
	} = useQuery(trpc.platformAdminUsers.list.queryOptions());
	const t = useTranslations("platformAdminUsers");
	const tc = useTranslations("common");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const invalidateKeys = trpc.platformAdminUsers.list.queryOptions().queryKey;

	const userFormSchema = z.object({
		name: z.string().min(1, t("nameRequired")),
		role: z.enum(["user", "admin", "super_admin"]),
		status: z.enum(["active", "inactive", "suspended"]),
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.platformAdminUsers.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => setIsDialogOpen(false),
	});
	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.platformAdminUsers.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	const form = useForm({
		defaultValues: {
			name: "",
			role: "user" as "user" | "admin" | "super_admin",
			status: "active" as "active" | "inactive" | "suspended",
		},
		validators: { onSubmit: userFormSchema },
		onSubmit: ({ value }) => {
			if (editingId) updateMutation.mutate({ id: editingId, ...value });
		},
	});

	const openEdit = (item: PlatformUser) => {
		setEditingId(item.id);
		form.reset();
		form.setFieldValue("name", item.name);
		form.setFieldValue("role", item.role as "user" | "admin" | "super_admin");
		form.setFieldValue(
			"status",
			item.status as "active" | "inactive" | "suspended",
		);
		setIsDialogOpen(true);
	};

	const columns: Column<PlatformUser>[] = [
		{
			key: "name",
			header: tc("name"),
			sortable: true,
			className: "font-medium",
		},
		{ key: "email", header: tc("email"), sortable: true },
		{ key: "role", header: t("role"), sortable: true },
		{ key: "status", header: tc("status"), sortable: true },
		{
			key: "createdAt",
			header: t("createdAt"),
			render: (row) => row.createdAt.toLocaleDateString(),
		},
		{
			key: "subscription",
			header: t("subscription"),
			render: (row) =>
				row.subscription
					? `${row.subscription.plan?.name ?? t("noPlan")} / ${row.subscription.status}`
					: t("none"),
		},
		{
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
		},
	];

	if (isLoading)
		return (
			<Card className="p-6">
				<Skeleton className="h-40 w-full" />
			</Card>
		);
	if (error)
		return (
			<Card>
				<CardContent>
					<p className="text-red-500">{error.message}</p>
				</CardContent>
			</Card>
		);

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<div className="flex items-center gap-2 text-muted-foreground">
					<UsersIcon className="h-5 w-5" />
					<span className="text-sm">
						{t("userCount", { count: users.length })}
					</span>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<DataTable
					data={users}
					columns={columns}
					emptyMessage={t("noUsers")}
					emptyIcon={<UsersIcon className="h-8 w-8" />}
					mobileScroll
					defaultSort={[{ id: "createdAt", desc: true }]}
				/>
			</CardContent>
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("editUser")}</DialogTitle>
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
									<div className="grid gap-2">
										<Label htmlFor="name">{tc("name")}</Label>
										<Input
											id="name"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="role">
								{(field) => (
									<div className="grid gap-2">
										<Label>{t("role")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(
													value as "user" | "admin" | "super_admin",
												)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="user">user</SelectItem>
												<SelectItem value="admin">admin</SelectItem>
												<SelectItem value="super_admin">super_admin</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
							<form.Field name="status">
								{(field) => (
									<div className="grid gap-2">
										<Label>{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(
													value as "active" | "inactive" | "suspended",
												)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">active</SelectItem>
												<SelectItem value="inactive">inactive</SelectItem>
												<SelectItem value="suspended">suspended</SelectItem>
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
								{tc("save")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<DeleteConfirmationDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={() => {
					if (deleteId) deleteMutation.mutate({ id: deleteId });
					setIsDeleteOpen(false);
					setDeleteId(null);
				}}
				description={t("deleteMessage")}
			/>
		</Card>
	);
}
