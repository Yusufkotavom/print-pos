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
import {
	CreditCardIcon,
	FilePenIcon,
	PlusCircleIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type PlatformUser = RouterOutputs["platformAdminUsers"]["list"][number];

const toDateTimeInput = (date: Date) => date.toISOString().slice(0, 16);
const addDays = (date: Date, days: number) => {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
};

export default function AdminUsersPage() {
	const trpc = useTRPC();
	const {
		data: users = [],
		isLoading,
		error,
	} = useQuery(trpc.platformAdminUsers.list.queryOptions());
	const { data: plans = [] } = useQuery(
		trpc.platformSubscriptions.listPlans.queryOptions(),
	);
	const t = useTranslations("platformAdminUsers");
	const tc = useTranslations("common");
	const ts = useTranslations("platformSubscriptions");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [isSubOpen, setIsSubOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingSubUser, setEditingSubUser] = useState<PlatformUser | null>(
		null,
	);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const invalidateKeys = trpc.platformAdminUsers.list.queryOptions().queryKey;

	const userFormSchema = z.object({
		name: z.string().min(1, t("nameRequired")),
		email: z.email(t("emailRequired")),
		password: z.string(),
		role: z.enum(["user", "admin", "super_admin"]),
		status: z.enum(["active", "inactive", "suspended"]),
	});

	const subSchema = z.object({
		planId: z.string(),
		status: z.enum(["active", "paused", "expired", "cancelled"]),
		currentPeriodStart: z.string().min(1),
		currentPeriodEnd: z.string().min(1),
	});

	const createMutation = useCrudMutation({
		mutationOptions: trpc.platformAdminUsers.create.mutationOptions(),
		invalidateKeys,
		successMessage: t("created"),
		errorMessage: t("createError"),
		onSuccess: () => setIsDialogOpen(false),
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

	const createSubMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.createSubscription.mutationOptions(),
		invalidateKeys,
		successMessage: ts("subscriptionCreated"),
		errorMessage: ts("subscriptionError"),
	});
	const updateSubMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.updateSubscription.mutationOptions(),
		invalidateKeys,
		successMessage: ts("subscriptionUpdated"),
		errorMessage: ts("subscriptionError"),
	});

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			role: "user" as "user" | "admin" | "super_admin",
			status: "active" as "active" | "inactive" | "suspended",
		},
		validators: { onSubmit: userFormSchema },
		onSubmit: ({ value }) => {
			if (editingId) {
				updateMutation.mutate({
					id: editingId,
					name: value.name,
					role: value.role,
					status: value.status,
				});
				return;
			}
			if (value.password.length < 8) return;
			createMutation.mutate({
				name: value.name,
				email: value.email,
				password: value.password,
				role: value.role,
				status: value.status,
			});
		},
	});

	const subForm = useForm({
		defaultValues: {
			planId: "none",
			status: "active" as "active" | "paused" | "expired" | "cancelled",
			currentPeriodStart: "",
			currentPeriodEnd: "",
		},
		validators: { onSubmit: subSchema },
		onSubmit: ({ value }) => {
			if (!editingSubUser) return;
			const payload = {
				userId: editingSubUser.id,
				planId: value.planId === "none" ? null : Number(value.planId),
				status: value.status,
				currentPeriodStart: new Date(value.currentPeriodStart),
				currentPeriodEnd: new Date(value.currentPeriodEnd),
				cancelAtPeriodEnd: false,
				cancelledAt: null,
			};
			if (editingSubUser.subscription) {
				updateSubMutation.mutate({
					id: editingSubUser.subscription.id,
					...payload,
				});
			} else {
				createSubMutation.mutate(payload);
			}
			setIsSubOpen(false);
		},
	});

	const openCreate = () => {
		setEditingId(null);
		form.reset();
		form.setFieldValue("role", "user");
		form.setFieldValue("status", "active");
		setIsDialogOpen(true);
	};

	const openEdit = (item: PlatformUser) => {
		setEditingId(item.id);
		form.reset();
		form.setFieldValue("name", item.name);
		form.setFieldValue("email", item.email);
		form.setFieldValue("password", "");
		form.setFieldValue("role", item.role as "user" | "admin" | "super_admin");
		form.setFieldValue(
			"status",
			item.status as "active" | "inactive" | "suspended",
		);
		setIsDialogOpen(true);
	};

	const openSubEdit = (user: PlatformUser) => {
		setEditingSubUser(user);
		subForm.reset();
		if (user.subscription) {
			subForm.setFieldValue(
				"planId",
				user.subscription.plan ? String(user.subscription.plan.id) : "none",
			);
			subForm.setFieldValue(
				"status",
				user.subscription.status as "active" | "paused" | "expired" | "cancelled",
			);
			subForm.setFieldValue(
				"currentPeriodStart",
				toDateTimeInput(new Date()),
			);
			subForm.setFieldValue(
				"currentPeriodEnd",
				toDateTimeInput(user.subscription.currentPeriodEnd),
			);
		} else {
			const now = new Date();
			subForm.setFieldValue("planId", "none");
			subForm.setFieldValue("status", "active");
			subForm.setFieldValue("currentPeriodStart", toDateTimeInput(now));
			subForm.setFieldValue("currentPeriodEnd", toDateTimeInput(addDays(now, 30)));
		}
		setIsSubOpen(true);
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
						onClick={() => openSubEdit(row)}
						icon={<CreditCardIcon className="h-4 w-4" />}
						label={ts("editSubscription")}
					/>
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
			<CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 space-y-0 p-0 pb-2">
				<div className="flex items-center gap-2 text-muted-foreground">
					<UsersIcon className="h-5 w-5" />
					<span className="text-sm">
						{t("userCount", { count: users.length })}
					</span>
				</div>
				<Button size="sm" className="w-full sm:w-auto" onClick={openCreate}>
					<PlusCircleIcon className="mr-2 h-4 w-4" />
					{t("addUser")}
				</Button>
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
						<DialogTitle>
							{editingId ? t("editUser") : t("addUser")}
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
							<form.Field name="email">
								{(field) => (
									<div className="grid gap-2">
										<Label htmlFor="email">{tc("email")}</Label>
										<Input
											id="email"
											type="email"
											value={field.state.value}
											disabled={Boolean(editingId)}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</div>
								)}
							</form.Field>
							{!editingId ? (
								<form.Field name="password">
									{(field) => (
										<div className="grid gap-2">
											<Label htmlFor="password">{tc("password")}</Label>
											<Input
												id="password"
												type="password"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										</div>
									)}
								</form.Field>
							) : null}
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
			<Dialog open={isSubOpen} onOpenChange={setIsSubOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{ts("editSubscription")}</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							subForm.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<subForm.Field name="planId">
								{(field) => (
									<div className="grid gap-2">
										<Label>{ts("plan")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(val) => {
												field.handleChange(val);
												const selectedPlan = plans.find((p) => String(p.id) === val);
												if (selectedPlan) {
													const startStr = subForm.getFieldValue("currentPeriodStart");
													const start = startStr ? new Date(startStr) : new Date();
													if (selectedPlan.interval === "month") {
														subForm.setFieldValue("currentPeriodEnd", toDateTimeInput(addDays(start, 30)));
													} else if (selectedPlan.interval === "year") {
														subForm.setFieldValue("currentPeriodEnd", toDateTimeInput(addDays(start, 365)));
													} else if (selectedPlan.interval === "lifetime") {
														subForm.setFieldValue("currentPeriodEnd", toDateTimeInput(addDays(start, 36500)));
													}
												}
											}}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">{ts("noPlan")}</SelectItem>
												{plans.map((p) => (
													<SelectItem key={p.id} value={String(p.id)}>
														{p.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</subForm.Field>
							<subForm.Field name="status">
								{(field) => (
									<div className="grid gap-2">
										<Label>{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={field.handleChange}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">active</SelectItem>
												<SelectItem value="paused">paused</SelectItem>
												<SelectItem value="expired">expired</SelectItem>
												<SelectItem value="cancelled">cancelled</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</subForm.Field>
							<subForm.Field name="currentPeriodEnd">
								{(field) => (
									<div className="grid gap-2">
										<Label>{ts("periodEnd")}</Label>
										<Input
											type="datetime-local"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</div>
								)}
							</subForm.Field>
						</div>
						<DialogFooter>
							<Button
								variant="secondary"
								type="button"
								onClick={() => setIsSubOpen(false)}
							>
								{tc("cancel")}
							</Button>
							<Button type="submit">{tc("save")}</Button>
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
